"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import disciplines from "../../../disciplines.json";
import {
  loadUsers,
  loadActiveUserId,
  saveActiveUserId,
  saveUsers,
  updateUser,
  addMeasurement,
  getLatestMeasurements,
  getMeasurementHistory,
  AVATAR_OPTIONS,
  MAX_PHOTO_SIZE,
  fileToBase64,
  isBase64Image,
  type User,
  type BodyMeasurement,
} from "@/lib/users";
import { loadHistoryStore, saveHistoryStore, type HistoryBySlug, type HistoryStore, type HistoryItem } from "@/lib/results";
import {
  getUserStats,
  getOverallLevel,
  getRankTitle,
  getDisciplineAchievements,
  type Discipline,
} from "@/lib/rpgStats";
import { useAuth } from "@/components/AuthProvider";
import {
  getCloudProfile,
  updateCloudProfile,
  addCloudMeasurement,
  getCloudMeasurements,
  getAllCloudResults,
  getCloudResults,
  type CloudProfile,
  type CloudResult,
  type CloudMeasurement
} from "@/lib/cloudSync";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PhotoGallery } from "@/components/PhotoGallery";

// UI Components
const MeasurementCard = ({ label, value, unit, icon }: { label: string, value?: number, unit: string, icon: string }) => (
  <div className="bg-black/40 border border-white/5 p-3 flex items-center gap-3">
    <span className="text-xl shrink-0 grayscale opacity-80">{icon}</span>
    <div>
      <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold text-white leading-none mt-1">
        {value ?? "--"} <span className="text-[10px] text-zinc-600 font-normal">{unit}</span>
      </div>
    </div>
  </div>
);

const StatCard = ({ stat, isSelected, onClick }: { stat: any, isSelected: boolean, onClick: () => void }) => (
  <div
    onClick={onClick}
    className={`relative p-3 border cursor-pointer transition-all ${isSelected ? "bg-white/10 border-white/20" : "bg-zinc-900/40 border-white/5 hover:border-white/10"}`}
  >
    <div className="flex justify-between items-start mb-2">
      <span className="text-xl">{stat.icon}</span>
      <div className="text-right">
        <div className="text-xl font-black italic leading-none">{stat.level}</div>
        <div className="text-[8px] font-mono text-zinc-600 uppercase">LVL</div>
      </div>
    </div>
    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">{stat.title}</div>
    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
      <div className="h-full bg-white transition-all" style={{ width: `${stat.progress}%` }} />
    </div>
  </div>
);

const DisciplineRow = ({ item, isExpanded, onToggle }: { item: any, isExpanded: boolean, onToggle: () => void }) => {
  const d = item.discipline;
  const hasValue = item.value !== null;

  return (
    <div className="group">
      <div onClick={onToggle} className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors">
        <span className="text-lg grayscale group-hover:grayscale-0 transition-all">{d.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-end pr-4">
            <div className="text-sm font-bold text-zinc-200 truncate">{d.name}</div>
            {hasValue && (
              <div className="text-[9px] font-mono text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.progress}% to next
              </div>
            )}
          </div>

          {hasValue ? (
            <div className="mt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-zinc-400">{item.formatted}</span>
                <span className="text-[9px] text-zinc-600">• {item.date}</span>
              </div>
              {/* Progress Bar */}
              <div className="h-0.5 w-full bg-zinc-800 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full transition-all duration-1000"
                  style={{
                    width: `${item.progress}%`,
                    backgroundColor: item.level?.color || '#555'
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-zinc-700 font-mono mt-1">Нет данных</div>
          )}
        </div>

        {hasValue && item.level ? (
          <div
            className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded min-w-[60px] text-center"
            style={{
              borderColor: item.level.color,
              color: item.level.color,
              boxShadow: `0 0 10px -5px ${item.level.color}`
            }}
          >
            {item.level.name}
          </div>
        ) : <span className="text-[19px] text-zinc-800">-</span>}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pl-12">
          {d.description && (
            <div className="text-[10px] text-zinc-500 leading-relaxed max-w-sm mb-4">
              {d.description}
            </div>
          )}

          {hasValue && d.has1RM && (
            <div className="bg-zinc-900/40 border border-white/5 rounded p-3">
              <div className="text-[9px] font-mono text-zinc-500 uppercase mb-2">Рабочие веса (% от ПМ)</div>
              <div className="grid grid-cols-4 gap-2">
                {[50, 60, 70, 75, 80, 85, 90, 95].map(pct => (
                  <div key={pct} className="text-center bg-black/20 p-1.5 rounded border border-white/5">
                    <div className="text-[9px] text-zinc-500">{pct}%</div>
                    <div className="text-xs font-bold text-zinc-200">
                      {Math.round((item.value as number) * pct / 100)} <span className="text-[8px] font-normal text-zinc-600">{d.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


export default function AccountPage() {
  return (
    <ProtectedRoute>
      <AccountContent />
    </ProtectedRoute>
  );
}

function AccountContent() {
  const list = disciplines as Discipline[];

  // Simplification: We only care about the Active User (Me)
  // Logic for viewing other users is moved to /admin

  const { user: authUser, loading: authLoading } = useAuth();
  const [cloudProfile, setCloudProfile] = useState<CloudProfile | null>(null);

  // Local state
  const [users, setUsers] = useState<User[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [history, setHistory] = useState<HistoryBySlug>({});
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const addLog = (m: string) => setSyncLogs(p => [...p.slice(-5), `${new Date().toLocaleTimeString()}: ${m}`]);

  // UI State
  const [showAllDisciplines, setShowAllDisciplines] = useState(false);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());

  // Edit Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editAvatarType, setEditAvatarType] = useState<"emoji" | "photo">("emoji");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Measurement State
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [newHeight, setNewHeight] = useState("");
  const [newChest, setNewChest] = useState("");
  const [newWaist, setNewWaist] = useState("");
  const [newHips, setNewHips] = useState("");
  const [newBiceps, setNewBiceps] = useState("");
  const [newShoulders, setNewShoulders] = useState("");
  const [newGlutes, setNewGlutes] = useState("");

  useEffect(() => {
    // LOAD DATA
    const loadData = async () => {
      let currentUsers = loadUsers();
      let currentStore: HistoryStore = {};

      const savedActive = loadActiveUserId();
      let initialActive = savedActive && currentUsers.some((u) => u.id === savedActive) ? savedActive : currentUsers[0]?.id;

      addLog("Starting loadData...");
      // Ensure Auth User Exists in Local State immediately
      if (authUser) {
        addLog(`Auth detected: ${authUser.email}`);
        initialActive = authUser.id;
        let currentUser = currentUsers.find(x => x.id === authUser.id);
        const defaultName = authUser.user_metadata?.name || authUser.email?.split('@')[0] || "Атлет";

        if (!currentUser) {
          currentUser = {
            id: authUser.id,
            name: defaultName,
            email: authUser.email,
            role: 'user',
            avatarType: "emoji",
            measurements: []
          };
          currentUsers.push(currentUser);
        }

        // Fallback if name is missing
        if (!currentUser.name) currentUser.name = defaultName;
      }

      // Always load history store
      const storeId = initialActive || authUser?.id || "guest";
      currentStore = loadHistoryStore(storeId);

      // Sync with Cloud if Auth
      if (authUser) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        addLog(`Connecting to: ${supabaseUrl?.slice(0, 20)}...`);

        // Helper to wrap Supabase calls in a timeout
        const withTimeout = async (promise: Promise<any>, ms: number = 10000) => {
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
          return Promise.race([promise, timeout]);
        };

        try {
          addLog("Fetching profile...");
          const profile = await withTimeout(getCloudProfile(authUser.id), 8000);
          addLog("Profile fetch: OK");

          const currentUser = currentUsers.find(x => x.id === authUser.id);
          if (currentUser && profile) {
            currentUser.name = profile.name || currentUser.name;
            currentUser.role = (profile.role === 'admin' ? 'admin' : 'user');
          }

          // Sync Measurements
          addLog("Fetching measurements...");
          const cloudMeasurements = await withTimeout(getCloudMeasurements(authUser.id), 10000);
          addLog(`Stats synced: ${cloudMeasurements?.length || 0} measurements`);
          if (currentUser) {
            const measurementsMap = new Map<string, BodyMeasurement>();
            currentUser.measurements?.forEach(m => measurementsMap.set(m.ts, m));

            // Local -> Cloud (Migration)
            const localToCloudMeasurements: any[] = [];
            currentUser.measurements?.forEach(m => {
              // Check if THIS specific measurement (timestamp + fields) is in cloud
              // (Simplification: check if timestamp exists in cloudMeasurements)
              const inCloud = cloudMeasurements?.some((cm: any) => cm.recorded_at === m.ts);
              if (!inCloud) {
                if (m.weight) localToCloudMeasurements.push({ user_id: authUser.id, type: 'weight', value: m.weight, recorded_at: m.ts });
                if (m.height) localToCloudMeasurements.push({ user_id: authUser.id, type: 'height', value: m.height, recorded_at: m.ts });
                if (m.chest) localToCloudMeasurements.push({ user_id: authUser.id, type: 'chest', value: m.chest, recorded_at: m.ts });
                if (m.waist) localToCloudMeasurements.push({ user_id: authUser.id, type: 'waist', value: m.waist, recorded_at: m.ts });
                if (m.hips) localToCloudMeasurements.push({ user_id: authUser.id, type: 'hips', value: m.hips, recorded_at: m.ts });
                if (m.biceps) localToCloudMeasurements.push({ user_id: authUser.id, type: 'biceps', value: m.biceps, recorded_at: m.ts });
                if (m.shoulders) localToCloudMeasurements.push({ user_id: authUser.id, type: 'shoulders', value: m.shoulders, recorded_at: m.ts });
                if (m.glutes) localToCloudMeasurements.push({ user_id: authUser.id, type: 'glutes', value: m.glutes, recorded_at: m.ts });
              }
            });

            if (localToCloudMeasurements.length > 0) {
              addLog(`Pushing ${localToCloudMeasurements.length} stats...`);
              await withTimeout(supabase.from('measurements').insert(localToCloudMeasurements) as any, 10000);
              addLog("Stats pushed: OK");
            }

            // Cloud -> Local
            cloudMeasurements?.forEach((cm: CloudMeasurement) => {
              const existing: BodyMeasurement = measurementsMap.get(cm.recorded_at) || { ts: cm.recorded_at };
              if (cm.type === 'weight') existing.weight = cm.value;
              if (cm.type === 'height') existing.height = cm.value;
              if (cm.type === 'chest') existing.chest = cm.value;
              if (cm.type === 'waist') existing.waist = cm.value;
              if (cm.type === 'hips') existing.hips = cm.value;
              if (cm.type === 'biceps') existing.biceps = cm.value;
              if (cm.type === 'shoulders') existing.shoulders = cm.value;
              if (cm.type === 'glutes') existing.glutes = cm.value;
              measurementsMap.set(cm.recorded_at, existing);
            });
            currentUser.measurements = Array.from(measurementsMap.values())
              .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
          }

          // Sync Results
          addLog("Fetching history...");
          const cloudResults = await withTimeout(getCloudResults(authUser.id), 20000); // 20s for large history
          addLog(`History synced: ${cloudResults?.length || 0} entries`);

          if (cloudResults && cloudResults.length > 0) {
            cloudResults.forEach((r: CloudResult) => {
              const targetId = r.user_id || authUser.id;
              if (!currentStore[targetId]) currentStore[targetId] = {};
              if (!currentStore[targetId][r.discipline_slug]) {
                currentStore[targetId][r.discipline_slug] = [];
              }
              const exists = currentStore[targetId][r.discipline_slug].some(
                (local: HistoryItem) => local.ts === r.recorded_at
              );
              if (!exists) {
                currentStore[targetId][r.discipline_slug].push({
                  ts: r.recorded_at,
                  value: Number(r.value),
                });
              }
            });
          }

          // Local -> Cloud Migration (Results)
          const localToCloudResults = [];
          if (currentStore[authUser.id]) {
            for (const slug in currentStore[authUser.id]) {
              for (const item of currentStore[authUser.id][slug]) {
                const inCloud = cloudResults?.some((cr: CloudResult) => cr.recorded_at === item.ts && cr.discipline_slug === slug);
                if (!inCloud) {
                  localToCloudResults.push({
                    user_id: authUser.id,
                    discipline_slug: slug,
                    value: item.value,
                    recorded_at: item.ts
                  });
                }
              }
            }
          }

          if (localToCloudResults.length > 0) {
            addLog(`Pushing ${localToCloudResults.length} records...`);
            await withTimeout(supabase.from('results').insert(localToCloudResults) as any, 20000);
            addLog("Records pushed: OK");
          }

          addLog("All data synced successfully.");
        } catch (e: any) {
          addLog(`Sync error: ${e.message || 'Unknown'}`);
          console.error("Cloud sync failed:", e);
        }
      }

      saveUsers(currentUsers);
      saveHistoryStore(currentStore);
      setUsers([...currentUsers]);

      if (initialActive) {
        setActiveUserId(initialActive);
        setHistory(currentStore[initialActive] ?? {});
      }
    };
    loadData();
  }, [authUser]);

  // Cloud Profile Load
  useEffect(() => {
    if (authUser && !authLoading) {
      getCloudProfile(authUser.id).then(setCloudProfile);
    }
  }, [authUser, authLoading]);

  const activeUser = users.find((u) => u.id === activeUserId);

  // Display Logic (Mix of Cloud + Local)
  const displayName = cloudProfile?.name ||
    activeUser?.name ||
    authUser?.user_metadata?.name ||
    authUser?.email?.split('@')[0] ||
    "Атлет";

  // const displayAvatar = cloudProfile?.avatar || activeUser?.avatar;
  const displayRole = cloudProfile?.role || activeUser?.role || "user";
  const isCloudAdmin = cloudProfile?.role === "admin";
  const isAdminUser = displayRole === "admin" || isCloudAdmin;

  const latestMeasurements = activeUser ? getLatestMeasurements(activeUser) : null;
  const measurementHistory = activeUser ? getMeasurementHistory(activeUser, 5) : [];

  // Stats
  const latestWeight = latestMeasurements?.weight;
  const stats = useMemo(() => getUserStats(list, history, latestWeight), [list, history, latestWeight]);
  const overallLevel = useMemo(() => getOverallLevel(stats), [stats]);
  const rank = useMemo(() => getRankTitle(overallLevel), [overallLevel]);
  const achievements = useMemo(() => getDisciplineAchievements(list, history, latestWeight), [list, history, latestWeight]);

  // Force sync activeUserId with Auth User
  useEffect(() => {
    if (authUser && activeUserId !== authUser.id) {
      setActiveUserId(authUser.id);
    }
  }, [authUser, activeUserId]);

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


  // Handlers
  const handleSaveProfile = async () => {
    if (!activeUser) return;
    const newName = editName || activeUser.name;
    const newAvatar = editAvatar || activeUser.avatar;
    const newAvatarType = editAvatarType;

    // 1. Local
    const updated = updateUser(users, activeUserId, {
      name: newName,
      avatar: newAvatar,
      avatarType: newAvatarType
    });
    setUsers(updated);
    saveUsers(updated);

    // 2. Cloud
    if (authUser && activeUserId === authUser.id) {
      try {
        await updateCloudProfile(authUser.id, {
          name: newName,
          avatar: newAvatar,
          avatar_type: newAvatarType === 'photo' ? 'photo' : 'emoji'
        });
        setCloudProfile(prev => prev ? { ...prev, name: newName, avatar: newAvatar || null, avatar_type: newAvatarType } : null);
      } catch (e) { console.error(e); }
    }
    setIsEditingProfile(false);
  };

  const handleStartEditProfile = () => {
    if (!activeUser) return;
    setEditName(activeUser.name);
    setEditAvatar(activeUser.avatar ?? "");
    setEditAvatarType(activeUser.avatarType ?? "emoji");
    setIsEditingProfile(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_SIZE) { alert("Файл слишком большой"); return; }
    try {
      const base64 = await fileToBase64(file);
      setEditAvatar(base64);
      setEditAvatarType("photo");
    } catch (e) { console.error(e); }
  };

  const handleAddMeasurement = () => {
    const measurement: Omit<BodyMeasurement, "ts"> = {};
    if (newWeight) measurement.weight = parseFloat(newWeight);
    if (newHeight) measurement.height = parseFloat(newHeight);
    if (newChest) measurement.chest = parseFloat(newChest);
    if (newWaist) measurement.waist = parseFloat(newWaist);
    if (newHips) measurement.hips = parseFloat(newHips);
    if (newBiceps) measurement.biceps = parseFloat(newBiceps);
    if (newShoulders) measurement.shoulders = parseFloat(newShoulders);
    if (newGlutes) measurement.glutes = parseFloat(newGlutes);

    if (Object.keys(measurement).length === 0) return;

    const updated = addMeasurement(users, activeUserId, measurement);
    setUsers(updated);
    saveUsers(updated);

    if (authUser && activeUserId === authUser.id) {
      const ts = new Date().toISOString();
      const promises = [];
      if (measurement.weight) promises.push(addCloudMeasurement({ user_id: authUser.id, type: 'weight', value: measurement.weight, recorded_at: ts }));
      if (measurement.height) promises.push(addCloudMeasurement({ user_id: authUser.id, type: 'height', value: measurement.height, recorded_at: ts }));
      if (measurement.chest) promises.push(addCloudMeasurement({ user_id: authUser.id, type: 'chest', value: measurement.chest, recorded_at: ts }));
      if (measurement.waist) promises.push(addCloudMeasurement({ user_id: authUser.id, type: 'waist', value: measurement.waist, recorded_at: ts }));
      if (measurement.hips) promises.push(addCloudMeasurement({ user_id: authUser.id, type: 'hips', value: measurement.hips, recorded_at: ts }));
      if (measurement.biceps) promises.push(addCloudMeasurement({ user_id: authUser.id, type: 'biceps', value: measurement.biceps, recorded_at: ts }));
      if (measurement.shoulders) promises.push(addCloudMeasurement({ user_id: authUser.id, type: 'shoulders', value: measurement.shoulders, recorded_at: ts }));
      if (measurement.glutes) promises.push(addCloudMeasurement({ user_id: authUser.id, type: 'glutes', value: measurement.glutes, recorded_at: ts }));
      Promise.all(promises).catch(console.error);
    }

    setShowMeasurementForm(false);
    setNewWeight(""); setNewHeight(""); setNewChest(""); setNewWaist(""); setNewHips(""); setNewBiceps(""); setNewShoulders(""); setNewGlutes("");
  };


  return (
    <div className="pb-12 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 px-1">
        <div>
          <h1 className="text-2xl font-black italic uppercase text-white leading-none">
            Личный <span className="text-[var(--accent-primary)]">Кабинет</span>
          </h1>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative p-6 border border-white/5 bg-zinc-900/10 mb-8 overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 opacity-20 pointer-events-none blur-3xl rounded-full" style={{ backgroundColor: rank.color }} />

        <div className="relative flex flex-col md:flex-row items-center gap-6">
          {/* Avatar */}
          <div className="relative">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-transform overflow-hidden"
              style={{ background: activeUser?.avatarType === "photo" && activeUser?.avatar ? "transparent" : `linear-gradient(135deg, ${rank.color}80, ${rank.color})` }}
              onClick={handleStartEditProfile}
            >
              {   // Inline Avatar Rendering Logic (Simplified)
                activeUser?.avatarType === "photo" && activeUser?.avatar && isBase64Image(activeUser.avatar) ?
                  <img src={activeUser.avatar} alt={activeUser.name} className="w-28 h-28 text-5xl rounded-full object-cover" /> :
                  <span className="text-5xl">{activeUser?.avatar ?? "👤"}</span>
              }
            </div>
            <div className="absolute -bottom-2 -right-2 border border-white/10 rounded-sm px-2 py-0.5 text-[10px] font-mono font-black" style={{ backgroundColor: "#000", color: rank.color }}>
              УРВ {overallLevel}
            </div>
            {isAdminUser && <div className="absolute -top-1 -left-1 bg-yellow-500 text-black rounded-full w-6 h-6 flex items-center justify-center text-xs">👑</div>}
          </div>

          {/* Info */}
          <div className="text-center md:text-left flex-1">
            {isEditingProfile ? (
              <div className="space-y-4">
                <input type="text" className="w-full bg-black/60 border border-white/10 px-3 py-2 text-white outline-none focus:border-yellow-500" placeholder="Имя" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                <div className="flex gap-2 mb-2">
                  <button type="button" className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border transition-all ${editAvatarType === "emoji" ? "bg-yellow-500 text-black border-yellow-500" : "bg-white/5 text-zinc-500 border-white/5 hover:text-white"}`} onClick={() => setEditAvatarType("emoji")}>😀 Эмодзи</button>
                  <button type="button" className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border transition-all ${editAvatarType === "photo" ? "bg-yellow-500 text-black border-yellow-500" : "bg-white/5 text-zinc-500 border-white/5 hover:text-white"}`} onClick={() => setEditAvatarType("photo")}>📷 Фото</button>
                </div>
                {editAvatarType === "emoji" ? (
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_OPTIONS.map(av => <button key={av} type="button" className={`text-2xl p-2 rounded transition-all ${editAvatar === av ? "bg-yellow-500 text-black scale-110" : "bg-white/5 hover:bg-white/10"}`} onClick={() => setEditAvatar(av)}>{av}</button>)}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    <button type="button" className="px-3 py-1 text-[10px] font-black uppercase border border-white/20 text-white hover:bg-white/5 transition-colors" onClick={() => fileInputRef.current?.click()}>📷 Загрузить фото</button>
                    {editAvatar && isBase64Image(editAvatar) && <img src={editAvatar} className="w-16 h-16 rounded-full object-cover border-2 border-yellow-500" />}
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="px-4 py-1.5 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-yellow-400" onClick={handleSaveProfile}>Сохранить</button>
                  <button className="px-4 py-1.5 bg-white/5 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10" onClick={() => setIsEditingProfile(false)}>Отмена</button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black uppercase italic text-white leading-tight">
                  {displayName}
                  {isAdminUser && <span className="ml-2 text-[10px] font-mono text-yellow-500 uppercase tracking-widest bg-yellow-500/10 px-1.5 py-0.5 border border-yellow-500/30">Admin</span>}
                </h2>
                <p className="text-xs font-mono uppercase tracking-[0.2em] mt-1" style={{ color: rank.color }}>{rank.titleRu}</p>
                <div className="flex items-center gap-1 mt-3">
                  <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full transition-all duration-1000" style={{ width: `${(filledDisciplines / list.length) * 100}%`, backgroundColor: rank.color }} />
                  </div>
                  <span className="text-[9px] font-mono text-zinc-600 uppercase">{filledDisciplines}/{list.length} PR</span>
                </div>
                <button className="mt-4 text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-white border-b border-zinc-800 hover:border-white transition-all" onClick={handleStartEditProfile}>Ред. Профиль</button>
              </>
            )}
          </div>

          <div className="text-center">
            <div className="text-5xl font-black italic bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${rank.color}, ${rank.color}cc)` }}>{overallLevel}</div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mt-1">Ранг (Уровень)</p>
          </div>
        </div>
      </div>

      {/* Discipline List (Moved Up) */}
      <div className="space-y-6 mb-8">
        {Object.entries(groupedAchievements).map(([category, items]) => {
          const visibleItems = showAllDisciplines ? items : items.filter(i => i.value !== null);
          if (visibleItems.length === 0) return null;
          return (
            <div key={category} className="animate-fadeIn">
              <h4 className="text-[10px] font-black uppercase italic tracking-widest text-zinc-500 mb-3 px-1 border-b border-white/5 pb-2">{category}</h4>
              <div className="border border-white/5 bg-zinc-900/20 divide-y divide-white/5">
                {visibleItems.map(item => (
                  <DisciplineRow
                    key={item.discipline.slug}
                    item={item}
                    isExpanded={expandedDisciplines.has(item.discipline.slug)}
                    onToggle={() => {
                      const next = new Set(expandedDisciplines);
                      if (next.has(item.discipline.slug)) next.delete(item.discipline.slug);
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

      {/* Measurements (Moved Down & Expanded) */}
      <section className="bg-zinc-900/10 border border-white/5 overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-zinc-400">Метрики тела</h3>
            <button
              onClick={() => setShowInstructions(true)}
              className="w-4 h-4 rounded-full border border-zinc-600 flex items-center justify-center text-[9px] text-zinc-500 hover:text-white hover:border-white transition-colors"
              title="Как замерять?"
            >
              i
            </button>
          </div>
          <button className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-white transition-colors" onClick={() => setShowMeasurementForm(!showMeasurementForm)}>{showMeasurementForm ? "[ СКРЫТЬ ]" : "[ ВНЕСТИ ]"}</button>
        </div>

        {showMeasurementForm && (
          <div className="p-4 border-b border-white/5 bg-black/40 backdrop-blur-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1">Вес (кг)</label><input type="number" className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2 text-sm font-mono text-white focus:border-[var(--accent-primary)] outline-none" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="75.5" /></div>
              <div><label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1">Рост (см)</label><input type="number" className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2 text-sm font-mono text-white focus:border-[var(--accent-primary)] outline-none" value={newHeight} onChange={e => setNewHeight(e.target.value)} placeholder="180" /></div>
              <div><label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1">Грудь (см)</label><input type="number" className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2 text-sm font-mono text-white focus:border-[var(--accent-primary)] outline-none" value={newChest} onChange={e => setNewChest(e.target.value)} placeholder="100" /></div>
              <div><label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1">Талия (см)</label><input type="number" className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2 text-sm font-mono text-white focus:border-[var(--accent-primary)] outline-none" value={newWaist} onChange={e => setNewWaist(e.target.value)} placeholder="80" /></div>
              <div><label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1">Бёдра (см)</label><input type="number" className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2 text-sm font-mono text-white focus:border-[var(--accent-primary)] outline-none" value={newHips} onChange={e => setNewHips(e.target.value)} placeholder="95" /></div>
              <div><label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1">Бицепс (см)</label><input type="number" className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2 text-sm font-mono text-white focus:border-[var(--accent-primary)] outline-none" value={newBiceps} onChange={e => setNewBiceps(e.target.value)} placeholder="35" /></div>
              <div><label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1">Плечи (см)</label><input type="number" className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2 text-sm font-mono text-white focus:border-[var(--accent-primary)] outline-none" value={newShoulders} onChange={e => setNewShoulders(e.target.value)} placeholder="120" /></div>
              <div><label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1">Ягодицы (см)</label><input type="number" className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2 text-sm font-mono text-white focus:border-[var(--accent-primary)] outline-none" value={newGlutes} onChange={e => setNewGlutes(e.target.value)} placeholder="95" /></div>
            </div>
            <button className="w-full mt-4 bg-[var(--accent-primary)] py-2 text-[10px] font-black uppercase italic tracking-widest text-black hover:bg-yellow-400 transition-colors" onClick={handleAddMeasurement}>СОХРАНИТЬ ДАННЫЕ</button>
          </div>
        )}
        <div className="p-4">
          {latestMeasurements ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <MeasurementCard label="Вес" value={latestMeasurements.weight} unit="кг" icon="⚖️" />
                <MeasurementCard label="Рост" value={latestMeasurements.height} unit="см" icon="📏" />
                <MeasurementCard label="Грудь" value={latestMeasurements.chest} unit="см" icon="📐" />
                <MeasurementCard label="Талия" value={latestMeasurements.waist} unit="см" icon="📏" />
                <MeasurementCard label="Бёдра" value={latestMeasurements.hips} unit="см" icon="📐" />
                <MeasurementCard label="Бицепс" value={latestMeasurements.biceps} unit="см" icon="💪" />
                <MeasurementCard label="Плечи" value={latestMeasurements.shoulders} unit="см" icon="👕" />
                <MeasurementCard label="Ягодицы" value={latestMeasurements.glutes} unit="см" icon="🍑" />
              </div>
              {measurementHistory.length > 1 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-zinc-600 hover:text-white transition-colors uppercase text-[9px] font-black tracking-widest">История измерений ({measurementHistory.length})</summary>
                  <div className="mt-2 space-y-2">
                    {measurementHistory.map(m => (
                      <div key={m.ts} className="flex flex-wrap justify-between items-center text-[10px] font-mono py-2 border-b border-white/5 last:border-0">
                        <span className="text-zinc-600 shrink-0 mr-4">{new Date(m.ts).toLocaleDateString("ru-RU")}</span>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-400 justify-end">
                          {m.weight && <span>⚖️ {m.weight}</span>}
                          {m.height && <span>📏 {m.height}</span>}
                          {m.chest && <span>📐 {m.chest}</span>}
                          {m.waist && <span>📏 {m.waist}</span>}
                          {m.hips && <span>📐 {m.hips}</span>}
                          {m.biceps && <span>💪 {m.biceps}</span>}
                          {m.shoulders && <span>👕 {m.shoulders}</span>}
                          {m.glutes && <span>🍑 {m.glutes}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : <p className="text-zinc-600 text-[10px] font-mono uppercase text-center py-4">НЕТ ДАННЫХ. НАЧНИТЕ ОТСЛЕЖИВАНИЕ</p>}
        </div>
      </section>

      {/* Progress Photos */}
      {authUser && activeUserId === authUser.id && (
        <PhotoGallery userId={authUser.id} />
      )}

      {/* Debug Info (Only visible if logs present) */}
      {syncLogs.length > 0 && (
        <div className="mt-8 p-4 bg-zinc-900/50 border border-white/5 rounded text-[10px] font-mono text-zinc-500">
          <div className="flex justify-between items-center mb-2">
            <span className="text-zinc-400 font-bold uppercase">System Debug</span>
            <div className="flex gap-2">
              <button onClick={() => window.location.reload()} className="text-blue-500 underline">Sync</button>
              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-red-500 underline">Reset</button>
            </div>
          </div>
          {syncLogs.map((l, i) => <div key={i}>{l}</div>)}
          {authUser && <div className="mt-2 text-zinc-600">ID: {authUser.id.slice(0, 8)}...</div>}
          <div className="mt-1 text-[8px] text-zinc-700 break-all">URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}</div>
        </div>
      )}

      {/* Stats Grid */}
      <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-zinc-600 mb-4 px-1">Основные параметры</h3>
      <div className="grid gap-3 grid-cols-2 mb-8">
        {stats.map(stat => <StatCard key={stat.stat} stat={stat} isSelected={selectedStat === stat.stat} onClick={() => setSelectedStat(selectedStat === stat.stat ? null : stat.stat)} />)}
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowInstructions(false)}>
          <div className="bg-zinc-900 border border-white/10 p-6 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-2 right-2 text-zinc-500 hover:text-white" onClick={() => setShowInstructions(false)}>✕</button>
            <h3 className="text-xl font-black italic uppercase mb-4 text-white">Как делать замеры</h3>
            <div className="bg-zinc-800 flex items-center justify-center mb-4 border border-white/5 p-2">
              <img src="/measurements.jpg" alt="Схема замеров" className="w-full h-auto max-h-[60vh] object-contain rounded-sm" />
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Для точности результатов проводите замеры утром натощак, в расслабленном состоянии. Используйте сантиметровую ленту.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
