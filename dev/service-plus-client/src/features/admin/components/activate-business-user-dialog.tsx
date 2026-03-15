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
import type { BusinessUserType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivateBusinessUserDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
    user: BusinessUserType | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ActivateBusinessUserDialog = ({
    onOpenChange,
    onSuccess,
    open,
    user,
}: ActivateBusinessUserDialogPropsType) => {
    const [submitting, setSubmitting] = useState(false);
    const dbName = useAppSelector(selectDbName);

    if (!user) return null;

    async function handleActivate() {
        if (!user || !dbName) return;
        setSubmitting(true);
        try {
            const result = await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "user",
                        xData: { id: user.id, is_active: true },
                    }),
                },
            });
            if (result.errors) {
                toast.error(MESSAGES.ERROR_BUSINESS_USER_ACTIVATE_FAILED);
                return;
            }
            toast.success(MESSAGES.SUCCESS_BUSINESS_USER_ACTIVATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_BUSINESS_USER_ACTIVATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Activate Business User</DialogTitle>
                    <DialogDescription>
                        Activate{" "}
                        <span className="font-semibold text-slate-800">{user.full_name}</span>?
                    </DialogDescription>
                </DialogHeader>
                <p className="text-sm text-slate-600">This user will be able to log in again.</p>
                <DialogFooter>
                    <Button disabled={submitting} variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        disabled={submitting}
                        onClick={handleActivate}
                    >
                        {submitting ? <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                        Activate
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
