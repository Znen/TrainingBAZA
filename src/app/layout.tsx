import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import UserSwitcher from "@/components/UserSwitcher";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import { BottomNav } from "@/components/BottomNav";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <ToastProvider>
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#0d0d0d]/95 backdrop-blur-md border-b border-white/5">
              <div className="mx-auto flex max-w-5xl h-14 items-center justify-between px-4">
                <Link
                  href="/"
                  className="flex items-center gap-2.5 group"
                >
                  {/* Logo mark */}
                  <div className="w-7 h-7 bg-[var(--accent-primary)] flex items-center justify-center font-black text-black text-sm leading-none select-none">
                    Б
                  </div>
                  <span className="font-bold text-base tracking-tight uppercase italic">
                    <span className="text-white">Training</span>
                    <span className="text-[var(--accent-primary)] ml-1">BAZA</span>
                  </span>
                </Link>

                <UserSwitcher />
              </div>
            </header>

            {/* Main content */}
            <main className="flex-1 pt-14 pb-24 mx-auto w-full max-w-5xl px-4">
              {children}
            </main>

            {/* Bottom navigation */}
            <BottomNav />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
