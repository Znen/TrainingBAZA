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
import { loadHistoryStore, type HistoryBySlug } from "@/lib/results";
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
import { getCloudProfile, updateCloudProfile, type CloudProfile } from "@/lib/cloudSync";

export default function AccountPage() {
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
    let u = loadUsers();
    if (u.length === 0) {
      // Создаём гостя без админ-прав (админ назначается через облако)
      const created = createUser("Гость", "user");
      u = [created];
      saveUsers(u);
    }
    setUsers(u);

    const savedActive = loadActiveUserId();
    const initialActive =
      savedActive && u.some((x) => x.id === savedActive) ? savedActive : u[0].id;
    setActiveUserId(initialActive);
    setViewingUserId(initialActive);
    saveActiveUserId(initialActive);

    const store = loadHistoryStore(initialActive);
    setHistory(store[initialActive] ?? {});
  }, []);

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
  const handleSaveProfile = () => {
    if (!viewingUser || !canEdit) return;
    const updated = updateUser(users, viewingUserId, {
      name: editName || viewingUser.name,
      avatar: editAvatar || viewingUser.avatar,
      avatarType: editAvatarType,
    });
    setUsers(updated);
    saveUsers(updated);
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
    <main>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">⚔️ Профиль атлета</h1>
          {isCurrentUserAdmin && viewingUserId !== activeUserId && (
            <p className="text-sm text-[var(--accent-warning)]">
              👁 Просмотр профиля: {viewingUser?.name}
            </p>
          )}
        </div>

        {/* Селектор пользователя для админа */}
        {isCurrentUserAdmin && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--text-muted)]">Просмотр:</span>
            <select
              className="select"
              value={viewingUserId}
              onChange={(e) => setViewingUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.role === "admin" ? "👑" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Hero Card */}
      <div className="hero-card mb-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-500/20 to-transparent rounded-full blur-3xl" />

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
              className="absolute -bottom-2 -right-2 border-2 rounded-full px-3 py-1 text-sm font-bold"
              style={{
                backgroundColor: "#0f172a",
                borderColor: rank.color,
                color: rank.color,
              }}
            >
              {overallLevel}
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
                  className="input w-full max-w-xs"
                  placeholder="Имя"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />

                {/* Табы выбора типа аватара */}
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    className={`btn btn-sm ${editAvatarType === "emoji" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setEditAvatarType("emoji")}
                  >
                    😀 Эмодзи
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${editAvatarType === "photo" ? "btn-primary" : "btn-secondary"}`}
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
                        className={`text-2xl p-2 rounded-lg transition-all ${editAvatar === av
                          ? "bg-[var(--accent-primary)] scale-110"
                          : "bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)]"
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
                      className="btn btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📷 Загрузить фото
                    </button>
                    {editAvatar && isBase64Image(editAvatar) && (
                      <div className="mt-2">
                        <img
                          src={editAvatar}
                          alt="Превью"
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      </div>
                    )}
                    <p className="text-xs text-[var(--text-muted)]">
                      Макс. размер: {MAX_PHOTO_SIZE / 1024}KB
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={handleSaveProfile}>
                    Сохранить
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIsEditingProfile(false)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {displayName}
                  {(displayRole === "admin" || isCloudAdmin) && (
                    <span className="ml-2 text-sm text-yellow-500">Тренер</span>
                  )}
                </h2>
                <p className="text-lg font-medium" style={{ color: rank.color }}>
                  {rank.titleRu}
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  {filledDisciplines} из {list.length} дисциплин
                </p>
                {canEdit && (
                  <button
                    className="btn btn-ghost btn-sm mt-2"
                    onClick={handleStartEditProfile}
                  >
                    ✏️ Редактировать
                  </button>
                )}
              </>
            )}
          </div>

          <div className="text-center">
            <div
              className="text-5xl font-bold bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, ${rank.color}, ${rank.color}cc)`,
              }}
            >
              {overallLevel}
            </div>
            <p className="text-sm text-slate-400 mt-1">Уровень</p>
          </div>
        </div>
      </div>

      {/* Измерения тела */}
      <div className="card mb-8">
        <div className="card-header">
          <h3 className="card-title">📏 Измерения тела</h3>
          {canEdit && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowMeasurementForm(!showMeasurementForm)}
            >
              {showMeasurementForm ? "Скрыть" : "+ Добавить"}
            </button>
          )}
        </div>

        {showMeasurementForm && canEdit && (
          <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Вес (кг)</label>
                <input
                  type="number"
                  className="input input-sm"
                  placeholder="75.5"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Грудь (см)</label>
                <input
                  type="number"
                  className="input input-sm"
                  placeholder="100"
                  value={newChest}
                  onChange={(e) => setNewChest(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Талия (см)</label>
                <input
                  type="number"
                  className="input input-sm"
                  placeholder="80"
                  value={newWaist}
                  onChange={(e) => setNewWaist(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Бёдра (см)</label>
                <input
                  type="number"
                  className="input input-sm"
                  placeholder="95"
                  value={newHips}
                  onChange={(e) => setNewHips(e.target.value)}
                />
              </div>
            </div>
            <button className="btn btn-primary btn-sm mt-4" onClick={handleAddMeasurement}>
              Сохранить измерения
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
                  <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                    История измерений ({measurementHistory.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {measurementHistory.map((m) => (
                      <div
                        key={m.ts}
                        className="flex justify-between items-center text-xs py-2 border-b border-[var(--border-default)] last:border-0"
                      >
                        <span className="text-[var(--text-muted)]">
                          {new Date(m.ts).toLocaleDateString("ru-RU")}
                        </span>
                        <div className="flex gap-4">
                          {m.weight && <span>⚖️ {m.weight} кг</span>}
                          {m.chest && <span>📐 {m.chest} см</span>}
                          {m.waist && <span>📏 {m.waist} см</span>}
                          {m.hips && <span>📐 {m.hips} см</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <p className="text-[var(--text-muted)] text-sm text-center py-4">
              Нет данных. {canEdit ? "Добавьте первое измерение для отслеживания прогресса." : ""}
            </p>
          )}
        </div>
      </div>

      {/* Характеристики */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
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

      {/* Легенда уровней */}
      <div className="card p-4 mb-8">
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">
          Уровни нормативов тренера
        </h3>
        <div className="flex flex-wrap gap-2">
          {STANDARD_LEVELS.map((level) => (
            <span
              key={level.id}
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${level.color}20`,
                color: level.color,
                border: `1px solid ${level.color}40`,
              }}
            >
              {level.name}
            </span>
          ))}
        </div>
      </div>

      {/* Список дисциплин */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            {selectedStat
              ? `${stats.find((s) => s.stat === selectedStat)?.name ?? "Дисциплины"}`
              : "Все дисциплины"}
          </h3>
          <button
            onClick={() => setShowAllDisciplines(!showAllDisciplines)}
            className="btn btn-ghost btn-sm"
          >
            {showAllDisciplines ? "Скрыть пустые" : "Показать все"}
          </button>
        </div>

        <div className="divide-y divide-[var(--border-default)]">
          {Object.entries(groupedAchievements).map(([category, items]) => {
            const visibleItems = showAllDisciplines
              ? items
              : items.filter((i) => i.value !== null);

            if (visibleItems.length === 0) return null;

            return (
              <div key={category}>
                <div className="px-4 py-2 bg-[var(--bg-secondary)] text-sm font-medium text-[var(--text-muted)]">
                  {category}
                </div>
                {visibleItems.map((item) => (
                  <DisciplineRow
                    key={item.discipline.slug}
                    item={item}
                    isExpanded={expandedDisciplines.has(item.discipline.slug)}
                    onToggle={() => {
                      const newSet = new Set(expandedDisciplines);
                      if (newSet.has(item.discipline.slug)) {
                        newSet.delete(item.discipline.slug);
                      } else {
                        newSet.add(item.discipline.slug);
                      }
                      setExpandedDisciplines(newSet);
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ADMIN: Управление пользователями
          ══════════════════════════════════════════════════════════════ */}
      {isCurrentUserAdmin && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">👥 Управление пользователями</h3>
            <button
              onClick={() => {
                if (confirm("Удалить ВСЕХ пользователей? Это действие необратимо!")) {
                  clearAllUsers();
                  window.location.reload();
                }
              }}
              className="btn btn-ghost btn-sm text-red-500"
            >
              🗑️ Очистить всех
            </button>
          </div>

          <div className="divide-y divide-[var(--border-default)]">
            {users.map((u) => (
              <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {u.avatar && isBase64Image(u.avatar) ? (
                    <img src={u.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span className="text-2xl">{u.avatar || "👤"}</span>
                  )}
                  <div>
                    <div className="font-medium">
                      {u.name || "(без имени)"}
                      {u.role === "admin" && <span className="ml-2 text-xs text-yellow-500">👑 Админ</span>}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">ID: {u.id.slice(0, 8)}...</div>
                  </div>
                </div>

                {u.id !== activeUserId && (
                  <button
                    onClick={() => {
                      if (confirm(`Удалить пользователя "${u.name}"?`)) {
                        const updated = deleteUser(users, u.id);
                        setUsers(updated);
                        saveUsers(updated);
                      }
                    }}
                    className="btn btn-ghost btn-sm text-red-500"
                  >
                    🗑️ Удалить
                  </button>
                )}

                {u.id === activeUserId && (
                  <span className="text-xs text-[var(--text-muted)]">(текущий)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
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
    <div className="text-center p-3 rounded-lg bg-[var(--bg-secondary)]">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xl font-bold">
        {value !== undefined ? value : "—"}
        {value !== undefined && (
          <span className="text-sm text-[var(--text-muted)] ml-1">{unit}</span>
        )}
      </div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
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
      className={`stat-card text-left ${isSelected ? "selected" : ""}`}
      style={{
        borderColor: isSelected ? stat.color : undefined,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{stat.icon}</span>
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <span className="font-medium">{stat.name}</span>
            <span className="text-lg font-bold" style={{ color: stat.color }}>
              {stat.level}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {stat.disciplineCount > 0
              ? `${stat.disciplineCount} дисциплин`
              : "Нет данных"}
          </p>
        </div>
      </div>

      <div className="progress">
        <div
          className="progress-bar"
          style={{
            width: `${barWidth}%`,
            background: `linear-gradient(90deg, ${stat.color}80, ${stat.color})`,
          }}
        />
      </div>
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
    <div>
      <div
        className={`discipline-row ${show1RM ? "cursor-pointer" : ""}`}
        onClick={show1RM ? onToggle : undefined}
      >
        <span className="discipline-icon">{discipline.icon}</span>

        <div className="discipline-info">
          <div className="discipline-name flex items-center gap-2">
            {discipline.name}
            {show1RM && (
              <span className="text-xs text-[var(--accent-primary)]">
                {isExpanded ? "▼" : "▶"} %
              </span>
            )}
          </div>
          <div className="discipline-value">
            {value !== null ? (
              <>
                {shouldUseTimeInput(discipline.unit, discipline.direction)
                  ? formatSecondsToTime(value)
                  : `${value} ${discipline.unit}`}
                {show1RM && (
                  <span className="text-[var(--text-muted)]"> (1ПМ)</span>
                )}
              </>
            ) : (
              "Нет данных"
            )}
          </div>
        </div>

        {level ? (
          <div className="flex items-center gap-2">
            <span
              className="badge"
              style={{
                backgroundColor: `${level.color}20`,
                color: level.color,
              }}
            >
              {level.name}
            </span>
            {nextLevel && (
              <div className="w-16">
                <div className="progress">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: nextLevel.color,
                    }}
                  />
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5 text-center">
                  {progress}% → {nextLevel.name}
                </p>
              </div>
            )}
          </div>
        ) : nextLevel ? (
          <div className="text-xs text-[var(--text-muted)]">До {nextLevel.name}</div>
        ) : (
          <div className="text-xs text-[var(--text-muted)]">—</div>
        )}
      </div>

      {isExpanded && show1RM && (
        <div className="px-4 pb-4 pt-1 bg-[var(--bg-secondary)] border-t border-[var(--border-default)]">
          <div className="text-xs text-[var(--text-muted)] mb-2">
            Проценты от 1ПМ ({value} {discipline.unit})
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {percentages.map(({ percent, weight }) => (
              <div
                key={percent}
                className="rounded-lg bg-[var(--bg-card)] px-2 py-2"
              >
                <div className="text-xs text-[var(--text-muted)]">{percent}%</div>
                <div className="text-sm font-semibold text-white">
                  {weight} {discipline.unit}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
