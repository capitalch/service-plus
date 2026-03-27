import { useState } from "react";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

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
import type { FinancialYearType } from "@/features/client/types/financial-year";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteFinancialYearDialogPropsType = {
    fy:           FinancialYearType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteFinancialYearDialog = ({
    fy,
    onOpenChange,
    onSuccess,
    open,
}: DeleteFinancialYearDialogPropsType) => {
    const [confirmValue, setConfirmValue] = useState("");
    const [submitting,   setSubmitting]   = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const deleteEnabled = confirmValue === String(fy.id);

    function handleOpenChange(nextOpen: boolean) {
        if (!nextOpen) setConfirmValue("");
        onOpenChange(nextOpen);
    }

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
                        deletedIds: [fy.id],
                        tableName:  "financial_year",
                        xData:      {},
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_FY_DELETED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_FY_DELETE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Delete Financial Year</DialogTitle>
                    <DialogDescription>
                        Permanently delete FY{" "}
                        <span className="font-semibold text-slate-800">{fy.id}</span>?
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <p className="text-sm text-slate-600">This action cannot be undone.</p>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="confirm_fy">
                            Type <span className="font-semibold text-slate-800">{fy.id}</span> to confirm
                        </Label>
                        <Input
                            autoComplete="off"
                            id="confirm_fy"
                            placeholder={String(fy.id)}
                            value={confirmValue}
                            onChange={(e) => setConfirmValue(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button disabled={submitting} variant="ghost" onClick={() => handleOpenChange(false)}>
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
