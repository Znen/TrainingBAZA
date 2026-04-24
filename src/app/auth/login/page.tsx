"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/supabase";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const { error } = await signIn(email, password);

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push("/");
        }
    };

    return (
        <main className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4">
            <div className="card w-full max-w-md">
                <div className="card-header">
                    <h1 className="card-title text-2xl">🏋️ Training Baza</h1>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <h2 className="text-xl font-semibold text-center mb-6">Вход</h2>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

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
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? "Вход..." : "Войти"}
                    </button>

                    <p className="text-center text-sm text-[var(--text-muted)]">
                        Нет аккаунта?{" "}
                        <Link href="/auth/register" className="text-[var(--accent)] hover:underline">
                            Зарегистрироваться
                        </Link>
                    </p>
                </form>
            </div>
        </main>
    );
}
