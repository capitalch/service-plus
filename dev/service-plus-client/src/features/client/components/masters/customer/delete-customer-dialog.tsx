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
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { CustomerType } from "@/features/client/types/customer";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteCustomerDialogPropsType = {
    customer:     CustomerType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type InUseQueryDataType = {
    genericQuery: { in_use: boolean }[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteCustomerDialog = ({
    customer,
    onOpenChange,
    onSuccess,
    open,
}: DeleteCustomerDialogPropsType) => {
    const [checkingInUse, setCheckingInUse] = useState(false);
    const [confirmValue,  setConfirmValue]  = useState("");
    const [inUse,         setInUse]         = useState<boolean | null>(null);
    const [submitting,    setSubmitting]    = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    // On open: reset state and check in-use
    useEffect(() => {
        if (!open) {
            setCheckingInUse(false);
            setConfirmValue("");
            setInUse(null);
            setSubmitting(false);
            return;
        }
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
                        sqlArgs: { id: customer.id },
                        sqlId:   SQL_MAP.CHECK_CUSTOMER_IN_USE,
                    }),
                },
            })
            .then((res) => setInUse(res.data?.genericQuery?.[0]?.in_use ?? false))
            .catch(() => setInUse(null))
            .finally(() => setCheckingInUse(false));
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const displayName   = customer.full_name || customer.mobile;
    const deleteEnabled = inUse === false && !checkingInUse && confirmValue === customer.mobile;

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
                        deletedIds: [customer.id],
                        tableName:  "customer_contact",
                        xData:      {},
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_CUSTOMER_DELETED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_CUSTOMER_DELETE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Delete Customer</DialogTitle>
                    <DialogDescription>
                        Permanently delete{" "}
                        <span className="font-semibold text-slate-800">{displayName}</span>?
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <p className="text-sm text-slate-600">This action cannot be undone.</p>

                    {/* In-use warning */}
                    {inUse === true && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <p className="text-sm text-amber-800">{MESSAGES.ERROR_CUSTOMER_DELETE_IN_USE}</p>
                        </div>
                    )}

                    {/* Confirm input — shown only when not in use */}
                    {inUse !== true && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="confirm_customer_mobile">
                                Type{" "}
                                <span className="font-semibold text-slate-800">{customer.mobile}</span>{" "}
                                to confirm
                            </Label>
                            <Input
                                autoComplete="off"
                                id="confirm_customer_mobile"
                                placeholder={customer.mobile}
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
