"use client";

import { useEffect, useMemo, useState } from "react";
import disciplines from "../../../../disciplines.json";
import {
  User,
  loadUsers,
  saveUsers,
  loadActiveUserId,
  saveActiveUserId,
  createUser,
} from "@/lib/users";
import { HistoryStore, loadHistoryStore, getLatest, HistoryItem } from "@/lib/results";
import {
  Discipline,
  DisciplineRow,
  OverallRow,
  calculateDisciplineRating,
  calculateOverallRating,
} from "@/lib/ratings";

export default function RatingsPage() {
  const list = disciplines as Discipline[];

  const grouped = useMemo(() => {
    return list.reduce<Record<string, Discipline[]>>((acc, d) => {
      (acc[d.category] ||= []).push(d);
      return acc;
    }, {});
  }, [list]);

  // Фиксированный порядок категорий (как на странице Результаты)
  const CATEGORY_ORDER = ["Сила", "Статика", "Навыки", "Выносливость", "Бег", "Подвижность"];

  const categories = useMemo(
    () => CATEGORY_ORDER.filter(cat => grouped[cat]),
    [grouped]
  );

  const [users, setUsers] = useState<User[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [store, setStore] = useState<HistoryStore>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    let u = loadUsers();
    if (u.length === 0) {
      const created = createUser("User 1");
      u = [created];
      saveUsers(u);
    }
    setUsers(u);

    const savedActive = loadActiveUserId();
    const initialActive = savedActive && u.some((x) => x.id === savedActive) ? savedActive : u[0].id;
    setActiveUserId(initialActive);
    saveActiveUserId(initialActive);

    const s = loadHistoryStore(initialActive);
    setStore(s);
  }, []);

  const latest = useMemo(() => {
    const out: Record<string, Record<string, HistoryItem | null>> = {};
    for (const u of users) {
      const uh = store[u.id] ?? {};
      const bySlug: Record<string, HistoryItem | null> = {};
      for (const d of list) bySlug[d.slug] = getLatest(uh[d.slug]);
      out[u.id] = bySlug;
    }
    return out;
  }, [users, store, list]);

  const { standingsBySlug, overallRows } = useMemo(() => {
    const bySlug: Record<string, DisciplineRow[]> = {};

    for (const d of list) {
      const ranking = calculateDisciplineRating(d, users, store);
      ranking.sort((a, b) => {
        const ap = a.place ?? 1e9;
        const bp = b.place ?? 1e9;
        if (ap !== bp) return ap - bp;
        return a.userName.localeCompare(b.userName, "ru");
      });
      bySlug[d.slug] = ranking;
    }

    const overall = calculateOverallRating(list, users, store);

    return { standingsBySlug: bySlug, overallRows: overall };
  }, [users, list, store]);

  return (
    <main>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🏆 Рейтинги</h1>
          <p className="page-subtitle">Сравнение результатов участников</p>
        </div>
      </div>

      {/* Общий рейтинг */}
      <section className="card mb-6">
        <div className="card-header">
          <h2 className="card-title">Общий рейтинг</h2>
          <span className="badge badge-primary">{users.length} участников</span>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="w-16">Место</th>
                <th>Участник</th>
                <th className="text-right">Очки</th>
              </tr>
            </thead>
            <tbody>
              {overallRows.map((row) => (
                <tr
                  key={row.userId}
                  className={row.userId === activeUserId ? "bg-[var(--accent-primary)]/10" : ""}
                >
                  <td className="font-medium">
                    {row.place === 1 && "🥇"}
                    {row.place === 2 && "🥈"}
                    {row.place === 3 && "🥉"}
                    {row.place && row.place > 3 && `#${row.place}`}
                    {!row.place && "—"}
                  </td>
                  <td>{row.userName}</td>
                  <td className="text-right font-mono">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Рейтинги по категориям */}
      <div className="grid gap-6">
        {categories.map((category) => (
          <section key={category} className="card">
            <div
              className="card-header cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
              onClick={() => {
                setExpandedCategories(prev => {
                  const next = new Set(prev);
                  if (next.has(category)) {
                    next.delete(category);
                  } else {
                    next.add(category);
                  }
                  return next;
                });
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm transition-transform" style={{ transform: expandedCategories.has(category) ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                <h2 className="card-title">{category}</h2>
              </div>
              <span className="badge">{grouped[category].length} дисциплин</span>
            </div>

            {expandedCategories.has(category) && (
              <div className="divide-y divide-[var(--border-default)]">
                {grouped[category].map((d) => {
                  const rows = standingsBySlug[d.slug] ?? [];
                  const myRow = rows.find((r) => r.userId === activeUserId);

                  return (
                    <div key={d.slug} className="p-4">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="font-medium">{d.name}</div>
                        {myRow && myRow.place && (
                          <span className="badge badge-success">
                            #{myRow.place} • {myRow.value} {d.unit ?? ""}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {rows.slice(0, 5).map((row) => (
                          <div
                            key={row.userId}
                            className={`px-3 py-1.5 rounded-lg text-sm ${row.userId === activeUserId
                              ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]"
                              : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                              }`}
                          >
                            <span className="font-medium">
                              {row.place === 1 && "🥇"}
                              {row.place === 2 && "🥈"}
                              {row.place === 3 && "🥉"}
                              {row.place && row.place > 3 && `#${row.place}`}
                            </span>{" "}
                            {row.userName}: {row.value ?? "—"}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
