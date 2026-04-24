"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
  getLatestResults,
  getResultsHistory,
  addCloudResult,
  getCloudProfile,
  getAllCloudProfiles,
  CloudResult,
  type CloudProfile,
} from "@/lib/cloudSync";
import {
  parseTimeToSeconds,
  formatSecondsToTime,
  shouldUseTimeInput,
} from "@/lib/timeUtils";
import { useAuth } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MobilityInfoSection } from "@/components/MobilityInfo";
import { useToast } from "@/components/Toast";

type Discipline = {
  slug: string;
  category: string;
  name: string;
  unit?: string;
  direction?: "lower_better" | "higher_better";
  stat?: string;
  has1RM?: boolean;
  icon?: string;
  retired?: boolean;
};

export default function ResultsPage() {
  return (
    <ProtectedRoute>
      <ResultsContent />
    </ProtectedRoute>
  );
}

function ResultsContent() {
  const list = useMemo(() => (disciplines as Discipline[]).filter(d => !d.retired), []);

  const grouped = useMemo(() => {
    return list.reduce<Record<string, Discipline[]>>((acc, d) => {
      (acc[d.category] ||= []).push(d);
      return acc;
    }, {});
  }, [list]);

  const CATEGORY_ORDER = ["Сила", "Статика", "Навыки", "Выносливость", "Бег"];

  const categories = useMemo(
    () => CATEGORY_ORDER.filter(cat => grouped[cat]),
    [grouped]
  );

  const [users, setUsers] = useState<User[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [targetUserId, setTargetUserId] = useState<string>("");

  // Latest result per discipline for the target user (from v_latest_results view)
  const [latestBySlug, setLatestBySlug] = useState<Record<string, CloudResult>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Save feedback
  const [recentlySaved, setRecentlySaved] = useState<string | null>(null);
  const { toast } = useToast();

  // History drill-down state
  const [historySlug, setHistorySlug] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<CloudResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);

  // For localStorage fallback (guests)
  const [store, setStore] = useState<HistoryStore>({});

  const { user: authUser, loading: authLoading } = useAuth();

  const activeUser = users.find((u) => u.id === activeUserId);
  const targetUser = users.find((u) => u.id === targetUserId);
  const isCurrentUserAdmin = isAdmin(activeUser);
  const canAddResults = canAddResultsFor(activeUser, targetUserId);

  // Guest fallback history
  const guestHistory: HistoryBySlug = store[targetUserId] ?? {};

  // --- Effect 1: Load users & profiles ---
  useEffect(() => {
    let u = loadUsers();

    if (authUser && !authLoading) {
      getCloudProfile(authUser.id).then(async (profile) => {
        let currentList = loadUsers();
        const role = (profile?.role === 'admin') ? 'admin' : 'user';
        const name = profile?.name || authUser.user_metadata?.name || "Пользователь";

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
                existing.name = p.name;
                existing.role = p.role as any;
              }
            });
          } catch (err) {
            console.error("Failed to load all profiles", err);
          }
        }

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
    const initialActive =
      authUser ? authUser.id :
        (savedActive && u.some((x) => x.id === savedActive) ? savedActive : u[0].id);

    setActiveUserId(initialActive);
    setTargetUserId(initialActive);
    saveActiveUserId(initialActive);
  }, [authUser?.id, authLoading]); // Use stable string id, not object ref

  // --- Effect 2: Load latest results (1 row per discipline) ---
  useEffect(() => {
    if (!authUser) {
      // Guest fallback
      const currentStore = loadHistoryStore(activeUserId || "guest");
      setStore(currentStore);
      return;
    }

    const fetchUserId = targetUserId || authUser.id;
    if (!fetchUserId) return;

    getLatestResults(fetchUserId)
      .then((results) => {
        const bySlug: Record<string, CloudResult> = {};
        results.forEach((r) => {
          if (r.user_id && r.discipline_slug) {
            bySlug[r.discipline_slug] = r;
          }
        });
        setLatestBySlug(bySlug);
      })
      .catch((err) => console.error("Failed to load latest results:", err));

    // Close history panel when target user changes
    setHistorySlug(null);
    setHistoryItems([]);
  }, [authUser?.id, targetUserId]); // Stable deps: only refetch on real user/target change

  // --- Effect 3: Sync form values from latest results ---
  useEffect(() => {
    const nextValues: Record<string, string> = {};

    if (authUser) {
      // Cloud mode: use latestBySlug
      for (const d of list) {
        const r = latestBySlug[d.slug];
        if (r) {
          if (shouldUseTimeInput(d.unit ?? "", d.direction ?? "higher_better")) {
            nextValues[d.slug] = formatSecondsToTime(Number(r.value));
          } else {
            nextValues[d.slug] = String(r.value);
          }
        }
      }
    } else {
      // Guest: use localStorage
      const h = guestHistory;
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
    }

    setValues(nextValues);
  }, [latestBySlug, store, targetUserId, list, authUser]);

  // --- History drill-down ---
  const openHistory = useCallback(async (slug: string) => {
    if (!authUser) return; // history only for cloud users
    const fetchUserId = targetUserId || authUser.id;

    if (historySlug === slug) {
      // Toggle off
      setHistorySlug(null);
      setHistoryItems([]);
      return;
    }

    setHistorySlug(slug);
    setHistoryLoading(true);
    setHistoryItems([]);

    try {
      const items = await getResultsHistory(fetchUserId, slug, 50);
      setHistoryItems(items);
      setHistoryHasMore(items.length === 50);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [authUser, targetUserId, historySlug]);

  const loadMoreHistory = useCallback(async () => {
    if (!authUser || !historySlug || historyItems.length === 0) return;
    const fetchUserId = targetUserId || authUser.id;
    const lastItem = historyItems[historyItems.length - 1];

    setHistoryLoading(true);
    try {
      const items = await getResultsHistory(fetchUserId, historySlug, 50, lastItem.recorded_at);
      setHistoryItems(prev => [...prev, ...items]);
      setHistoryHasMore(items.length === 50);
    } catch (err) {
      console.error("Failed to load more history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [authUser, targetUserId, historySlug, historyItems]);

  // --- Commit value ---
  const commitValue = (slug: string, rawValue: string) => {
    if (!canAddResults) return;

    const d = list.find((x) => x.slug === slug);
    if (!d) return;

    let numericValue: number | null = null;

    if (shouldUseTimeInput(d.unit ?? "", d.direction ?? "higher_better")) {
      numericValue = parseTimeToSeconds(rawValue);
    } else {
      const normalizedValue = rawValue.replace(",", ".");
      const parsed = parseFloat(normalizedValue);
      if (!isNaN(parsed)) {
        numericValue = parsed;
      }
    }

    if (numericValue === null) return;

    if (authUser) {
      // Cloud mode: update optimistically then sync
      const now = new Date().toISOString();

      // Optimistic update of latestBySlug
      setLatestBySlug(prev => ({
        ...prev,
        [slug]: {
          user_id: targetUserId,
          discipline_slug: slug,
          value: numericValue as number,
          recorded_at: now,
        }
      }));

      // If history panel is open for this slug, prepend
      if (historySlug === slug) {
        setHistoryItems(prev => [{
          user_id: targetUserId,
          discipline_slug: slug,
          value: numericValue as number,
          recorded_at: now,
        }, ...prev]);
      }

      // Visual feedback
      setRecentlySaved(slug);
      setTimeout(() => setRecentlySaved(null), 900);
      toast("Сохранено");

      // Cloud sync
      addCloudResult({
        user_id: targetUserId,
        discipline_slug: slug,
        value: numericValue as number,
        recorded_at: now,
      }).catch(err => {
        console.error("Cloud sync failed:", err);
        toast("Ошибка синхронизации", "error");
      });
    } else {
      // Guest: localStorage
      setStore((prev) => {
        const next = addResult(prev, targetUserId, slug, numericValue as number);
        saveHistoryStore(next);
        return next;
      });
      setRecentlySaved(slug);
      setTimeout(() => setRecentlySaved(null), 900);
      toast("Сохранено");
    }
  };

  const switchTargetUser = (id: string) => {
    if (!isCurrentUserAdmin && authUser && id !== authUser.id) {
      console.warn("Unauthorized attempt to switch user");
      return;
    }
    setTargetUserId(id);
  };

  // --- Helper for getting latest value ---
  const getLatestForSlug = (slug: string) => {
    if (authUser) {
      const r = latestBySlug[slug];
      return r ? { ts: r.recorded_at, value: Number(r.value) } : null;
    }
    return getLatest(guestHistory[slug]);
  };

  return (
    <main>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-black uppercase italic leading-none mb-1">
            Результаты
          </h1>
          <p className="page-subtitle">
            {isCurrentUserAdmin
              ? "Введите результаты атлетов"
              : "Введите ваши личные рекорды"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

      {/* Admin warning */}
      {isCurrentUserAdmin && targetUserId !== activeUserId && (
        <div className="card p-3 mb-6 border-[var(--accent-warning)] bg-[var(--accent-warning)]/10">
          <p className="text-sm text-[var(--accent-warning)]">
            👁 Редактирование результатов: <strong>{targetUser?.name}</strong>
          </p>
        </div>
      )}

      {/* Categories */}
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
                  const last = getLatestForSlug(d.slug);
                  const isTimeInput = shouldUseTimeInput(d.unit ?? "", d.direction ?? "higher_better");
                  const isHistoryOpen = historySlug === d.slug;

                  return (
                    <div key={d.slug}>
                      <div className="discipline-row">
                        <span className="discipline-icon shrink-0">{d.icon ?? "📌"}</span>

                        <div
                          className="discipline-info min-w-0 pr-2 flex-1 cursor-pointer"
                          onClick={() => openHistory(d.slug)}
                          title="Нажмите для истории"
                        >
                          <div className="discipline-name leading-snug mb-0.5 text-sm font-medium text-white flex items-center gap-1.5">
                            {d.name}
                            {authUser && (
                              <span className={`text-[9px] transition-transform ${isHistoryOpen ? 'rotate-90' : ''}`}>
                                ▶
                              </span>
                            )}
                          </div>
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
                            className={`input input-sm text-center font-mono ${isTimeInput ? 'w-24' : 'w-20'} ${recentlySaved === d.slug ? 'input-saved' : ''}`}
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

                      {/* History Panel (click-to-expand) */}
                      {isHistoryOpen && (
                        <div className="px-4 pb-3 pt-1 bg-zinc-900/30 border-t border-white/5">
                          <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-2">
                            История: {d.name}
                          </div>

                          {historyLoading && historyItems.length === 0 ? (
                            <div className="text-[10px] text-zinc-600 py-2 text-center">Загрузка...</div>
                          ) : historyItems.length === 0 ? (
                            <div className="text-[10px] text-zinc-600 py-2 text-center">Нет записей</div>
                          ) : (
                            <div className="space-y-1">
                              {historyItems.map((item, idx) => (
                                <div key={item.id || idx} className="flex justify-between items-center text-[10px] font-mono py-1 border-b border-white/5 last:border-0">
                                  <span className="text-zinc-300">
                                    {isTimeInput
                                      ? formatSecondsToTime(Number(item.value))
                                      : `${item.value} ${d.unit ?? ""}`}
                                  </span>
                                  <span className="text-zinc-600">{formatUtc(item.recorded_at)}</span>
                                </div>
                              ))}

                              {historyHasMore && (
                                <button
                                  onClick={loadMoreHistory}
                                  disabled={historyLoading}
                                  className="w-full text-[10px] font-mono text-zinc-500 hover:text-white py-2 uppercase tracking-widest transition-colors disabled:opacity-50"
                                >
                                  {historyLoading ? "Загрузка..." : "[ Показать ещё ]"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Mobility info */}
      <MobilityInfoSection />

      {/* Hint for regular users */}
      {!isCurrentUserAdmin && (
        <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
          💡 Вы можете редактировать только свои результаты
        </div>
      )}
    </main>
  );
}
