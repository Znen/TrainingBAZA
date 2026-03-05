/**
 * Supabase Data Sync - синхронизация данных с облаком
 */

import { supabase } from './supabase';

// === IN-FLIGHT DEDUPE + SHORT TTL CACHE ===
// Prevents duplicate requests from StrictMode double-mounts and auth event bursts.

const inflight = new Map<string, Promise<any>>();
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 3000; // 3 seconds

function deduped<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // 1. Check TTL cache
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return Promise.resolve(cached.data as T);
    }

    // 2. Check in-flight
    const existing = inflight.get(key);
    if (existing) return existing as Promise<T>;

    // 3. Execute and track
    const promise = fn()
        .then((result) => {
            cache.set(key, { data: result, ts: Date.now() });
            return result;
        })
        .finally(() => {
            inflight.delete(key);
        });

    inflight.set(key, promise);
    return promise;
}

/** Invalidate cache for a specific key prefix (e.g. after writes) */
export function invalidateCache(prefix: string) {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) cache.delete(key);
    }
}

// === PROFILES ===

export interface CloudProfile {
    id: string;
    name: string;
    avatar: string | null;
    avatar_type: string;
    role: string;
}

export function getCloudProfile(userId: string): Promise<CloudProfile | null> {
    return deduped(`profile:${userId}`, async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, name, avatar, avatar_type, role')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
        return data;
    });
}

export async function updateCloudProfile(userId: string, updates: Partial<CloudProfile>) {
    const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId);

    if (error) {
        console.error('Error updating profile:', error);
    }
    return { error };
}

export async function deleteCloudProfile(userId: string) {
    // 1. Delete related data explicitly (in case ON DELETE CASCADE is missing)
    await supabase.from('measurements').delete().eq('user_id', userId);
    await supabase.from('results').delete().eq('user_id', userId);

    // 2. Delete the profile
    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

    if (error) {
        console.error('Error deleting profile:', error);
    }
    return { error };
}

// === RESULTS ===

export interface CloudResult {
    id?: string;
    user_id: string;
    discipline_slug: string;
    value: number;
    recorded_at: string;
}

/**
 * Fetch LATEST result per discipline for a given user.
 * Uses the v_latest_results view (DISTINCT ON user_id, discipline_slug).
 * Returns 1 row per discipline — ideal for the main /results list.
 */
export function getLatestResults(userId: string): Promise<CloudResult[]> {
    return deduped(`latest:${userId}`, async () => {
        const { data, error } = await supabase
            .from('v_latest_results')
            .select('user_id, discipline_slug, value, recorded_at')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching latest results:', error);
            return [];
        }
        return data || [];
    });
}

/**
 * Fetch history for a specific discipline with cursor-based pagination.
 * Returns `limit` rows ordered by recorded_at DESC.
 * Pass cursor (recorded_at of last item) to load the next page.
 */
export async function getResultsHistory(
    userId: string,
    disciplineSlug: string,
    limit: number = 50,
    cursor?: string // recorded_at of the last loaded item
): Promise<CloudResult[]> {
    let query = supabase
        .from('results')
        .select('id, user_id, discipline_slug, value, recorded_at')
        .eq('user_id', userId)
        .eq('discipline_slug', disciplineSlug)
        .order('recorded_at', { ascending: false })
        .limit(limit);

    if (cursor) {
        query = query.lt('recorded_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching results history:', error);
        return [];
    }
    return data || [];
}

export async function getCloudResults(userId: string): Promise<CloudResult[]> {
    const { data, error } = await supabase
        .from('results')
        .select('user_id, discipline_slug, value, recorded_at')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(1000);

    if (error) {
        console.error('Error fetching results:', error);
        return [];
    }
    return data || [];
}

/**
 * Fetch latest results across all users, but ONLY for specific disciplines.
 * Used by /ratings to avoid downloading massive history arrays.
 */
export function getLatestResultsForDisciplines(disciplineSlugs: string[]): Promise<CloudResult[]> {
    const keySlugs = [...disciplineSlugs].sort();
    return deduped(`latest-disciplines:${keySlugs.join(',')}`, async () => {
        if (disciplineSlugs.length === 0) return [];

        const { data, error } = await supabase
            .rpc('get_latest_results_for_disciplines', { slugs: disciplineSlugs });

        if (error) {
            console.error('Error fetching latest results for disciplines:', error);
            return [];
        }
        return data || [];
    });
}

export async function addCloudResult(result: Omit<CloudResult, 'id'>): Promise<CloudResult | null> {
    const { data, error } = await supabase
        .from('results')
        .insert(result)
        .select()
        .single();

    if (error) {
        console.error('Error adding result:', error);
        return null;
    }
    // Invalidate latest-results cache for this user so next fetch is fresh
    invalidateCache(`latest:${result.user_id}`);
    return data;
}

export async function getLatestCloudResult(userId: string, disciplineSlug: string): Promise<CloudResult | null> {
    const { data, error } = await supabase
        .from('results')
        .select('*')
        .eq('user_id', userId)
        .eq('discipline_slug', disciplineSlug)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('Error fetching latest result:', error);
    }
    return data || null;
}

// === MEASUREMENTS ===

export interface CloudMeasurement {
    id?: string;
    user_id: string;
    type: string;
    value: number;
    recorded_at: string;
}

export async function getCloudMeasurements(userId: string): Promise<CloudMeasurement[]> {
    const { data, error } = await supabase
        .from('measurements')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false });

    if (error) {
        console.error('Error fetching measurements:', error);
        return [];
    }
    return data || [];
}

export async function addCloudMeasurement(measurement: Omit<CloudMeasurement, 'id'>): Promise<CloudMeasurement | null> {
    const { data, error } = await supabase
        .from('measurements')
        .insert(measurement)
        .select()
        .single();

    if (error) {
        console.error('Error adding measurement:', error);
        return null;
    }
    return data;
}

export async function getLatestCloudMeasurements(userId: string): Promise<Record<string, CloudMeasurement>> {
    const measurements = await getCloudMeasurements(userId);
    const latest: Record<string, CloudMeasurement> = {};

    for (const m of measurements) {
        if (!latest[m.type]) {
            latest[m.type] = m;
        }
    }

    return latest;
}

// === ALL PROFILES (для рейтингов) ===

export async function getAllCloudProfiles(): Promise<CloudProfile[]> {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar, avatar_type, role')
        .order('name', { ascending: true })
        .limit(200);

    if (error) {
        console.error('Error fetching all profiles:', error);
        return [];
    }
    return data || [];
}
// === PROGRESS PHOTOS ===

export interface ProgressPhoto {
    id: string;
    user_id: string;
    storage_path: string;
    full_url?: string;
    recorded_at: string;
}

export async function uploadProgressPhoto(userId: string, file: File): Promise<{ data: ProgressPhoto | null; error: any }> {
    try {
        // 1. Upload to Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        console.log('Uploading photo to storage:', fileName);
        const { error: uploadError } = await supabase.storage
            .from('progress-photos')
            .upload(fileName, file);

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error(`Ошибка загрузки в хранилище: ${uploadError.message}`);
        }

        // 2. Add to Database
        console.log('Adding photo entry to database...');
        const { data, error: dbError } = await supabase
            .from('progress_photos')
            .insert({
                user_id: userId,
                storage_path: fileName,
                recorded_at: new Date().toISOString()
            })
            .select()
            .single();

        if (dbError) {
            console.error('Database entry error:', dbError);
            throw new Error(`Ошибка сохранения в базу: ${dbError.message}`);
        }

        return { data, error: null };
    } catch (error: any) {
        console.error('Error uploading photo:', error);
        return { data: null, error: error.message || 'Unknown error' };
    }
}

export async function getProgressPhotos(userId: string): Promise<ProgressPhoto[]> {
    const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false });

    if (error) {
        console.error('Error fetching photos:', error);
        return [];
    }

    if (!data) return [];

    // Generate URLs
    return data.map(photo => {
        const { data: urlData } = supabase.storage
            .from('progress-photos')
            .getPublicUrl(photo.storage_path);

        return {
            ...photo,
            full_url: urlData.publicUrl
        };
    });
}

export async function deleteProgressPhoto(photo: ProgressPhoto): Promise<{ error: any }> {
    try {
        // 1. Delete from Storage
        const { error: storageError } = await supabase.storage
            .from('progress-photos')
            .remove([photo.storage_path]);

        if (storageError) throw storageError;

        // 2. Delete from Database
        const { error: dbError } = await supabase
            .from('progress_photos')
            .delete()
            .eq('id', photo.id);

        if (dbError) throw dbError;

        return { error: null };
    } catch (error: any) {
        console.error('Error deleting photo:', error);
        return { error: error.message || 'Unknown error' };
    }
}
