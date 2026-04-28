import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { CloudUpload, Trash2, FileText, Loader2, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { uploadJobFile, deleteJobFile, getUploadConfig } from "@/lib/image-service";
import { getApiBaseUrl } from "@/lib/utils";
import type { JobFileRow } from "@/features/client/types/job";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";

type GenericQueryData<T> = { genericQuery: T[] | null };

export type StagedFile = {
    id: string;
    file: File;
    preview: string;
    about: string;
    isUploading: boolean;
};

type Props = {
    jobId?: number; // Optional. If not provided, acts as a staging area for new job creation.
    onPendingChange?: (files: StagedFile[]) => void;
    readOnly?: boolean;
};

export const JobImageUpload = ({ jobId, onPendingChange, readOnly = false }: Props) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [uploadedFiles, setUploadedFiles] = useState<JobFileRow[]>([]);
    const [pendingFiles, setPendingFiles] = useState<StagedFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [maxSizeKb, setMaxSizeKb] = useState<number>(500);

    const fetchFiles = useCallback(async () => {
        if (!jobId || !dbName || !schema) return;
        setIsLoading(true);
        try {
            // Fetch config and files in parallel
            const [filesRes, configRes] = await Promise.all([
                apolloClient.query<GenericQueryData<JobFileRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOB_IMAGE_DOCS,
                            sqlArgs: { job_id: jobId },
                        }),
                    },
                }),
                getUploadConfig()
            ]);
            
            setUploadedFiles(filesRes.data?.genericQuery || []);
            setMaxSizeKb(configRes.upload_max_size_kb);
        } catch {
            toast.error("Failed to load attached files.");
        } finally {
            setIsLoading(false);
        }
    }, [dbName, schema, jobId]);

    const fetchConfigOnly = useCallback(async () => {
        try {
            const config = await getUploadConfig();
            setMaxSizeKb(config.upload_max_size_kb);
        } catch (err) {
            console.error("Failed to fetch upload config", err);
        }
    }, []);

    useEffect(() => {
        if (jobId) {
            void fetchFiles();
        } else {
            void fetchConfigOnly();
        }
    }, [fetchFiles, fetchConfigOnly, jobId]);

    // Cleanup object URLs on unmount
    useEffect(() => {
        return () => {
            pendingFiles.forEach(pf => {
                if (pf.preview.startsWith("blob:")) URL.revokeObjectURL(pf.preview);
            });
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const filtered = acceptedFiles.filter(file => {
            if (file.size > maxSizeKb * 1024) {
                toast.error(`File "${file.name}" exceeds the ${maxSizeKb}KB limit.`);
                return false;
            }
            return true;
        });

        const newPending = filtered.map((file) => ({
            id: Math.random().toString(36).substring(7),
            file,
            preview: URL.createObjectURL(file),
            about: "",
            isUploading: false,
        }));
        
        setPendingFiles((prev) => {
            const updated = [...prev, ...newPending];
            if (onPendingChange) onPendingChange(updated);
            return updated;
        });
    }, [onPendingChange, maxSizeKb]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".png", ".jpg", ".jpeg", ".webp"],
            "application/pdf": [".pdf"],
        },
        disabled: readOnly,
    });

    const updatePendingAbout = (id: string, about: string) => {
        setPendingFiles((prev) => {
            const updated = prev.map((f) => (f.id === id ? { ...f, about } : f));
            if (onPendingChange) onPendingChange(updated);
            return updated;
        });
    };

    const removePending = (id: string) => {
        setPendingFiles((prev) => {
            const file = prev.find((f) => f.id === id);
            if (file && file.preview.startsWith("blob:")) URL.revokeObjectURL(file.preview);
            const updated = prev.filter((f) => f.id !== id);
            if (onPendingChange) onPendingChange(updated);
            return updated;
        });
    };

    const handleUploadAll = async () => {
        if (!jobId || !dbName || !schema) return; // Only available in edit mode
        
        const toUpload = pendingFiles.filter((f) => !f.isUploading);
        if (toUpload.some((f) => !f.about.trim())) {
            toast.error("Please provide an 'About' description for all files.");
            return;
        }

        let hasError = false;
        
        for (const pFile of toUpload) {
            setPendingFiles((prev) => {
                const updated = prev.map((f) => (f.id === pFile.id ? { ...f, isUploading: true } : f));
                if (onPendingChange) onPendingChange(updated);
                return updated;
            });

            try {
                const uploaded = await uploadJobFile(dbName, schema, jobId, pFile.about.trim(), pFile.file);
                setUploadedFiles((prev) => [...prev, uploaded]);
                setPendingFiles((prev) => {
                    const updated = prev.filter((f) => f.id !== pFile.id);
                    if (onPendingChange) onPendingChange(updated);
                    return updated;
                });
                if (pFile.preview.startsWith("blob:")) URL.revokeObjectURL(pFile.preview);
            } catch (err: any) {
                toast.error(`Upload failed for ${pFile.file.name}: ${err.message}`);
                setPendingFiles((prev) => {
                    const updated = prev.map((f) => (f.id === pFile.id ? { ...f, isUploading: false } : f));
                    if (onPendingChange) onPendingChange(updated);
                    return updated;
                });
                hasError = true;
            }
        }

        if (!hasError && toUpload.length > 0) {
            toast.success("Files uploaded successfully.");
        }
    };

    const handleDelete = async (imageId: number) => {
        if (!dbName || !schema) return;
        if (!confirm("Are you sure you want to delete this file?")) return;
        try {
            await deleteJobFile(dbName, schema, imageId);
            setUploadedFiles((prev) => prev.filter((f) => f.id !== imageId));
            toast.success("File deleted successfully.");
        } catch {
            toast.error("Failed to delete file.");
        }
    };

    const isUploadDisabled = pendingFiles.length === 0 || pendingFiles.some((f) => f.isUploading);
    const hasExistingFiles = uploadedFiles.length > 0;

    return (
        <div className="flex flex-col gap-5 mt-2 bg-[var(--cl-surface)] p-4 rounded-xl border border-[var(--cl-border)] shadow-sm">
            {/* Dropzone */}
            {!readOnly && (
                <div
                    {...getRootProps()}
                    className={`relative overflow-hidden group cursor-pointer border-2 border-dashed rounded-xl transition-all duration-300 ease-out flex flex-col md:flex-row items-center justify-center py-4 px-6 gap-4 text-center md:text-left ${
                        isDragActive
                            ? "border-[var(--cl-accent)] bg-[var(--cl-accent)]/5 scale-[1.01] shadow-md shadow-[var(--cl-accent)]/10"
                            : "border-[var(--cl-border)] bg-[var(--cl-surface-2)]/30 hover:bg-[var(--cl-surface-2)] hover:border-[var(--cl-accent)]/40"
                    }`}
                >
                    <input {...getInputProps()} />
                    <motion.div 
                        initial={false}
                        animate={{ scale: isDragActive ? 1.05 : 1 }}
                        className="p-2.5 rounded-full bg-[var(--cl-surface)] shadow-sm group-hover:shadow-md transition-shadow border border-[var(--cl-border)]/50 shrink-0"
                    >
                        <CloudUpload className={`w-5 h-5 transition-colors ${isDragActive ? "text-[var(--cl-accent)]" : "text-[var(--cl-text-muted)] group-hover:text-[var(--cl-accent)]"}`} />
                    </motion.div>
                    <div className="flex flex-col flex-1 items-center md:items-start">
                        <h4 className="text-sm font-semibold text-[var(--cl-text)]">
                            Drag & Drop files here <span className="font-normal text-[var(--cl-text-muted)]">or click to browse</span>
                        </h4>
                        <div className="mt-1.5 flex flex-wrap justify-center md:justify-start items-center gap-1.5 text-[10px] font-medium text-[var(--cl-text-muted)]/80">
                            <span className="px-1.5 py-0.5 rounded bg-[var(--cl-surface)] border border-[var(--cl-border)]">JPEG</span>
                            <span className="px-1.5 py-0.5 rounded bg-[var(--cl-surface)] border border-[var(--cl-border)]">PNG</span>
                            <span className="px-1.5 py-0.5 rounded bg-[var(--cl-surface)] border border-[var(--cl-border)]">WEBP</span>
                            <span className="px-1.5 py-0.5 rounded bg-[var(--cl-surface)] border border-[var(--cl-border)]">PDF</span>
                            <span className="ml-1 opacity-70">— Max {maxSizeKb}KB per file</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Pending Files List */}
            {pendingFiles.length > 0 && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: "auto" }} 
                    className="flex flex-col gap-3"
                >
                    <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--cl-text-muted)] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            Pending Uploads ({pendingFiles.length})
                        </h4>
                        {/* Only show Upload button if we have a jobId (edit mode). Otherwise form submission handles it. */}
                        {jobId && (
                            <Button
                                type="button"
                                size="sm"
                                disabled={isUploadDisabled}
                                onClick={handleUploadAll}
                                className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs px-2 shadow-sm font-bold"
                            >
                                <CloudUpload className="w-3 h-3 mr-1.5" />
                                Upload Now
                            </Button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        <AnimatePresence>
                            {pendingFiles.map((pf) => (
                                <motion.div
                                    key={pf.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    layout
                                    className="flex items-start gap-3 p-2.5 rounded-xl bg-[var(--cl-surface)] border border-[var(--cl-border)] shadow-sm relative overflow-hidden group"
                                >
                                    {pf.isUploading && (
                                        <div className="absolute inset-0 z-10 bg-[var(--cl-surface)]/70 backdrop-blur-[1px] flex items-center justify-center">
                                            <Loader2 className="w-5 h-5 text-[var(--cl-accent)] animate-spin" />
                                        </div>
                                    )}
                                    
                                    <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-[var(--cl-surface-2)] flex items-center justify-center border border-[var(--cl-border)] shadow-inner">
                                        {pf.file.type.includes("pdf") ? (
                                            <FileText className="w-6 h-6 text-rose-500/80" />
                                        ) : (
                                            <img src={pf.preview} alt="preview" className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 flex flex-col gap-1.5 pt-0.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-[11px] font-medium text-[var(--cl-text)] truncate" title={pf.file.name}>
                                                {pf.file.name}
                                            </p>
                                            <button 
                                                type="button"
                                                onClick={() => removePending(pf.id)}
                                                disabled={pf.isUploading}
                                                className="shrink-0 p-1 rounded-full text-[var(--cl-text-muted)]/70 hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-50 -mt-0.5 -mr-0.5"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="relative mt-auto">
                                            <Input
                                                size={1}
                                                className={`h-7 text-xs pr-7 bg-[var(--cl-surface-2)] border-dashed transition-all ${!pf.about.trim() ? "border-rose-400/50 hover:border-rose-400 focus-visible:border-rose-500 focus-visible:ring-rose-500/20" : "border-[var(--cl-border)] focus-visible:border-[var(--cl-accent)]"}`}
                                                placeholder="What is this file? *"
                                                value={pf.about}
                                                onChange={(e) => updatePendingAbout(pf.id, e.target.value)}
                                                disabled={pf.isUploading}
                                            />
                                            {pf.about.trim() && (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2 opacity-80" />
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}

            {/* Separator if both exist */}
            {pendingFiles.length > 0 && hasExistingFiles && (
                <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--cl-border)] to-transparent my-1" />
            )}

            {/* Uploaded Files Grid */}
            {(hasExistingFiles || isLoading) && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--cl-text-muted)] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Uploaded Files ({uploadedFiles.length})
                        </h4>
                        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--cl-text-muted)]" />}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <AnimatePresence>
                            {uploadedFiles.map((file) => {
                                const isPdf = file.url.toLowerCase().endsWith(".pdf");
                                const fullUrl = `${getApiBaseUrl()}/${file.url}`;

                                return (
                                    <motion.div
                                        key={file.id}
                                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                        layout
                                        className="group relative aspect-square rounded-xl overflow-hidden bg-[var(--cl-surface-2)] border border-[var(--cl-border)] shadow-sm hover:shadow-md transition-all duration-300 ring-1 ring-black/5"
                                    >
                                        {/* Main Content */}
                                        <a 
                                            href={fullUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="absolute inset-0 flex items-center justify-center"
                                        >
                                            {isPdf ? (
                                                <div className="flex flex-col items-center gap-2 group-hover:scale-110 transition-transform duration-500 ease-out">
                                                    <FileText className="w-10 h-10 text-rose-500 drop-shadow-sm" />
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--cl-text-muted)]">PDF</span>
                                                </div>
                                            ) : (
                                                <img 
                                                    src={fullUrl} 
                                                    alt={file.about} 
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
                                                    loading="lazy"
                                                />
                                            )}
                                        </a>

                                        {/* Gradient Overlay for Text */}
                                        <div className="absolute inset-x-0 bottom-0 pt-12 pb-2.5 px-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none transform translate-y-0 transition-transform duration-300">
                                            <p className="text-[11px] font-medium text-white/95 line-clamp-2 leading-snug drop-shadow-md">
                                                {file.about}
                                            </p>
                                        </div>

                                        {/* Delete Button */}
                                        {!readOnly && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleDelete(file.id);
                                                }}
                                                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 -translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:bg-rose-500 hover:scale-110 shadow-sm"
                                                title="Delete file"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </div>
            )}
        </div>
    );
};
