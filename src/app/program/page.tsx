"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/components/AuthProvider";
import {
  getPrograms,
  createProgram,
  setActiveProgram,
  deleteNode,
} from "@/lib/programApi";
import { Program } from "@/types/program";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ProgramEditor } from "@/components/ProgramEditor";

export default function ProgramPage() {
  return (
    <ProtectedRoute>
      <ProgramAdminContent />
    </ProtectedRoute>
  );
}

function ProgramAdminContent() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    setLoading(true);
    try {
      const data = await getPrograms();
      setPrograms(data);
    } catch (e: any) {
      console.error(e);
      alert(`Ошибка загрузки программ: ${e.message || JSON.stringify(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProgramTitle, setNewProgramTitle] = useState("");
  const [newProgramDate, setNewProgramDate] = useState("");

  const handleDeleteProgram = async (id: string) => {
    if (!confirm("Удалить программу?")) return;
    try {
      await deleteNode("programs", id);
      loadPrograms();
    } catch (e) {
      alert("Ошибка удаления");
    }
  };

  const content = (() => {
    if (loading) return <div className="p-8 text-center">Загрузка...</div>;
    // Editor View
    if (selectedProgramId) {
      return (
        <main className="max-w-4xl mx-auto p-4 pb-24">
          <ProgramEditor
            programId={selectedProgramId}
            onClose={() => {
              setSelectedProgramId(null);
              loadPrograms();
            }}
          />
        </main>
      );
    }
    return null;
  })();

  if (content) return content;

  // Render List
  return (
    <main className="max-w-4xl mx-auto p-4 pb-24 relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Управление программами</h1>
          <p className="text-zinc-400">Создание и редактирование циклов</p>
        </div>
        <button
          onClick={() => {
            // Set default date to next Monday
            const nextMonday = new Date();
            nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7));
            setNewProgramDate(nextMonday.toISOString().split('T')[0]);
            setNewProgramTitle("");
            setShowCreateModal(true);
          }}
          className="btn btn-primary"
        >
          + Новая программа
        </button>
      </div>

      <div className="space-y-4">
        {programs.map(p => (
          <div key={p.id} className={`p-4 rounded-xl border border-zinc-700 bg-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${p.is_active ? 'border-green-500/50 bg-green-900/10' : ''}`}>
            <div>
              <div className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                {p.title}
                {p.is_active && <span className="text-xs bg-green-500 text-black px-2 py-0.5 rounded-full whitespace-nowrap">Активна</span>}
              </div>
              <div className="text-sm text-zinc-400">
                Старт: {format(new Date(p.start_date), "d MMMM yyyy", { locale: ru })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {/* Actions */}
              {!p.is_active && (
                <button
                  onClick={async () => {
                    await setActiveProgram(p.id);
                    loadPrograms();
                  }}
                  className="flex-1 md:flex-none px-3 py-2 md:py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded-lg text-center whitespace-nowrap"
                >
                  Активна
                </button>
              )}
              <button
                onClick={() => setSelectedProgramId(p.id)}
                className="flex-1 md:flex-none px-3 py-2 md:py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg text-center whitespace-nowrap"
              >
                Редактировать
              </button>
              <button
                onClick={() => handleDeleteProgram(p.id)}
                className="flex-1 md:flex-none px-3 py-2 md:py-1.5 text-sm bg-red-900/50 hover:bg-red-900 text-red-200 rounded-lg text-center whitespace-nowrap"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}

        {programs.length === 0 && (
          <div className="text-center py-12 text-zinc-500 border-2 border-dashed border-zinc-800 rounded-xl">
            Нет созданных программ
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Новая программа</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Название</label>
                <input
                  type="text"
                  value={newProgramTitle}
                  onChange={e => setNewProgramTitle(e.target.value)}
                  placeholder="Например: Весна 2026"
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Дата начала (Понедельник)</label>
                <input
                  type="date"
                  value={newProgramDate}
                  onChange={e => setNewProgramDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    // DELETE LOGIC:
                    // Since the program is only created when "Create" is clicked,
                    // "Cancelling" here effectively deletes any draft data by clearing the state.
                    setShowCreateModal(false);
                    setNewProgramTitle("");
                    setNewProgramDate("");
                  }}
                  className="flex-1 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={async () => {
                    if (!newProgramTitle || !newProgramDate) return;
                    try {
                      await createProgram(newProgramTitle, newProgramDate);
                      setShowCreateModal(false);
                      loadPrograms();
                    } catch (e) {
                      alert("Ошибка при создании");
                    }
                  }}
                  className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors font-medium"
                >
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
