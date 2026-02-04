export interface Program {
    id: string;
    title: string;
    start_date: string; // ISO Date string (YYYY-MM-DD)
    is_active: boolean;
    created_at: string;
}

export interface Cycle {
    id: string;
    program_id: string;
    title: string;
    color?: string;
    order_index: number;
}

export interface Phase {
    id: string;
    cycle_id: string;
    title: string;
    order_index: number; // 1, 2, 3, 4
    color?: string; // New field
    created_at?: string;
}

export interface Workout {
    id: string;
    phase_id: string;
    title: string;
    order_index: number; // 1, 2, 3, 4
}

export interface WorkoutBlock {
    id: string;
    workout_id: string;
    title?: string; // e.g., "15 min"
    order_index: number;
    rows?: BlockRow[]; // Joined rows
}

export interface BlockRow {
    id: string;
    block_id: string;
    prefix?: string; // e.g., "A1"
    content: string;
    order_index: number;
}

// Helper type for full tree structure
export interface FullProgram extends Program {
    cycles: (Cycle & {
        phases: (Phase & {
            workouts: (Workout & {
                blocks: (WorkoutBlock & {
                    rows: BlockRow[];
                })[];
            })[];
        })[];
    })[];
}
