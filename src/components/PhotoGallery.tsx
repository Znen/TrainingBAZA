"use client";

import { useState, useEffect, useRef } from "react";
import { uploadProgressPhoto, getProgressPhotos, deleteProgressPhoto, type ProgressPhoto } from "@/lib/cloudSync";

interface PhotoGalleryProps {
    userId: string;
}

export function PhotoGallery({ userId }: PhotoGalleryProps) {
    const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);

    useEffect(() => {
        loadPhotos();
    }, [userId]);

    const loadPhotos = async () => {
        setLoading(true);
        const data = await getProgressPhotos(userId);
        setPhotos(data);
        setLoading(false);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const { data, error } = await uploadProgressPhoto(userId, file);
        if (error) {
            alert("Ошибка загрузки");
        } else if (data) {
            // Refresh list
            loadPhotos();
        }
        setUploading(false);
    };

    const handleDelete = async (photo: ProgressPhoto) => {
        if (!confirm("Удалить это фото?")) return;

        setLoading(true);
        const { error } = await deleteProgressPhoto(photo);
        if (error) {
            alert("Ошибка удаления: " + error);
        } else {
            setSelectedPhoto(null);
            loadPhotos();
        }
        setLoading(false);
    };

    return (
        <div className="bg-zinc-900/10 border border-white/5 overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-zinc-400">Фото прогресса</h3>
                <div className="flex gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUpload}
                    />
                    <button
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-white transition-colors"
                    >
                        {uploading ? "[ ЗАГРУЗКА... ]" : "[ ДОБАВИТЬ ФОТО ]"}
                    </button>
                </div>
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="text-center text-[10px] font-mono text-zinc-600 py-4">Загрузка...</div>
                ) : photos.length === 0 ? (
                    <div className="text-center text-[10px] font-mono text-zinc-600 py-4">НЕТ ФОТО. ЗАГРУЗИТЕ ПЕРВОЕ ФОТО ДЛЯ ОТСЛЕЖИВАНИЯ ПРОГРЕССА</div>
                ) : (
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                        {photos.map(photo => (
                            <div
                                key={photo.id}
                                className="aspect-square relative group cursor-pointer overflow-hidden border border-white/5 bg-zinc-800"
                                onClick={() => setSelectedPhoto(photo)}
                            >
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(photo); }}
                                    className="absolute top-1 right-1 w-6 h-6 bg-red-600/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold z-10 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg"
                                    title="Удалить"
                                >
                                    ✕
                                </button>
                                <img
                                    src={photo.full_url}
                                    alt="Progress"
                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[8px] font-mono text-white text-center">
                                    {new Date(photo.recorded_at).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {selectedPhoto && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setSelectedPhoto(null)}
                >
                    <div className="relative max-w-4xl max-h-screen">
                        <img
                            src={selectedPhoto.full_url}
                            className="max-w-full max-h-[85vh] border border-white/10 shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        />
                        <div className="mt-2 text-center">
                            <p className="text-sm font-mono text-zinc-400">{new Date(selectedPhoto.recorded_at).toLocaleString()}</p>
                            <button
                                className="mt-4 px-4 py-2 bg-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-colors"
                                onClick={() => setSelectedPhoto(null)}
                            >
                                Закрыть
                            </button>
                            <button
                                className="mt-4 px-4 py-2 bg-red-500/20 text-red-500 text-xs font-bold uppercase tracking-widest hover:bg-red-500/40 transition-colors ml-4"
                                onClick={() => handleDelete(selectedPhoto)}
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
