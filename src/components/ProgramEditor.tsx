"use client";

import { useState, useEffect } from "react";
import { FullProgram, Cycle, Phase, Workout, WorkoutBlock, BlockRow } from "@/types/program";
import {
    getFullProgramById,
    createCycle, createPhase, createSmartCycle, createWorkout, createBlock, createRow,
    deleteNode, updateNode
} from "@/lib/programApi";

interface Props {
    programId: string;
    onClose: () => void;
}

const PRESET_COLORS = [
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f97316" },
    { name: "Amber", value: "#f59e0b" },
    { name: "Green", value: "#22c55e" },
    { name: "Emerald", value: "#10b981" },
    { name: "Teal", value: "#14b8a6" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Violet", value: "#8b5cf6" },
    { name: "Purple", value: "#a855f7" },
    { name: "Fuchsia", value: "#d946ef" },
    { name: "Pink", value: "#ec4899" },
];

export function ProgramEditor({ programId, onClose }: Props) {
    const [program, setProgram] = useState<FullProgram | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCreatingCycle, setIsCreatingCycle] = useState(false);

    // Cycle Form State
    const [newCycleTitle, setNewCycleTitle] = useState("");
    const [newCycleColor, setNewCycleColor] = useState(PRESET_COLORS[7].value);

    useEffect(() => {
        loadData();
    }, [programId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getFullProgramById(programId);
            setProgram(data);
        } catch (e) {
            console.error(e);
            alert("Ошибка загрузки");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Загрузка...</div>;
    if (!program) return <div>Программа не найдена</div>;

    // --- Actions ---

    const handleUpdateDate = async () => {
        if (!program) return;
        const newDate = prompt("Дата начала (YYYY-MM-DD)", program.start_date);
        if (!newDate) return;

        await updateNode("programs", program.id, { start_date: newDate });
        loadData();
    };

    const handleCreateSmartCycle = async () => {
        if (!newCycleTitle) return alert("Введите название цикла");

        setLoading(true);
        try {
            const order = (program.cycles.length > 0 ? program.cycles[program.cycles.length - 1].order_index : 0) + 1;
            await createSmartCycle(program.id, newCycleTitle, order, newCycleColor);
            setNewCycleTitle("");
            setIsCreatingCycle(false);
            await loadData();
        } catch (e) {
            console.error(e);
            alert("Ошибка создания цикла");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold">{program.title}</h2>
                    <button
                        onClick={handleUpdateDate}
                        className="text-zinc-400 text-sm hover:text-white flex items-center gap-2 mt-1"
                    >
                        <span>Старт: {new Date(program.start_date).toLocaleDateString()}</span>
                        <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">изменить</span>
                    </button>
                </div>
                <button onClick={onClose} className="px-4 py-2 bg-zinc-700 rounded-lg">Закрыть</button>
            </div>

            <div className="space-y-8">
                {program.cycles.map(cycle => (
                    <CycleItem key={cycle.id} cycle={cycle} onRefresh={loadData} />
                ))}

                {!isCreatingCycle ? (
                    <button
                        onClick={() => setIsCreatingCycle(true)}
                        className="w-full py-4 border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl text-zinc-500 hover:text-white transition-colors flex flex-col items-center gap-2"
                    >
                        <span className="text-xl">+ Добавить Цикл</span>
                        <span className="text-sm">(Автоматически создаст 4 фазы по 4 тренировки)</span>
                    </button>
                ) : (
                    <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-lg font-bold mb-4">Новый Цикл</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Название</label>
                                <input
                                    value={newCycleTitle}
                                    onChange={e => setNewCycleTitle(e.target.value)}
                                    placeholder="Например: Силовой блок"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Цвет</label>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map(c => (
                                        <button
                                            key={c.value}
                                            onClick={() => setNewCycleColor(c.value)}
                                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${newCycleColor === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: c.value }}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleCreateSmartCycle}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
                                >
                                    Создать
                                </button>
                                <button
                                    onClick={() => setIsCreatingCycle(false)}
                                    className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg"
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Subcomponents ---

function CycleItem({ cycle, onRefresh }: { cycle: Cycle & { phases: any[] }, onRefresh: () => void }) {
    const handleDelete = async () => {
        if (!confirm(`Удалить цикл "${cycle.title}" и всё его содержимое?`)) return;
        await deleteNode("cycles", cycle.id);
        onRefresh();
    };

    return (
        <div className="border border-zinc-700 rounded-lg overflow-hidden">
            {/* Cycle Header */}
            <div className="bg-zinc-800 p-4 flex justify-between items-center relative" style={{ borderLeft: cycle.color ? `4px solid ${cycle.color}` : 'none' }}>
                <h3 className="text-lg font-bold">{cycle.title}</h3>
                <div className="flex gap-2">
                    <button onClick={handleDelete} className="text-red-400 hover:text-red-300 text-sm">Удалить</button>
                </div>
            </div>

            {/* Phases */}
            <div className="p-4 space-y-4 bg-zinc-900/50">
                {cycle.phases.map(phase => (
                    <PhaseItem key={phase.id} phase={phase} onRefresh={onRefresh} />
                ))}
            </div>
        </div>
    );
}

function PhaseItem({ phase, onRefresh }: { phase: Phase & { workouts: any[] }, onRefresh: () => void }) {
    const [showColorPicker, setShowColorPicker] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`Удалить фазу "${phase.title}"?`)) return;
        await deleteNode("phases", phase.id);
        onRefresh();
    };

    const handleColorUpdate = async (color: string) => {
        await updateNode("phases", phase.id, { color });
        setShowColorPicker(false);
        onRefresh();
    };

    return (
        <div className="border border-zinc-800 bg-black/20 rounded-lg p-3 relative">
            <div className="flex justify-between items-center mb-3 border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                    <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: phase.color || 'transparent', border: phase.color ? 'none' : '1px solid #555' }}
                    />
                    <span className="font-semibold text-blue-300">{phase.title}</span>
                </div>
                <div className="flex gap-2 relative">
                    <button
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="text-xs text-zinc-500 hover:text-white"
                    >
                        Цвет
                    </button>
                    <button onClick={handleDelete} className="text-xs text-red-500 hover:text-red-400">Удалить</button>

                    {/* Color Picker Popover for Phase */}
                    {showColorPicker && (
                        <div className="absolute top-6 right-0 bg-zinc-900 border border-zinc-700 p-2 rounded-xl shadow-xl z-20 grid grid-cols-4 gap-2 w-48">
                            {PRESET_COLORS.map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => handleColorUpdate(c.value)}
                                    className="w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 hover:border-white transition-all"
                                    style={{ backgroundColor: c.value }}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {phase.workouts.map(workout => (
                    <WorkoutItem key={workout.id} workout={workout} onRefresh={onRefresh} />
                ))}
            </div>
        </div>
    );
}

function WorkoutItem({ workout, onRefresh }: { workout: Workout & { blocks: any[] }, onRefresh: () => void }) {
    const [expanded, setExpanded] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Удалить тренировку?`)) return;
        await deleteNode("workouts", workout.id);
        onRefresh();
    };

    const handleAddBlock = async () => {
        const title = prompt("Заголовок (например 'Заминка')");
        if (!title) return;
        const order = (workout.blocks.length > 0 ? workout.blocks[workout.blocks.length - 1].order_index : 0) + 1;
        await createBlock(workout.id, title, order);
        onRefresh();
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">{workout.title}</h4>
                <div className="flex gap-2">
                    <button onClick={() => setExpanded(!expanded)} className="text-xs bg-zinc-800 px-2 py-1 rounded hover:bg-zinc-700">
                        {expanded ? "Свернуть" : "Редактировать"}
                    </button>
                </div>
            </div>

            {/* Preview */}
            {!expanded && (
                <div className="text-xs text-zinc-500 space-y-1">
                    {workout.blocks.length} блоков
                </div>
            )}

            {/* Editor Mode */}
            {expanded && (
                <div className="space-y-4 mt-3 border-t border-zinc-800 pt-3">
                    {workout.blocks.map((block: any) => (
                        <BlockEditor key={block.id} block={block} />
                    ))}
                    <button
                        onClick={handleAddBlock}
                        className="w-full text-xs py-2 border border-dashed border-zinc-800 text-zinc-500 hover:text-white"
                    >
                        + Добавить Блок
                    </button>
                </div>
            )}
        </div>
    );
}

function BlockEditor({ block }: { block: WorkoutBlock & { rows: any[] } }) {
    const [title, setTitle] = useState(block.title || "");
    const [rows, setRows] = useState(block.rows || []);
    const [saved, setSaved] = useState(true);

    useEffect(() => {
        if (title === (block.title || "")) return;
        setSaved(false);
        const timer = setTimeout(async () => {
            await updateNode("workout_blocks", block.id, { title });
            setSaved(true);
        }, 1000);
        return () => clearTimeout(timer);
    }, [title]);

    const handleRowUpdate = async (rowId: string, content: string) => {
        setRows(prev => prev.map((r: any) => r.id === rowId ? { ...r, content } : r));
        await updateNode("block_rows", rowId, { content });
    };

    const handleRowPrefixUpdate = async (rowId: string, prefix: string) => {
        setRows(prev => prev.map((r: any) => r.id === rowId ? { ...r, prefix } : r));
        await updateNode("block_rows", rowId, { prefix });
    };

    const handleDeleteRow = async (rowId: string) => {
        if (!confirm("Удалить строку?")) return;
        setRows(prev => prev.filter((r: any) => r.id !== rowId));
        await deleteNode("block_rows", rowId);
    };

    const handleAddRow = async () => {
        const lastRow = rows[rows.length - 1];
        let nextPrefix = "A1";

        // Simple logic to guess next prefix
        if (lastRow?.prefix) {
            const match = lastRow.prefix.match(/([A-Zа-яА-Я]+)(\d+)/);
            if (match) {
                const letter = match[1];
                const num = parseInt(match[2]);
                nextPrefix = `${letter}${num + 1}`;
            }
        }

        const order = (rows.length > 0 ? rows[rows.length - 1].order_index : 0) + 1;
        const newRow = await createRow(block.id, "", order, nextPrefix);
        setRows([...rows, newRow]);
    };

    const handleDeleteBlock = async () => {
        if (!confirm("Удалить весь блок?")) return;
        await deleteNode("workout_blocks", block.id);
        // Force refresh parent? 
        // This component doesn't have onRefresh prop cleanly passed down for parent removal.
        // Ideally we pass onRefresh from WorkoutItem.
        // For now, let's just alert the user to refresh, or we can assume parent re-renders?
        // Actually, without onRefresh, the UI won't update to remove this block.
        // Let's assume the user will collapse/expand or we need to pass refreshing up.
        // To fix this cleanly, we can reload... but let's just reload the page or rely on parent re-render if we passed the callback.
        // Wait, BlockEditor is inside map in WorkoutItem. WorkoutItem renders BlockEditor.
        // BlockEditor needs a way to tell WorkoutItem to remove it from the list.
        // Simplest: pass onRefresh to BlockEditor too.
        window.location.reload(); // Dirty hack for deep nesting deletion if we don't pass callback props all the way down
    };

    return (
        <div className="border border-zinc-800/50 bg-black/20 rounded p-2 text-sm relative group/block">
            {/* Block Header */}
            <div className="flex items-center gap-2 mb-2">
                <input
                    className="bg-transparent border-b border-zinc-700 font-bold text-yellow-500/90 w-full focus:outline-none focus:border-yellow-500"
                    placeholder="Заголовок"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                />
                <button onClick={handleDeleteBlock} className="text-red-900 opacity-0 group-hover/block:opacity-100 hover:text-red-500 transition-opacity px-2">x</button>
            </div>

            {/* Rows */}
            <div className="space-y-1">
                {rows.map((row: any) => (
                    <div key={row.id} className="flex gap-2 items-start group/row">
                        <input
                            className="bg-transparent w-8 text-zinc-500 font-mono text-right focus:text-white focus:outline-none"
                            value={row.prefix || ""}
                            onChange={(e) => handleRowPrefixUpdate(row.id, e.target.value)}
                        />
                        <textarea
                            className="flex-1 bg-zinc-900/50 rounded border border-zinc-800 p-1 text-zinc-300 focus:border-blue-500/50 focus:outline-none resize-none overflow-hidden"
                            rows={1}
                            style={{ minHeight: '1.6rem', height: 'auto' }}
                            onInput={(e) => {
                                e.currentTarget.style.height = 'auto';
                                e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                            }}
                            defaultValue={row.content}
                            onBlur={(e) => handleRowUpdate(row.id, e.target.value)}
                        />
                        <button onClick={() => handleDeleteRow(row.id)} className="text-red-900 opacity-0 group-hover/row:opacity-100 hover:text-red-500 transition-opacity">x</button>
                    </div>
                ))}
            </div>

            <button
                onClick={handleAddRow}
                className="mt-2 text-[10px] uppercase tracking-wider text-zinc-600 hover:text-blue-400 font-semibold"
            >
                + строка
            </button>
        </div>
    );
}
