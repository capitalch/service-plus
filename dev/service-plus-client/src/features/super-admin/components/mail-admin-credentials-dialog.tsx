import { useState } from "react";
import { toast } from "sonner";
import { Loader2Icon, MailCheckIcon, TriangleAlertIcon } from "lucide-react";

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

type MailAdminCredentialsResultType = {
    mailAdminCredentials: {
        email_error: string | null;
        email_sent: boolean;
        id: number;
    };
};

type MailAdminCredentialsDialogPropsType = {
    admin: ClientAdminType | null;
    clientId: number;
    dbName: string;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
};

type ResetResultType = {
    emailError: string | null;
    emailSent: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const MailAdminCredentialsDialog = ({
    admin,
    clientId,
    dbName,
    onOpenChange,
    onSuccess,
    open,
}: MailAdminCredentialsDialogPropsType) => {
    const [error,       setError]       = useState<string | null>(null);
    const [resetResult, setResetResult] = useState<ResetResultType | null>(null);
    const [submitting,  setSubmitting]  = useState(false);

    if (!admin) return null;

    function handleOpenChange(value: boolean) {
        if (!value) {
            setError(null);
            setResetResult(null);
        }
        onOpenChange(value);
    }

    async function handleSendLink() {
        if (!admin) return;
        setSubmitting(true);
        setError(null);
        try {
            const result = await apolloClient.mutate<MailAdminCredentialsResultType>({
                mutation: GRAPHQL_MAP.mailAdminCredentials,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: encodeURIComponent(JSON.stringify({ client_id: clientId, id: admin.id })),
                },
            });
            if (result.error) {
                setError(MESSAGES.ERROR_ADMIN_MAIL_CREDENTIALS_FAILED);
                return;
            }
            const data = result.data?.mailAdminCredentials;
            setResetResult({
                emailError: data?.email_error ?? null,
                emailSent:  data?.email_sent  ?? false,
            });
            onSuccess();
        } catch {
            setError(MESSAGES.ERROR_ADMIN_MAIL_CREDENTIALS_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Send Password Reset Link</DialogTitle>
                    <DialogDescription>
                        A reset link will be emailed to{" "}
                        <span className="font-semibold text-slate-800">{admin.full_name}</span>
                        {" · "}
                        <span className="text-slate-500">{admin.email}</span>
                    </DialogDescription>
                </DialogHeader>

                {/* ── Pre-send state ── */}
                {!resetResult && (
                    <>
                        <p className="text-sm text-slate-600">
                            A password reset link (valid for 48 hours) will be sent to the admin's email.
                            No password is changed at this stage.
                        </p>
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <DialogFooter>
                            <Button disabled={submitting} variant="ghost" onClick={() => handleOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                disabled={submitting}
                                onClick={handleSendLink}
                            >
                                {submitting && <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                Send Reset Link
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {/* ── Post-send state ── */}
                {resetResult && (
                    <>
                        {resetResult.emailSent ? (
                            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                <MailCheckIcon className="h-4 w-4 flex-shrink-0" />
                                <span>{MESSAGES.SUCCESS_ADMIN_CREDENTIALS_MAILED}</span>
                            </div>
                        ) : (
                            <Alert variant="warning">
                                <TriangleAlertIcon className="h-4 w-4" />
                                <AlertDescription>
                                    {MESSAGES.WARN_ADMIN_CREDENTIALS_MAIL_NOT_SENT}
                                    {resetResult.emailError && (
                                        <span className="mt-1 block text-xs opacity-75">{resetResult.emailError}</span>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}

                        <DialogFooter>
                            <Button
                                className="bg-slate-800 text-white hover:bg-slate-900"
                                onClick={() => {
                                    if (resetResult.emailSent) toast.success(MESSAGES.SUCCESS_ADMIN_CREDENTIALS_MAILED);
                                    handleOpenChange(false);
                                }}
                            >
                                Done
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
