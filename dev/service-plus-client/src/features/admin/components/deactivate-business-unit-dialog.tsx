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
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { BusinessUnitType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeactivateBusinessUnitDialogPropsType = {
    bu: BusinessUnitType | null;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeactivateBusinessUnitDialog = ({
    bu,
    onOpenChange,
    onSuccess,
    open,
}: DeactivateBusinessUnitDialogPropsType) => {
    const [submitting, setSubmitting] = useState(false);
    const dbName = useAppSelector(selectDbName);

    if (!bu) return null;

    async function handleDeactivate() {
        if (!bu || !dbName) return;
        setSubmitting(true);
        try {
            const result = await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "bu",
                        xData: { id: bu.id, is_active: false },
                    }),
                },
            });
            if (result.errors) {
                toast.error(MESSAGES.ERROR_BU_DEACTIVATE_FAILED);
                return;
            }
            toast.success(MESSAGES.SUCCESS_BU_DEACTIVATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_BU_DEACTIVATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Deactivate Business Unit</DialogTitle>
                    <DialogDescription>
                        Deactivate{" "}
                        <span className="font-semibold text-slate-800">{bu.name}</span>?
                    </DialogDescription>
                </DialogHeader>
                <p className="text-sm text-slate-600">
                    This business unit will no longer be available for new user assignments.
                </p>
                <DialogFooter>
                    <Button disabled={submitting} variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        className="bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                        disabled={submitting}
                        onClick={handleDeactivate}
                    >
                        {submitting ? <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                        Deactivate
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
