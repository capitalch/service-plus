import { useEffect } from "react";
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
import type { ClientAdminType } from "@/features/super-admin/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckEmailQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

type EditAdminDialogPropsType = {
    admin: ClientAdminType | null;
    clientName: string;
    dbName: string;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
};

type EditAdminFormType = {
    email: string;
    full_name: string;
    mobile: string;
};

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

// ─── Schema ───────────────────────────────────────────────────────────────────

const editAdminSchema = z.object({
    email: z.string().email({ message: MESSAGES.ERROR_EMAIL_INVALID }),
    full_name: z.string().min(1, MESSAGES.ERROR_FULL_NAME_REQUIRED),
    mobile: z
        .string()
        .optional()
        .refine(
            (val) => !val || /^\+?[\d\s\-().]{7,15}$/.test(val),
            { message: MESSAGES.ERROR_MOBILE_INVALID },
        ),
});

// ─── Component ────────────────────────────────────────────────────────────────

export const EditAdminDialog = ({
    admin,
    clientName,
    dbName,
    onOpenChange,
    onSuccess,
    open,
}: EditAdminDialogPropsType) => {
    const {
        clearErrors,
        control,
        formState: { errors, isDirty, isSubmitting, isValid },
        handleSubmit,
        register,
        reset,
        setError,
    } = useForm<EditAdminFormType>({
        defaultValues: { email: "", full_name: "", mobile: "" },
        mode: "onChange",
        resolver: zodResolver(editAdminSchema),
    });

    const emailValue = useWatch({ control, name: "email" });
    const debouncedEmail = useDebounce(emailValue, 1200);

    useEffect(() => {
        if (!open || !admin) return;
        reset({ email: admin.email, full_name: admin.full_name, mobile: admin.mobile ?? "" });
    }, [open, admin, reset]);

    useEffect(() => {
        if (!debouncedEmail || !admin) return;
        if (debouncedEmail === admin.email) {
            clearErrors("email");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(debouncedEmail)) return;

        apolloClient.query<CheckEmailQueryDataType>({
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema: "security",
                value: graphQlUtils.buildGenericQueryValue({
                    sqlArgs: { email: debouncedEmail, id: admin.id },
                    sqlId: SQL_MAP.CHECK_ADMIN_EMAIL_EXISTS_EXCLUDE_ID,
                }),
            },
            fetchPolicy: "network-only",
        }).then(({ data }) => {
            const exists = data?.genericQuery?.[0]?.exists;
            if (exists) {
                setError("email", { message: MESSAGES.ERROR_ADMIN_EMAIL_EXISTS_EDIT });
            } else {
                clearErrors("email");
            }
        }).catch(() => {});
    }, [debouncedEmail, admin, dbName, setError, clearErrors]);

    if (!admin) return null;

    async function onSubmit(values: EditAdminFormType) {
        if (!admin) return;
        try {
            const result = await apolloClient.mutate({
                mutation: GRAPHQL_MAP.updateAdminUser,
                variables: {
                    db_name: dbName,
                    email: values.email,
                    full_name: values.full_name,
                    id: admin.id,
                    mobile: values.mobile || null,
                },
            });
            if (result.error) {
                toast.error(MESSAGES.ERROR_ADMIN_UPDATE_FAILED);
                return;
            }
            toast.success(MESSAGES.SUCCESS_ADMIN_UPDATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_ADMIN_UPDATE_FAILED);
        }
    }

    const submittable = isValid && isDirty && !isSubmitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Admin</DialogTitle>
                    <DialogDescription>
                        Update admin details for{" "}
                        <span className="font-semibold text-slate-800">{clientName}</span>.
                    </DialogDescription>
                </DialogHeader>

                <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
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
                            <AnimatePresence>
                                {!errors.email && debouncedEmail && debouncedEmail !== admin.email && (
                                    <motion.span
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2"
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                    >
                                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>
                        <FieldError message={errors.email?.message} />
                    </div>

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
                            type="submit"
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
