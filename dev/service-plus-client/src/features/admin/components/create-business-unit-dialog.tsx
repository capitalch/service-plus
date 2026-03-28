import React, { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle, ChevronRight, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
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

type CreatedBuType = { code: string; id: string; name: string };

// ─── Schema ───────────────────────────────────────────────────────────────────

const createBusinessUnitSchema = z.object({
    code: z
        .string()
        .min(3, "Code must be at least 3 characters")
        .max(9, "Code must be 9 characters or fewer")
        .regex(/^[a-zA-Z0-9_]+$/, "Code can only contain letters, numbers and underscores. No spaces or hyphens.")
        .transform((v) => v.toLowerCase()),
    name: z
        .string()
        .min(3, "Name must be at least 3 characters")
        .regex(/^[a-zA-Z0-9 ]+$/, "Name can only contain letters, numbers and spaces."),
});

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
    { label: "Enter Details", n: 1 as const },
    { label: "Creating",      n: 2 as const },
    { label: "Done",          n: 3 as const },
];

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
    return (
        <div className="flex items-center justify-center gap-2 mb-4 text-xs">
            {STEPS.map(({ label, n }, idx) => (
                <React.Fragment key={n}>
                    <div className={cn(
                        "flex items-center gap-1.5",
                        current === n ? "text-teal-700 font-semibold" : "text-slate-400",
                    )}>
                        <span className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold",
                            current === n  ? "border-teal-600 bg-teal-600 text-white" :
                            current > n    ? "border-emerald-500 bg-emerald-500 text-white" :
                                             "border-slate-300 text-slate-400",
                        )}>
                            {current > n ? <Check className="h-3 w-3" /> : n}
                        </span>
                        {label}
                    </div>
                    {idx < STEPS.length - 1 && (
                        <ChevronRight className="h-3 w-3 text-slate-300" />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}

// ─── Field error helper ───────────────────────────────────────────────────────

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
    const [checkingName, setCheckingName] = useState(false);
    const [codeTaken,    setCodeTaken]    = useState<boolean | null>(null);
    const [createError,  setCreateError]  = useState<string | null>(null);
    const [createdBu,    setCreatedBu]    = useState<CreatedBuType | null>(null);
    const [nameTaken,    setNameTaken]    = useState<boolean | null>(null);
    const [step,         setStep]         = useState<1 | 2 | 3>(1);

    const dbName = useAppSelector(selectDbName);

    const form = useForm<CreateBusinessUnitFormType>({
        defaultValues: { code: "", name: "" },
        mode: "onChange",
        resolver: zodResolver(createBusinessUnitSchema),
    });

    const { formState: { errors } } = form;
    const codeValue     = useWatch({ control: form.control, name: "code" });
    const debouncedCode = useDebounce(codeValue, 1200);
    const nameValue     = useWatch({ control: form.control, name: "name" });
    const debouncedName = useDebounce(nameValue, 1200);

    // Debounced code uniqueness check
    useEffect(() => {
        if (!debouncedCode || !dbName) { setCodeTaken(null); return; }
        const { invalid } = form.getFieldState("code");
        if (invalid) { setCodeTaken(null); return; }
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

    // Debounced name uniqueness check
    useEffect(() => {
        if (!debouncedName || !dbName) { setNameTaken(null); return; }
        const { invalid } = form.getFieldState("name");
        if (invalid) { setNameTaken(null); return; }
        setCheckingName(true);
        setNameTaken(null);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { name: debouncedName },
                        sqlId: SQL_MAP.CHECK_BU_NAME_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setNameTaken(exists);
                if (exists) {
                    form.setError("name", { message: MESSAGES.ERROR_BU_NAME_EXISTS, type: "manual" });
                } else {
                    form.clearErrors("name");
                }
            })
            .catch(() => { setNameTaken(null); })
            .finally(() => { setCheckingName(false); });
    }, [debouncedName]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset all state on close
    useEffect(() => {
        if (!open) {
            setCheckingCode(false);
            setCheckingName(false);
            setCodeTaken(null);
            setCreateError(null);
            setCreatedBu(null);
            setNameTaken(null);
            setStep(1);
            form.reset({ code: "", name: "" });
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Step 2: auto-trigger mutation on mount
    useEffect(() => {
        if (step !== 2 || !dbName) return;
        setCreateError(null);
        const data = form.getValues();
        apolloClient
            .mutate<{ createBuSchemaAndFeedSeedData: { code: string; id: number; name: string } }>({
                mutation: GRAPHQL_MAP.createBuSchemaAndFeedSeedData,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: encodeURIComponent(
                        JSON.stringify({ code: data.code.toLowerCase(), name: data.name })
                    ),
                },
            })
            .then((res) => {
                const result = res.data?.createBuSchemaAndFeedSeedData;
                setCreatedBu({
                    code: result?.code ?? data.code.toLowerCase(),
                    id:   String(result?.id ?? ""),
                    name: result?.name ?? data.name,
                });
                setStep(3);
            })
            .catch((err) => {
                const msg =
                    err?.errors?.[0]?.message ??
                    MESSAGES.ERROR_BU_CREATE_SCHEMA_FAILED;
                setCreateError(msg);
            });
    }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

    function onNext(data: CreateBusinessUnitFormType) {
        void data;
        setStep(2);
    }

    const nextDisabled =
        checkingCode ||
        checkingName ||
        Object.keys(errors).length > 0 ||
        codeTaken === true ||
        nameTaken === true ||
        !form.getValues("code") ||
        !form.getValues("name");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Add Business Unit
                    </DialogTitle>
                </DialogHeader>

                <StepIndicator current={step} />

                {/* ── Step 1: Enter Details ── */}
                {step === 1 && (
                    <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onNext)}>
                        {/* Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="bu_code">
                                Code <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    autoComplete="off"
                                    className="pr-8 font-mono"
                                    id="bu_code"
                                    placeholder="e.g. workshop1"
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
                            <div className="relative">
                                <Input
                                    autoComplete="off"
                                    className="pr-8"
                                    id="bu_name"
                                    placeholder="e.g. Main Workshop"
                                    {...form.register("name")}
                                />
                                {checkingName && (
                                    <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                                )}
                                {!checkingName && nameTaken === false && !errors.name && (
                                    <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                                )}
                            </div>
                            <FieldError message={errors.name?.message} />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-teal-600 text-white hover:bg-teal-700"
                                disabled={nextDisabled}
                                type="submit"
                            >
                                Next
                            </Button>
                        </DialogFooter>
                    </form>
                )}

                {/* ── Step 2: Creating Business Unit ── */}
                {step === 2 && (
                    <div className="flex flex-col items-center gap-4 py-6">
                        {createError ? (
                            <>
                                <p className="text-center text-sm text-red-500">{createError}</p>
                                <DialogFooter className="pt-2 w-full">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => onOpenChange(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="bg-teal-600 text-white hover:bg-teal-700"
                                        type="button"
                                        onClick={() => setStep(2)}
                                    >
                                        Retry
                                    </Button>
                                </DialogFooter>
                            </>
                        ) : (
                            <>
                                <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
                                <p className="text-sm text-slate-500">Setting up your business unit…</p>
                            </>
                        )}
                    </div>
                )}

                {/* ── Step 3: Done ── */}
                {step === 3 && (
                    <div className="flex flex-col items-center gap-4 py-6 text-center">
                        <CheckCircle className="h-12 w-12 text-emerald-500" />
                        <p className="text-lg font-semibold text-slate-800">Business Unit Created</p>
                        <p className="text-sm text-slate-500">
                            <span className="font-medium">{createdBu?.name}</span>
                            {" "}({createdBu?.code}) has been created successfully.
                        </p>
                        <DialogFooter className="pt-2 w-full justify-center">
                            <Button
                                className="bg-teal-600 text-white hover:bg-teal-700"
                                type="button"
                                onClick={() => { onSuccess(); onOpenChange(false); }}
                            >
                                Done
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
