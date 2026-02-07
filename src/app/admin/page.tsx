"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
    getAllCloudProfiles,
    updateCloudProfile,
    addCloudMeasurement,
    getCloudMeasurements,
    CloudProfile,
    CloudMeasurement
} from "@/lib/cloudSync";
import { isBase64Image } from "@/lib/users";

export default function AdminPage() {
    return (
        <ProtectedRoute>
            <AdminContent />
        </ProtectedRoute>
    );
}

function AdminContent() {
    const { user: authUser, loading } = useAuth();
    const [users, setUsers] = useState<CloudProfile[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Edit State
    const [editingUser, setEditingUser] = useState<CloudProfile | null>(null);
    const [isMeasurementMode, setIsMeasurementMode] = useState(false);

    // Form State
    const [editName, setEditName] = useState("");
    const [editRole, setEditRole] = useState("user");

    // Measurement Form
    const [newWeight, setNewWeight] = useState("");
    const [newChest, setNewChest] = useState("");
    const [newWaist, setNewWaist] = useState("");
    const [newHips, setNewHips] = useState("");

    useEffect(() => {
        if (!authUser) return;

        const init = async () => {
            try {
                // 1. Check if I am admin
                // We can check the local profile or just fetch all and see if we are allowed
                // Ideally we check the profile of the current user first
                const profiles = await getAllCloudProfiles();
                const myProfile = profiles.find(p => p.id === authUser.id);

                if (myProfile?.role === 'admin') {
                    setIsAdmin(true);
                    setUsers(profiles);
                } else {
                    // Redirect or show access denied? 
                    // ProtectedRoute handles auth, but not role. 
                    // For now just show "Access Denied" if not admin
                }
            } catch (err) {
                console.error("Admin load error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [authUser]);

    const handleEditUser = (u: CloudProfile) => {
        setEditingUser(u);
        setEditName(u.name || "");
        setEditRole(u.role || "user");
        setIsMeasurementMode(false);
    };

    const handleAddMeasurement = (u: CloudProfile) => {
        setEditingUser(u);
        setIsMeasurementMode(true);
        setNewWeight("");
        setNewChest("");
        setNewWaist("");
        setNewHips("");
    };

    const saveProfile = async () => {
        if (!editingUser) return;
        try {
            await updateCloudProfile(editingUser.id, {
                name: editName,
                role: editRole
            });

            // Update local list
            setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, name: editName, role: editRole } : u));
            setEditingUser(null);
        } catch (err) {
            alert("Ошибка сохранения");
        }
    };

    const saveMeasurement = async () => {
        if (!editingUser) return;
        const ts = new Date().toISOString();
        const promises = [];
        if (newWeight) promises.push(addCloudMeasurement({ user_id: editingUser.id, type: 'weight', value: parseFloat(newWeight), recorded_at: ts }));
        if (newChest) promises.push(addCloudMeasurement({ user_id: editingUser.id, type: 'chest', value: parseFloat(newChest), recorded_at: ts }));
        if (newWaist) promises.push(addCloudMeasurement({ user_id: editingUser.id, type: 'waist', value: parseFloat(newWaist), recorded_at: ts }));
        if (newHips) promises.push(addCloudMeasurement({ user_id: editingUser.id, type: 'hips', value: parseFloat(newHips), recorded_at: ts }));

        try {
            await Promise.all(promises);
            alert("Замеры сохранены!");
            setEditingUser(null);
        } catch (err) {
            console.error(err);
            alert("Ошибка сохранения замеров");
        }
    };

    if (loading || isLoading) return <div className="p-10 text-center">Загрузка...</div>;

    if (!isAdmin) {
        return (
            <div className="p-10 text-center text-red-500">
                ⛔ Доступ запрещен. Только для администраторов.
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto pb-20">
            <h1 className="text-2xl font-black italic uppercase text-white mb-8">
                👑 Панель <span className="text-yellow-500">Администратора</span>
            </h1>

            <div className="space-y-4">
                {users.map(u => (
                    <div key={u.id} className="card p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                            {u.avatar && isBase64Image(u.avatar) ? (
                                <img src={u.avatar} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xl">{u.avatar || "👤"}</span>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white truncate">{u.name || "Без имени"}</h3>
                                {u.role === 'admin' && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded">ADM</span>}
                            </div>
                            <p className="text-[10px] font-mono text-zinc-500 truncate">{u.id}</p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => handleAddMeasurement(u)}
                                className="btn btn-sm bg-blue-600/20 text-blue-400 hover:bg-blue-600/40"
                            >
                                📐 Замеры
                            </button>
                            <button
                                onClick={() => handleEditUser(u)}
                                className="btn btn-sm bg-zinc-700 hover:bg-zinc-600"
                            >
                                ✏️
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Modal / Overlay */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl max-w-sm w-full space-y-4">
                        <h2 className="text-xl font-bold">
                            {isMeasurementMode ? "Новые замеры" : "Редактирование"}
                        </h2>
                        <p className="text-sm text-zinc-400">Пользователь: {editingUser.name}</p>

                        {isMeasurementMode ? (
                            <div className="grid grid-cols-2 gap-3">
                                <input type="number" placeholder="Вес (кг)" className="input" value={newWeight} onChange={e => setNewWeight(e.target.value)} />
                                <input type="number" placeholder="Грудь (см)" className="input" value={newChest} onChange={e => setNewChest(e.target.value)} />
                                <input type="number" placeholder="Талия (см)" className="input" value={newWaist} onChange={e => setNewWaist(e.target.value)} />
                                <input type="number" placeholder="Бёдра (см)" className="input" value={newHips} onChange={e => setNewHips(e.target.value)} />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <label className="block">
                                    <span className="text-xs text-zinc-500">Имя</span>
                                    <input type="text" className="input w-full mt-1" value={editName} onChange={e => setEditName(e.target.value)} />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-zinc-500">Роль</span>
                                    <select className="select w-full mt-1" value={editRole} onChange={e => setEditRole(e.target.value)}>
                                        <option value="user">Пользователь</option>
                                        <option value="admin">Администратор</option>
                                    </select>
                                </label>
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <button className="btn btn-primary flex-1" onClick={isMeasurementMode ? saveMeasurement : saveProfile}>
                                Сохранить
                            </button>
                            <button className="btn bg-zinc-800 flex-1" onClick={() => setEditingUser(null)}>
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
