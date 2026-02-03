// src/lib/storage.ts
// Универсальные хелперы для localStorage (без падений на SSR)

export function lsAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function lsGet(key: string): string | null {
  if (!lsAvailable()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function lsSet(key: string, value: string): boolean {
  if (!lsAvailable()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function lsRemove(key: string): boolean {
  if (!lsAvailable()) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function lsGetJSON<T>(key: string, fallback: T): T {
  const raw = lsGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function lsSetJSON<T>(key: string, value: T): boolean {
  try {
    return lsSet(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
