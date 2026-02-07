"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import disciplines from "../../../disciplines.json";
import {
  loadUsers,
  loadActiveUserId,
  saveActiveUserId,
  createUser,
  saveUsers,
  updateUser,
  deleteUser,
  clearAllUsers,
  addMeasurement,
  getLatestMeasurements,
  getMeasurementHistory,
  AVATAR_OPTIONS,
  MAX_PHOTO_SIZE,
  fileToBase64,
  isBase64Image,
  isAdmin,
  canEditUser,
  type User,
  type BodyMeasurement,
} from "@/lib/users";
import { loadHistoryStore, type HistoryBySlug, type HistoryStore, type HistoryItem } from "@/lib/results";
import {
  getUserStats,
  getOverallLevel,
  getRankTitle,
  getDisciplineAchievements,
  STANDARD_LEVELS,
  type StatLevel,
  type Discipline,
} from "@/lib/rpgStats";
import { formatSecondsToTime, shouldUseTimeInput } from "@/lib/timeUtils";
import { getPercentageWeights } from "@/lib/oneRepMax";
import { useAuth } from "@/components/AuthProvider";
import {
  getCloudProfile,
  updateCloudProfile,
  addCloudMeasurement,
  getCloudMeasurements,
  getAllCloudResults,
  type CloudProfile,
  type CloudResult,
  type CloudMeasurement
} from "@/lib/cloudSync";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function AccountPage() {
  return (
    <ProtectedRoute>
      <AccountContent />
    </ProtectedRoute>
  );
}

function AccountContent() {
  const list = disciplines as Discipline[];

  const [users, setUsers] = useState<User[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [viewingUserId, setViewingUserId] = useState<string>("");
  const [history, setHistory] = useState<HistoryBySlug>({});
  const [showAllDisciplines, setShowAllDisciplines] = useState(false);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());

  // Редактирование профиля
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editAvatarType, setEditAvatarType] = useState<"emoji" | "photo">("emoji");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Измерения
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [newChest, setNewChest] = useState("");
  const [newWaist, setNewWaist] = useState("");
  const [newHips, setNewHips] = useState("");

  // Cloud auth
  const { user: authUser, loading: authLoading } = useAuth();
  const [cloudProfile, setCloudProfile] = useState<CloudProfile | null>(null);

  useEffect(() => {
    // LOAD DATA (Local + Cloud)
    const loadData = async () => {
      let currentUsers = loadUsers();
      let currentStore: HistoryStore = {};

      // 1. Local Data
      // Ensure initialActive is valid before loading history
      const savedActive = loadActiveUserId();
      let initialActive = savedActive && currentUsers.some((u) => u.id === savedActive) ? savedActive : currentUsers[0]?.id;

      if (initialActive) {
        currentStore = loadHistoryStore(initialActive);
      }

      // 2. Cloud Data (if authenticated)
      if (authUser) {
        try {
          // A. Sync Profile
          const profile = await getCloudProfile(authUser.id);
          const role = (profile?.role === 'admin') ? 'admin' : 'user';
          const name = profile?.name || authUser.user_metadata?.name || "Пользователь";

          let currentUser = currentUsers.find(x => x.id === authUser.id);
          if (currentUser) {
            // Update if changed
            if (currentUser.role !== role || (profile?.name && currentUser.name !== profile.name)) {
              currentUser.role = role;
              currentUser.name = name;
              currentUser.measurements = currentUser.measurements || [];
            }
          } else {
            currentUser = {
              id: authUser.id,
              name: name,
              email: authUser.email,
              role: role,
              avatarType: "emoji",
              measurements: []
            };
            currentUsers.push(currentUser);
          }

          initialActive = authUser.id; // Force active to auth user

          // B. Sync Measurements
          const cloudMeasurements = await getCloudMeasurements(authUser.id);
          if (currentUser) {
            const measurementsMap = new Map<string, BodyMeasurement>();
            // Existing local
            currentUser.measurements?.forEach(m => measurementsMap.set(m.ts, m));

            // Merge Cloud
            cloudMeasurements.forEach((cm: CloudMeasurement) => {
              const existing: BodyMeasurement = measurementsMap.get(cm.recorded_at) || { ts: cm.recorded_at };
              if (cm.type === 'weight') existing.weight = cm.value;
              else if (cm.type === 'chest') existing.chest = cm.value;
              else if (cm.type === 'waist') existing.waist = cm.value;
              else if (cm.type === 'hips') existing.hips = cm.value;
              measurementsMap.set(cm.recorded_at, existing);
            });

            currentUser.measurements = Array.from(measurementsMap.values())
              .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
          }

          // C. Sync Results
          const cloudResults = await getAllCloudResults();
          cloudResults.forEach((r: CloudResult) => {
            if (!currentStore[r.user_id]) currentStore[r.user_id] = {};
            if (!currentStore[r.user_id][r.discipline_slug]) {
              currentStore[r.user_id][r.discipline_slug] = [];
            }
            const exists = currentStore[r.user_id][r.discipline_slug].some(
              (local: HistoryItem) => local.ts === r.recorded_at && local.value === Number(r.value)
            );

            if (!exists) {
              currentStore[r.user_id][r.discipline_slug].push({
                ts: r.recorded_at,
                value: Number(r.value),
              });
            }
          });

        } catch (e) {
          console.error("Failed to load cloud data", e);
        }
      }

      saveUsers(currentUsers);
      setUsers([...currentUsers]);

      if (initialActive) {
        setActiveUserId(initialActive);
        if (!viewingUserId) setViewingUserId(initialActive);
        setHistory(currentStore[initialActive] ?? {});
      }
    };

    loadData();

  }, [authUser]); // Run on auth change

  // Обновить историю при смене просматриваемого пользователя
  useEffect(() => {
    if (viewingUserId) {
      const store = loadHistoryStore(viewingUserId);
      setHistory(store[viewingUserId] ?? {});
    }
  }, [viewingUserId]);

  // Загрузка облачного профиля
  useEffect(() => {
    if (authUser && !authLoading) {
      getCloudProfile(authUser.id).then(setCloudProfile);
    } else {
      setCloudProfile(null);
    }
  }, [authUser, authLoading]);

  const activeUser = users.find((u) => u.id === activeUserId);
  const viewingUser = users.find((u) => u.id === viewingUserId);
  const isCurrentUserAdmin = isAdmin(activeUser);
  const canEdit = canEditUser(activeUser, viewingUserId);

  // Объединяем облачный и локальный профиль
  const displayName = cloudProfile?.name || viewingUser?.name || "Гость";
  const displayAvatar = cloudProfile?.avatar || viewingUser?.avatar;
  const displayRole = cloudProfile?.role || viewingUser?.role || "user";
  const isCloudAdmin = cloudProfile?.role === "admin";

  const stats = useMemo(() => getUserStats(list, history), [list, history]);
  const overallLevel = useMemo(() => getOverallLevel(stats), [stats]);
  const rank = useMemo(() => getRankTitle(overallLevel), [overallLevel]);
  const achievements = useMemo(
    () => getDisciplineAchievements(list, history),
    [list, history]
  );
  const latestMeasurements = viewingUser ? getLatestMeasurements(viewingUser) : null;
  const measurementHistory = viewingUser ? getMeasurementHistory(viewingUser, 5) : [];

  const filledDisciplines = useMemo(() => {
    return list.filter((d) => history[d.slug]?.length > 0).length;
  }, [list, history]);

  const filteredAchievements = useMemo(() => {
    if (!selectedStat) return achievements;
    return achievements.filter((a) => a.discipline.stat === selectedStat);
  }, [achievements, selectedStat]);

  const groupedAchievements = useMemo(() => {
    const groups: Record<string, typeof filteredAchievements> = {};
    for (const a of filteredAchievements) {
      const cat = a.discipline.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(a);
    }
    return groups;
  }, [filteredAchievements]);

  // Обработчики
  const handleSaveProfile = async () => {
    if (!viewingUser || !canEdit) return;

    const newName = editName || viewingUser.name;
    const newAvatar = editAvatar || viewingUser.avatar;
    const newAvatarType = editAvatarType;

    // 1. Update local
    const updated = updateUser(users, viewingUserId, {
      name: newName,
      avatar: newAvatar,
      avatarType: newAvatarType,
    });
    setUsers(updated);
    saveUsers(updated);

    // 2. Push to cloud if it's the current user's profile
    if (authUser && viewingUserId === authUser.id) {
      try {
        await updateCloudProfile(authUser.id, {
          name: newName,
          avatar: newAvatar,
          avatar_type: newAvatarType === 'photo' ? 'photo' : 'emoji'
        });
        // Update local cloudProfile state to match
        setCloudProfile(prev => prev ? {
          ...prev,
          name: newName,
          avatar: newAvatar || null,
          avatar_type: newAvatarType
        } : null);
      } catch (err) {
        console.error("Failed to sync profile to cloud:", err);
      }
    }

    setIsEditingProfile(false);
  };

  const handleStartEditProfile = () => {
    if (!viewingUser || !canEdit) return;
    setEditName(viewingUser.name);
    setEditAvatar(viewingUser.avatar ?? "");
    setEditAvatarType(viewingUser.avatarType ?? "emoji");
    setIsEditingProfile(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_PHOTO_SIZE) {
      alert(`Файл слишком большой. Максимум ${MAX_PHOTO_SIZE / 1024}KB`);
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Пожалуйста, выберите изображение");
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setEditAvatar(base64);
      setEditAvatarType("photo");
    } catch (err) {
      console.error("Ошибка загрузки фото:", err);
    }
  };

  const handleAddMeasurement = () => {
    if (!canEdit) return;
    const measurement: Omit<BodyMeasurement, "ts"> = {};
    if (newWeight) measurement.weight = parseFloat(newWeight);
    if (newChest) measurement.chest = parseFloat(newChest);
    if (newWaist) measurement.waist = parseFloat(newWaist);
    if (newHips) measurement.hips = parseFloat(newHips);

    if (Object.keys(measurement).length === 0) return;

    const updated = addMeasurement(users, viewingUserId, measurement);
    setUsers(updated);
    saveUsers(updated);

    // 2. Update Cloud if enabled
    if (authUser && (viewingUserId === authUser.id || isCurrentUserAdmin)) {
      const ts = new Date().toISOString();
      const promises = [];
      if (measurement.weight) promises.push(addCloudMeasurement({ user_id: viewingUserId, type: 'weight', value: measurement.weight, recorded_at: ts }));
      if (measurement.chest) promises.push(addCloudMeasurement({ user_id: viewingUserId, type: 'chest', value: measurement.chest, recorded_at: ts }));
      if (measurement.waist) promises.push(addCloudMeasurement({ user_id: viewingUserId, type: 'waist', value: measurement.waist, recorded_at: ts }));
      if (measurement.hips) promises.push(addCloudMeasurement({ user_id: viewingUserId, type: 'hips', value: measurement.hips, recorded_at: ts }));

      Promise.all(promises).catch(err => console.error("Cloud measurement sync failed:", err));
    }

    setShowMeasurementForm(false);
    setNewWeight("");
    setNewChest("");
    setNewWaist("");
    setNewHips("");
  };

  const renderAvatar = (user: User | undefined, size: "sm" | "lg" = "lg") => {
    if (!user) return "👤";
    const sizeClass = size === "lg" ? "w-28 h-28 text-5xl" : "w-10 h-10 text-xl";

    if (user.avatarType === "photo" && user.avatar && isBase64Image(user.avatar)) {
      return (
        <img
          src={user.avatar}
          alt={user.name}
          className={`${sizeClass} rounded-full object-cover`}
        />
      );
    }
    return <span className={size === "lg" ? "text-5xl" : "text-xl"}>{user.avatar ?? "👤"}</span>;
  };

  return (
    <div className="pb-12 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 px-1">
        <div>
          <h1 className="text-2xl font-black italic uppercase text-white leading-none">
            Личный <span className="text-[var(--accent-primary)]">Кабинет</span>
          </h1>
          {isCurrentUserAdmin && viewingUserId !== activeUserId && (
            <p className="text-[10px] font-mono text-yellow-500 uppercase tracking-widest mt-1">
              👁 Просмотр: {viewingUser?.name}
            </p>
          )}
        </div>

        {/* Селектор пользователя для админа */}
        {isCurrentUserAdmin && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-2 py-1 rounded">
            <span className="text-[9px] font-mono text-zinc-600 uppercase">Просмотр:</span>
            <select
              className="bg-transparent text-[10px] font-mono text-zinc-400 outline-none cursor-pointer"
              value={viewingUserId}
              onChange={(e) => setViewingUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id} className="bg-black text-white">
                  {u.name} {u.role === "admin" ? "👑" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Hero Section */}
      <div className="relative p-6 border border-white/5 bg-zinc-900/10 mb-8 overflow-hidden group">
        <div
          className="absolute top-0 right-0 w-64 h-64 opacity-20 pointer-events-none blur-3xl rounded-full"
          style={{ backgroundColor: rank.color }}
        />

        <div className="relative flex flex-col md:flex-row items-center gap-6">
          {/* Аватар */}
          <div className="relative">
            <div
              className={`w-28 h-28 rounded-full flex items-center justify-center shadow-lg ${canEdit ? "cursor-pointer hover:scale-105" : ""
                } transition-transform overflow-hidden`}
              style={{
                background: viewingUser?.avatarType === "photo" && viewingUser?.avatar
                  ? "transparent"
                  : `linear-gradient(135deg, ${rank.color}80, ${rank.color})`,
                boxShadow: `0 10px 40px ${rank.color}40`,
              }}
              onClick={canEdit ? handleStartEditProfile : undefined}
              title={canEdit ? "Нажмите для редактирования" : undefined}
            >
              {renderAvatar(viewingUser, "lg")}
            </div>
            <div
              className="absolute -bottom-2 -right-2 border border-white/10 rounded-sm px-2 py-0.5 text-[10px] font-mono font-black"
              style={{
                backgroundColor: "#000",
                color: rank.color,
                boxShadow: `0 0 15px ${rank.color}40`,
              }}
            >
              УРВ {overallLevel}
            </div>
            {viewingUser?.role === "admin" && (
              <div className="absolute -top-1 -left-1 bg-yellow-500 text-black rounded-full w-6 h-6 flex items-center justify-center text-xs">
                👑
              </div>
            )}
          </div>

          {/* Инфо */}
          <div className="text-center md:text-left flex-1">
            {isEditingProfile ? (
              <div className="space-y-4">
                <input
                  type="text"
                  className="w-full bg-black/60 border border-white/10 px-3 py-2 text-white outline-none focus:border-yellow-500"
                  placeholder="Имя"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />

                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border transition-all ${editAvatarType === "emoji" ? "bg-yellow-500 text-black border-yellow-500" : "bg-white/5 text-zinc-500 border-white/5 hover:text-white"}`}
                    onClick={() => setEditAvatarType("emoji")}
                  >
                    😀 Эмодзи
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border transition-all ${editAvatarType === "photo" ? "bg-yellow-500 text-black border-yellow-500" : "bg-white/5 text-zinc-500 border-white/5 hover:text-white"}`}
                    onClick={() => setEditAvatarType("photo")}
                  >
                    📷 Фото
                  </button>
                </div>

                {editAvatarType === "emoji" ? (
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_OPTIONS.map((av) => (
                      <button
                        key={av}
                        type="button"
                        className={`text-2xl p-2 rounded transition-all ${editAvatar === av
                          ? "bg-yellow-500 text-black scale-110"
                          : "bg-white/5 hover:bg-white/10"
                          }`}
                        onClick={() => setEditAvatar(av)}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                    <button
                      type="button"
                      className="px-3 py-1 text-[10px] font-black uppercase border border-white/20 text-white hover:bg-white/5 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📷 Загрузить фото
                    </button>
                    {editAvatar && isBase64Image(editAvatar) && (
                      <div className="mt-2 text-center md:text-left">
                        <img
                          src={editAvatar}
                          alt="Превью"
                          className="w-16 h-16 rounded-full object-cover border-2 border-yellow-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button className="px-4 py-1.5 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-yellow-400" onClick={handleSaveProfile}>
                    Сохранить
                  </button>
                  <button
                    className="px-4 py-1.5 bg-white/5 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                    onClick={() => setIsEditingProfile(false)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black uppercase italic text-white leading-tight">
                  {displayName}
                  {(displayRole === "admin" || isCloudAdmin) && (
                    <span className="ml-2 text-[10px] font-mono text-yellow-500 uppercase tracking-widest bg-yellow-500/10 px-1.5 py-0.5 border border-yellow-500/30">Admin</span>
                  )}
                </h2>
                <p className="text-xs font-mono uppercase tracking-[0.2em] mt-1" style={{ color: rank.color }}>
                  {rank.titleRu}
                </p>
                <div className="flex items-center gap-1 mt-3">
                  <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-1000"
                      style={{
                        width: `${(filledDisciplines / list.length) * 100}%`,
                        backgroundColor: rank.color
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-zinc-600 uppercase">
                    {filledDisciplines}/{list.length} PR
                  </span>
                </div>
                {canEdit && (
                  <button
                    className="mt-4 text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-white border-b border-zinc-800 hover:border-white transition-all"
                    onClick={handleStartEditProfile}
                  >
                    Ред. Профиль
                  </button>
                )}
              </>
            )}
          </div>

          <div className="text-center">
            <div
              className="text-5xl font-black italic bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, ${rank.color}, ${rank.color}cc)`,
              }}
            >
              {overallLevel}
            </div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mt-1">Ранг (Уровень)</p>
          </div>
        </div>
      </div>

      {/* Измерения тела */}
      <section className="bg-zinc-900/10 border border-white/5 overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-zinc-400">Метрики тела</h3>
          {canEdit && (
            <button
              className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-white transition-colors"
              onClick={() => setShowMeasurementForm(!showMeasurementForm)}
            >
              {showMeasurementForm ? "[ СКРЫТЬ ]" : "[ ВНЕСТИ ]"}
            </button>
          )}
        </div>

        {showMeasurementForm && canEdit && (
          <div className="p-4 border-b border-white/5 bg-black/40 backdrop-blur-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1">Вес (кг)</label>
                <input
                  type="number"
                  className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2 text-sm font-mono text-white focus:border-[var(--accent-primary)] outline-none"
                  placeholder="75.5"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1">Грудь (см)</label>
                <input
                  type="number"
                  className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2 text-sm font-mono text-white focus:border-[var(--accent-primary)] outline-none"
                  placeholder="100"
                  value={newChest}
                  onChange={(e) => setNewChest(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1">Талия (см)</label>
                <input
                  type="number"
                  className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2 text-sm font-mono text-white focus:border-[var(--accent-primary)] outline-none"
                  placeholder="80"
                  value={newWaist}
                  onChange={(e) => setNewWaist(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1">Бёдра (см)</label>
                <input
                  type="number"
                  className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2 text-sm font-mono text-white focus:border-[var(--accent-primary)] outline-none"
                  placeholder="95"
                  value={newHips}
                  onChange={(e) => setNewHips(e.target.value)}
                />
              </div>
            </div>
            <button className="w-full mt-4 bg-[var(--accent-primary)] py-2 text-[10px] font-black uppercase italic tracking-widest text-black hover:bg-yellow-400 transition-colors" onClick={handleAddMeasurement}>
              СОХРАНИТЬ ДАННЫЕ
            </button>
          </div>
        )}

        <div className="p-4">
          {latestMeasurements ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <MeasurementCard
                  label="Вес"
                  value={latestMeasurements.weight}
                  unit="кг"
                  icon="⚖️"
                />
                <MeasurementCard
                  label="Грудь"
                  value={latestMeasurements.chest}
                  unit="см"
                  icon="📐"
                />
                <MeasurementCard
                  label="Талия"
                  value={latestMeasurements.waist}
                  unit="см"
                  icon="📏"
                />
                <MeasurementCard
                  label="Бёдра"
                  value={latestMeasurements.hips}
                  unit="см"
                  icon="📐"
                />
              </div>

              {measurementHistory.length > 1 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-zinc-600 hover:text-white transition-colors uppercase text-[9px] font-black tracking-widest">
                    История измерений ({measurementHistory.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {measurementHistory.map((m) => (
                      <div
                        key={m.ts}
                        className="flex justify-between items-center text-[10px] font-mono py-2 border-b border-white/5 last:border-0"
                      >
                        <span className="text-zinc-600">
                          {new Date(m.ts).toLocaleDateString("ru-RU")}
                        </span>
                        <div className="flex gap-4 text-zinc-400">
                          {m.weight && <span>⚖️ {m.weight}kg</span>}
                          {m.chest && <span>📐 {m.chest}cm</span>}
                          {m.waist && <span>📏 {m.waist}cm</span>}
                          {m.hips && <span>📐 {m.hips}cm</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <p className="text-zinc-600 text-[10px] font-mono uppercase text-center py-4">
              НЕТ ДАННЫХ. {canEdit ? "НАЧНИТЕ ОТСЛЕЖИВАНИЕ" : ""}
            </p>
          )}
        </div>
      </section>

      {/* Характеристики */}
      <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-zinc-600 mb-4 px-1">Основные параметры</h3>
      <div className="grid gap-3 grid-cols-2 mb-8">
        {stats.map((stat) => (
          <StatCard
            key={stat.stat}
            stat={stat}
            isSelected={selectedStat === stat.stat}
            onClick={() =>
              setSelectedStat(selectedStat === stat.stat ? null : stat.stat)
            }
          />
        ))}
      </div>

      {/* Список дисциплин */}
      <div className="space-y-6">
        {Object.entries(groupedAchievements).map(([category, items]) => {
          const visibleItems = showAllDisciplines
            ? items
            : items.filter((i) => i.value !== null);

          if (visibleItems.length === 0) return null;

          return (
            <div key={category} className="animate-fadeIn">
              <h4 className="text-[10px] font-black uppercase italic tracking-widest text-zinc-500 mb-3 px-1 border-b border-white/5 pb-2">
                {category}
              </h4>
              <div className="border border-white/5 bg-zinc-900/20 divide-y divide-white/5">
                {visibleItems.map((item) => (
                  <DisciplineRow
                    key={item.discipline.slug}
                    item={item}
                    isExpanded={expandedDisciplines.has(item.discipline.slug)}
                    onToggle={() => {
                      const next = new Set(expandedDisciplines);
                      if (next.has(item.discipline.slug))
                        next.delete(item.discipline.slug);
                      else next.add(item.discipline.slug);
                      setExpandedDisciplines(next);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin Controls */}
      {isCurrentUserAdmin && (
        <div className="mt-12 pt-8 border-t border-white/10">
          <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-red-500 mb-4 px-1">Управление базой</h3>
          <div className="border border-red-500/20 bg-red-500/5 divide-y divide-red-500/10">
            {users.map((u) => (
              <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {renderAvatar(u, "sm")}
                  <div>
                    <div className="text-[10px] font-bold uppercase text-white">
                      {u.name || "БЕЗ ИМЕНИ"}
                      {u.role === "admin" && <span className="ml-2 text-yellow-500">[ADM]</span>}
                    </div>
                    <div className="text-[8px] font-mono text-zinc-600">UID: {u.id.slice(0, 8)}</div>
                  </div>
                </div>

                {u.id !== activeUserId ? (
                  <button
                    onClick={() => {
                      if (window.confirm(`Удалить пользователя "${u.name}"?`)) {
                        const updated = deleteUser(users, u.id);
                        setUsers(updated);
                        saveUsers(updated);
                      }
                    }}
                    className="p-3 -mr-3 text-[8px] font-black uppercase text-red-500 hover:text-red-400 touch-manipulation"
                    aria-label="Удалить пользователя"
                  >
                    [ УДАЛИТЬ ]
                  </button>
                ) : (
                  <span className="text-[8px] font-mono text-zinc-700 uppercase">Активен</span>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              if (window.confirm("Удалить ВСЕХ пользователей? Это действие необратимо!")) {
                clearAllUsers();
                window.location.reload();
              }
            }}
            className="w-full mt-4 py-4 border border-red-500/30 text-red-500 text-[9px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-colors touch-manipulation"
          >
            Удалить все данные БД
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Компоненты */
/* ────────────────────────────────────────────────────────────── */

function MeasurementCard({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value?: number;
  unit: string;
  icon: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-3 border border-white/5 bg-white/5 group hover:bg-white/10 transition-colors">
      <div className="text-xl mb-1 opacity-50 grayscale group-hover:grayscale-0 transition-all">{icon}</div>
      <div className="text-lg font-black italic text-white leading-none">
        {value !== undefined ? value : "—"}
        {value !== undefined && (
          <span className="text-[9px] font-mono text-zinc-600 uppercase ml-1 tracking-tighter">{unit}</span>
        )}
      </div>
      <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}

function StatCard({
  stat,
  isSelected,
  onClick,
}: {
  stat: StatLevel;
  isSelected: boolean;
  onClick: () => void;
}) {
  const barWidth = Math.max(2, stat.level);

  return (
    <button
      onClick={onClick}
      className={`relative p-4 text-left border transition-all duration-300 ${isSelected
        ? "bg-white/10 border-[var(--accent-primary)] shadow-[0_0_20px_rgba(234,179,8,0.1)]"
        : "bg-zinc-900/40 border-white/5 hover:border-white/20"
        }`}
    >
      <div className="flex items-center gap-3 mb-3 relative z-10">
        <span className="text-xl opacity-50 grayscale">{stat.icon}</span>
        <div className="flex-1">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-black uppercase italic tracking-widest text-zinc-400 leading-none">{stat.name}</span>
            <span className="text-xl font-black italic leading-none" style={{ color: stat.color }}>
              {stat.level}
            </span>
          </div>
        </div>
      </div>

      <div className="h-1 bg-white/5 relative overflow-hidden">
        <div
          className="h-full transition-all duration-1000"
          style={{
            width: `${barWidth}%`,
            backgroundColor: stat.color,
            boxShadow: `0 0 10px ${stat.color}40`
          }}
        />
      </div>

      <p className="text-[8px] font-mono text-zinc-600 uppercase mt-2 tracking-tighter">
        {stat.disciplineCount} Рекордов
      </p>
    </button>
  );
}

function DisciplineRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: ReturnType<typeof getDisciplineAchievements>[number];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { discipline, value, level, nextLevel, progress } = item;
  const show1RM = discipline.has1RM && value !== null;
  const percentages = show1RM ? getPercentageWeights(value) : [];

  return (
    <div className="group">
      <div
        className={`flex items-center gap-4 px-4 py-3 transition-colors ${show1RM ? "cursor-pointer hover:bg-white/5" : ""
          }`}
        onClick={show1RM ? onToggle : undefined}
      >
        <span className="text-lg opacity-40 grayscale group-hover:grayscale-0 transition-all">{discipline.icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-white truncate">
              {discipline.name}
            </h4>
            {show1RM && (
              <span className={`text-[8px] font-mono leading-none ${isExpanded ? "text-yellow-500" : "text-zinc-600"}`}>
                [ {isExpanded ? "СКРЫТЬ" : "ПОКАЗАТЬ %-ПМ"} ]
              </span>
            )}
          </div>
          <div className="text-xs font-mono text-zinc-500 mt-0.5">
            {value !== null ? (
              <>
                <span className="text-white font-bold">
                  {shouldUseTimeInput(discipline.unit, discipline.direction)
                    ? formatSecondsToTime(value)
                    : `${value}${discipline.unit}`}
                </span>
                {show1RM && (
                  <span className="text-[9px] text-zinc-700 ml-1">(Эквивалент ПМ)</span>
                )}
              </>
            ) : (
              "НЕТ ДАННЫХ"
            )}
          </div>
        </div>

        {level ? (
          <div className="flex flex-col items-end gap-1.5 min-w-[80px]">
            <span
              className="px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] border border-zinc-800"
              style={{
                color: level.color,
                backgroundColor: `${level.color}10`,
                borderColor: `${level.color}30`
              }}
            >
              {level.name}
            </span>
            {nextLevel && (
              <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-1000"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: nextLevel.color,
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-[8px] font-mono text-zinc-700">БЕЗ РАНГА</div>
        )}
      </div>

      {isExpanded && show1RM && (
        <div className="px-4 pb-4 bg-black/40 border-t border-white/5 animate-in slide-in-from-top-1">
          <div className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest py-3 text-center">
            Расчетные проценты ПМ
          </div>
          <div className="grid grid-cols-4 gap-1">
            {percentages.map(({ percent, weight }) => (
              <div
                key={percent}
                className="bg-zinc-900/50 p-2 border border-white/5 text-center"
              >
                <div className="text-[8px] font-mono text-zinc-500 mb-1">{percent}%</div>
                <div className="text-[10px] font-bold text-white font-mono leading-none">
                  {weight}{discipline.unit}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
