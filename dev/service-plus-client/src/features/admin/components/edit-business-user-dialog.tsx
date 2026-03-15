import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

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
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { BusinessUserType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckEmailQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

type EditBusinessUserDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
    user: BusinessUserType | null;
};

type EditBusinessUserFormType = z.infer<typeof editBusinessUserSchema>;

// ─── Schema ───────────────────────────────────────────────────────────────────

const editBusinessUserSchema = z.object({
    email: z.string().email({ message: MESSAGES.ERROR_EMAIL_INVALID }),
    full_name: z.string().min(2, MESSAGES.ERROR_FULL_NAME_REQUIRED),
    mobile: z
        .string()
        .optional()
        .refine(
            (val) => !val || /^\+?[\d\s\-().]{7,15}$/.test(val),
            { message: MESSAGES.ERROR_MOBILE_INVALID },
        ),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return (
        <AnimatePresence>
            {message && (
                <motion.p
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-500"
                    exit={{ opacity: 0, y: -4 }}
                    initial={{ opacity: 0, y: -4 }}
                >
                    {message}
                </motion.p>
            )}
        </AnimatePresence>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditBusinessUserDialog = ({
    onOpenChange,
    onSuccess,
    open,
    user,
}: EditBusinessUserDialogPropsType) => {
    const dbName = useAppSelector(selectDbName);

    const [checkingEmail, setCheckingEmail] = useState(false);
    const [emailTaken, setEmailTaken]       = useState<boolean | null>(null);

    const {
        clearErrors,
        control,
        formState: { errors, isDirty, isSubmitting, isValid },
        handleSubmit,
        register,
        reset,
        setError,
    } = useForm<EditBusinessUserFormType>({
        defaultValues: { email: "", full_name: "", mobile: "" },
        mode: "onChange",
        resolver: zodResolver(editBusinessUserSchema),
    });

    const emailValue    = useWatch({ control, name: "email" });
    const debouncedEmail = useDebounce(emailValue, 1200);

    useEffect(() => {
        if (!open || !user) return;
        setCheckingEmail(false);
        setEmailTaken(null);
        reset({ email: user.email, full_name: user.full_name, mobile: user.mobile ?? "" });
    }, [open, user, reset]); // eslint-disable-line react-hooks/exhaustive-deps

    // Immediately reset emailTaken when user starts typing a new email
    useEffect(() => {
        if (!user || emailValue === user.email) return;
        setEmailTaken(null);
    }, [emailValue]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!debouncedEmail || !user || !dbName) return;
        if (debouncedEmail === user.email) {
            clearErrors("email");
            setEmailTaken(false);
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(debouncedEmail)) return;

        setCheckingEmail(true);
        apolloClient
            .query<CheckEmailQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { email: debouncedEmail, id: user.id },
                        sqlId: SQL_MAP.CHECK_BUSINESS_USER_EMAIL_EXISTS_EXCLUDE_ID,
                    }),
                },
            })
            .then(({ data }) => {
                const exists = data?.genericQuery?.[0]?.exists ?? false;
                setEmailTaken(exists);
                if (exists) {
                    setError("email", { message: MESSAGES.ERROR_BUSINESS_USER_EMAIL_EXISTS_EDIT });
                } else {
                    clearErrors("email");
                }
            })
            .catch(() => {
                setEmailTaken(null);
            })
            .finally(() => {
                setCheckingEmail(false);
            });
    }, [debouncedEmail, user, dbName, clearErrors, setError]);

    if (!user) return null;

    async function onSubmit(values: EditBusinessUserFormType) {
        if (!user || !dbName) return;
        if (values.email !== user.email && emailTaken !== false) return;
        try {
            const result = await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "user",
                        xData: {
                            email: values.email,
                            full_name: values.full_name,
                            id: user.id,
                            mobile: values.mobile || null,
                        },
                    }),
                },
            });
            if (result.errors) {
                toast.error(MESSAGES.ERROR_BUSINESS_USER_UPDATE_FAILED);
                return;
            }
            toast.success(MESSAGES.SUCCESS_BUSINESS_USER_UPDATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_BUSINESS_USER_UPDATE_FAILED);
        }
    }

    const emailChanged = emailValue !== (user?.email ?? "");
    const emailReady   = !emailChanged || emailTaken === false;
    const submittable  = isValid && isDirty && !isSubmitting && !checkingEmail && emailReady;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Business User</DialogTitle>
                    <DialogDescription>
                        Update details for{" "}
                        <span className="font-semibold text-slate-800">{user.full_name}</span>.
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (emailChanged && emailTaken !== false) return;
                        void handleSubmit(onSubmit)(e);
                    }}
                >
                    {/* Username (read-only) */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="username_ro">Username</Label>
                        <Input
                            className="cursor-not-allowed bg-slate-50 text-slate-500"
                            disabled
                            id="username_ro"
                            readOnly
                            value={user.username}
                        />
                    </div>

                    {/* Full Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="full_name">
                            Full Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            autoComplete="off"
                            disabled={isSubmitting}
                            id="full_name"
                            placeholder="Full Name"
                            {...register("full_name")}
                        />
                        <FieldError message={errors.full_name?.message} />
                    </div>

                    {/* Email */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="email">
                            Email <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                className="pr-8"
                                disabled={isSubmitting}
                                id="email"
                                placeholder="Email"
                                type="email"
                                {...register("email")}
                            />
                            {checkingEmail && (
                                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                            )}
                            {!checkingEmail && emailTaken === false && emailValue !== user.email && !errors.email && (
                                <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                            )}
                        </div>
                        <FieldError message={errors.email?.message} />
                    </div>

                    {/* Mobile */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="mobile">Mobile</Label>
                        <Input
                            autoComplete="off"
                            disabled={isSubmitting}
                            id="mobile"
                            placeholder="Mobile (optional)"
                            {...register("mobile")}
                        />
                        <FieldError message={errors.mobile?.message} />
                    </div>

                    <DialogFooter>
                        <Button
                            disabled={isSubmitting}
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            disabled={!submittable}
                            type="button"
                            onClick={() => {
                                if (emailChanged && emailTaken !== false) return;
                                void handleSubmit(onSubmit)();
                            }}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
