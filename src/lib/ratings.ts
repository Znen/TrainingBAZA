// src/lib/ratings.ts
// Расчёт рейтингов (общий и по дисциплинам)

import type { User } from "./users";
import type { HistoryStore } from "./results";
import { getLatest } from "./results";

export type DisciplineRow = {
    userId: string;
    userName: string;
    value: number | null;
    place: number | null;
    points: number;
};

export type OverallRow = {
    userId: string;
    userName: string;
    points: number;
    place: number;
};

/**
 * Очки за место (схема A):
 * N пользователей. 1 место = N, 2 место = N-1, ... последнее = 1. Нет результата = 0.
 */
export function pointsForPlaceA(place: number, totalUsers: number): number {
    if (place <= 0 || place > totalUsers) return 0;
    return totalUsers - place + 1;
}

/**
 * Ничьи (схема A): среднее очков занятых мест.
 */
export function averageTiePointsA(
    placeStart: number,
    tieSize: number,
    totalUsers: number
): number {
    let sum = 0;
    for (let i = 0; i < tieSize; i++) {
        sum += pointsForPlaceA(placeStart + i, totalUsers);
    }
    return sum / tieSize;
}

export type Discipline = {
    slug: string;
    name: string;
    category: string;
    unit?: string;
    direction?: "lower_better" | "higher_better";
};

/**
 * Рассчитать рейтинг по одной дисциплине.
 */
export function calculateDisciplineRating(
    discipline: Discipline,
    users: User[],
    store: HistoryStore
): DisciplineRow[] {
    const lowerBetter = discipline.direction === "lower_better";
    const totalUsers = users.length;

    // Собираем последние значения
    const rows: DisciplineRow[] = users.map((u) => {
        const userHistory = store[u.id] ?? {};
        const arr = userHistory[discipline.slug];
        const latest = getLatest(arr);
        return {
            userId: u.id,
            userName: u.name,
            value: latest?.value ?? null,
            place: null,
            points: 0,
        };
    });

    // Сортируем по значению
    const withValue = rows.filter((r) => r.value !== null);
    const withoutValue = rows.filter((r) => r.value === null);

    withValue.sort((a, b) => {
        const av = a.value!;
        const bv = b.value!;
        return lowerBetter ? av - bv : bv - av;
    });

    // Присваиваем места с учётом ничьих
    let currentPlace = 1;
    let i = 0;
    while (i < withValue.length) {
        // Находим группу с одинаковыми значениями
        let j = i;
        while (j < withValue.length && withValue[j].value === withValue[i].value) {
            j++;
        }
        const tieSize = j - i;
        const avgPoints = averageTiePointsA(currentPlace, tieSize, totalUsers);

        for (let k = i; k < j; k++) {
            withValue[k].place = currentPlace;
            withValue[k].points = avgPoints;
        }

        currentPlace += tieSize;
        i = j;
    }

    // Без результата — 0 очков, место null
    for (const r of withoutValue) {
        r.place = null;
        r.points = 0;
    }

    return [...withValue, ...withoutValue];
}

/**
 * Рассчитать общий рейтинг (сумма очков по всем дисциплинам).
 */
export function calculateOverallRating(
    disciplines: Discipline[],
    users: User[],
    store: HistoryStore
): OverallRow[] {
    // Для каждого пользователя — сумма очков
    const pointsMap: Record<string, number> = {};
    for (const u of users) {
        pointsMap[u.id] = 0;
    }

    for (const d of disciplines) {
        const ranking = calculateDisciplineRating(d, users, store);
        for (const r of ranking) {
            pointsMap[r.userId] = (pointsMap[r.userId] ?? 0) + r.points;
        }
    }

    // Сортируем по очкам (больше = лучше)
    const rows: OverallRow[] = users.map((u) => ({
        userId: u.id,
        userName: u.name,
        points: pointsMap[u.id] ?? 0,
        place: 0,
    }));

    rows.sort((a, b) => b.points - a.points);

    // Присваиваем места с учётом ничьих
    let currentPlace = 1;
    let i = 0;
    while (i < rows.length) {
        let j = i;
        while (j < rows.length && rows[j].points === rows[i].points) {
            j++;
        }
        for (let k = i; k < j; k++) {
            rows[k].place = currentPlace;
        }
        currentPlace += j - i;
        i = j;
    }

    return rows;
}
