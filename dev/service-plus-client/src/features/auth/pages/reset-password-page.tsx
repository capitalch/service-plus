import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { KeyRoundIcon, Loader2Icon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MESSAGES } from '@/constants/messages';
import { ROUTES } from '@/router/routes';
import { setNewPassword, validateResetToken } from '@/lib/auth-service';
import type { ValidateResetTokenResponseType } from '@/lib/auth-service';

// ─── Schema ───────────────────────────────────────────────────────────────────

const resetSchema = z
    .object({
        confirmPassword: z.string(),
        newPassword: z
            .string()
            .min(8, MESSAGES.ERROR_RESET_PASSWORD_TOO_SHORT)
            .regex(/[a-zA-Z]/, 'Must contain at least one letter')
            .regex(/[0-9]/, 'Must contain at least one number'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: MESSAGES.ERROR_RESET_PASSWORDS_MISMATCH,
        path: ['confirmPassword'],
    });

type ResetFormType = z.infer<typeof resetSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const navigate       = useNavigate();

    const [pageError,  setPageError]  = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [tokenInfo,  setTokenInfo]  = useState<ValidateResetTokenResponseType | null>(null);
    const [validating, setValidating] = useState(true);

    const token = searchParams.get('token') ?? '';

    const {
        formState: { errors, isValid },
        handleSubmit,
        register,
        trigger,
    } = useForm<ResetFormType>({
        mode: 'onChange',
        resolver: zodResolver(resetSchema),
    });

    useEffect(() => {
        if (!token) {
            navigate(ROUTES.login, { replace: true });
            return;
        }

        async function checkToken() {
            try {
                const info = await validateResetToken(token);
                setTokenInfo(info);
            } catch {
                setPageError(MESSAGES.ERROR_RESET_TOKEN_INVALID);
            } finally {
                setValidating(false);
            }
        }

        checkToken();
    }, [navigate, token]);

    async function onSubmit(data: ResetFormType) {
        setSubmitting(true);
        try {
            await setNewPassword(token, data.newPassword);
            toast.success(MESSAGES.SUCCESS_RESET_PASSWORD);
            navigate(ROUTES.login, { replace: true });
        } catch {
            setPageError(MESSAGES.ERROR_RESET_PASSWORD_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
            <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
                initial={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.3 }}
            >
                {/* Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                    {/* Header */}
                    <div className="mb-6 flex flex-col items-center gap-2 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                            <KeyRoundIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <h1 className="text-xl font-semibold text-slate-800">Set New Password</h1>
                        {tokenInfo && (
                            <p className="text-sm text-slate-500">
                                Hello, <span className="font-medium text-slate-700">{tokenInfo.full_name}</span>
                            </p>
                        )}
                    </div>

                    {/* Validating state */}
                    {validating && (
                        <div className="flex items-center justify-center gap-2 py-4 text-slate-500">
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Validating link…</span>
                        </div>
                    )}

                    {/* Invalid / expired token */}
                    {!validating && pageError && !tokenInfo && (
                        <div className="space-y-4">
                            <Alert variant="destructive">
                                <AlertDescription>{pageError}</AlertDescription>
                            </Alert>
                            <Button
                                className="w-full"
                                variant="outline"
                                onClick={() => navigate(ROUTES.login)}
                            >
                                Back to Login
                            </Button>
                        </div>
                    )}

                    {/* Password form */}
                    {!validating && tokenInfo && (
                        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                            {/* Username (read-only) */}
                            <div className="space-y-1.5">
                                <Label className="text-sm text-slate-600">Username</Label>
                                <Input
                                    readOnly
                                    className="bg-slate-50 text-slate-500"
                                    value={tokenInfo.username}
                                />
                            </div>

                            {/* New password */}
                            <div className="space-y-1.5">
                                <Label className="text-sm" htmlFor="newPassword">
                                    New Password <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    {...register('newPassword', { onChange: () => trigger('confirmPassword') })}
                                />
                                {errors.newPassword && (
                                    <p className="text-xs text-red-600">{errors.newPassword.message}</p>
                                )}
                            </div>

                            {/* Confirm password */}
                            <div className="space-y-1.5">
                                <Label className="text-sm" htmlFor="confirmPassword">
                                    Confirm Password <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    {...register('confirmPassword')}
                                />
                                {errors.confirmPassword && (
                                    <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>
                                )}
                            </div>

                            {/* Submission error */}
                            {pageError && tokenInfo && (
                                <Alert variant="destructive">
                                    <AlertDescription>{pageError}</AlertDescription>
                                </Alert>
                            )}

                            <Button
                                className="w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                disabled={!isValid || submitting}
                                type="submit"
                            >
                                {submitting && <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                Set Password
                            </Button>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
