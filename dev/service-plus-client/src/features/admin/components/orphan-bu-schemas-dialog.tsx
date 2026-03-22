import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2Icon, RefreshCwIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrphanSchemaType = { schema_name: string };

type OrphanBuSchemasDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    open: boolean;
};

type RowStateType = {
    confirmInput: string;
    deleting: boolean;
    expanded: boolean;
};

type GenericQueryDataType = {
    genericQuery: OrphanSchemaType[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const OrphanBuSchemasDialog = ({
    onOpenChange,
    open,
}: OrphanBuSchemasDialogPropsType) => {
    const [deletingSelected, setDeletingSelected] = useState(false);
    const [loading, setLoading]                   = useState(false);
    const [rowStates, setRowStates]               = useState<Record<string, RowStateType>>({});
    const [schemas, setSchemas]                   = useState<OrphanSchemaType[]>([]);
    const [selected, setSelected]                 = useState<Set<string>>(new Set());

    const dbName = useAppSelector(selectDbName);

    async function fetchOrphanSchemas() {
        if (!dbName) return;
        setLoading(true);
        try {
            const result = await apolloClient.query<GenericQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_ORPHAN_BU_SCHEMAS,
                    }),
                },
            });
            const rows = result.data?.genericQuery ?? [];
            setSchemas(rows);
            setRowStates({});
            setSelected(new Set());
        } catch (e: any) {
            console.error(e);
            toast.error(MESSAGES.ERROR_ORPHAN_BU_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (open) {
            fetchOrphanSchemas();
        } else {
            setSchemas([]);
            setRowStates({});
            setSelected(new Set());
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    function getRowState(name: string): RowStateType {
        return rowStates[name] ?? { confirmInput: "", deleting: false, expanded: false };
    }

    function setRowState(name: string, patch: Partial<RowStateType>) {
        setRowStates((prev) => ({
            ...prev,
            [name]: { ...getRowState(name), ...patch },
        }));
    }

    async function deleteSchema(schemaName: string, onDone?: () => void) {
        if (!dbName) return;
        setRowState(schemaName, { deleting: true });
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.deleteBuSchema,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: encodeURIComponent(
                        JSON.stringify({ code: schemaName, delete_bu_row: false })
                    ),
                },
            });
            toast.success(MESSAGES.SUCCESS_ORPHAN_BU_DELETED);
            setSchemas((prev) => prev.filter((s) => s.schema_name !== schemaName));
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(schemaName);
                return next;
            });
            setRowStates((prev) => {
                const next = { ...prev };
                delete next[schemaName];
                return next;
            });
            onDone?.();
        } catch {
            toast.error(MESSAGES.ERROR_ORPHAN_BU_DELETE_FAILED);
            setRowState(schemaName, { deleting: false });
        }
    }

    async function handleDeleteSelected() {
        const names = Array.from(selected);
        setDeletingSelected(true);
        for (const name of names) {
            await deleteSchema(name);
        }
        setDeletingSelected(false);
    }

    function handleToggleAll(checked: boolean) {
        if (checked) {
            setSelected(new Set(schemas.map((s) => s.schema_name)));
        } else {
            setSelected(new Set());
        }
    }

    function handleToggleRow(name: string, checked: boolean) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) {
                next.add(name);
            } else {
                next.delete(name);
            }
            return next;
        });
    }

    const allSelected = schemas.length > 0 && selected.size === schemas.length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Orphaned Schemas</DialogTitle>
                    <DialogDescription>
                        For every Business Unit, there should be a schema with the same name. The schema contains the data tables for the Business Unit. Orphaned schemas are those data tables which are not associated with any Business Unit.
                    </DialogDescription>
                    <DialogDescription>
                        Following orphaned schemas exist in the database. You can delete them if you want.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2Icon className="h-6 w-6 animate-spin text-slate-400" />
                        </div>
                    ) : schemas.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-400">
                            No orphaned schemas found.
                        </p>
                    ) : (
                        <div className="rounded-lg border border-slate-200">
                            {/* Header row */}
                            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2">
                                <Checkbox
                                    checked={allSelected}
                                    id="select_all_orphans"
                                    onCheckedChange={(v) => handleToggleAll(Boolean(v))}
                                />
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Schema Name
                                </span>
                            </div>

                            {/* Schema rows */}
                            <div className="divide-y divide-slate-100">
                                {schemas.map((s) => {
                                    const rs   = getRowState(s.schema_name);
                                    const valid = rs.confirmInput.toLowerCase() === s.schema_name;

                                    return (
                                        <div key={s.schema_name} className="flex flex-col gap-2 px-3 py-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <Checkbox
                                                        checked={selected.has(s.schema_name)}
                                                        id={`chk_${s.schema_name}`}
                                                        onCheckedChange={(v) =>
                                                            handleToggleRow(s.schema_name, Boolean(v))
                                                        }
                                                    />
                                                    <span className="font-mono text-sm text-slate-700">
                                                        {s.schema_name}
                                                    </span>
                                                </div>
                                                {!rs.expanded && (
                                                    <Button
                                                        className="h-7 gap-1 text-xs text-red-600 hover:text-red-700"
                                                        disabled={rs.deleting}
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setRowState(s.schema_name, { expanded: true })
                                                        }
                                                    >
                                                        <Trash2Icon className="h-3.5 w-3.5" />
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>

                                            {/* Inline confirmation */}
                                            {rs.expanded && (
                                                <div className="flex items-end gap-2 pl-6">
                                                    <div className="flex flex-1 flex-col gap-1">
                                                        <Label
                                                            className="text-xs text-slate-500"
                                                            htmlFor={`confirm_${s.schema_name}`}
                                                        >
                                                            Type{" "}
                                                            <span className="font-mono font-semibold text-slate-700">
                                                                {s.schema_name}
                                                            </span>{" "}
                                                            to confirm
                                                        </Label>
                                                        <Input
                                                            autoComplete="off"
                                                            className="h-8 font-mono text-sm"
                                                            id={`confirm_${s.schema_name}`}
                                                            placeholder={s.schema_name}
                                                            value={rs.confirmInput}
                                                            onChange={(e) =>
                                                                setRowState(s.schema_name, {
                                                                    confirmInput: e.target.value,
                                                                })
                                                            }
                                                        />
                                                    </div>
                                                    <Button
                                                        className="h-8 bg-red-600 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                                                        disabled={rs.deleting || !valid}
                                                        size="sm"
                                                        onClick={() => deleteSchema(s.schema_name)}
                                                    >
                                                        {rs.deleting ? (
                                                            <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            "Confirm"
                                                        )}
                                                    </Button>
                                                    <Button
                                                        className="h-8 text-xs"
                                                        disabled={rs.deleting}
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setRowState(s.schema_name, {
                                                                confirmInput: "",
                                                                expanded: false,
                                                            })
                                                        }
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-wrap gap-2">
                    <Button
                        className="gap-1.5"
                        disabled={loading}
                        size="sm"
                        variant="outline"
                        onClick={fetchOrphanSchemas}
                    >
                        <RefreshCwIcon className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                    <div className="flex flex-1 justify-end gap-2">
                        {selected.size > 0 && (
                            <Button
                                className="bg-red-600 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                                disabled={deletingSelected}
                                size="sm"
                                onClick={handleDeleteSelected}
                            >
                                {deletingSelected ? (
                                    <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                Delete Selected ({selected.size})
                            </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
