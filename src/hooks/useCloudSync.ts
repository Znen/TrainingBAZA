"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
    getCloudResults,
    addCloudResult,
    getCloudMeasurements,
    addCloudMeasurement,
    getCloudProfile,
    updateCloudProfile,
    type CloudResult,
    type CloudMeasurement,
    type CloudProfile,
} from "@/lib/cloudSync";

export interface UseCloudSyncReturn {
    // Auth state
    isAuthenticated: boolean;
    userId: string | null;

    // Profile
    profile: CloudProfile | null;
    updateProfile: (updates: Partial<CloudProfile>) => Promise<void>;

    // Results
    results: CloudResult[];
    addResult: (disciplineSlug: string, value: number) => Promise<CloudResult | null>;
    getLatestResult: (disciplineSlug: string) => CloudResult | undefined;
    refreshResults: () => Promise<void>;

    // Measurements
    measurements: CloudMeasurement[];
    addMeasurement: (type: string, value: number) => Promise<CloudMeasurement | null>;
    getLatestMeasurement: (type: string) => CloudMeasurement | undefined;
    refreshMeasurements: () => Promise<void>;

    // Loading state
    loading: boolean;
}

export function useCloudSync(): UseCloudSyncReturn {
    const { user, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState<CloudProfile | null>(null);
    const [results, setResults] = useState<CloudResult[]>([]);
    const [measurements, setMeasurements] = useState<CloudMeasurement[]>([]);
    const [loading, setLoading] = useState(true);

    const userId = user?.id ?? null;
    const isAuthenticated = !!user;

    // Load data when authenticated
    useEffect(() => {
        if (authLoading) return;

        if (!userId) {
            setProfile(null);
            setResults([]);
            setMeasurements([]);
            setLoading(false);
            return;
        }

        async function loadData() {
            setLoading(true);
            try {
                const [profileData, resultsData, measurementsData] = await Promise.all([
                    getCloudProfile(userId!),
                    getCloudResults(userId!),
                    getCloudMeasurements(userId!),
                ]);

                setProfile(profileData);
                setResults(resultsData);
                setMeasurements(measurementsData);
            } catch (error) {
                console.error("Error loading cloud data:", error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [userId, authLoading]);

    // Update profile
    const handleUpdateProfile = useCallback(async (updates: Partial<CloudProfile>) => {
        if (!userId) return;
        await updateCloudProfile(userId, updates);
        const updated = await getCloudProfile(userId);
        setProfile(updated);
    }, [userId]);

    // Add result
    const handleAddResult = useCallback(async (disciplineSlug: string, value: number) => {
        if (!userId) return null;

        const result = await addCloudResult({
            user_id: userId,
            discipline_slug: disciplineSlug,
            value,
            recorded_at: new Date().toISOString(),
        });

        if (result) {
            setResults(prev => [result, ...prev]);
        }

        return result;
    }, [userId]);

    // Get latest result for discipline
    const getLatestResult = useCallback((disciplineSlug: string) => {
        return results.find(r => r.discipline_slug === disciplineSlug);
    }, [results]);

    // Refresh results
    const refreshResults = useCallback(async () => {
        if (!userId) return;
        const data = await getCloudResults(userId);
        setResults(data);
    }, [userId]);

    // Add measurement
    const handleAddMeasurement = useCallback(async (type: string, value: number) => {
        if (!userId) return null;

        const measurement = await addCloudMeasurement({
            user_id: userId,
            type,
            value,
            recorded_at: new Date().toISOString(),
        });

        if (measurement) {
            setMeasurements(prev => [measurement, ...prev]);
        }

        return measurement;
    }, [userId]);

    // Get latest measurement for type
    const getLatestMeasurement = useCallback((type: string) => {
        return measurements.find(m => m.type === type);
    }, [measurements]);

    // Refresh measurements
    const refreshMeasurements = useCallback(async () => {
        if (!userId) return;
        const data = await getCloudMeasurements(userId);
        setMeasurements(data);
    }, [userId]);

    return {
        isAuthenticated,
        userId,
        profile,
        updateProfile: handleUpdateProfile,
        results,
        addResult: handleAddResult,
        getLatestResult,
        refreshResults,
        measurements,
        addMeasurement: handleAddMeasurement,
        getLatestMeasurement,
        refreshMeasurements,
        loading: loading || authLoading,
    };
}
