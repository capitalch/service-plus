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
import type { ClientAdminType } from "@/features/super-admin/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeactivateAdminDialogPropsType = {
    admin: ClientAdminType | null;
    clientName: string;
    dbName: string;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeactivateAdminDialog = ({
    admin,
    clientName,
    dbName,
    onOpenChange,
    onSuccess,
    open,
}: DeactivateAdminDialogPropsType) => {
    const [submitting, setSubmitting] = useState(false);

    if (!admin) return null;

    async function handleDeactivate() {
        if (!admin) return;
        setSubmitting(true);
        try {
            const result = await apolloClient.mutate({
                mutation: GRAPHQL_MAP.setAdminUserActive,
                variables: { db_name: dbName, id: admin.id, is_active: false },
            });
            if (result.errors?.length) {
                toast.error(MESSAGES.ERROR_ADMIN_DEACTIVATE_FAILED);
                return;
            }
            toast.success(MESSAGES.SUCCESS_ADMIN_DEACTIVATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_ADMIN_DEACTIVATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Deactivate Admin</DialogTitle>
                    <DialogDescription>
                        Deactivate <span className="font-semibold text-slate-800">{admin.full_name}</span> for{" "}
                        <span className="font-semibold text-slate-800">{clientName}</span>?
                    </DialogDescription>
                </DialogHeader>
                <p className="text-sm text-slate-600">This admin will not be able to log in.</p>
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
