import { addDays, startOfWeek, differenceInCalendarDays, format, isSameDay } from "date-fns";
import { ru } from "date-fns/locale";
import { FullProgram, Cycle, Phase } from "@/types/program";

/**
 * Calculates the date for a specific workout based on the program start date and its global index.
 * Assumes a Mon-Wed-Fri schedule.
 */
export function getWorkoutDate(startDate: Date, globalIndex: number): Date {
    const weekIndex = Math.floor(globalIndex / 3);
    const remainder = globalIndex % 3;

    // Offsets for Mon (0), Wed (2), Fri (4)
    const offsets = [0, 2, 4];
    const dayOffset = offsets[remainder];

    const totalDaysToAdd = (weekIndex * 7) + dayOffset;

    return addDays(startDate, totalDaysToAdd);
}

/**
 * Finds the global workout index for a given date, if it falls on a training day.
 * Returns -1 if the date is not a training day (e.g. Tue, Thu, Sat, Sun).
 */
export function getWorkoutIndexForDate(startDate: Date, targetDate: Date): number {
    const diff = differenceInCalendarDays(targetDate, startDate);
    if (diff < 0) return -1;

    const weeks = Math.floor(diff / 7);
    const daysIntoWeek = diff % 7;

    // Map days into week (0=Mon, 2=Wed, 4=Fri) to remainder index (0, 1, 2)
    let remainder = -1;
    if (daysIntoWeek === 0) remainder = 0;
    else if (daysIntoWeek === 2) remainder = 1;
    else if (daysIntoWeek === 4) remainder = 2;

    if (remainder === -1) return -1;

    return (weeks * 3) + remainder;
}

export function getProgramWeekLabel(startDate: Date, targetDate: Date): string {
    const diff = differenceInCalendarDays(targetDate, startDate);
    if (diff < 0) return "До начала";
    const weekNum = Math.floor(diff / 7) + 1;
    return `Неделя ${weekNum}`;
}

export function formatTrainingDate(date: Date): string {
    return format(date, "d MMMM, EEEE", { locale: ru });
}

/**
 * Determines which Cycle and Phase a specific Week (containing the date) belongs to.
 * Based on the flattened structure of the program (Cycles -> Phases).
 * Assumes each Phase = 1 Week.
 */
export function getPhaseForDate(program: FullProgram, targetDate: Date): { cycle?: Cycle, phase?: Phase, color?: string } {
    const startDate = new Date(program.start_date);
    const diff = differenceInCalendarDays(targetDate, startDate);

    if (diff < 0) return {}; // Before program starts

    // Rule: Phase color persists until its last workout day.
    // New phase color starts the following day.

    let globalWorkoutCounter = 0;

    for (const cycle of program.cycles) {
        // Sort phases to be sure
        const sortedPhases = (cycle.phases || []).sort((a, b) => a.order_index - b.order_index);

        for (const phase of sortedPhases) {
            const workouts = phase.workouts || [];
            if (workouts.length === 0) continue;

            const lastWorkoutIdx = globalWorkoutCounter + workouts.length - 1;
            const lastWorkoutDate = getWorkoutDate(startDate, lastWorkoutIdx);
            const phaseEndDiff = differenceInCalendarDays(lastWorkoutDate, startDate);

            if (diff <= phaseEndDiff) {
                return { cycle, phase, color: phase.color || cycle.color };
            }

            globalWorkoutCounter += workouts.length;
        }
    }

    return {}; // Date exceeds program duration
}
