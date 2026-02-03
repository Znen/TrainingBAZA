"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

interface ProtectedRouteProps {
    children: React.ReactNode;
    fallbackUrl?: string;
}

/**
 * Компонент для защиты маршрутов.
 * Перенаправляет неавторизованных пользователей на страницу входа.
 */
export function ProtectedRoute({ children, fallbackUrl = "/auth/login" }: ProtectedRouteProps) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.replace(fallbackUrl);
        }
    }, [user, loading, router, fallbackUrl]);

    // Показываем загрузку пока проверяем авторизацию
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="animate-pulse text-4xl mb-4">⏳</div>
                    <p className="text-[var(--text-muted)]">Проверка авторизации...</p>
                </div>
            </div>
        );
    }

    // Если не авторизован — показываем сообщение (редирект уже в useEffect)
    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="text-4xl mb-4">🔒</div>
                    <p className="text-[var(--text-muted)]">Требуется авторизация</p>
                </div>
            </div>
        );
    }

    // Пользователь авторизован — показываем контент
    return <>{children}</>;
}
