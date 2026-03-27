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
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { PartType } from "@/features/client/types/part";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeletePartDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    part:         PartType;
};

type InUseQueryDataType = {
    genericQuery: { in_use: boolean }[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeletePartDialog = ({
    onOpenChange,
    onSuccess,
    open,
    part,
}: DeletePartDialogPropsType) => {
    const [checkingInUse, setCheckingInUse] = useState(false);
    const [confirmValue,  setConfirmValue]  = useState("");
    const [inUse,         setInUse]         = useState<boolean | null>(null);
    const [submitting,    setSubmitting]    = useState(false);

    const dbName  = useAppSelector(selectDbName);
    const schema_ = useAppSelector(selectSchema);

    useEffect(() => {
        if (!open) {
            setCheckingInUse(false);
            setConfirmValue("");
            setInUse(null);
            setSubmitting(false);
            return;
        }
        if (!dbName || !schema_) return;
        setCheckingInUse(true);
        apolloClient
            .query<InUseQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { id: part.id },
                        sqlId:   SQL_MAP.CHECK_PART_IN_USE,
                    }),
                },
            })
            .then((res) => setInUse(res.data?.genericQuery?.[0]?.in_use ?? false))
            .catch(() => setInUse(null))
            .finally(() => setCheckingInUse(false));
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const deleteEnabled = inUse === false && !checkingInUse && confirmValue.toLowerCase() === part.part_code.toLowerCase();

    async function handleDelete() {
        if (!dbName || !schema_) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericUpdateValue({
                        deletedIds: [part.id],
                        tableName:  "spare_part_master",
                        xData:      {},
                    }),
                },
            });
            toast.success("Part deleted successfully.");
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error("Failed to delete part. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Delete Part</DialogTitle>
                    <DialogDescription>
                        Permanently delete{" "}
                        <span className="font-semibold text-slate-800">{part.part_name}</span>?
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <p className="text-sm text-slate-600">This action cannot be undone.</p>

                    {inUse === true && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <p className="text-sm text-amber-800">
                                This part cannot be deleted as it is referenced by existing jobs, invoices, or stock records.
                            </p>
                        </div>
                    )}

                    {inUse !== true && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="confirm_part_code">
                                Type{" "}
                                <span className="font-semibold font-mono text-slate-800">{part.part_code}</span>{" "}
                                to confirm
                            </Label>
                            <Input
                                autoComplete="off"
                                className="font-mono uppercase"
                                id="confirm_part_code"
                                placeholder={part.part_code}
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
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
