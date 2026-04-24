"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import UserSwitcher from "@/components/UserSwitcher";
import { getActiveProgram } from "@/lib/programApi";
import { FullProgram, Workout } from "@/types/program";
import { getWorkoutIndexForDate, getPhaseForDate } from "@/lib/programUtils";
import { getDailyQuote } from "@/lib/quotes";
import { addDays, subDays, startOfWeek, isSameDay, format, addWeeks, subWeeks } from "date-fns";
import { ru } from "date-fns/locale";

export default function Home() {
  const { user } = useAuth();
  const [activeProgram, setActiveProgram] = useState<FullProgram | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [quote, setQuote] = useState("");

  // Anchor date for the visible week grid (always Monday of the visible week)
  const [viewDate, setViewDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setQuote(getDailyQuote());
    async function load() {
      try {
        const prog = await getActiveProgram();
        setActiveProgram(prog);

        // If program starts in the future, jump to start date
        if (prog && new Date(prog.start_date) > new Date()) {
          setViewDate(startOfWeek(new Date(prog.start_date), { weekStartsOn: 1 }));
          setSelectedDate(new Date(prog.start_date));
        }

      } catch (e) {
        console.error(e);
        setLoadError(true);
      }
    }
    load();
  }, []);

  // Ensure selectedDate is visible when it changes (optional, but good UX)
  // useEffect(() => {
  //   const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  //   setViewDate(start);
  // }, [selectedDate]);

  // --- Helpers for Display ---

  const workoutsMap = useMemo(() => {
    if (!activeProgram) return new Map<number, Workout>();

    const map = new Map<number, any>();
    let globalIndex = 0;

    activeProgram.cycles.forEach(cycle => {
      cycle.phases.forEach(phase => {
        phase.workouts.forEach(workout => {
          map.set(globalIndex, { ...workout, cycleTitle: cycle.title, phaseTitle: phase.title, cycleColor: cycle.color });
          globalIndex++;
        });
      });
    });
    return map;
  }, [activeProgram]);

  const selectedWorkout = useMemo(() => {
    if (!activeProgram) return null;
    const startDate = new Date(activeProgram.start_date);
    const index = getWorkoutIndexForDate(startDate, selectedDate);
    return index !== -1 ? workoutsMap.get(index) : null;
  }, [activeProgram, workoutsMap, selectedDate]);

  // Determine current phase/cycle info for the HEADER
  const currentPhaseInfo = useMemo(() => {
    if (!activeProgram) return null;
    return getPhaseForDate(activeProgram, selectedDate);
  }, [activeProgram, selectedDate]);


  // Generate 21 days for the Grid (3 weeks)
  const gridDays = useMemo(() => {
    const dates = [];
    // viewDate is Monday of the MIDDLE week
    const start = subWeeks(viewDate, 1);
    for (let i = 0; i < 21; i++) {
      dates.push(addDays(start, i));
    }
    return dates;
  }, [viewDate]);

  const handlePrevWeek = () => setViewDate(subWeeks(viewDate, 1));
  const handleNextWeek = () => setViewDate(addWeeks(viewDate, 1));

  if (loadError) return <div className="p-4 text-red-500">Ошибка загрузки программы</div>;

  return (
    <div className="selection:bg-yellow-500/30">
      <div className="max-w-lg mx-auto">

        {/* DAILY QUOTE */}
        <div className="mb-6 select-none">
          <p className="text-xs font-mono leading-relaxed text-zinc-600 border-l-2 border-zinc-800 pl-3 italic">
            {quote}
          </p>
        </div>

        {/* ACTIVE PHASE HEADER */}
        {activeProgram && currentPhaseInfo?.cycle ? (
          <div className="mb-4 relative overflow-hidden rounded-none border-l-2 border-yellow-500 pl-4 py-2 group">
            {/* Glow effect based on cycle color */}
            <div
              className="absolute inset-0 opacity-10 blur-xl pointer-events-none"
              style={{ backgroundColor: currentPhaseInfo.color || '#fff' }}
            />

            <div className="relative z-10 flex justify-between items-start">
              <div>
                <div className="text-[9px] font-bold tracking-[0.2em] uppercase text-zinc-500 mb-0.5">
                  Текущий цикл
                </div>
                <h2 className="text-xl font-black uppercase italic leading-none" style={{ color: currentPhaseInfo.color || 'white' }}>
                  {currentPhaseInfo.cycle.title}
                </h2>
                <p className="text-zinc-500 text-[10px] font-mono mt-0.5 uppercase">
                  {currentPhaseInfo.phase?.title}
                </p>
              </div>

              {/* Admin Link */}
              <Link href="/program" className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-zinc-600 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-4 h-12 flex items-center justify-between text-zinc-600 italic text-sm">
            <span>{activeProgram ? "Вне программы" : "Нет активной программы"}</span>
            <Link href="/program" className="text-xs border border-zinc-800 px-2 py-0.5 rounded hover:bg-zinc-900 transition-colors">
              Управление
            </Link>
          </div>
        )}

        {/* CALENDAR GRID (3 Weeks) */}
        {activeProgram && (
          <div className="mb-6">
            {/* Navigation */}
            <div className="flex justify-between items-center mb-3 px-1">
              <button onClick={handlePrevWeek} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 rounded transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                {format(viewDate, "LLLL yyyy", { locale: ru })}
              </span>
              <button onClick={handleNextWeek} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 rounded transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Grid Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1.5">
              {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map(day => (
                <div key={day} className="text-[10px] text-center text-zinc-700 font-bold tracking-wide">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid Days */}
            <div className="grid grid-cols-7 gap-y-1 gap-x-1">
              {gridDays.map((d, i) => {
                const isSelected = isSameDay(d, selectedDate);
                const isToday = isSameDay(d, new Date());

                const dayPhaseInfo = getPhaseForDate(activeProgram, d);
                const dayColor = dayPhaseInfo?.color;

                const wIndex = getWorkoutIndexForDate(new Date(activeProgram.start_date), d);
                const hasWorkout = workoutsMap.has(wIndex);

                // Dim days not in the middle week? Optional.
                // Let's keep them all same brightness but maybe differentiate slightly?
                // const isCurrentViewWeek = isSameWeek(d, viewDate, { weekStartsOn: 1 });

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(d)}
                    className={`
                      relative h-11 flex flex-col items-center justify-center rounded
                      transition-all duration-150 group border
                      ${isSelected
                        ? 'border-yellow-500/60 bg-yellow-500/8'
                        : isToday
                        ? 'border-white/15 bg-white/4'
                        : 'border-transparent hover:border-white/8 hover:bg-white/3'}
                    `}
                    style={!isSelected && !isToday && dayPhaseInfo.cycle ? {
                      backgroundColor: dayColor ? `${dayColor}12` : 'rgba(255,255,255,0.03)',
                    } : undefined}
                  >
                    {/* Day Number */}
                    <span className={`
                      text-xs font-bold z-10 leading-none
                      ${isToday && !isSelected ? 'text-yellow-400' : ''}
                      ${isSelected ? 'text-yellow-300' : !isToday ? 'text-zinc-500 group-hover:text-zinc-200' : ''}
                    `}>
                      {format(d, "d")}
                    </span>

                    {/* Workout Indicator dot */}
                    {hasWorkout && (
                      <div
                        className="w-1 h-1 mt-1 rounded-full z-10 opacity-80"
                        style={{ backgroundColor: dayColor || '#eab308' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* WORKOUT DISPLAY */}
        <div className="min-h-[40vh] relative pt-2 border-t border-zinc-900">
          {selectedWorkout ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Title */}
              <div className="mb-6 flex items-end justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-3xl font-black italic uppercase text-white leading-none">
                    {selectedWorkout.title}
                  </h3>
                  <p className="text-xs font-mono text-zinc-500 mt-2 uppercase tracking-wide">
                    {selectedWorkout.phaseTitle} // {format(selectedDate, "d MMMM", { locale: ru })}
                  </p>
                </div>
                {/* Circle Graph or Icon could go here */}
                <div className="text-4xl opacity-20 grayscale">
                  🏋️‍♂️
                </div>
              </div>

              {/* Blocks Aggressive Style */}
              <div className="space-y-6">
                {selectedWorkout.blocks.length === 0 && (
                  <p className="text-zinc-600 font-mono text-sm py-8 text-center text-zinc-700 uppercase tracking-widest">
                    [ Нет данных ]
                  </p>
                )}

                {selectedWorkout.blocks.map((block: any, idx: number) => (
                  <div key={block.id} className="relative pl-4">
                    {/* Vertical accent line */}
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full"
                      style={{ background: `linear-gradient(to bottom, ${selectedWorkout.cycleColor || '#eab308'}80, transparent)` }}
                    />

                    {/* Block Header */}
                    {block.title && (
                      <div className="mb-3">
                        <span className="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border"
                          style={{
                            color: selectedWorkout.cycleColor || '#a1a1aa',
                            borderColor: `${selectedWorkout.cycleColor || '#3f3f46'}40`,
                            background: `${selectedWorkout.cycleColor || '#3f3f46'}12`,
                          }}
                        >
                          {block.title}
                        </span>
                      </div>
                    )}

                    {/* Rows */}
                    <div className="space-y-2.5">
                      {block.rows.map((row: any) => (
                        <div key={row.id} className="flex gap-3 items-baseline">
                          <span className="font-mono text-sm font-bold w-[2.5ch] shrink-0 text-yellow-500/90">
                            {row.prefix}
                          </span>
                          <span className="text-zinc-300 text-sm leading-relaxed">
                            {row.content}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Rest State
            <div className="flex flex-col items-center justify-center h-64 select-none">
              <div className="text-5xl font-black text-zinc-800 mb-3 tracking-tighter">REST</div>
              <div className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-700">День восстановления</div>
            </div>
          )}
        </div>
      </div>

      {/* DEBUG SECTION — only in dev when env flag is set */}
      {process.env.NEXT_PUBLIC_DEBUG_FOOTER === '1' && (
        <DebugFooter user={user} activeProgram={activeProgram} loadError={loadError} viewDate={viewDate} />
      )}
    </div>
  );
}

function DebugFooter({ user, activeProgram, loadError, viewDate }: any) {
  const [allPrograms, setAllPrograms] = useState<any[]>([]);

  useEffect(() => {
    // Guard: only fetch when debug footer is explicitly enabled
    if (process.env.NEXT_PUBLIC_DEBUG_FOOTER !== '1') return;
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.from('programs').select('*').then(({ data, error }) => {
        if (data) setAllPrograms(data);
        if (error) console.error("Debug fetch error:", error);
      });
    });
  }, []);

  return (
    <div className="max-w-lg mx-auto px-4 pb-32 pt-8 relative z-40">
      <details className="text-xs text-white bg-zinc-800 p-2 rounded border border-zinc-700">
        <summary className="cursor-pointer font-bold text-yellow-500">🐞 DEBUG INFO (Click me)</summary>
        <div className="mt-2 text-[10px] space-y-2">
          <pre className="whitespace-pre-wrap font-mono text-zinc-300">
            User: {user?.email || 'Guest'}{"\n"}
            ID: {user?.id || 'none'}{"\n"}
            Refreshed: {new Date().toLocaleTimeString()}{"\n"}
            Active Prog ID: {activeProgram ? activeProgram.id : 'null'}{"\n"}
            Load Error: {loadError ? 'Yes' : 'No'}{"\n"}
            View Date: {viewDate.toISOString().split('T')[0]}{"\n"}
            Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}
          </pre>

          <div className="border-t border-zinc-600 pt-2 mb-2">
            <p className="font-bold text-zinc-400">Connection:</p>
            <span className="font-mono text-zinc-500">
              URL: {process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 20)}...
            </span>
          </div>

          <div className="border-t border-zinc-600 pt-2">
            <p className="font-bold text-zinc-400 mb-1">Visible Programs (Raw DB Check):</p>
            {allPrograms.length === 0 ? (
              <p className="text-red-400">0 programs found (Table empty or RLS blocking)</p>
            ) : (
              <ul className="space-y-1">
                {allPrograms.map(p => (
                  <li key={p.id} className="font-mono text-zinc-400">
                    [{p.is_active ? 'ACTIVE' : 'OFF'}] {p.title} <br />
                    <span className="opacity-50 text-[9px]">ID: {p.id.slice(0, 8)}...</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
