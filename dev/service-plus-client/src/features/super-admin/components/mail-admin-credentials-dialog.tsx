import { useState } from "react";
import { toast } from "sonner";
import { Loader2Icon, XIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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

type AlertStateType = {
    detail?: string;
    message: string;
    variant: "destructive" | "warning";
} | null;

type MailAdminCredentialsResultType = {
    mailAdminCredentials: { email_error: string | null; email_sent: boolean; id: number };
};

type MailAdminCredentialsDialogPropsType = {
    admin: ClientAdminType | null;
    dbName: string;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const MailAdminCredentialsDialog = ({
    admin,
    dbName,
    onOpenChange,
    onSuccess,
    open,
}: MailAdminCredentialsDialogPropsType) => {
    const [alert, setAlert] = useState<AlertStateType>(null);
    const [submitting, setSubmitting] = useState(false);

    if (!admin) return null;

    function handleOpenChange(value: boolean) {
        if (!value) setAlert(null);
        onOpenChange(value);
    }

    async function handleMailCredentials() {
        if (!admin) return;
        setSubmitting(true);
        try {
            const result = await apolloClient.mutate<MailAdminCredentialsResultType>({
                mutation: GRAPHQL_MAP.mailAdminCredentials,
                variables: { db_name: dbName, id: admin.id },
            });
            if (result.error) {
                setAlert({ message: MESSAGES.ERROR_ADMIN_MAIL_CREDENTIALS_FAILED, variant: "destructive" });
                return;
            }
            const emailSent = result.data?.mailAdminCredentials?.email_sent ?? false;
            if (emailSent) {
                toast.success(MESSAGES.SUCCESS_ADMIN_CREDENTIALS_MAILED);
                onSuccess();
                onOpenChange(false);
            } else {
                const emailError = result.data?.mailAdminCredentials?.email_error ?? undefined;
                setAlert({ detail: emailError, message: MESSAGES.WARN_ADMIN_CREDENTIALS_MAIL_NOT_SENT, variant: "warning" });
            }
        } catch {
            setAlert({ message: MESSAGES.ERROR_ADMIN_MAIL_CREDENTIALS_FAILED, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Reset password and mail</DialogTitle>
                    <DialogDescription>
                        Reset and email credentials for{" "}
                        <span className="font-semibold text-slate-800">{admin.full_name}</span>
                        {" "}·{" "}
                        <span className="text-slate-500">{admin.email}</span>
                    </DialogDescription>
                </DialogHeader>
                <p className="text-sm text-slate-600">
                    A new temporary password will be generated and emailed to the admin user.
                    The existing password will be replaced immediately.
                </p>
                {alert && (
                    <Alert variant={alert.variant} className="relative pr-8">
                        <AlertDescription>
                            {alert.message}
                            {alert.detail && (
                                <span className="mt-1 block text-xs opacity-75">{alert.detail}</span>
                            )}
                        </AlertDescription>
                        <button
                            aria-label="Dismiss"
                            className="absolute right-2 top-2 opacity-70 hover:opacity-100"
                            onClick={() => setAlert(null)}
                        >
                            <XIcon className="h-4 w-4" />
                        </button>
                    </Alert>
                )}
                <DialogFooter>
                    <Button disabled={submitting} variant="ghost" onClick={() => handleOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        disabled={submitting}
                        onClick={handleMailCredentials}
                    >
                        {submitting && <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Send Credentials
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
