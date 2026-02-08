/**
 * Supabase Data Sync - синхронизация данных с облаком
 */

import { supabase } from './supabase';

// === PROFILES ===

export interface CloudProfile {
    id: string;
    name: string;
    avatar: string | null;
    avatar_type: string;
    role: string;
}

export async function getCloudProfile(userId: string): Promise<CloudProfile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
    return data;
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

export async function getCloudResults(userId: string): Promise<CloudResult[]> {
    const { data, error } = await supabase
        .from('results')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false });

    if (error) {
        console.error('Error fetching results:', error);
        return [];
    }
    return data || [];
}

export async function getAllCloudResults(): Promise<CloudResult[]> {
    const { data, error } = await supabase
        .from('results')
        .select('*')
        .order('recorded_at', { ascending: false });

    if (error) {
        console.error('Error fetching all results:', error);
        return [];
    }
    return data || [];
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
        .select('*');

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

        const { error: uploadError } = await supabase.storage
            .from('progress-photos')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        // 2. Add to Database
        const { data, error: dbError } = await supabase
            .from('progress_photos')
            .insert({
                user_id: userId,
                storage_path: fileName,
                recorded_at: new Date().toISOString()
            })
            .select()
            .single();

        if (dbError) throw dbError;

        return { data, error: null };
    } catch (error) {
        console.error('Error uploading photo:', error);
        return { data: null, error };
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
