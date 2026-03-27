import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangleIcon, Loader2Icon } from "lucide-react";

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
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { LookupConfig, LookupRecord } from "@/features/client/types/lookup";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteLookupDialogPropsType = {
    config:       LookupConfig;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    record:       LookupRecord;
};

type InUseQueryDataType = {
    genericQuery: { in_use: boolean }[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteLookupDialog = ({
    config,
    onOpenChange,
    onSuccess,
    open,
    record,
}: DeleteLookupDialogPropsType) => {
    const [checkingInUse, setCheckingInUse] = useState(false);
    const [confirmValue,  setConfirmValue]  = useState("");
    const [inUse,         setInUse]         = useState<boolean | null>(null);
    const [submitting,    setSubmitting]    = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    useEffect(() => {
        if (!open) {
            setCheckingInUse(false);
            setConfirmValue("");
            setInUse(null);
            setSubmitting(false);
            return;
        }
        // System records cannot be deleted — skip the in-use check
        if (record.is_system) return;
        if (!dbName || !schema) return;
        setCheckingInUse(true);
        apolloClient
            .query<InUseQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { id: record.id },
                        sqlId:   config.checkInUseSqlId,
                    }),
                },
            })
            .then((res) => setInUse(res.data?.genericQuery?.[0]?.in_use ?? false))
            .catch(() => setInUse(null))
            .finally(() => setCheckingInUse(false));
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const deleteEnabled = !record.is_system && inUse === false && !checkingInUse && confirmValue.toLowerCase() === record.name.toLowerCase();

    async function handleDelete() {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        deletedIds: [record.id],
                        tableName:  config.tableName,
                        xData:      {},
                    }),
                },
            });
            toast.success(config.messages.deleted);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(config.messages.deleteFailed);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Delete Record</DialogTitle>
                    <DialogDescription>
                        Permanently delete{" "}
                        <span className="font-semibold text-slate-800">{record.name}</span>?
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <p className="text-sm text-slate-600">This action cannot be undone.</p>

                    {/* System record — delete blocked */}
                    {record.is_system && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <p className="text-sm text-amber-800">{MESSAGES.ERROR_LOOKUP_DELETE_SYSTEM}</p>
                        </div>
                    )}

                    {/* In-use check result */}
                    {!record.is_system && inUse === true && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <p className="text-sm text-amber-800">{config.messages.deleteInUse}</p>
                        </div>
                    )}

                    {/* Confirm input */}
                    {!record.is_system && inUse !== true && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="confirm_lookup_name">
                                Type{" "}
                                <span className="font-semibold text-slate-800">{record.name}</span>{" "}
                                to confirm
                            </Label>
                            <Input
                                autoComplete="off"
                                id="confirm_lookup_name"
                                placeholder={record.name}
                                value={confirmValue}
                                onChange={(e) => setConfirmValue(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button disabled={submitting} variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    {!record.is_system && (
                        <Button
                            className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            disabled={submitting || checkingInUse || !deleteEnabled}
                            onClick={handleDelete}
                        >
                            {(submitting || checkingInUse) ? (
                                <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Delete
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
