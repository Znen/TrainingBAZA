/**
 * Модуль расчёта 1ПМ (одноповторного максимума)
 * 
 * Формулы:
 * - Epley: 1RM = weight × (1 + reps/30)
 * - Brzycki: 1RM = weight × (36 / (37 - reps))
 * - NSCA: 1RM = weight × (1 + 0.033 × reps)
 */

export type FormulaType = 'epley' | 'brzycki' | 'nsca';

/**
 * Рассчитать 1ПМ по формуле Epley
 */
export function calculate1RMEpley(weight: number, reps: number): number {
    if (reps <= 0) return weight;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
}

/**
 * Рассчитать 1ПМ по формуле Brzycki
 */
export function calculate1RMBrzycki(weight: number, reps: number): number {
    if (reps <= 0) return weight;
    if (reps === 1) return weight;
    if (reps >= 37) return weight * 2; // защита от деления на ноль
    return weight * (36 / (37 - reps));
}

/**
 * Рассчитать 1ПМ по формуле NSCA
 */
export function calculate1RMNSCA(weight: number, reps: number): number {
    if (reps <= 0) return weight;
    if (reps === 1) return weight;
    return weight * (1 + 0.033 * reps);
}

/**
 * Рассчитать 1ПМ по выбранной формуле
 */
export function calculate1RM(
    weight: number,
    reps: number,
    formula: FormulaType = 'epley'
): number {
    switch (formula) {
        case 'brzycki':
            return calculate1RMBrzycki(weight, reps);
        case 'nsca':
            return calculate1RMNSCA(weight, reps);
        case 'epley':
        default:
            return calculate1RMEpley(weight, reps);
    }
}

/**
 * Стандартные проценты для тренировок
 */
export const TRAINING_PERCENTAGES = [50, 60, 70, 75, 80, 85, 90, 95] as const;

/**
 * Рассчитать веса для всех процентов от 1ПМ
 */
export function getPercentageWeights(oneRM: number): Array<{ percent: number; weight: number }> {
    return TRAINING_PERCENTAGES.map(percent => ({
        percent,
        weight: Math.round(oneRM * percent / 100 * 10) / 10 // округление до 0.1
    }));
}

/**
 * Рассчитать вес для конкретного процента
 */
export function getWeightForPercent(oneRM: number, percent: number): number {
    return Math.round(oneRM * percent / 100 * 10) / 10;
}

/**
 * Округлить вес до ближайшего шага (обычно 2.5 или 5 кг)
 */
export function roundToStep(weight: number, step: number = 2.5): number {
    return Math.round(weight / step) * step;
}

/**
 * Получить веса с округлением до грифа
 */
export function getPercentageWeightsRounded(
    oneRM: number,
    step: number = 2.5
): Array<{ percent: number; weight: number; roundedWeight: number }> {
    return TRAINING_PERCENTAGES.map(percent => {
        const exactWeight = oneRM * percent / 100;
        return {
            percent,
            weight: Math.round(exactWeight * 10) / 10,
            roundedWeight: roundToStep(exactWeight, step)
        };
    });
}
