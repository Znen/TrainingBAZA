"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { addCloudResult } from "@/lib/cloudSync";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface LocalResult {
    value: number;
    date: string;
}

interface LocalHistoryStore {
    [disciplineSlug: string]: LocalResult[];
}

export default function SyncPage() {
    return (
        <ProtectedRoute>
            <SyncContent />
        </ProtectedRoute>
    );
}

function SyncContent() {
    const { user, loading } = useAuth();
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ success: number; errors: number } | null>(null);

    const handleSync = async () => {
        if (!user) return;

        setSyncing(true);
        setSyncResult(null);

        let success = 0;
        let errors = 0;

        try {
            // Получаем локальные данные из localStorage
            const historyJson = localStorage.getItem("historyStore");

            if (!historyJson) {
                setSyncResult({ success: 0, errors: 0 });
                setSyncing(false);
                return;
            }

            const localHistory: LocalHistoryStore = JSON.parse(historyJson);

            // Синхронизируем каждый результат
            for (const [slug, results] of Object.entries(localHistory)) {
                for (const result of results) {
                    try {
                        const added = await addCloudResult({
                            user_id: user.id,
                            discipline_slug: slug,
                            value: result.value,
                            recorded_at: result.date || new Date().toISOString(),
                        });

                        if (added) {
                            success++;
                        } else {
                            errors++;
                        }
                    } catch {
                        errors++;
                    }
                }
            }

            setSyncResult({ success, errors });
        } catch (error) {
            console.error("Sync error:", error);
            setSyncResult({ success, errors: errors + 1 });
        } finally {
            setSyncing(false);
        }
    };

    // ProtectedRoute handles loading and auth checks
    if (!user) return null;

    return (
        <div className="max-w-lg mx-auto">
            <div className="card">
                <div className="card-header">
                    <h1 className="card-title">☁️ Синхронизация данных</h1>
                </div>

                <div className="p-6 space-y-6">
                    <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                        <p className="text-sm text-blue-300">
                            <strong>Аккаунт:</strong> {user.email}
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-medium">Импорт локальных данных</h3>
                        <p className="text-sm text-[var(--text-muted)]">
                            Перенесите ваши результаты тренировок из локального хранилища в облако.
                            После этого данные будут доступны на любом устройстве.
                        </p>
                    </div>

                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="w-full py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors disabled:opacity-50"
                    >
                        {syncing ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin">⏳</span>
                                Синхронизация...
                            </span>
                        ) : (
                            "🔄 Импортировать данные в облако"
                        )}
                    </button>

                    {syncResult && (
                        <div className={`p-4 rounded-lg ${syncResult.errors > 0
                            ? "bg-yellow-500/10 border border-yellow-500/30"
                            : "bg-green-500/10 border border-green-500/30"
                            }`}>
                            <p className="font-medium">
                                {syncResult.errors === 0 ? "✅ Синхронизация завершена!" : "⚠️ Синхронизация завершена с ошибками"}
                            </p>
                            <p className="text-sm mt-1">
                                Успешно: {syncResult.success} записей
                                {syncResult.errors > 0 && `, Ошибок: ${syncResult.errors}`}
                            </p>
                        </div>
                    )}

                    <div className="pt-4 border-t border-[var(--border-default)]">
                        <Link
                            href="/results"
                            className="text-[var(--accent)] hover:underline text-sm"
                        >
                            ← Вернуться к результатам
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
