// src/lib/program.ts
// Календарь, фазы, позиция в цикле

import { lsGet, lsSet, lsGetJSON, lsSetJSON } from "./storage";

export type Phase = {
    name: string;
    workouts: number; // сколько тренировок в фазе (не дней)
};

const LS_CYCLE_START_KEY = "trainingBaza:cycleStartYmd:v1";
const LS_PHASES_KEY = "trainingBaza:phases:v1";
const MOSCOW_TZ = "Europe/Moscow";

export const DEFAULT_PHASES: Phase[] = [
    { name: "Фаза 1", workouts: 4 },
    { name: "Фаза 2", workouts: 4 },
    { name: "Фаза 3", workouts: 4 },
    { name: "Фаза 4", workouts: 4 },
];

// ========== Утилиты для дат ==========

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

/** YYYY-MM-DD в таймзоне Europe/Moscow */
export function moscowDateYmd(date: Date = new Date()): string {
    // sv-SE стабильно даёт YYYY-MM-DD
    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: MOSCOW_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

export function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
    const [y, m, d] = ymd.split("-").map((x) => Number(x));
    if (!y || !m || !d) return null;
    return { y, m, d };
}

/**
 * Создаём Date так, чтобы Intl(…, timeZone: Europe/Moscow) корректно работал
 * (берём полдень UTC — безопаснее, чем полночь из-за сдвигов).
 */
export function dateFromYmd(ymd: string): Date {
    return new Date(`${ymd}T12:00:00.000Z`);
}

export function weekdayShortMoscow(ymd: string): string {
    const d = dateFromYmd(ymd);
    return new Intl.DateTimeFormat("en-US", { timeZone: MOSCOW_TZ, weekday: "short" }).format(d);
}

export function isTrainingDay(ymd: string): boolean {
    const w = weekdayShortMoscow(ymd);
    return w === "Mon" || w === "Wed" || w === "Fri";
}

export function addDaysYmd(ymd: string, deltaDays: number): string {
    const d = dateFromYmd(ymd);
    d.setUTCDate(d.getUTCDate() + deltaDays);
    return moscowDateYmd(d);
}

export function cmpYmd(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

// ========== localStorage ==========

export function loadCycleStartYmd(): string | null {
    const raw = lsGet(LS_CYCLE_START_KEY);
    return raw && typeof raw === "string" ? raw : null;
}

export function saveCycleStartYmd(ymd: string): void {
    lsSet(LS_CYCLE_START_KEY, ymd);
}

export function loadPhases(): Phase[] {
    const data = lsGetJSON<unknown>(LS_PHASES_KEY, null);
    if (!data || !Array.isArray(data) || data.length === 0) return DEFAULT_PHASES;

    const cleaned = data
        .map((p) => ({
            name: typeof (p as Phase)?.name === "string" ? (p as Phase).name : "Фаза",
            workouts: Number.isFinite(Number((p as Phase)?.workouts)) ? Number((p as Phase).workouts) : 0,
        }))
        .filter((p) => p.workouts > 0);

    return cleaned.length > 0 ? cleaned : DEFAULT_PHASES;
}

export function savePhases(phases: Phase[]): void {
    lsSetJSON(LS_PHASES_KEY, phases);
}

// ========== Логика цикла ==========

/** Сколько тренировок (Mon/Wed/Fri) прошло от cycleStart до dateYmd включительно */
export function workoutIndexFromStart(cycleStartYmd: string, dateYmd: string): number {
    if (cmpYmd(dateYmd, cycleStartYmd) < 0) return 0;

    let count = 0;
    let cur = cycleStartYmd;

    // лимит 2000 дней (~5.5 лет) чтобы не зависнуть
    for (let i = 0; i < 2000; i++) {
        if (isTrainingDay(cur)) count++;
        if (cur === dateYmd) break;
        cur = addDaysYmd(cur, 1);
    }
    return count;
}

export type PhaseInfo = {
    phase: Phase;
    phaseIndex: number;
    within: number;
    start: number;
    end: number;
};

export function phaseForWorkout(phases: Phase[], workoutIndex: number): PhaseInfo | null {
    if (workoutIndex <= 0) return null;

    let acc = 0;
    for (let i = 0; i < phases.length; i++) {
        const start = acc + 1;
        const end = acc + phases[i].workouts;
        if (workoutIndex >= start && workoutIndex <= end) {
            return { phase: phases[i], phaseIndex: i + 1, within: workoutIndex - acc, start, end };
        }
        acc = end;
    }

    // вышли за пределы — "после цикла"
    return {
        phase: { name: "Вне цикла", workouts: 0 },
        phaseIndex: phases.length + 1,
        within: 0,
        start: acc + 1,
        end: acc,
    };
}

// ========== Генерация ячеек календаря ==========

export type CalendarCell = {
    ymd: string | null;
    day: number | null;
};

export type MonthInfo = {
    y: number;
    m: number;
    daysInMonth: number;
    cells: CalendarCell[];
};

export function getMonthInfo(selectedYmd: string, fallbackYmd: string): MonthInfo | null {
    const p = parseYmd(selectedYmd) ?? parseYmd(fallbackYmd);
    if (!p) return null;

    const { y, m } = p;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

    const firstYmd = `${y}-${pad2(m)}-01`;
    const firstW = weekdayShortMoscow(firstYmd);
    const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    const firstOffset = map[firstW] ?? 0;

    const cells: CalendarCell[] = [];
    for (let i = 0; i < firstOffset; i++) cells.push({ ymd: null, day: null });
    for (let day = 1; day <= daysInMonth; day++) {
        const ymd = `${y}-${pad2(m)}-${pad2(day)}`;
        cells.push({ ymd, day });
    }
    // добить до кратности 7
    while (cells.length % 7 !== 0) cells.push({ ymd: null, day: null });

    return { y, m, daysInMonth, cells };
}
