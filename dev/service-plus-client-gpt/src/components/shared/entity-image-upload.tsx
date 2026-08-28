import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { CloudUpload, GripVertical, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { compressImage } from "@/lib/image-compression";
import { getUploadConfig } from "@/lib/image-service";
import { getApiBaseUrl } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type StagedFile = {
    id: string;
    file: File;
    preview: string;
};

export type EntityImageUploadProps = {
    /** Current image urls, in display order — element 0 is the cover/thumbnail. */
    images:   string[];
    onChange: (urls: string[]) => void;
    /** Uploads files and returns the full, server-authoritative updated url list. */
    uploadFiles:   (files: File[]) => Promise<string[]>;
    deleteImage:   (url: string) => Promise<string[]>;
    reorderImages: (urls: string[]) => Promise<string[]>;
    readOnly?: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Entity-agnostic photo manager for a `text[]` image-urls column (element 0 = cover).
 * Generalized out of the job-scoped uploader for spare_part_web (§3c/§6b): no per-file
 * caption (there's nothing to caption — every photo is of the same, already-named
 * entity), url-keyed delete instead of an id, and drag-to-reorder that posts the full
 * url list in one write rather than patching per-row sort values.
 */
export const EntityImageUpload = ({
    images,
    onChange,
    uploadFiles,
    deleteImage,
    reorderImages,
    readOnly = false,
}: EntityImageUploadProps) => {
    const [pendingFiles, setPendingFiles] = useState<StagedFile[]>([]);
    const [maxSizeKb, setMaxSizeKb] = useState(500);
    const [uploading, setUploading] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);
    const imagesRef = useRef(images);
    imagesRef.current = images;

    useEffect(() => {
        getUploadConfig()
            .then(cfg => setMaxSizeKb(cfg.upload_max_size_kb))
            .catch(() => { /* keep default */ });
    }, []);

    useEffect(() => {
        return () => {
            pendingFiles.forEach(pf => {
                if (pf.preview.startsWith("blob:")) URL.revokeObjectURL(pf.preview);
            });
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const processed: File[] = [];
        for (const file of acceptedFiles) {
            if (file.size > maxSizeKb * 1024) {
                try {
                    const before = (file.size / 1024).toFixed(0);
                    const compressed = await compressImage(file, maxSizeKb);
                    const after = (compressed.size / 1024).toFixed(0);
                    toast.info(`"${file.name}" compressed ${before}KB → ${after}KB`);
                    processed.push(compressed);
                } catch {
                    toast.error(`Could not compress "${file.name}". Please reduce the file size manually.`);
                }
            } else {
                processed.push(file);
            }
        }

        setPendingFiles(prev => [
            ...prev,
            ...processed.map(file => ({
                id: Math.random().toString(36).substring(7),
                file,
                preview: URL.createObjectURL(file),
            })),
        ]);
    }, [maxSizeKb]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
        disabled: readOnly,
    });

    function removePending(id: string) {
        setPendingFiles(prev => {
            const file = prev.find(f => f.id === id);
            if (file && file.preview.startsWith("blob:")) URL.revokeObjectURL(file.preview);
            return prev.filter(f => f.id !== id);
        });
    }

    async function handleUploadAll() {
        if (pendingFiles.length === 0) return;
        setUploading(true);
        try {
            const newUrls = await uploadFiles(pendingFiles.map(pf => pf.file));
            pendingFiles.forEach(pf => { if (pf.preview.startsWith("blob:")) URL.revokeObjectURL(pf.preview); });
            setPendingFiles([]);
            onChange(newUrls);
            toast.success("Photos uploaded successfully.");
        } catch (err: unknown) {
            toast.error((err as Error)?.message ?? "Upload failed.");
        } finally {
            setUploading(false);
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const newUrls = await deleteImage(deleteTarget);
            onChange(newUrls);
            toast.success("Photo deleted successfully.");
        } catch (err: unknown) {
            toast.error((err as Error)?.message ?? "Failed to delete photo.");
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    }

    // ── Drag-to-reorder (native HTML5 DnD — no new dependency) ─────────────────

    function handleDrop(targetIdx: number) {
        if (dragIndex === null || dragIndex === targetIdx) { setDragIndex(null); setOverIndex(null); return; }
        const previous = imagesRef.current;
        const reordered = [...previous];
        const [moved] = reordered.splice(dragIndex, 1);
        reordered.splice(targetIdx, 0, moved);
        setDragIndex(null);
        setOverIndex(null);

        // Optimistic — instant feedback, rolled back on failure.
        onChange(reordered);
        reorderImages(reordered).catch((err: unknown) => {
            onChange(previous);
            toast.error((err as Error)?.message ?? "Failed to save the new photo order.");
        });
    }

    const isUploadDisabled = pendingFiles.length === 0 || uploading;

    return (
        <>
            <div className="flex flex-col gap-3">
                {!readOnly && (
                    <div
                        {...getRootProps()}
                        className={`relative overflow-hidden group cursor-pointer border-2 border-dashed rounded-xl transition-all duration-300 ease-out flex items-center justify-center py-4 px-6 gap-3 text-center ${
                            isDragActive
                                ? "border-(--cl-accent) bg-(--cl-accent)/5 scale-[1.01]"
                                : "border-(--cl-border) bg-(--cl-surface-2)/30 hover:bg-(--cl-surface-2) hover:border-(--cl-accent)/40"
                        }`}
                    >
                        <input {...getInputProps()} />
                        <CloudUpload className={`h-5 w-5 shrink-0 ${isDragActive ? "text-(--cl-accent)" : "text-(--cl-text-muted) group-hover:text-(--cl-accent)"}`} />
                        <div className="text-left">
                            <p className="text-sm font-semibold text-(--cl-text)">
                                Drag & drop photos here <span className="font-normal text-(--cl-text-muted)">or click to browse</span>
                            </p>
                            <p className="mt-0.5 text-[10px] text-(--cl-text-muted)">JPEG · PNG · WEBP — max {maxSizeKb}KB per file</p>
                        </div>
                    </div>
                )}

                {/* Pending files */}
                {pendingFiles.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                                Pending ({pendingFiles.length})
                            </p>
                            <Button
                                className="h-7 bg-blue-600 px-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                                disabled={isUploadDisabled}
                                size="sm"
                                type="button"
                                onClick={handleUploadAll}
                            >
                                {uploading ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <CloudUpload className="mr-1.5 h-3 w-3" />}
                                Upload Now
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <AnimatePresence>
                                {pendingFiles.map(pf => (
                                    <motion.div
                                        key={pf.id}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface-2)"
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                    >
                                        <img alt="" className="h-full w-full object-cover" src={pf.preview} />
                                        {!uploading && (
                                            <button
                                                className="absolute right-0.5 top-0.5 rounded-full bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
                                                type="button"
                                                onClick={() => removePending(pf.id)}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                {/* Uploaded photos — drag to reorder, element 0 is the cover */}
                {images.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                            Photos ({images.length}) — drag to reorder, first is the cover
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {images.map((url, idx) => (
                                <div
                                    key={url}
                                    className={`group relative h-20 w-20 shrink-0 cursor-grab overflow-hidden rounded-lg border bg-(--cl-surface-2) transition-shadow active:cursor-grabbing ${
                                        overIndex === idx && dragIndex !== null && dragIndex !== idx
                                            ? "border-(--cl-accent) ring-2 ring-(--cl-accent)/30"
                                            : "border-(--cl-border)"
                                    }`}
                                    draggable={!readOnly}
                                    onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                                    onDragOver={e => { e.preventDefault(); setOverIndex(idx); }}
                                    onDragStart={() => setDragIndex(idx)}
                                    onDrop={e => { e.preventDefault(); handleDrop(idx); }}
                                >
                                    <img
                                        alt={`Photo ${idx + 1}`}
                                        className="h-full w-full object-cover"
                                        src={`${getApiBaseUrl()}/api/images/${url}`}
                                    />
                                    {idx === 0 && (
                                        <Badge className="absolute left-1 top-1 h-4 border-none bg-black/60 px-1 text-[9px] text-white">
                                            Cover
                                        </Badge>
                                    )}
                                    {!readOnly && (
                                        <>
                                            <div className="absolute inset-x-0 top-0 flex justify-center bg-black/30 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                                <GripVertical className="h-3 w-3 text-white" />
                                            </div>
                                            <button
                                                className="absolute right-0.5 top-0.5 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500 cursor-pointer"
                                                title="Delete photo"
                                                type="button"
                                                onClick={() => setDeleteTarget(url)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && !isDeleting && setDeleteTarget(null)}>
                <AlertDialogContent className="max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-5 w-5 text-red-600" />
                            Delete Photo
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this photo? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                            onClick={confirmDelete}
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
