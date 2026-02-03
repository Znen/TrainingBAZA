"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/supabase";

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (password.length < 6) {
            setError("Пароль должен быть минимум 6 символов");
            setLoading(false);
            return;
        }

        const { error } = await signUp(email, password, name);

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            setSuccess(true);
        }
    };

    if (success) {
        return (
            <main className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4">
                <div className="card w-full max-w-md p-6 text-center">
                    <div className="text-5xl mb-4">✉️</div>
                    <h2 className="text-xl font-semibold mb-2">Проверьте почту!</h2>
                    <p className="text-[var(--text-muted)] mb-4">
                        Мы отправили ссылку для подтверждения на {email}
                    </p>
                    <Link
                        href="/auth/login"
                        className="text-[var(--accent)] hover:underline"
                    >
                        Вернуться к входу
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4">
            <div className="card w-full max-w-md">
                <div className="card-header">
                    <h1 className="card-title text-2xl">🏋️ Training Baza</h1>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <h2 className="text-xl font-semibold text-center mb-6">Регистрация</h2>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">
                            Имя
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] focus:border-[var(--accent)] focus:outline-none"
                            placeholder="Ваше имя"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] focus:border-[var(--accent)] focus:outline-none"
                            placeholder="your@email.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">
                            Пароль
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] focus:border-[var(--accent)] focus:outline-none"
                            placeholder="Минимум 6 символов"
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? "Регистрация..." : "Зарегистрироваться"}
                    </button>

                    <p className="text-center text-sm text-[var(--text-muted)]">
                        Уже есть аккаунт?{" "}
                        <Link href="/auth/login" className="text-[var(--accent)] hover:underline">
                            Войти
                        </Link>
                    </p>
                </form>
            </div>
        </main>
    );
}
