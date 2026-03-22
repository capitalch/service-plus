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
import type { BusinessUnitType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteBusinessUnitDialogPropsType = {
    bu: BusinessUnitType | null;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteBusinessUnitDialog = ({
    bu,
    onOpenChange,
    onSuccess,
    open,
}: DeleteBusinessUnitDialogPropsType) => {
    const [confirmCode, setConfirmCode] = useState("");
    const [submitting, setSubmitting]   = useState(false);
    const dbName = useAppSelector(selectDbName);

    // Reset confirm input on close
    useEffect(() => {
        if (!open) {
            setConfirmCode("");
        }
    }, [open]);

    if (!bu) return null;

    const buCode       = bu.code.toLowerCase();
    const deleteEnabled = confirmCode.toLowerCase() === buCode;

    async function handleDelete() {
        if (!bu || !dbName) return;
        setSubmitting(true);
        try {
            if (bu.schema_exists) {
                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.deleteBuSchema,
                    variables: {
                        db_name: dbName,
                        schema: "security",
                        value: encodeURIComponent(
                            JSON.stringify({ code: buCode, delete_bu_row: true })
                        ),
                    },
                });
                toast.success(MESSAGES.SUCCESS_BU_SCHEMA_DELETED);
            } else {
                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.genericUpdate,
                    variables: {
                        db_name: dbName,
                        schema: "security",
                        value: graphQlUtils.buildGenericUpdateValue({
                            deletedIds: [bu.id],
                            tableName: "bu",
                            xData: {},
                        }),
                    },
                });
                toast.success(MESSAGES.SUCCESS_BU_DELETED);
            }
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_BU_SCHEMA_DELETE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Delete Business Unit</DialogTitle>
                    <DialogDescription>
                        Permanently delete{" "}
                        <span className="font-semibold text-slate-800">{bu.name}</span>?
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <p className="text-sm text-slate-600">
                        This action cannot be undone. Only inactive business units can be deleted.
                    </p>

                    {bu.schema_exists && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <p className="text-sm text-amber-800">
                                <span className="font-semibold">Warning:</span>{" "}
                                {MESSAGES.INFO_BU_SCHEMA_DROP_WARNING}{" "}
                                The schema{" "}
                                <span className="font-mono font-semibold">{buCode}</span>{" "}
                                will be dropped.
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="confirm_bu_code">
                            Type{" "}
                            <span className="font-mono font-semibold text-slate-800">{buCode}</span>{" "}
                            to confirm
                        </Label>
                        <Input
                            autoComplete="off"
                            className="font-mono"
                            id="confirm_bu_code"
                            placeholder={buCode}
                            value={confirmCode}
                            onChange={(e) => setConfirmCode(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button disabled={submitting} variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        disabled={submitting || !deleteEnabled}
                        onClick={handleDelete}
                    >
                        {submitting ? <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
