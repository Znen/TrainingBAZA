// src/lib/results.ts
// Работа с историей результатов пользователей

import { lsGetJSON, lsSetJSON } from "./storage";

export type HistoryItem = {
    ts: string; // ISO, UTC (new Date().toISOString())
    value: number;
};

export type HistoryBySlug = Record<string, HistoryItem[]>;
export type HistoryStore = Record<string, HistoryBySlug>; // userId -> (slug -> history[])

const LS_HISTORY_KEY = "trainingBaza:history:v2";

function isHistoryBySlug(obj: unknown): obj is HistoryBySlug {
    if (!obj || typeof obj !== "object") return false;
    const rec = obj as Record<string, unknown>;
    return Object.values(rec).every((v) => Array.isArray(v));
}

/**
 * Загрузить хранилище истории.
 * Поддерживает миграцию со старого формата (HistoryBySlug -> HistoryStore).
 */
export function loadHistoryStore(defaultUserId: string): HistoryStore {
    const raw = lsGetJSON<unknown>(LS_HISTORY_KEY, null);
    if (!raw) return {};

    // миграция: если лежит старый формат (HistoryBySlug), заворачиваем под defaultUserId
    if (isHistoryBySlug(raw)) {
        const migrated: HistoryStore = { [defaultUserId]: raw };
        lsSetJSON(LS_HISTORY_KEY, migrated);
        return migrated;
    }

    if (typeof raw !== "object") return {};
    const store = raw as HistoryStore;

    // страховка: внизу массивы
    for (const userId of Object.keys(store)) {
        const bySlug = store[userId];
        if (!bySlug || typeof bySlug !== "object") {
            store[userId] = {};
            continue;
        }
        for (const slug of Object.keys(bySlug)) {
            if (!Array.isArray(bySlug[slug])) bySlug[slug] = [];
        }
    }
    return store;
}

export function saveHistoryStore(store: HistoryStore): void {
    lsSetJSON(LS_HISTORY_KEY, store);
}

/** Последняя запись по времени, независимо от порядка массива */
export function getLatest(arr: HistoryItem[] | undefined): HistoryItem | null {
    if (!arr || arr.length === 0) return null;
    let best = arr[0];
    for (let i = 1; i < arr.length; i++) {
        const a = arr[i];
        if (new Date(a.ts).getTime() > new Date(best.ts).getTime()) best = a;
    }
    return best ?? null;
}

/** Добавить результат в store, возвращает обновлённый store */
export function addResult(
    store: HistoryStore,
    userId: string,
    slug: string,
    value: number
): HistoryStore {
    const item: HistoryItem = { ts: new Date().toISOString(), value };

    const next: HistoryStore = { ...store };
    const userHistory: HistoryBySlug = { ...(next[userId] ?? {}) };

    const arr = [...(userHistory[slug] ?? []), item];
    arr.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    userHistory[slug] = arr;
    next[userId] = userHistory;

    saveHistoryStore(next);
    return next;
}

/** Форматирование ISO UTC -> "YYYY-MM-DD HH:mm UTC" */
export function formatUtc(ts: string): string {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
        d.getUTCHours()
    )}:${pad(d.getUTCMinutes())} UTC`;
}
