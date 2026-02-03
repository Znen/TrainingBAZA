"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
    User,
    loadUsers,
    saveUsers,
    loadActiveUserId,
    saveActiveUserId,
    createUser,
    isBase64Image,
} from "@/lib/users";

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

    const activeUser = users.find((u) => u.id === activeUserId);

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
            </div>

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

            {/* Register/Login Section */}
            {!showRegister ? (
                <div className="p-3">
                    <button
                        type="button"
                        onClick={() => setShowRegister(true)}
                        className="w-full px-4 py-2 text-sm text-center bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                    >
                        ➕ Регистрация / Вход
                    </button>
                </div>
            ) : (
                <div className="p-4 space-y-3">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Имя</label>
                        <input
                            type="text"
                            value={registerName}
                            onChange={(e) => setRegisterName(e.target.value)}
                            placeholder="Ваше имя"
                            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-white text-sm focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Email (опционально)</label>
                        <input
                            type="email"
                            value={registerEmail}
                            onChange={(e) => setRegisterEmail(e.target.value)}
                            placeholder="email@example.com"
                            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-white text-sm focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleRegister}
                            className="flex-1 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors"
                        >
                            Создать
                        </button>
                        <button
                            type="button"
                            onClick={handleLogin}
                            className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                        >
                            Войти
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowRegister(false)}
                        className="w-full text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                        Отмена
                    </button>
                </div>
            )}
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
                    {renderAvatar(activeUser?.avatar)}
                    <span>{activeUser?.name && activeUser.name.trim() ? activeUser.name : "Войти"}</span>
                    {activeUser?.role === "admin" && <span className="text-xs">👑</span>}
                    <span className="text-xs opacity-50">{showDropdown ? "▲" : "▼"}</span>
                </button>
            </div>

            {/* Portal dropdown to body */}
            {mounted && dropdownContent && createPortal(dropdownContent, document.body)}
        </>
    );
}
