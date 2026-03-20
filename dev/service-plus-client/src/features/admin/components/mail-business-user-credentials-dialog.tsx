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
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { BusinessUserType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertStateType = {
    detail?: string;
    message: string;
    variant: "destructive" | "warning";
} | null;

type MailBusinessUserCredentialsDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
    user: BusinessUserType | null;
};

type MailResultType = {
    mailBusinessUserCredentials: { email_error: string | null; email_sent: boolean; id: number };
};

// ─── Component ────────────────────────────────────────────────────────────────

export const MailBusinessUserCredentialsDialog = ({
    onOpenChange,
    onSuccess,
    open,
    user,
}: MailBusinessUserCredentialsDialogPropsType) => {
    const dbName = useAppSelector(selectDbName);

    const [alert, setAlert]       = useState<AlertStateType>(null);
    const [submitting, setSubmitting] = useState(false);

    if (!user) return null;

    function handleOpenChange(value: boolean) {
        if (!value) setAlert(null);
        onOpenChange(value);
    }

    async function handleSendCredentials() {
        if (!user || !dbName) return;
        setSubmitting(true);
        try {
            const result = await apolloClient.mutate<MailResultType>({
                mutation: GRAPHQL_MAP.mailBusinessUserCredentials,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: encodeURIComponent(JSON.stringify({ id: user.id })),
                },
            });
            const emailSent = result.data?.mailBusinessUserCredentials?.email_sent ?? false;
            if (emailSent) {
                toast.success(MESSAGES.SUCCESS_BUSINESS_USER_CREDENTIALS_MAILED);
                onSuccess();
                onOpenChange(false);
            } else {
                const emailError = result.data?.mailBusinessUserCredentials?.email_error ?? undefined;
                setAlert({
                    detail: emailError,
                    message: MESSAGES.WARN_BUSINESS_USER_CREDENTIALS_MAIL_NOT_SENT,
                    variant: "warning",
                });
            }
        } catch {
            setAlert({ message: MESSAGES.ERROR_BUSINESS_USER_MAIL_CREDENTIALS_FAILED, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Send password reset link</DialogTitle>
                    <DialogDescription>
                        Send a reset link to{" "}
                        <span className="font-semibold text-slate-800">{user.full_name}</span>
                        {" "}·{" "}
                        <span className="text-slate-500">{user.email}</span>
                    </DialogDescription>
                </DialogHeader>
                <p className="text-sm text-slate-600">
                    A reset link (valid for 48 hours) will be emailed to the user.
                    No password is changed at this stage.
                </p>
                {alert && (
                    <Alert className="relative pr-8" variant={alert.variant}>
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
                        onClick={handleSendCredentials}
                    >
                        {submitting && <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Send Reset Link
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
