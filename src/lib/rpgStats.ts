/**
 * RPG Stats Module - расчёт характеристик персонажа
 * Использует нормативы тренера для определения уровня
 */

import type { HistoryBySlug } from './results';
import standardsData from '../../standards.json';

export type StatType = 'strength' | 'endurance' | 'agility' | 'flexibility';

export interface StatInfo {
    type: StatType;
    name: string;
    nameRu: string;
    icon: string;
    color: string;
}

export interface StatLevel {
    stat: StatType;
    name: string;
    icon: string;
    color: string;
    level: number;       // 0-100
    progress: number;    // 0-100% до следующего уровня
    disciplineCount: number;
}

export interface Discipline {
    slug: string;
    name: string;
    category: string;
    unit: string;
    direction: 'higher_better' | 'lower_better';
    stat: StatType;
    has1RM: boolean;
    icon: string;
}

export interface StandardLevel {
    id: string;
    name: string;
    points: number;
    color: string;
}

export interface DisciplineStandard {
    category: string;
    unit: string;
    direction: 'higher_better' | 'lower_better';
    values: (number | null)[];
    note?: string;
}

// Уровни нормативов
export const STANDARD_LEVELS: StandardLevel[] = standardsData.levels as StandardLevel[];

// Нормативы по дисциплинам
export const STANDARDS: Record<string, DisciplineStandard> = standardsData.standards as Record<string, DisciplineStandard>;

// Информация о характеристиках
export const STATS: Record<StatType, StatInfo> = {
    strength: {
        type: 'strength',
        name: 'Strength',
        nameRu: 'Сила',
        icon: '💪',
        color: '#ef4444'
    },
    endurance: {
        type: 'endurance',
        name: 'Endurance',
        nameRu: 'Выносливость',
        icon: '🏃',
        color: '#22c55e'
    },
    agility: {
        type: 'agility',
        name: 'Agility',
        nameRu: 'Ловкость',
        icon: '🤸',
        color: '#3b82f6'
    },
    flexibility: {
        type: 'flexibility',
        name: 'Flexibility',
        nameRu: 'Гибкость',
        icon: '🧘',
        color: '#a855f7'
    }
};

/**
 * Получить последний результат из истории
 */
function getLatestValue(items: { ts: string; value: number }[] | undefined): number | null {
    if (!items || items.length === 0) return null;
    const sorted = [...items].sort((a, b) =>
        new Date(b.ts).getTime() - new Date(a.ts).getTime()
    );
    return sorted[0].value;
}

/**
 * Определить уровень норматива для значения
 */
export function getStandardLevel(
    slug: string,
    value: number,
    userWeight?: number
): { level: StandardLevel | null; nextLevel: StandardLevel | null; progress: number; points: number } {
    const standard = STANDARDS[slug];
    if (!standard) {
        return { level: null, nextLevel: null, progress: 0, points: 0 };
    }

    // Normalize value if unit is xBW (коэффициент от веса тела)
    let processedValue = value;
    if (userWeight && (standard.unit === 'xBW' || standard.unit === 'xСВ')) {
        processedValue = value / userWeight;
    }

    const values = standard.values;
    const direction = standard.direction;
    let achievedIndex = -1;

    // Найти достигнутый уровень
    for (let i = values.length - 1; i >= 0; i--) {
        const threshold = values[i];
        if (threshold === null) continue;

        const passed = direction === 'higher_better'
            ? processedValue >= threshold
            : processedValue <= threshold;

        if (passed) {
            achievedIndex = i;
            break;
        }
    }

    if (achievedIndex === -1) {
        // Не достиг даже минималки
        const firstValid = values.findIndex(v => v !== null);
        if (firstValid !== -1 && values[firstValid] !== null) {
            const threshold = values[firstValid]!;
            let progress: number;
            if (direction === 'higher_better') {
                progress = Math.min(99, Math.max(0, (processedValue / threshold) * 100));
            } else {
                progress = Math.min(99, Math.max(0, (threshold / processedValue) * 100));
            }
            return {
                level: null,
                nextLevel: STANDARD_LEVELS[firstValid],
                progress,
                points: Math.round(progress * 0.1) // 0-10 очков до минималки
            };
        }
        return { level: null, nextLevel: null, progress: 0, points: 0 };
    }

    const currentLevel = STANDARD_LEVELS[achievedIndex];
    const nextIndex = achievedIndex + 1;
    const nextLevel = nextIndex < STANDARD_LEVELS.length ? STANDARD_LEVELS[nextIndex] : null;

    // Рассчитать прогресс до следующего уровня
    let progress = 100;
    if (nextLevel && values[nextIndex] !== null) {
        const currentThreshold = values[achievedIndex]!;
        const nextThreshold = values[nextIndex]!;

        if (direction === 'higher_better') {
            const range = nextThreshold - currentThreshold;
            progress = range > 0 ? Math.min(99, ((processedValue - currentThreshold) / range) * 100) : 0;
        } else {
            const range = currentThreshold - nextThreshold;
            progress = range > 0 ? Math.min(99, ((currentThreshold - processedValue) / range) * 100) : 0;
        }
        progress = Math.max(0, Math.round(progress));
    }

    return {
        level: currentLevel,
        nextLevel,
        progress,
        points: currentLevel.points + Math.round((progress / 100) * 10)
    };
}

/**
 * Расчёт уровня характеристики на основе результатов пользователя
 */
export function calculateStatLevel(
    stat: StatType,
    disciplines: Discipline[],
    history: HistoryBySlug,
    userWeight?: number
): StatLevel {
    const statInfo = STATS[stat];
    const relevantDisciplines = disciplines.filter(d => d.stat === stat);

    if (relevantDisciplines.length === 0) {
        return {
            stat,
            name: statInfo.nameRu,
            icon: statInfo.icon,
            color: statInfo.color,
            level: 0,
            progress: 0,
            disciplineCount: 0
        };
    }

    let totalPoints = 0;
    let count = 0;

    for (const d of relevantDisciplines) {
        const value = getLatestValue(history[d.slug]);
        if (value !== null) {
            const { points } = getStandardLevel(d.slug, value, userWeight);
            totalPoints += points;
            count++;
        }
    }

    const avgPoints = count > 0 ? totalPoints / count : 0;
    const level = Math.round(avgPoints);
    const progress = Math.round((avgPoints - Math.floor(avgPoints)) * 100);

    return {
        stat,
        name: statInfo.nameRu,
        icon: statInfo.icon,
        color: statInfo.color,
        level,
        progress,
        disciplineCount: count
    };
}

// Stat types excluded from cabinet display (retired)
const RETIRED_STATS: StatType[] = ['flexibility'];

/**
 * Получить все характеристики пользователя
 * flexibility исключён — подвижность теперь информационная
 */
export function getUserStats(
    disciplines: Discipline[],
    history: HistoryBySlug,
    userWeight?: number
): StatLevel[] {
    const statTypes: StatType[] = ['strength', 'endurance', 'agility', 'flexibility'];
    return statTypes
        .filter(s => !RETIRED_STATS.includes(s))
        .map(stat => calculateStatLevel(stat, disciplines, history, userWeight));
}

/**
 * Расчёт общего уровня персонажа
 */
export function getOverallLevel(stats: StatLevel[]): number {
    const activeStats = stats.filter(s => s.disciplineCount > 0);
    if (activeStats.length === 0) return 1;

    const avg = activeStats.reduce((sum, s) => sum + s.level, 0) / activeStats.length;
    return Math.max(1, Math.round(avg));
}

/**
 * Получить название ранга на основе уровня
 */
export function getRankTitle(level: number): { title: string; titleRu: string; color: string } {
    const matchedLevel = STANDARD_LEVELS.slice().reverse().find(l => level >= l.points);
    if (matchedLevel) {
        return {
            title: matchedLevel.id,
            titleRu: matchedLevel.name,
            color: matchedLevel.color
        };
    }
    return { title: 'none', titleRu: 'Без уровня', color: '#6b7280' };
}

/**
 * Получить детальную информацию о достижениях пользователя по дисциплинам
 * Retired disciplines (stat: flexibility) are excluded
 */
export function getDisciplineAchievements(
    disciplines: Discipline[],
    history: HistoryBySlug,
    userWeight?: number
): Array<{
    discipline: Discipline;
    value: number | null;
    formatted: string;
    date: string | null;
    level: StandardLevel | null;
    nextLevel: StandardLevel | null;
    progress: number;
}> {
    const activeDisciplines = disciplines.filter(d => !RETIRED_STATS.includes(d.stat));
    return activeDisciplines.map(d => {
        // Find latest item
        const items = history[d.slug];
        let latestItem = null;
        if (items && items.length > 0) {
            latestItem = [...items].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0];
        }

        if (!latestItem) {
            return {
                discipline: d,
                value: null,
                formatted: "-",
                date: null,
                level: null,
                nextLevel: STANDARD_LEVELS[0],
                progress: 0
            };
        }

        const value = latestItem.value;
        const { level, nextLevel, progress } = getStandardLevel(d.slug, value, userWeight);

        return {
            discipline: d,
            value,
            formatted: `${value} ${d.unit}`,
            date: new Date(latestItem.ts).toLocaleDateString("ru-RU"),
            level,
            nextLevel,
            progress
        };
    });
}
