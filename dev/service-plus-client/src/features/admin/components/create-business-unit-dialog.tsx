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

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

type CreateBusinessUnitDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
};

type CreateBusinessUnitFormType = z.infer<typeof createBusinessUnitSchema>;

// ─── Schema ───────────────────────────────────────────────────────────────────

const createBusinessUnitSchema = z.object({
    code: z
        .string()
        .min(3, "Code must be at least 3 characters")
        .max(9, "Code must be 9 characters or fewer")
        .regex(/^[a-zA-Z0-9_]+$/, "Code can only contain letters, numbers and underscores. No spaces or hyphens."),
    name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .regex(/^[a-zA-Z0-9 ]+$/, "Name can only contain letters, numbers and spaces."),
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

export const CreateBusinessUnitDialog = ({
    onOpenChange,
    onSuccess,
    open,
}: CreateBusinessUnitDialogPropsType) => {
    const [checkingCode, setCheckingCode] = useState(false);
    const [codeTaken, setCodeTaken]       = useState<boolean | null>(null);
    const [submitting, setSubmitting]     = useState(false);

    const dbName = useAppSelector(selectDbName);

    const form = useForm<CreateBusinessUnitFormType>({
        defaultValues: { code: "", name: "" },
        mode: "onChange",
        resolver: zodResolver(createBusinessUnitSchema),
    });

    const { formState: { errors } } = form;
    const codeValue    = useWatch({ control: form.control, name: "code" });
    const debouncedCode = useDebounce(codeValue, 1200);

    // Debounced code uniqueness check
    useEffect(() => {
        if (!debouncedCode || !dbName) {
            setCodeTaken(null);
            return;
        }
        const { invalid } = form.getFieldState("code");
        if (invalid) {
            setCodeTaken(null);
            return;
        }
        setCheckingCode(true);
        setCodeTaken(null);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { code: debouncedCode },
                        sqlId: SQL_MAP.CHECK_BU_CODE_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setCodeTaken(exists);
                if (exists) {
                    form.setError("code", { message: MESSAGES.ERROR_BU_CODE_EXISTS, type: "manual" });
                } else {
                    form.clearErrors("code");
                }
            })
            .catch(() => { setCodeTaken(null); })
            .finally(() => { setCheckingCode(false); });
    }, [debouncedCode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset on close
    useEffect(() => {
        if (!open) {
            setCheckingCode(false);
            setCodeTaken(null);
            setSubmitting(false);
            form.reset({ code: "", name: "" });
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: CreateBusinessUnitFormType) {
        if (!dbName) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "bu",
                        xData: { code: data.code.toLowerCase(), name: data.name },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_BU_CREATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_BU_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled =
        submitting ||
        checkingCode ||
        Object.keys(errors).length > 0 ||
        codeTaken === true;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-slate-800">
                        Add Business Unit
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Create a new business unit for this client.
                    </DialogDescription>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Code */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bu_code">
                            Code <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                className="pr-8 font-mono uppercase"
                                disabled={submitting}
                                id="bu_code"
                                placeholder="e.g. WORKSHOP1"
                                {...form.register("code")}
                            />
                            {checkingCode && (
                                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                            )}
                            {!checkingCode && codeTaken === false && !errors.code && (
                                <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                            )}
                        </div>
                        <FieldError message={errors.code?.message} />
                        <p className="text-[11px] text-slate-400">Unique identifier — cannot be changed later.</p>
                    </div>

                    {/* Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bu_name">
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            autoComplete="off"
                            disabled={submitting}
                            id="bu_name"
                            placeholder="e.g. Main Workshop"
                            {...form.register("name")}
                        />
                        <FieldError message={errors.name?.message} />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            disabled={submitting}
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700"
                            disabled={submitDisabled}
                            type="submit"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
