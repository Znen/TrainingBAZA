// src/lib/users.ts
// Управление пользователями с ролями и аватарами

import { lsGetJSON, lsSetJSON, lsGet, lsSet } from "./storage";

/**
 * Роли пользователей
 */
export type UserRole = "user" | "admin";

/**
 * Измерения тела с историей
 */
export type BodyMeasurement = {
    weight?: number;       // кг
    height?: number;       // рост, см
    chest?: number;        // обхват груди, см
    waist?: number;        // обхват талии, см
    hips?: number;         // обхват бёдер, см
    biceps?: number;       // бицепс, см
    shoulders?: number;    // плечи, см
    glutes?: number;       // ягодицы, см
    ts: string;            // ISO timestamp
};

export type User = {
    id: string;
    name: string;
    email?: string;                 // email для входа
    role: UserRole;
    avatar?: string;                // эмодзи или base64 фото
    avatarType?: "emoji" | "photo"; // тип аватара
    measurements?: BodyMeasurement[];
};

const LS_USERS_KEY = "trainingBaza:users:v2";
const LS_ACTIVE_USER_KEY = "trainingBaza:activeUserId:v1";

export function safeId(): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = globalThis.crypto;
    return typeof c?.randomUUID === "function" ? c.randomUUID() : `u_${Date.now()}`;
}

export function loadUsers(): User[] {
    // Попробуем загрузить v2, если нет — мигрируем из v1
    let data = lsGetJSON<unknown>(LS_USERS_KEY, null);

    if (!data) {
        // Миграция из v1
        const oldData = lsGetJSON<unknown>("trainingBaza:users:v1", []);
        if (Array.isArray(oldData) && oldData.length > 0) {
            // Добавляем роль user всем существующим пользователям
            const migrated = oldData.map((u: any) => ({
                ...u,
                role: "user" as UserRole,
                avatarType: u.avatar && !AVATAR_OPTIONS.includes(u.avatar) ? "photo" : "emoji",
            }));
            lsSetJSON(LS_USERS_KEY, migrated);
            return migrated as User[];
        }
        data = [];
    }

    if (!Array.isArray(data)) return [];
    return data.filter(
        (u): u is User =>
            u !== null &&
            typeof u === "object" &&
            typeof (u as User).id === "string" &&
            typeof (u as User).name === "string"
    ).map(u => ({
        ...u,
        // Если имя пустое — даём дефолтное
        name: u.name && u.name.trim() ? u.name : `Пользователь ${u.id.slice(0, 4)}`,
        role: u.role ?? "user",
        avatarType: u.avatarType ?? (u.avatar && !AVATAR_OPTIONS.includes(u.avatar) ? "photo" : "emoji"),
    }));
}

export function saveUsers(users: User[]): void {
    lsSetJSON(LS_USERS_KEY, users);
}

export function loadActiveUserId(): string | null {
    const id = lsGet(LS_ACTIVE_USER_KEY);
    return id && typeof id === "string" ? id : null;
}

export function saveActiveUserId(id: string): void {
    lsSet(LS_ACTIVE_USER_KEY, id);
}

export function createUser(name?: string, role: UserRole = "user"): User {
    return {
        id: safeId(),
        name: name ?? `Атлет ${Date.now()}`,
        role,
        avatarType: "emoji",
        measurements: [],
    };
}

/**
 * Проверка, является ли пользователь админом
 */
export function isAdmin(user: User | undefined): boolean {
    return user?.role === "admin";
}

/**
 * Может ли пользователь редактировать профиль другого пользователя
 */
export function canEditUser(currentUser: User | undefined, targetUserId: string): boolean {
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    return currentUser.id === targetUserId;
}

/**
 * Может ли пользователь добавлять результаты за другого пользователя
 */
export function canAddResultsFor(currentUser: User | undefined, targetUserId: string): boolean {
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    return currentUser.id === targetUserId;
}

/**
 * Обновить профиль пользователя
 */
export function updateUser(
    users: User[],
    userId: string,
    updates: Partial<Pick<User, "name" | "avatar" | "avatarType" | "role">>
): User[] {
    // Валидация: не принимаем пустое имя
    const safeUpdates = { ...updates };
    if (safeUpdates.name !== undefined && !safeUpdates.name.trim()) {
        delete safeUpdates.name;
    }
    return users.map((u) => (u.id === userId ? { ...u, ...safeUpdates } : u));
}

/**
 * Удалить пользователя
 */
export function deleteUser(users: User[], userId: string): User[] {
    return users.filter((u) => u.id !== userId);
}

/**
 * Очистить всех пользователей (сбросить localStorage)
 */
export function clearAllUsers(): void {
    if (typeof window !== "undefined") {
        localStorage.removeItem(LS_USERS_KEY);
        localStorage.removeItem(LS_ACTIVE_USER_KEY);
    }
}

/**
 * Добавить измерения тела
 */
export function addMeasurement(
    users: User[],
    userId: string,
    measurement: Omit<BodyMeasurement, "ts">
): User[] {
    const entry: BodyMeasurement = {
        ...measurement,
        ts: new Date().toISOString(),
    };

    return users.map((u) => {
        if (u.id !== userId) return u;
        return {
            ...u,
            measurements: [...(u.measurements ?? []), entry],
        };
    });
}

/**
 * Получить последние измерения пользователя
 */
export function getLatestMeasurements(user: User): BodyMeasurement | null {
    const m = user.measurements;
    if (!m || m.length === 0) return null;
    return m[m.length - 1];
}

/**
 * Получить историю измерений (последние N записей)
 */
export function getMeasurementHistory(user: User, limit: number = 10): BodyMeasurement[] {
    const m = user.measurements ?? [];
    return m.slice(-limit).reverse();
}

/**
 * Инициализация пользователей: если нет — создаём админа.
 * Возвращает { users, activeUserId }
 */
export function initUsers(): { users: User[]; activeUserId: string } {
    let users = loadUsers();
    if (users.length === 0) {
        // Создаём первого пользователя как админа
        const first = createUser("Тренер", "admin");
        users = [first];
        saveUsers(users);
    }

    const savedActiveId = loadActiveUserId();
    const activeUserId =
        savedActiveId && users.some((u) => u.id === savedActiveId)
            ? savedActiveId
            : users[0].id;
    saveActiveUserId(activeUserId);

    return { users, activeUserId };
}

/**
 * Список доступных аватаров (эмодзи)
 */
export const AVATAR_OPTIONS = [
    "🏃", "🏋️", "🧘", "🤸", "💪", "🥇", "🏆", "⚡",
    "🔥", "🎯", "👤", "👩", "👨", "🧑", "🦸", "🥷"
];

/**
 * Конвертировать файл в base64
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
}

/**
 * Максимальный размер фото в байтах (10MB)
 */
export const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

/**
 * Проверить, является ли строка base64 изображением
 */
export function isBase64Image(str: string): boolean {
    return str.startsWith("data:image/");
}
