import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
    if (_supabase) return _supabase;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        // During next build's static prerender, env may be absent.
        // Return a no-op client that will silently fail — real requests happen at runtime only.
        console.warn('Supabase env vars missing – using placeholder client (build-time prerender only).');
        return createClient('https://placeholder.supabase.co', 'placeholder-key');
    }

    _supabase = createClient(url, key);
    return _supabase;
}

// Proxy that lazily resolves the real (or placeholder) client on first property access.
export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        return (getSupabase() as any)[prop];
    },
});

// Auth helpers
export async function signUp(email: string, password: string, name: string) {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/login` : undefined;

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { name },
            emailRedirectTo: redirectTo
        }
    });
    return { data, error };
}

export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    return { data, error };
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export async function getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}
