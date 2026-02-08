"use client";

import { useEffect, useMemo, useState } from "react";
import disciplines from "../../../disciplines.json";
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
  calculateDisciplineRating,
  calculateOverallRating,
} from "@/lib/ratings";
import { getAllCloudResults, getAllCloudProfiles } from "@/lib/cloudSync";
import { useAuth } from "@/components/AuthProvider";

export default function RatingsPage() {
  const { user: authUser, loading: authLoading } = useAuth();
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
  const [isCloudData, setIsCloudData] = useState(false);
  const [debug, setDebug] = useState({ profiles: 0, results: 0, lastFetch: "" });

  const loadData = async () => {
    // 1. Try cloud if logged in
    if (authUser) {
      try {
        const [cloudProfiles, cloudResults] = await Promise.all([
          getAllCloudProfiles(),
          getAllCloudResults()
        ]);

        setDebug({
          profiles: cloudProfiles.length,
          results: cloudResults.length,
          lastFetch: new Date().toLocaleTimeString()
        });

        if (cloudProfiles.length > 0) {
          const mappedUsers: User[] = cloudProfiles.map(p => ({
            id: p.id,
            name: p.name,
            role: p.role as any,
            avatar: p.avatar || undefined,
            avatarType: p.avatar_type as any
          }));

          const mappedStore: HistoryStore = {};
          cloudResults.forEach(r => {
            if (!mappedStore[r.user_id]) mappedStore[r.user_id] = {};
            if (!mappedStore[r.user_id][r.discipline_slug]) {
              mappedStore[r.user_id][r.discipline_slug] = [];
            }
            mappedStore[r.user_id][r.discipline_slug].push({
              ts: r.recorded_at,
              value: Number(r.value)
            });
          });

          setUsers(mappedUsers);
          setStore(mappedStore);
          setActiveUserId(authUser.id);
          setIsCloudData(true);
          return; // Success, exit
        }
      } catch (err) {
        console.error("Cloud ratings error:", err);
      }
    }

    // 2. Fallback to local
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
    setIsCloudData(false);
  };

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authUser, authLoading]);

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
    <div className="pb-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black italic uppercase text-white leading-none mb-2">
          Зал <span className="text-[var(--accent-primary)]">Славы</span>
        </h1>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] border-l border-zinc-800 pl-3">
          Глобальный рейтинг атлетов {isCloudData && "(Облако подключено)"}
        </p>
      </div>

      {/* Общий рейтинг */}
      <section className="mb-10 bg-zinc-900/30 border border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h2 className="text-xs font-black uppercase italic tracking-widest text-zinc-400">Общий рейтинг</h2>
          <span className="text-[10px] font-mono text-zinc-600 uppercase">{users.length} участников</span>
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
                  className={`${row.userId === activeUserId ? "bg-[var(--accent-primary)]/5" : ""} border-b border-white/5 last:border-0`}
                >
                  <td className="font-medium">
                    {row.place > 0 ? (
                      <>
                        {row.place === 1 && "🥇"}
                        {row.place === 2 && "🥈"}
                        {row.place === 3 && "🥉"}
                        {row.place > 3 && `#${row.place}`}
                      </>
                    ) : "—"}
                  </td>
                  <td>{row.userName}</td>
                  <td className="text-right font-mono">{row.points || 0}</td>
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
                            #{myRow.place} • {myRow.value !== null ? (Number.isInteger(myRow.value) ? myRow.value : myRow.value.toFixed(2)) : "—"} {d.unit ?? ""}
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
                            {row.userName}: {row.value !== null ? (Number.isInteger(row.value) ? row.value : row.value.toFixed(2)) : "—"}
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

      {/* System Debug */}
      <div className="mt-12 p-4 border-t border-white/5 opacity-50 text-[10px] font-mono">
        <div className="flex justify-between items-center mb-2">
          <span className="uppercase tracking-widest text-zinc-500 font-bold">Системная отладка</span>
          <button onClick={loadData} className="px-2 py-0.5 border border-zinc-700 rounded hover:bg-zinc-800 transition-colors">
            [ОТЛАДКА: Обновить]
          </button>
        </div>
        <pre className="text-zinc-400">
          Облако: {isCloudData ? "Активно" : "Отключено"}{"\n"}
          Пользователь: {authUser?.email || "гость"}{"\n"}
          Локальный ID: {activeUserId}{"\n"}
          Облачный ID: {authUser?.id || "нет"}{"\n"}
          Профилей: {debug.profiles}{"\n"}
          Записей: {debug.results}{"\n"}
          Обновлено: {debug.lastFetch || "никогда"}
        </pre>
      </div>
    </div>
  );
}
