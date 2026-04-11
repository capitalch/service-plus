import { useEffect, useState } from "react";
import { AlertTriangleIcon, CheckCircle2Icon, Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { BrandOption } from "@/features/client/types/model";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "preview" | "confirm" | "done";

type UsageStats = {
    total:          number;
    in_use_count:   number;
    deletable_count: number;
};

type StatsQueryDataType = {
    genericQuery: UsageStats[] | null;
};

type DeleteBrandPartsWizardDialogPropsType = {
    brand:     BrandOption;
    open:      boolean;
    onClose:   () => void;
    onDeleted: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteBrandPartsWizardDialog = ({
    brand,
    open,
    onClose,
    onDeleted,
}: DeleteBrandPartsWizardDialogPropsType) => {
    const dbName  = useAppSelector(selectDbName);
    const schema_ = useAppSelector(selectSchema);

    const [step,         setStep]         = useState<Step>("preview");
    const [stats,        setStats]        = useState<UsageStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [confirmText,  setConfirmText]  = useState("");
    const [submitting,   setSubmitting]   = useState(false);
    const [deletedCount, setDeletedCount] = useState(0);

    // ── Reset + fetch stats on open ───────────────────────────────────────────

    useEffect(() => {
        if (!open) return;
        setStep("preview");
        setStats(null);
        setConfirmText("");
        setSubmitting(false);
        setDeletedCount(0);

        if (!dbName || !schema_) return;
        setStatsLoading(true);
        apolloClient
            .query<StatsQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { brand_id: brand.id },
                        sqlId:   SQL_MAP.GET_PARTS_USAGE_STATS_BY_BRAND,
                    }),
                },
            })
            .then((res) => setStats(res.data?.genericQuery?.[0] ?? null))
            .catch(() => toast.error("Failed to load part stats."))
            .finally(() => setStatsLoading(false));
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleClose() {
        if (step === "done") onDeleted();
        else onClose();
    }

    async function handleDelete() {
        if (!dbName || !schema_) return;
        setSubmitting(true);
        try {
            const result = await apolloClient.mutate({
                mutation: GRAPHQL_MAP.deleteUnusedPartsByBrand,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value:   encodeURIComponent(JSON.stringify({ brand_id: brand.id })),
                },
            });
            const data = result.data as { deleteUnusedPartsByBrand?: { deleted_count?: number } } | null;
            const count: number = data?.deleteUnusedPartsByBrand?.deleted_count ?? 0;
            setDeletedCount(count);
            setStep("done");
        } catch {
            toast.error("Deletion failed. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    // ── Derived ───────────────────────────────────────────────────────────────

    const confirmMatch = confirmText.trim().toLowerCase() === brand.name.trim().toLowerCase();
    const deleteEnabled = confirmMatch && !submitting;

    // ── Render helpers ────────────────────────────────────────────────────────

    function renderPreview() {
        if (statsLoading || !stats) {
            return (
                <div className="flex items-center justify-center py-10">
                    <Loader2Icon className="h-5 w-5 animate-spin text-[var(--cl-text-muted)]" />
                </div>
            );
        }

        const nothingToDelete = stats.deletable_count === 0;

        return (
            <>
                <div className="overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)]">
                    <div className="flex items-center justify-between border-b border-[var(--cl-border)] px-4 py-2.5">
                        <span className="text-sm text-[var(--cl-text-muted)]">Total parts for brand</span>
                        <span className="font-semibold text-[var(--cl-text)]">{stats.total}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-[var(--cl-border)] px-4 py-2.5">
                        <span className="text-sm text-[var(--cl-text-muted)]">In use (jobs / invoices / stock)</span>
                        <span className="font-semibold text-amber-600">{stats.in_use_count}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-[var(--cl-text-muted)]">Safe to delete</span>
                        <span className={`font-semibold ${nothingToDelete ? "text-[var(--cl-text-muted)]" : "text-red-600"}`}>
                            {stats.deletable_count}
                        </span>
                    </div>
                </div>

                {nothingToDelete ? (
                    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                        <span className="mt-0.5 text-blue-600">ℹ</span>
                        <p className="text-sm text-blue-800">
                            All parts for <span className="font-semibold">{brand.name}</span> are currently in use.
                            There is nothing to delete.
                        </p>
                    </div>
                ) : (
                    <p className="text-xs text-[var(--cl-text-muted)]">
                        Only unused parts will be removed. Parts referenced in any job, invoice, or
                        stock record are left untouched.
                    </p>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button
                        className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        disabled={nothingToDelete}
                        onClick={() => setStep("confirm")}
                    >
                        Next
                    </Button>
                </DialogFooter>
            </>
        );
    }

    function renderConfirm() {
        return (
            <>
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-800">
                        You are about to permanently delete{" "}
                        <span className="font-semibold">{stats?.deletable_count}</span> spare part
                        {stats?.deletable_count !== 1 ? "s" : ""} for brand{" "}
                        <span className="font-semibold">{brand.name}</span>. This action cannot be undone.
                    </p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="confirm_brand_name">
                        Type <span className="font-semibold text-[var(--cl-text)]">{brand.name}</span> to confirm
                    </Label>
                    <Input
                        autoComplete="off"
                        id="confirm_brand_name"
                        placeholder={brand.name}
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                    />
                </div>

                <DialogFooter>
                    <Button disabled={submitting} variant="ghost" onClick={() => setStep("preview")}>
                        Back
                    </Button>
                    <Button
                        className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        disabled={!deleteEnabled}
                        onClick={handleDelete}
                    >
                        {submitting ? (
                            <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Delete {stats?.deletable_count} Part{stats?.deletable_count !== 1 ? "s" : ""}
                    </Button>
                </DialogFooter>
            </>
        );
    }

    function renderDone() {
        return (
            <>
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <CheckCircle2Icon className="h-10 w-10 text-emerald-500" />
                    <div>
                        <p className="font-semibold text-[var(--cl-text)]">Cleanup Complete</p>
                        <p className="mt-1 text-sm text-[var(--cl-text-muted)]">
                            <span className="font-semibold text-[var(--cl-text)]">{deletedCount}</span> spare part
                            {deletedCount !== 1 ? "s" : ""} deleted for brand{" "}
                            <span className="font-semibold text-[var(--cl-text)]">{brand.name}</span>.
                        </p>
                        {stats && stats.in_use_count > 0 && (
                            <p className="mt-1 text-xs text-[var(--cl-text-muted)]">
                                {stats.in_use_count} part{stats.in_use_count !== 1 ? "s were" : " was"} skipped (still in use).
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button className="bg-teal-600 text-white hover:bg-teal-700" onClick={handleClose}>
                        Close
                    </Button>
                </DialogFooter>
            </>
        );
    }

    // ── Title / description per step ──────────────────────────────────────────

    const titles: Record<Step, string> = {
        preview: `Clean Up Parts — ${brand.name}`,
        confirm: "Confirm Deletion",
        done:    "Cleanup Complete",
    };

    const descriptions: Record<Step, string> = {
        preview: "Review how many parts can be safely removed.",
        confirm: "This action is permanent and cannot be undone.",
        done:    "",
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{titles[step]}</DialogTitle>
                    {descriptions[step] && (
                        <DialogDescription>{descriptions[step]}</DialogDescription>
                    )}
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    {step === "preview" && renderPreview()}
                    {step === "confirm" && renderConfirm()}
                    {step === "done"    && renderDone()}
                </div>
            </DialogContent>
        </Dialog>
    );
};
