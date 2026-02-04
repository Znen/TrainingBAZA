"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
    User,
    loadUsers,
    saveUsers,
    loadActiveUserId,
    saveActiveUserId,
    createUser,
    isBase64Image,
} from "@/lib/users";
import { useAuth } from "@/components/AuthProvider";
import { getCloudProfile, updateCloudProfile, type CloudProfile } from "@/lib/cloudSync";

// Хелпер для рендеринга аватара (эмодзи или фото)
function renderAvatar(avatar: string | undefined, size: "sm" | "lg" = "sm") {
    if (!avatar) {
        return <span className={size === "lg" ? "text-2xl" : "text-lg"}>👤</span>;
    }
    if (isBase64Image(avatar)) {
        return (
            <img
                src={avatar}
                alt="avatar"
                className={`rounded-full object-cover ${size === "lg" ? "w-8 h-8" : "w-5 h-5"}`}
            />
        );
    }
    return <span className={size === "lg" ? "text-2xl" : "text-lg"}>{avatar}</span>;
}

export default function UserSwitcher() {
    const [mounted, setMounted] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [activeUserId, setActiveUserId] = useState<string>("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [registerName, setRegisterName] = useState("");
    const [registerEmail, setRegisterEmail] = useState("");
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

    const activeUser = users.find((u) => u.id === activeUserId);

    // Supabase auth
    const { user: authUser, loading: authLoading, signOut } = useAuth();
    const [cloudProfile, setCloudProfile] = useState<CloudProfile | null>(null);

    // Load cloud profile
    useEffect(() => {
        if (authUser && !authLoading) {
            getCloudProfile(authUser.id).then(setCloudProfile);
        } else {
            setCloudProfile(null);
        }
    }, [authUser, authLoading]);

    // Sync local profile to cloud if cloud is empty/generic
    useEffect(() => {
        // Only sync if we have both and cloud name looks like a default/email-based one
        if (authUser && cloudProfile && activeUser && !authLoading) {
            const isGenericName = !cloudProfile.name ||
                cloudProfile.name === 'User' ||
                cloudProfile.name === authUser.email?.split('@')[0];

            const hasCustomLocalName = activeUser.name &&
                activeUser.name !== 'Гость' &&
                activeUser.name !== 'Тренер' &&
                activeUser.name !== 'User';

            if (isGenericName && hasCustomLocalName) {
                console.log("Auto-syncing local name to cloud:", activeUser.name);
                updateCloudProfile(authUser.id, {
                    name: activeUser.name,
                    avatar: activeUser.avatar,
                    avatar_type: activeUser.avatarType === 'photo' ? 'photo' : 'emoji'
                });

                // Optimistic update to UI
                setCloudProfile(prev => prev ? {
                    ...prev,
                    name: activeUser.name,
                    avatar: activeUser.avatar || null
                } : null);
            }
        }
    }, [authUser, cloudProfile, activeUser, authLoading]);

    useEffect(() => {
        setMounted(true);
        const u = loadUsers();
        setUsers(u);
        const savedActive = loadActiveUserId();
        if (savedActive && u.some((x) => x.id === savedActive)) {
            setActiveUserId(savedActive);
        } else if (u.length > 0) {
            setActiveUserId(u[0].id);
        }
    }, []);

    // Update dropdown position when button is clicked
    useEffect(() => {
        if (showDropdown && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
            });
        }
    }, [showDropdown]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(target) &&
                buttonRef.current &&
                !buttonRef.current.contains(target)
            ) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showDropdown]);



    // Determine display properties
    // If authenticated: use cloud profile
    // If NOT authenticated: force "Guest" and no admin badge (ignore local storage legacy "Trainer")
    const displayName = authUser
        ? (cloudProfile?.name || authUser.email?.split('@')[0] || "Атлет")
        : "Гость";

    const displayAvatar = authUser
        ? (cloudProfile?.avatar || activeUser?.avatar)
        : undefined; // Default avatar for guest

    // Only cloud admins get the badge
    const showAdminBadge = authUser && cloudProfile?.role === 'admin';

    const handleSwitchUser = (userId: string) => {
        setActiveUserId(userId);
        saveActiveUserId(userId);
        setShowDropdown(false);
        window.location.reload();
    };

    const handleRegister = () => {
        if (!registerName.trim()) return;

        if (registerEmail && users.some(u => u.email === registerEmail)) {
            alert("Пользователь с такой почтой уже существует");
            return;
        }

        const newUser = createUser(registerName.trim(), "user");
        newUser.email = registerEmail.trim() || undefined;

        const nextUsers = [...users, newUser];
        setUsers(nextUsers);
        saveUsers(nextUsers);

        setActiveUserId(newUser.id);
        saveActiveUserId(newUser.id);

        setShowRegister(false);
        setRegisterName("");
        setRegisterEmail("");

        window.location.reload();
    };

    const handleLogin = () => {
        if (!registerEmail.trim()) return;

        const found = users.find(u => u.email === registerEmail.trim());
        if (found) {
            handleSwitchUser(found.id);
        } else {
            alert("Пользователь не найден. Зарегистрируйтесь.");
        }
    };

    // SSR placeholder
    if (!mounted) {
        return (
            <div className="flex-shrink-0">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-blue-500 bg-zinc-800 text-sm text-white">
                    <span>👤</span>
                    <span>...</span>
                </div>
            </div>
        );
    }

    const dropdownContent = showDropdown ? (
        <div
            ref={dropdownRef}
            className="fixed w-72 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden"
            style={{
                zIndex: 999999,
                top: dropdownPosition.top,
                right: dropdownPosition.right,
            }}
        >
            {/* Current User Info */}
            <div className="p-3 border-b border-zinc-700 bg-zinc-800">
                <p className="text-xs text-zinc-400">
                    Текущий: <strong className="text-white">{activeUser?.name || "Гость"}</strong>
                    {activeUser?.role === "admin" && " 👑 (Тренер)"}
                </p>
                {authUser && (
                    <p className="text-xs text-green-400 mt-1">
                        ☁️ Облако: {authUser.email}
                    </p>
                )}
            </div>

            {/* Cloud Auth Section */}
            {!authUser && !authLoading && (
                <div className="p-3 border-b border-zinc-700 bg-blue-900/30">
                    <p className="text-xs text-blue-300 mb-2">☁️ Облачная синхронизация</p>
                    <div className="flex gap-2">
                        <Link
                            href="/auth/login"
                            className="flex-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-center transition-colors"
                            onClick={() => setShowDropdown(false)}
                        >
                            Войти
                        </Link>
                        <Link
                            href="/auth/register"
                            className="flex-1 px-3 py-2 text-xs bg-green-600 hover:bg-green-700 rounded-lg text-white text-center transition-colors"
                            onClick={() => setShowDropdown(false)}
                        >
                            Регистрация
                        </Link>
                    </div>
                </div>
            )}
            {authUser && (
                <div className="p-3 border-b border-zinc-700 space-y-2">
                    <Link
                        href="/sync"
                        className="block w-full px-3 py-2 text-xs bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600 rounded-lg text-blue-400 text-center transition-colors"
                        onClick={() => setShowDropdown(false)}
                    >
                        🔄 Синхронизация данных
                    </Link>
                    <button
                        onClick={async () => {
                            await signOut();
                            setShowDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-xs bg-red-600/20 hover:bg-red-600/40 border border-red-600 rounded-lg text-red-400 transition-colors"
                    >
                        Выйти из облака
                    </button>
                </div>
            )}

            {/* User List */}
            {users.length > 0 && (
                <div className="max-h-48 overflow-y-auto">
                    {users.map((u) => (
                        <button
                            key={u.id}
                            type="button"
                            className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-zinc-800 transition-colors ${u.id === activeUserId ? "bg-blue-900/30 border-l-2 border-blue-500" : ""
                                }`}
                            onClick={() => handleSwitchUser(u.id)}
                        >
                            {renderAvatar(u.avatar, "lg")}
                            <span className="flex-1 truncate text-white">{u.name}</span>
                            {u.role === "admin" && <span className="text-xs">👑</span>}
                            {u.id === activeUserId && <span className="text-blue-400">✓</span>}
                        </button>
                    ))}
                </div>
            )}

            {/* Divider */}
            <div className="border-t border-zinc-700" />

            {/* Register/Login Section - REMOVED LEGACY LOCAL AUTH */}
            {/* If you want to add local profiles, use a different mechanism. 
                For now, we rely on Supabase Auth. */
            }
        </div>
    ) : null;

    return (
        <>
            <div className="flex-shrink-0">
                {/* Main Button */}
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-blue-500 bg-zinc-800 hover:bg-zinc-700 text-sm text-white cursor-pointer transition-colors"
                >
                    {renderAvatar(displayAvatar)}
                    <span>{displayName}</span>
                    {showAdminBadge && <span className="text-xs">👑</span>}
                    <span className="text-xs opacity-50">{showDropdown ? "▲" : "▼"}</span>
                </button>
            </div>

            {/* Portal dropdown to body */}
            {mounted && dropdownContent && createPortal(dropdownContent, document.body)}
        </>
    );
}
