"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            if (session?.user) triggerAutoSync(session.user);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
                if (session?.user) triggerAutoSync(session.user);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // Helper: Auto-sync local data to cloud on login
    const triggerAutoSync = async (user: User) => {
        try {
            // 1. Try new format first
            let historyJson = localStorage.getItem("trainingBaza:history:v2");
            let localHistory: any = null;

            if (historyJson) {
                const store = JSON.parse(historyJson);
                // HistoryStore is Record<userId, Record<slug, HistoryItem[]>>
                // STRICT: Only sync data belonging to THIS user (by auth ID)
                const userHistory = store[user.id];
                if (userHistory && typeof userHistory === 'object') {
                    localHistory = userHistory;
                }
            } else {
                // 2. Fallback to old key
                historyJson = localStorage.getItem("historyStore");
                if (historyJson) {
                    localHistory = JSON.parse(historyJson);
                }
            }

            if (!localHistory || Object.keys(localHistory).length === 0) return;

            console.log("🔄 Auto-syncing local data to cloud...");
            let count = 0;
            const { addCloudResult } = await import("@/lib/cloudSync"); // Dynamic import to avoid circular dep if any

            for (const [slug, results] of Object.entries(localHistory)) {
                if (!Array.isArray(results)) continue;
                for (const result of (results as any[])) {
                    await addCloudResult({
                        user_id: user.id,
                        discipline_slug: slug,
                        value: result.value,
                        recorded_at: result.ts || result.date || new Date().toISOString(),
                    });
                    count++;
                }
            }
            if (count > 0) console.log(`✅ Auto-synced ${count} results.`);
        } catch (err) {
            console.error("Auto-sync failed:", err);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signOut: handleSignOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
