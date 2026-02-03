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
