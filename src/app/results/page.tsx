"use client";

import { useEffect, useMemo, useState } from "react";
import disciplines from "../../../disciplines.json";
import {
  User,
  loadUsers,
  loadActiveUserId,
  saveActiveUserId,
  saveUsers,
  isAdmin,
  canAddResultsFor,
} from "@/lib/users";
import {
  HistoryStore,
  HistoryBySlug,
  HistoryItem,
  loadHistoryStore,
  saveHistoryStore,
  getLatest,
  addResult,
  formatUtc,
} from "@/lib/results";
import {
  getAllCloudResults,
  getCloudProfile,
  getAllCloudProfiles,
  CloudResult,
  type CloudProfile
} from "@/lib/cloudSync";
import {
  parseTimeToSeconds,
  formatSecondsToTime,
  shouldUseTimeInput,
} from "@/lib/timeUtils";

type Discipline = {
  slug: string;
  category: string;
  name: string;
  unit?: string;
  direction?: "lower_better" | "higher_better";
  stat?: string;
  has1RM?: boolean;
  icon?: string;
};

import { addCloudResult } from "@/lib/cloudSync";
import { useAuth } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function ResultsPage() {
  return (
    <ProtectedRoute>
      <ResultsContent />
    </ProtectedRoute>
  );
}

function ResultsContent() {
  const list = disciplines as Discipline[];

  const grouped = useMemo(() => {
    return list.reduce<Record<string, Discipline[]>>((acc, d) => {
      (acc[d.category] ||= []).push(d);
      return acc;
    }, {});
  }, [list]);

  // Фиксированный порядок категорий
  const CATEGORY_ORDER = ["Сила", "Статика", "Навыки", "Выносливость", "Бег", "Подвижность"];

  const categories = useMemo(
    () => CATEGORY_ORDER.filter(cat => grouped[cat]),
    [grouped]
  );

  const [users, setUsers] = useState<User[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [targetUserId, setTargetUserId] = useState<string>("");

  const [store, setStore] = useState<HistoryStore>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const { user: authUser, loading: authLoading } = useAuth();

  const activeUser = users.find((u) => u.id === activeUserId);
  const targetUser = users.find((u) => u.id === targetUserId);
  const isCurrentUserAdmin = isAdmin(activeUser);
  const canAddResults = canAddResultsFor(activeUser, targetUserId);

  const history: HistoryBySlug = store[targetUserId] ?? {};

  useEffect(() => {
    let u = loadUsers();

    // Если мы авторизованы, убеждаемся, что пользователь есть в списке
    if (authUser && !authLoading) {
      getCloudProfile(authUser.id).then(async (profile) => {
        let currentList = loadUsers();

        // 1. Update current user in list
        const role = (profile?.role === 'admin') ? 'admin' : 'user';
        const name = profile?.name || authUser.user_metadata?.name || "Пользователь";

        // Remove duplicates of current authUser if any existed incorrectly
        // currentList = currentList.filter(u => u.id !== authUser.id);

        let currentUser = currentList.find(x => x.id === authUser.id);
        if (currentUser) {
          currentUser.role = role;
          currentUser.name = name;
        } else {
          currentUser = {
            id: authUser.id,
            name: name,
            email: authUser.email,
            role: role,
            avatarType: "emoji",
            measurements: []
          };
          currentList.push(currentUser);
        }

        // 2. If Admin, fetch ALL profiles
        if (role === 'admin') {
          try {
            const allProfiles = await getAllCloudProfiles();
            allProfiles.forEach((p: CloudProfile) => {
              const existing = currentList.find(u => u.id === p.id);
              if (!existing) {
                currentList.push({
                  id: p.id,
                  name: p.name,
                  role: p.role as any,
                  avatarType: (p.avatar_type as any) || "emoji",
                  measurements: []
                });
              } else {
                // Sync details
                existing.name = p.name;
                existing.role = p.role as any;
              }
            });
          } catch (err) {
            console.error("Failed to load all profiles", err);
          }
        }

        // 3. Deduplicate invalid entries (fallback)
        const uniqueMap = new Map();
        currentList.forEach(u => uniqueMap.set(u.id, u));
        const dedupedList = Array.from(uniqueMap.values());

        saveUsers(dedupedList);
        setUsers(dedupedList);
      });
    }

    if (u.length === 0) return;

    setUsers(u);

    const savedActive = loadActiveUserId();
    // Если есть авторизованный пользователь, приоритет ему
    // Если есть авторизованный пользователь, приоритет ему
    const initialActive =
      authUser ? authUser.id :
        (savedActive && u.some((x) => x.id === savedActive) ? savedActive : u[0].id);

    setActiveUserId(initialActive);
    setTargetUserId(initialActive);
    saveActiveUserId(initialActive);
  }, [authUser, authLoading]);

  // Load Data Effect (Local + Cloud)
  useEffect(() => {
    const loadToStore = async () => {
      // 1. Initial Load from LocalStorage (for active user, or ideally all known history if structure allowed, 
      // but loadHistoryStore currently loads everything from the single key if it's migrated, 
      // actually loadHistoryStore loads ALL history from LS key 'trainingBaza:history:v2')
      // Wait, loadHistoryStore argument 'defaultUserId' is only used for migration. 
      // It returns the WHOLE store.
      const currentStore = loadHistoryStore(activeUserId || "guest");

      // 2. Cloud Data (if authenticated)
      if (authUser) {
        try {
          const cloudResults = await getAllCloudResults();
          cloudResults.forEach((r: CloudResult) => {
            if (!currentStore[r.user_id]) currentStore[r.user_id] = {};
            if (!currentStore[r.user_id][r.discipline_slug]) {
              currentStore[r.user_id][r.discipline_slug] = [];
            }
            const exists = currentStore[r.user_id][r.discipline_slug].some(
              (local: HistoryItem) => local.ts === r.recorded_at && local.value === Number(r.value)
            );
            if (!exists) {
              currentStore[r.user_id][r.discipline_slug].push({
                ts: r.recorded_at,
                value: Number(r.value),
              });
            }
          });
        } catch (err) {
          console.error("Failed to load cloud results in Results:", err);
        }
      }

      setStore(currentStore);
    };

    loadToStore();
  }, [authUser]); // Reload if auth changes

  // Update form values when Store OR TargetUser changes
  useEffect(() => {
    if (!targetUserId) return;

    const h = store[targetUserId] ?? {};
    const nextValues: Record<string, string> = {};
    for (const d of list) {
      const last = getLatest(h[d.slug]);
      if (last) {
        if (shouldUseTimeInput(d.unit ?? "", d.direction ?? "higher_better")) {
          nextValues[d.slug] = formatSecondsToTime(last.value);
        } else {
          nextValues[d.slug] = String(last.value);
        }
      }
    }
    setValues(nextValues);
  }, [targetUserId, store, list]);

  const commitValue = (slug: string, rawValue: string) => {
    if (!canAddResults) return;

    const d = list.find((x) => x.slug === slug);
    if (!d) return;

    let numericValue: number | null = null;

    if (shouldUseTimeInput(d.unit ?? "", d.direction ?? "higher_better")) {
      numericValue = parseTimeToSeconds(rawValue);
    } else {
      // Заменяем запятую на точку для русской локали
      const normalizedValue = rawValue.replace(",", ".");
      const parsed = parseFloat(normalizedValue);
      if (!isNaN(parsed)) {
        numericValue = parsed;
      }
    }

    if (numericValue === null) return;

    // 1. Update Local
    setStore((prev) => {
      const next = addResult(prev, targetUserId, slug, numericValue as number);
      saveHistoryStore(next);
      return next;
    });

    // 2. Update Cloud if enabled
    if (authUser && (targetUserId === authUser.id || isCurrentUserAdmin)) {
      addCloudResult({
        user_id: targetUserId,
        discipline_slug: slug,
        value: numericValue as number,
        recorded_at: new Date().toISOString()
      }).catch(err => console.error("Cloud sync failed:", err));
    }
  };

  const switchTargetUser = (id: string) => {
    setTargetUserId(id);
  };

  return (
    <main>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Результаты</h1>
          <p className="page-subtitle">
            {isCurrentUserAdmin
              ? "Введите результаты атлетов"
              : "Введите ваши личные рекорды"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Селектор пользователя — только для админа */}
          {isCurrentUserAdmin ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-secondary)]">Атлет:</span>
              <select
                className="select"
                value={targetUserId}
                onChange={(e) => switchTargetUser(e.target.value)}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.role === "admin" ? "👑" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-secondary)]">Вы:</span>
              <span className="font-medium">{activeUser?.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Уведомление о режиме */}
      {isCurrentUserAdmin && targetUserId !== activeUserId && (
        <div className="card p-3 mb-6 border-[var(--accent-warning)] bg-[var(--accent-warning)]/10">
          <p className="text-sm text-[var(--accent-warning)]">
            👁 Редактирование результатов: <strong>{targetUser?.name}</strong>
          </p>
        </div>
      )}

      {/* Категории дисциплин */}
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
              <span className="badge">{grouped[category].length}</span>
            </div>

            {expandedCategories.has(category) && (
              <div className="discipline-list">
                {grouped[category].map((d) => {
                  const h = history[d.slug] ?? [];
                  const last = getLatest(h);
                  const isTimeInput = shouldUseTimeInput(d.unit ?? "", d.direction ?? "higher_better");

                  return (
                    <div key={d.slug} className="discipline-row">
                      <span className="discipline-icon shrink-0">{d.icon ?? "📌"}</span>

                      <div className="discipline-info min-w-0 pr-2 flex-1">
                        <div className="discipline-name leading-snug mb-0.5 text-sm font-medium text-white">{d.name}</div>
                        <div className="discipline-value text-[10px] text-zinc-500">
                          {last ? (
                            <div className="flex flex-wrap gap-x-2">
                              <span className="text-zinc-300">
                                {isTimeInput
                                  ? formatSecondsToTime(last.value)
                                  : `${last.value} ${d.unit ?? ""}`}
                              </span>
                              <span className="opacity-40">• {formatUtc(last.ts)}</span>
                            </div>
                          ) : (
                            <span className="italic opacity-50">Нет данных</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          className={`input input-sm text-center font-mono ${isTimeInput ? 'w-24' : 'w-20'}`}
                          type="text"
                          inputMode={isTimeInput ? "text" : "decimal"}
                          placeholder={isTimeInput ? "ММ:СС" : "0"}
                          value={values[d.slug] ?? ""}
                          onChange={(e) => setValues((prev) => ({ ...prev, [d.slug]: e.target.value }))}
                          onBlur={(e) => commitValue(d.slug, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                          disabled={!canAddResults}
                        />
                        {!isTimeInput && d.unit && (
                          <span className="text-[10px] text-zinc-500 font-mono w-4 text-left">
                            {d.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Подсказка для обычных пользователей */}
      {!isCurrentUserAdmin && (
        <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
          💡 Вы можете редактировать только свои результаты
        </div>
      )}
    </main>
  );
}
