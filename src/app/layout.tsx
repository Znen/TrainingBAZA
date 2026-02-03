import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import UserSwitcher from "@/components/UserSwitcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Training BAZA",
  description: "Система отслеживания тренировок с RPG-прогрессией",
};

const navLinks = [
  { href: "/", label: "Главная", icon: "🏠" },
  { href: "/results", label: "Результаты", icon: "📊" },
  { href: "/program", label: "Программа", icon: "📅" },
  { href: "/ratings", label: "Рейтинги", icon: "🏆" },
  { href: "/account", label: "Кабинет", icon: "⚔️" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen flex flex-col">
          {/* Навигация */}
          <nav className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-[var(--bg-primary)]/95 backdrop-blur-md">
            <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2 sm:px-6 sm:gap-2">
              {/* Лого */}
              <Link
                className="font-bold text-lg mr-4 sm:mr-6 flex items-center gap-2 text-[var(--text-primary)]"
                href="/"
              >
                <span className="text-xl">🎯</span>
                <span className="hidden sm:inline">Training BAZA</span>
              </Link>

              {/* Ссылки навигации */}
              <div className="flex items-center gap-0.5 sm:gap-1">
                {navLinks.slice(1).map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="nav-link px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-[var(--bg-card-hover)] transition-colors flex items-center gap-1.5"
                  >
                    <span className="text-base">{link.icon}</span>
                    <span className="hidden sm:inline">{link.label}</span>
                  </Link>
                ))}
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Переключатель пользователей */}
              <UserSwitcher />
            </div>
          </nav>

          {/* Контент */}
          <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>

          {/* Футер */}
          <footer className="border-t border-[var(--border-default)] py-4 mt-auto">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center text-sm text-[var(--text-muted)]">
              Training BAZA © 2024
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
