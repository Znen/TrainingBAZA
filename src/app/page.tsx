"use client";

import { useEffect, useMemo, useState } from "react";
import disciplines from "../../../disciplines.json";
import {
  Phase,
  DEFAULT_PHASES,
  moscowDateYmd,
  isTrainingDay,
  workoutIndexFromStart,
  phaseForWorkout,
  getMonthInfo,
  loadCycleStartYmd,
  saveCycleStartYmd,
  loadPhases,
  savePhases,
} from "@/lib/program";
import { loadFeed, saveFeed, addFeedItem as addFeedItemLib, FeedItem } from "@/lib/feed";
import { safeId } from "@/lib/users";

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

export default function Home() {
  const list = disciplines as Discipline[];

  const disciplineOptions = useMemo(
    () => [{ slug: "", name: "Без дисциплины" }, ...list.map((d) => ({ slug: d.slug, name: d.name }))],
    [list]
  );

  const todayYmd = useMemo(() => moscowDateYmd(), []);

  const [cycleStartYmd, setCycleStartYmd] = useState<string>(todayYmd);
  const [phases, setPhases] = useState<Phase[]>(DEFAULT_PHASES);
  const [phasesDraft, setPhasesDraft] = useState<string>(JSON.stringify(DEFAULT_PHASES, null, 2));
  const [showPhasesEditor, setShowPhasesEditor] = useState(false);

  const [selectedYmd, setSelectedYmd] = useState<string>(todayYmd);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedDate, setFeedDate] = useState<string>(() => todayYmd);
  const [feedTitle, setFeedTitle] = useState<string>("");
  const [feedVideoUrl, setFeedVideoUrl] = useState<string>("");
  const [feedDisciplineSlug, setFeedDisciplineSlug] = useState<string>("");

  const monthInfo = useMemo(() => getMonthInfo(selectedYmd, todayYmd), [selectedYmd, todayYmd]);

  useEffect(() => {
    const savedStart = loadCycleStartYmd();
    if (savedStart) setCycleStartYmd(savedStart);

    const p = loadPhases();
    setPhases(p);
    setPhasesDraft(JSON.stringify(p, null, 2));

    setFeed(loadFeed());
  }, []);

  const todayWorkoutIndex = useMemo(() => workoutIndexFromStart(cycleStartYmd, todayYmd), [cycleStartYmd, todayYmd]);
  const selectedWorkoutIndex = useMemo(
    () => workoutIndexFromStart(cycleStartYmd, selectedYmd),
    [cycleStartYmd, selectedYmd]
  );

  const todayPhase = useMemo(() => phaseForWorkout(phases, todayWorkoutIndex), [phases, todayWorkoutIndex]);
  const selectedPhase = useMemo(() => phaseForWorkout(phases, selectedWorkoutIndex), [phases, selectedWorkoutIndex]);

  const addFeedItem = () => {
    const title = feedTitle.trim();
    const url = feedVideoUrl.trim();
    const dateYmd = feedDate.trim();

    if (!title || !url || !dateYmd) return;

    const item: FeedItem = {
      id: safeId(),
      date: dateYmd,
      type: "video_achievement",
      userId: "dev",
      title,
      videoUrl: url,
      disciplineSlug: feedDisciplineSlug || undefined,
      createdAtUtc: new Date().toISOString(),
    };

    const updated = addFeedItemLib(item);
    setFeed(updated);

    setFeedTitle("");
    setFeedVideoUrl("");
    setFeedDisciplineSlug("");
  };

  const removeFeedItem = (id: string) => {
    setFeed((prev) => {
      const next = prev.filter((x) => x.id !== id);
      saveFeed(next);
      return next;
    });
  };

  const applyPhasesDraft = () => {
    try {
      const parsed = JSON.parse(phasesDraft) as Phase[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      const cleaned = parsed
        .map((p) => ({
          name: typeof p?.name === "string" ? p.name : "Фаза",
          workouts: Number.isFinite(Number(p?.workouts)) ? Number(p.workouts) : 0,
        }))
        .filter((p) => p.workouts > 0);

      if (cleaned.length === 0) return;

      setPhases(cleaned);
      savePhases(cleaned);
      setShowPhasesEditor(false);
    } catch {
      // ignore
    }
  };

  return (
    <main className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════
          CALENDAR — Glass Panel with Animated Border
          ═══════════════════════════════════════════════════════════════ */}
      <section className="glass-panel glow-effect">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">📅 Календарь программы</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Пн/Ср/Пт • Слоты 09:00 / 19:00 / 20:30 • Europe/Moscow
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-xs text-[var(--text-muted)] mb-1">Старт цикла</div>
              <input
                className="tech-input w-40"
                type="date"
                value={cycleStartYmd}
                onChange={(e) => {
                  const v = e.target.value;
                  setCycleStartYmd(v);
                  saveCycleStartYmd(v);
                }}
              />
            </div>

            <div>
              <div className="text-xs text-[var(--text-muted)] mb-1">Выбрано</div>
              <input
                className="tech-input w-40"
                type="date"
                value={selectedYmd}
                onChange={(e) => setSelectedYmd(e.target.value)}
              />
            </div>

            <button
              className="tech-btn"
              onClick={() => setShowPhasesEditor((v) => !v)}
              type="button"
            >
              ⚙️ Фазы
            </button>
          </div>
        </div>

        {/* Phases Editor */}
        {showPhasesEditor && (
          <div className="glass-panel mb-6 p-4">
            <div className="text-sm font-semibold mb-2">Редактор фаз (JSON)</div>
            <textarea
              className="tech-input h-32 font-mono text-xs"
              value={phasesDraft}
              onChange={(e) => setPhasesDraft(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <button className="tech-btn" onClick={applyPhasesDraft} type="button">
                Применить
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setPhases(DEFAULT_PHASES);
                  setPhasesDraft(JSON.stringify(DEFAULT_PHASES, null, 2));
                  savePhases(DEFAULT_PHASES);
                }}
                type="button"
              >
                Сбросить
              </button>
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        {monthInfo && (
          <>
            {/* Current Status */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 text-sm">
              <div className="text-[var(--text-muted)]">
                Месяц: <span className="text-[var(--text-primary)] font-semibold">{monthInfo.y}-{String(monthInfo.m).padStart(2, "0")}</span>
              </div>
              <div className="text-[var(--text-muted)]">
                Сегодня: <span className="text-[var(--text-primary)] font-semibold">{todayYmd}</span>
                {todayPhase?.phase && (
                  <span className="ml-2 text-[var(--accent-primary)]">
                    • {todayPhase.phase.name} (#{todayWorkoutIndex})
                  </span>
                )}
              </div>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="tech-grid-header">
                  {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((x) => (
                    <span key={x}>{x}</span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {monthInfo.cells.map((c, idx) => {
                    if (!c.ymd) return <div key={idx} className="h-20" />;

                    const ymd = c.ymd;
                    const training = isTrainingDay(ymd);
                    const selected = ymd === selectedYmd;
                    const isToday = ymd === todayYmd;

                    const cellClasses = [
                      "tech-cell h-20 text-left",
                      training && "training",
                      selected && "active",
                      isToday && "today",
                    ].filter(Boolean).join(" ");

                    return (
                      <button
                        key={ymd}
                        type="button"
                        onClick={() => setSelectedYmd(ymd)}
                        className={cellClasses}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{c.day}</span>
                          {isToday && <span className="tech-badge">TODAY</span>}
                        </div>

                        {training && (
                          <div className="mt-2 text-[10px] text-[var(--text-muted)] font-mono tracking-wide">
                            09:00 • 19:00 • 20:30
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Day Info */}
            <div className="mt-6 p-4 rounded-xl bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.3)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{selectedYmd}</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {isTrainingDay(selectedYmd) ? (
                      <span className="text-[var(--accent-success)]">● Тренировочный день</span>
                    ) : (
                      <span>○ Отдых</span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-[var(--text-muted)]">Позиция в цикле</div>
                  <div className="font-semibold">
                    {selectedWorkoutIndex > 0 ? `#${selectedWorkoutIndex}` : "До старта"}
                  </div>
                  {selectedPhase?.phase && (
                    <div className="text-xs text-[var(--accent-primary)]">
                      {selectedPhase.phase.name} ({selectedPhase.within}/{selectedPhase.phase.workouts})
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FEED — Events & Achievements
          ═══════════════════════════════════════════════════════════════ */}
      <section className="glass-panel glow-effect">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight">📰 Лента событий</h2>
          <span className="tech-badge success">{feed.length} записей</span>
        </div>

        {/* Add Form */}
        <div className="grid gap-4 md:grid-cols-12 p-4 rounded-xl bg-[rgba(0,0,0,0.3)] mb-6">
          <div className="md:col-span-2">
            <div className="text-xs text-[var(--text-muted)] mb-1">Дата</div>
            <input
              className="tech-input"
              type="date"
              value={feedDate}
              onChange={(e) => setFeedDate(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <div className="text-xs text-[var(--text-muted)] mb-1">Дисциплина</div>
            <select
              className="tech-input"
              value={feedDisciplineSlug}
              onChange={(e) => setFeedDisciplineSlug(e.target.value)}
            >
              {disciplineOptions.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <div className="text-xs text-[var(--text-muted)] mb-1">Заголовок</div>
            <input
              className="tech-input"
              placeholder="20 подтягиваний подряд"
              value={feedTitle}
              onChange={(e) => setFeedTitle(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <div className="text-xs text-[var(--text-muted)] mb-1">Ссылка на видео</div>
            <input
              className="tech-input"
              placeholder="https://..."
              value={feedVideoUrl}
              onChange={(e) => setFeedVideoUrl(e.target.value)}
            />
          </div>

          <div className="md:col-span-12 flex justify-end">
            <button className="tech-btn" onClick={addFeedItem} type="button">
              ➕ Добавить
            </button>
          </div>
        </div>

        {/* Feed List */}
        <div className="space-y-3">
          {feed.length === 0 ? (
            <div className="text-center text-[var(--text-muted)] py-8">
              Лента пуста
            </div>
          ) : (
            feed.map((it) => {
              const dName = it.disciplineSlug
                ? (list.find((d) => d.slug === it.disciplineSlug)?.name ?? it.disciplineSlug)
                : null;

              return (
                <div key={it.id} className="tech-cell">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{it.title}</div>
                      <div className="text-sm text-[var(--text-muted)]">
                        {it.date}
                        {dName && <span className="ml-2 text-[var(--accent-primary)]">• {dName}</span>}
                      </div>

                      {it.videoUrl && (
                        <a
                          className="inline-block mt-2 text-sm text-[var(--accent-primary)] hover:underline"
                          href={it.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          🎬 Открыть видео
                        </a>
                      )}
                    </div>

                    <button
                      className="btn btn-ghost text-xs"
                      onClick={() => removeFeedItem(it.id)}
                      type="button"
                    >
                      ✕ Удалить
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
