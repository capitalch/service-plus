import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Receipt, RefreshCw, Search, Trash2, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdditionalChargeRow = { id: number; name: string };
type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Row animation ────────────────────────────────────────────────────────────

const rowVariants = {
    hidden:  { opacity: 0, y: 4 },
    visible: (i: number) => ({
        opacity:    1,
        y:          0,
        transition: { delay: i * 0.035, duration: 0.18, ease: "easeOut" as const },
    }),
};

// ─── Dialogs ──────────────────────────────────────────────────────────────────

type NameDialogProps = {
    title:       string;
    value:       string;
    saving:      boolean;
    idValue?:    string;
    onIdChange?: (v: string) => void;
    onChange:    (v: string) => void;
    onSave:      () => void;
    onClose:     () => void;
};

function NameDialog({ title, value, saving, idValue, onIdChange, onChange, onSave, onClose }: NameDialogProps) {
    const hasId     = idValue !== undefined && onIdChange !== undefined;
    const idNum     = hasId ? parseInt(idValue, 10) : NaN;
    const idInvalid = hasId && (isNaN(idNum) || idNum <= 0);
    const canSave   = value.trim() && (!hasId || !idInvalid);

    return (
        <Dialog open onOpenChange={v => { if (!v && !saving) onClose(); }}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    {hasId && (
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-[var(--cl-text-muted)] uppercase tracking-wider">
                                ID <span className="text-red-500">*</span>
                            </label>
                            <Input
                                autoFocus
                                className={`border-[var(--cl-border)] bg-white text-sm ${idInvalid ? "border-red-500" : ""}`}
                                disabled={saving}
                                min={1}
                                placeholder="e.g. 15"
                                type="number"
                                value={idValue}
                                onChange={e => onIdChange!(e.target.value)}
                                onFocus={e => e.target.select()}
                            />
                        </div>
                    )}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-[var(--cl-text-muted)] uppercase tracking-wider">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                            autoFocus={!hasId}
                            className="border-[var(--cl-border)] bg-white text-sm"
                            disabled={saving}
                            placeholder="Charge name"
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && canSave) onSave(); }}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button disabled={saving} variant="outline" onClick={onClose}>Cancel</Button>
                    <Button disabled={!canSave || saving} onClick={onSave}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type DeleteDialogProps = {
    name:    string;
    saving:  boolean;
    onConfirm: () => void;
    onClose:   () => void;
};

function DeleteDialog({ name, saving, onConfirm, onClose }: DeleteDialogProps) {
    return (
        <Dialog open onOpenChange={v => { if (!v && !saving) onClose(); }}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Delete Charge</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-[var(--cl-text)]">
                    Delete <span className="font-semibold">{name}</span>? This cannot be undone.
                </p>
                <DialogFooter>
                    <Button disabled={saving} variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled={saving}
                        onClick={onConfirm}
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export const AdditionalChargeSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [rows,    setRows]    = useState<AdditionalChargeRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [search,  setSearch]  = useState("");
    const [saving,  setSaving]  = useState(false);

    // Add
    const [addOpen, setAddOpen] = useState(false);
    const [addId,   setAddId]   = useState("");
    const [addName, setAddName] = useState("");

    // Edit
    const [editRow,  setEditRow]  = useState<AdditionalChargeRow | null>(null);
    const [editName, setEditName] = useState("");

    // Delete
    const [deleteRow, setDeleteRow] = useState<AdditionalChargeRow | null>(null);

    const loadData = useCallback(async () => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryData<AdditionalChargeRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_ADDITIONAL_CHARGES }) },
            });
            setRows(res.data?.genericQuery ?? []);
        } catch {
            toast.error("Failed to load additional charges.");
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadData();
    }, [loadData]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows;
    }, [rows, search]);

    async function handleAdd() {
        const id = parseInt(addId, 10);
        if (!dbName || !schema || !addName.trim() || isNaN(id) || id <= 0) return;
        setSaving(true);
        try {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: encodeObj({ tableName: "additional_charge", xData: { id, name: addName.trim(), isIdInsert: true } }) },
            });
            toast.success("Charge added.");
            setAddOpen(false);
            setAddName("");
            void loadData();
        } catch {
            toast.error("Failed to add charge.");
        } finally {
            setSaving(false);
        }
    }

    async function handleEdit() {
        if (!dbName || !schema || !editRow || !editName.trim()) return;
        setSaving(true);
        try {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: encodeObj({ tableName: "additional_charge", xData: { id: editRow.id, name: editName.trim() } }) },
            });
            toast.success("Charge updated.");
            setEditRow(null);
            void loadData();
        } catch {
            toast.error("Failed to update charge.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!dbName || !schema || !deleteRow) return;
        setSaving(true);
        try {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: encodeObj({ tableName: "additional_charge", deletedIds: [deleteRow.id] }) },
            });
            toast.success("Charge deleted.");
            setDeleteRow(null);
            void loadData();
        } catch {
            toast.error("Failed to delete charge.");
        } finally {
            setSaving(false);
        }
    }

    const thClass = "sticky top-0 z-10 bg-[var(--cl-surface-2)] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--cl-text-muted)] border-b border-[var(--cl-border)]";
    const tdClass = "px-4 py-2.5 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                        <Receipt className="h-4 w-4" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-[var(--cl-text)]">Job Additional Charges</h2>
                        <p className="text-xs text-[var(--cl-text-muted)]">Manage predefined additional charge names used in jobs.</p>
                    </div>
                </div>
                <Button
                    className="h-8 gap-1.5 text-xs"
                    size="sm"
                    onClick={() => {
                        const nextId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1;
                        setAddId(String(nextId));
                        setAddName("");
                        setAddOpen(true);
                    }}
                >
                    <Plus className="h-3.5 w-3.5" /> Add Charge
                </Button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                    <Input
                        className="h-8 border-[var(--cl-border)] bg-white pl-8 pr-8 text-xs"
                        placeholder="Search charges…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]"
                            type="button"
                            onClick={() => setSearch("")}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
                <Button
                    className="h-8 px-2.5 text-xs"
                    disabled={loading}
                    size="sm"
                    variant="outline"
                    onClick={() => void loadData()}
                >
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                </Button>
                <span className="text-xs text-[var(--cl-text-muted)]">
                    {loading ? "Loading…" : `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`}
                </span>
            </div>

            {/* Table */}
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                <div className="h-full overflow-y-auto">
                    <table className="min-w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={thClass} style={{ width: "4%" }}>#</th>
                                <th className={thClass}>Name</th>
                                <th className={`${thClass} text-right`} style={{ width: "10%" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className={tdClass}><div className="h-4 w-6 rounded bg-[var(--cl-border)]" /></td>
                                        <td className={tdClass}><div className="h-4 w-48 rounded bg-[var(--cl-border)]" /></td>
                                        <td className={tdClass}></td>
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-12 text-center text-sm text-[var(--cl-text-muted)]">
                                        {search ? "No charges match your search." : "No charges yet. Click Add Charge to create one."}
                                    </td>
                                </tr>
                            ) : filtered.map((row, idx) => (
                                <motion.tr
                                    key={row.id}
                                    animate="visible"
                                    className="group transition-colors hover:bg-[var(--cl-accent)]/5"
                                    custom={idx}
                                    initial="hidden"
                                    variants={rowVariants}
                                >
                                    <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{idx + 1}</td>
                                    <td className={tdClass}>{row.name}</td>
                                    <td className={`${tdClass} text-right`}>
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                className="h-7 w-7 p-0 text-[var(--cl-text-muted)] hover:text-[var(--cl-accent)]"
                                                size="icon"
                                                title="Edit"
                                                variant="ghost"
                                                onClick={() => { setEditRow(row); setEditName(row.name); }}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                className="h-7 w-7 p-0 text-[var(--cl-text-muted)] hover:text-red-500 hover:bg-red-500/10"
                                                size="icon"
                                                title="Delete"
                                                variant="ghost"
                                                onClick={() => setDeleteRow(row)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add dialog */}
            {addOpen && (
                <NameDialog
                    idValue={addId}
                    saving={saving}
                    title="Add Charge"
                    value={addName}
                    onChange={setAddName}
                    onClose={() => setAddOpen(false)}
                    onIdChange={setAddId}
                    onSave={() => void handleAdd()}
                />
            )}

            {/* Edit dialog */}
            {editRow && (
                <NameDialog
                    saving={saving}
                    title="Edit Charge"
                    value={editName}
                    onChange={setEditName}
                    onClose={() => setEditRow(null)}
                    onSave={() => void handleEdit()}
                />
            )}

            {/* Delete dialog */}
            {deleteRow && (
                <DeleteDialog
                    name={deleteRow.name}
                    saving={saving}
                    onClose={() => setDeleteRow(null)}
                    onConfirm={() => void handleDelete()}
                />
            )}
        </motion.div>
    );
};
