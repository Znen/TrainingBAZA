import { supabase } from "./supabase";
import { FullProgram, Program, Cycle, Phase, Workout, WorkoutBlock, BlockRow } from "@/types/program";

// --- Programs ---

export async function getPrograms(): Promise<Program[]> {
    const { data, error } = await supabase
        .from("programs")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
}

// Shared helper for creating the full tree structure
function buildProgramTree(program: any, fullData: any[]): FullProgram {
    const cycles = (fullData || []).map((cycle: any) => ({
        ...cycle,
        phases: (cycle.phases || [])
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((phase: any) => ({
                ...phase,
                workouts: (phase.workouts || [])
                    .sort((a: any, b: any) => a.order_index - b.order_index)
                    .map((workout: any) => ({
                        ...workout,
                        blocks: (workout.blocks || [])
                            .sort((a: any, b: any) => a.order_index - b.order_index)
                            .map((block: any) => ({
                                ...block,
                                rows: (block.rows || [])
                                    .sort((a: any, b: any) => a.order_index - b.order_index)
                            }))
                    }))
            }))
    }));

    return { ...program, cycles };
}

export async function getFullProgramById(id: string): Promise<FullProgram | null> {
    const { data: program, error } = await supabase
        .from("programs")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !program) return null;

    const { data: fullData, error: deepError } = await supabase
        .from("cycles")
        .select(`
            *,
            phases (
                *,
                workouts (
                    *,
                    blocks:workout_blocks (
                        *,
                        rows:block_rows (*)
                    )
                )
            )
        `)
        .eq("program_id", program.id)
        .order("order_index", { ascending: true });

    if (deepError) throw deepError;

    return buildProgramTree(program, fullData);
}

export async function getActiveProgram(): Promise<FullProgram | null> {
    const { data: program, error } = await supabase
        .from("programs")
        .select("*")
        .eq("is_active", true)
        .single();

    if (error || !program) return null;

    const { data: fullData, error: deepError } = await supabase
        .from("cycles")
        .select(`
            *,
            phases (
                *,
                workouts (
                    *,
                    blocks:workout_blocks (
                        *,
                        rows:block_rows (*)
                    )
                )
            )
        `)
        .eq("program_id", program.id)
        .order("order_index", { ascending: true });

    if (deepError) throw deepError;

    return buildProgramTree(program, fullData);
}

export async function createProgram(title: string, startDate: string): Promise<Program> {
    const { data, error } = await supabase
        .from("programs")
        .insert({ title, start_date: startDate })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function setActiveProgram(id: string) {
    await supabase.from("programs").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");

    const { error } = await supabase
        .from("programs")
        .update({ is_active: true })
        .eq("id", id);

    if (error) throw error;
}

// --- Cycles ---

export async function createCycle(programId: string, title: string, orderIndex: number, color?: string): Promise<Cycle> {
    const { data, error } = await supabase
        .from("cycles")
        .insert({ program_id: programId, title, order_index: orderIndex, color })
        .select()
        .single();
    if (error) throw error;
    return data;
}

/**
 * Creates a "Smart Cycle" with pre-populated Phases, Workouts, and Blocks.
 * Structure: 4 Phases -> 4 Workouts each -> Standard Blocks (A, B, C, D, E).
 */
export async function createSmartCycle(programId: string, title: string, orderIndex: number, color: string) {
    // 1. Create Cycle
    const cycle = await createCycle(programId, title, orderIndex, color);

    // 2. Create 4 Phases
    for (let pLink = 1; pLink <= 4; pLink++) {
        // User asked to replace "Week" with "Phase", but in the hierarchy they said: 
        // "Cycle... consists of 4 phases... In a phase 4 workouts".
        // Let's name them "Фаза ${pLink}" for now.
        const phaseTitle = `Фаза ${pLink}`;
        const phase = await createPhase(cycle.id, phaseTitle, pLink);

        // 3. Create 4 Workouts per Phase
        for (let wLink = 1; wLink <= 4; wLink++) {
            const workout = await createWorkout(phase.id, `Тренировка ${wLink}`, wLink);

            // 4. Create Standard Blocks
            // Structure:
            // A: A1, A2
            // B: B1, B2
            // C: C1, C2
            // D: D1, D2
            // E: E1, E2, E3, E4, E5
            // F: F1

            const standardBlocks = [
                { rows: ['A1', 'A2'] },
                { rows: ['B1', 'B2'] },
                { rows: ['C1', 'C2'] },
                { rows: ['D1', 'D2'] },
                { rows: ['E1', 'E2', 'E3', 'E4', 'E5'] },
                { rows: ['F1'] }
            ];

            for (let bIndex = 0; bIndex < standardBlocks.length; bIndex++) {
                const blockDef = standardBlocks[bIndex];
                // Create Block
                const block = await createBlock(workout.id, undefined, bIndex + 1);

                // Create Rows
                for (let rIndex = 0; rIndex < blockDef.rows.length; rIndex++) {
                    const prefix = blockDef.rows[rIndex];
                    await createRow(block.id, "", rIndex + 1, prefix);
                }
            }
        }
    }
}

// --- Phases ---

export async function createPhase(cycleId: string, title: string, orderIndex: number): Promise<Phase> {
    const { data, error } = await supabase
        .from("phases")
        .insert({ cycle_id: cycleId, title, order_index: orderIndex })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// --- Workouts ---

export async function createWorkout(phaseId: string, title: string, orderIndex: number): Promise<Workout> {
    const { data, error } = await supabase
        .from("workouts")
        .insert({ phase_id: phaseId, title, order_index: orderIndex })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// --- Blocks & Rows (Builder) ---

export async function createBlock(workoutId: string, title: string | undefined, orderIndex: number): Promise<WorkoutBlock> {
    const { data, error } = await supabase
        .from("workout_blocks")
        .insert({ workout_id: workoutId, title, order_index: orderIndex })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function createRow(blockId: string, content: string, orderIndex: number, prefix?: string): Promise<BlockRow> {
    const { data, error } = await supabase
        .from("block_rows")
        .insert({ block_id: blockId, content, prefix, order_index: orderIndex })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// --- Deletions ---

export async function deleteNode(table: 'programs' | 'cycles' | 'phases' | 'workouts' | 'workout_blocks' | 'block_rows', id: string) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
}

// --- Updates ---
export async function updateNode(
    table: 'programs' | 'cycles' | 'phases' | 'workouts' | 'workout_blocks' | 'block_rows',
    id: string,
    payload: any
) {
    const { error } = await supabase.from(table).update(payload).eq("id", id);
    if (error) throw error;
}
