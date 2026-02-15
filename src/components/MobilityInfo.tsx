"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

/* ── Static data for 3 mobility tests ── */

interface MobilityLevel {
    level: number;
    image: string;
    description: string;
}

interface MobilityTest {
    icon: string;
    title: string;
    subtitle?: string;
    startingPosition: string;
    levels: MobilityLevel[];
}

const MOBILITY_TESTS: MobilityTest[] = [
    {
        icon: "🧘‍♂️",
        title: "Панкейк",
        subtitle: "Тест подвижности тазобедренных и задней поверхности бедра",
        startingPosition:
            "Сидя на полу, ноги широко разведены и полностью выпрямлены, колени смотрят вверх, спина прямая. Наклон выполняется за счёт сгибания в тазобедренных суставах, без округления поясницы.",
        levels: [
            {
                level: 1,
                image: "/mobility/pancake/pancake_lvl_1.JPG",
                description:
                    "Небольшой наклон корпуса вперёд.\nЛадони находятся на полу в районе колен.\nСпина сохраняет нейтральное положение, без округления.",
            },
            {
                level: 2,
                image: "/mobility/pancake/pancake_lvl_2.JPG",
                description:
                    "Наклон корпуса углубляется.\nПредплечья полностью касаются пола.\nКонтроль положения таза и ровной спины сохраняется.",
            },
            {
                level: 3,
                image: "/mobility/pancake/pancake_lvl_3.JPG",
                description:
                    "Глубокий наклон вперёд.\nГолова касается пола между ног.\nНаклон выполняется без рывков и компенсаций.",
            },
            {
                level: 4,
                image: "/mobility/pancake/pancake_lvl_4.JPG",
                description:
                    "Максимальный наклон корпуса.\nГрудная клетка и голова полностью касаются пола.\nПоложение удерживается спокойно, без напряжения и боли.",
            },
        ],
    },
    {
        icon: "🧘‍♂️",
        title: "Наклон вперёд из положения стоя (ноги вместе)",
        subtitle: "Тест подвижности задней поверхности бедра",
        startingPosition:
            "Стоя, ноги вместе, колени полностью выпрямлены. Стопы параллельны. Наклон выполняется плавно вперёд, без рывков.",
        levels: [
            {
                level: 1,
                image: "/mobility/naklon/naklon_lvl_1.JPG",
                description:
                    "При наклоне вперёд кончики пальцев рук касаются пола.\nКолени остаются выпрямленными.",
            },
            {
                level: 2,
                image: "/mobility/naklon/naklon_lvl_2.JPG",
                description:
                    "Наклон углубляется.\nКулачки рук полностью касаются пола.\nПоложение выполняется без сгибания коленей.",
            },
            {
                level: 3,
                image: "/mobility/naklon/naklon_lvl_3.JPG",
                description:
                    "Максимальный наклон вперёд.\nЛадони полностью касаются пола.\nКолени прямые, наклон контролируемый и без боли.",
            },
        ],
    },
    {
        icon: "🤸‍♂️",
        title: "Мостик",
        subtitle:
            "Тест подвижности плечевых суставов, позвоночника и тазобедренных",
        startingPosition:
            "Лёжа на спине. Стопы на полу на ширине таза, руки возле головы, ладони упираются в пол, пальцы направлены к плечам. Выход в мостик выполняется контролируемо.",
        levels: [
            {
                level: 1,
                image: "/mobility/most/most_lvl_1.JPG",
                description:
                    "При выходе в мостик голова касается пола.\nПолного выпрямления рук и раскрытия плеч нет.",
            },
            {
                level: 2,
                image: "/mobility/most/most_lvl_2.JPG",
                description:
                    "Мостик удерживается на руках и ногах.\nЛокти слегка согнуты, плечевые суставы раскрыты не полностью.\nФорма стабильная, без резкого прогиба в пояснице.",
            },
            {
                level: 3,
                image: "/mobility/most/most_lvl_3.JPG",
                description:
                    "Визуально правильный мостик.\nРуки и ноги выпрямлены, плечи полностью раскрыты, грудная клетка выведена вперёд.\nДополнительная проверка: возможность пройтись в этом положении вперёд или назад без потери формы.",
            },
        ],
    },
];

/* ── Lightbox modal ── */

function ImageLightbox({
    src,
    alt,
    onClose,
}: {
    src: string;
    alt: string;
    onClose: () => void;
}) {
    // ESC to close
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKey);
        // Prevent body scroll while open
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleKey);
            document.body.style.overflow = "";
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={alt}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-xl transition-colors"
                aria-label="Закрыть"
            >
                ✕
            </button>

            {/* Caption */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 bg-black/60 rounded-full text-xs text-zinc-300 font-mono">
                {alt}
            </div>

            {/* Full image — object-contain so nothing is cropped */}
            <div className="relative w-[90vw] h-[85vh] z-[1]">
                <Image
                    src={src}
                    alt={alt}
                    fill
                    className="object-contain"
                    sizes="90vw"
                    priority
                />
            </div>
        </div>
    );
}

/* ── Level card ── */

function LevelCard({
    lvl,
    onImageClick,
}: {
    lvl: MobilityLevel;
    onImageClick: (src: string, alt: string) => void;
}) {
    const alt = `Уровень ${lvl.level}`;

    return (
        <div className="flex flex-col bg-black/30 border border-white/5 rounded-lg overflow-hidden h-full">
            {/* Fixed aspect-ratio image area — clickable */}
            <button
                type="button"
                className="relative w-full aspect-[4/3] bg-zinc-900 cursor-zoom-in flex-shrink-0 group overflow-hidden"
                onClick={() => onImageClick(lvl.image, alt)}
                aria-label={`Открыть ${alt} на весь экран`}
            >
                <Image
                    src={lvl.image}
                    alt={alt}
                    fill
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 25vw"
                />
                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-2xl drop-shadow-lg">
                        🔍
                    </span>
                </div>
            </button>

            {/* Text area */}
            <div className="p-3 flex-1 flex flex-col">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">
                    Уровень {lvl.level}
                </div>
                <div className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-line">
                    {lvl.description}
                </div>
            </div>
        </div>
    );
}

/* ── Test block ── */

function MobilityTestBlock({
    test,
    onImageClick,
}: {
    test: MobilityTest;
    onImageClick: (src: string, alt: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="card">
            <div
                className="card-header cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <span
                        className="text-sm transition-transform"
                        style={{
                            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                        }}
                    >
                        ▶
                    </span>
                    <span className="text-lg">{test.icon}</span>
                    <div>
                        <h3 className="card-title text-sm">{test.title}</h3>
                        {test.subtitle && (
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                                {test.subtitle}
                            </p>
                        )}
                    </div>
                </div>
                <span className="badge">{test.levels.length} уровней</span>
            </div>

            {expanded && (
                <div className="p-4 space-y-4">
                    {/* Starting position */}
                    <div className="bg-zinc-900/40 border border-white/5 rounded-lg p-3">
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">
                            Исходное положение для всех уровней
                        </div>
                        <p className="text-[11px] text-zinc-300 leading-relaxed">
                            {test.startingPosition}
                        </p>
                    </div>

                    {/* Level cards — items-stretch ensures equal card heights */}
                    <div
                        className={`grid gap-3 items-stretch ${test.levels.length === 4
                                ? "grid-cols-2 md:grid-cols-4"
                                : "grid-cols-1 md:grid-cols-3"
                            }`}
                    >
                        {test.levels.map((lvl) => (
                            <LevelCard
                                key={lvl.level}
                                lvl={lvl}
                                onImageClick={onImageClick}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Exported section ── */

export function MobilityInfoSection() {
    const [lightbox, setLightbox] = useState<{
        src: string;
        alt: string;
    } | null>(null);

    const openLightbox = useCallback((src: string, alt: string) => {
        setLightbox({ src, alt });
    }, []);

    const closeLightbox = useCallback(() => {
        setLightbox(null);
    }, []);

    return (
        <>
            <section className="mt-6">
                <div className="mb-4">
                    <h2 className="text-lg font-black italic uppercase text-white">
                        Подвижность
                    </h2>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.15em] mt-1">
                        Информационные тесты • только для самопроверки
                    </p>
                </div>
                <div className="grid gap-4">
                    {MOBILITY_TESTS.map((test) => (
                        <MobilityTestBlock
                            key={test.title}
                            test={test}
                            onImageClick={openLightbox}
                        />
                    ))}
                </div>
            </section>

            {/* Global lightbox */}
            {lightbox && (
                <ImageLightbox
                    src={lightbox.src}
                    alt={lightbox.alt}
                    onClose={closeLightbox}
                />
            )}
        </>
    );
}
