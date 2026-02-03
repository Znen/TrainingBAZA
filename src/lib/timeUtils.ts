/**
 * Утилиты для работы со временем
 * Формат ввода: MM:SS (например 04:20)
 * Хранение: секунды (число)
 */

/**
 * Парсит строку времени MM:SS в секунды
 * @param timeStr строка в формате MM:SS или просто число секунд
 * @returns число секунд или null если некорректный формат
 */
export function parseTimeToSeconds(timeStr: string): number | null {
    const trimmed = timeStr.trim();

    // Если содержит двоеточие — парсим как MM:SS
    if (trimmed.includes(':')) {
        const parts = trimmed.split(':');
        if (parts.length !== 2) return null;

        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);

        if (isNaN(minutes) || isNaN(seconds)) return null;
        if (seconds < 0 || seconds >= 60) return null;
        if (minutes < 0) return null;

        return minutes * 60 + seconds;
    }

    // Иначе пробуем как число (секунды)
    const num = parseFloat(trimmed);
    if (isNaN(num) || num < 0) return null;

    return Math.round(num);
}

/**
 * Форматирует секунды в строку MM:SS
 * @param totalSeconds количество секунд
 * @returns строка в формате MM:SS
 */
export function formatSecondsToTime(totalSeconds: number): string {
    if (totalSeconds < 0) return '00:00';

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Форматирует секунды в читаемую строку
 * Для коротких интервалов (< 60 сек) показывает секунды
 * Для длинных — MM:SS
 */
export function formatTimeDisplay(totalSeconds: number): string {
    if (totalSeconds < 60) {
        return `${Math.round(totalSeconds)} сек`;
    }
    return formatSecondsToTime(totalSeconds);
}

/**
 * Проверяет, является ли единица измерения временной
 */
export function isTimeUnit(unit: string): boolean {
    return unit === 'sec' || unit === 'min';
}

/**
 * Проверяет, нужно ли использовать формат MM:SS для ввода
 * (для дисциплин >60 сек, где меньше = лучше)
 */
export function shouldUseTimeInput(unit: string, direction: string): boolean {
    return unit === 'sec' && direction === 'lower_better';
}
