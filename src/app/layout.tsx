import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import UserSwitcher from "@/components/UserSwitcher";
import { AuthProvider } from "@/components/AuthProvider";

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
        <AuthProvider>
          {/* Глобальный хедер в стиле BAZA */}
          <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/5">
            <div className="mx-auto flex max-w-5xl h-14 items-center justify-between px-4">
              <Link
                className="font-bold text-lg flex items-center gap-1 tracking-tighter uppercase italic"
                href="/"
              >
                <span className="text-white">Training</span>
                <span className="text-[var(--accent-primary)]">BAZA</span>
              </Link>

              <UserSwitcher />
            </div>
          </header>

          {/* Основной контент с отступами под зафиксированные панели */}
          <main className="flex-1 pt-14 pb-24 mx-auto w-full max-w-5xl px-4">
            {children}
          </main>

          {/* Нижняя навигация */}
          <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-black/90 backdrop-blur-xl pb-safe">
            <div className="mx-auto flex max-w-5xl h-16 items-center justify-around">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex flex-col items-center gap-1 transition-all hover:scale-110 active:scale-90 px-3"
                >
                  <span className="text-xl opacity-80">{link.icon}</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </nav>
        </AuthProvider>
      </body>
    </html>
  );
}
