import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";

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
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { LookupConfig } from "@/features/client/types/lookup";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddLookupDialogPropsType = {
    config:       LookupConfig;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type CheckQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddLookupDialog = ({
    config,
    onOpenChange,
    onSuccess,
    open,
}: AddLookupDialogPropsType) => {
    const [checkingCode, setCheckingCode] = useState(false);
    const [codeTaken,    setCodeTaken]    = useState<boolean | null>(null);
    const [submitting,   setSubmitting]   = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const formSchema = useMemo(() => z.object({
        code: config.codeLettersOnly
            ? z.string().min(1, "Code is required").max(30).regex(/^[A-Za-z_]+$/, "Only letters and underscores").transform(v => v.toUpperCase())
            : z.string().min(1, "Code is required").max(30).regex(/^[A-Za-z0-9_]+$/, "Only letters, numbers and underscores").transform(v => v.toUpperCase()),
        name:          z.string().min(1, "Name is required"),
        description:   z.string().optional(),
        display_order: z.coerce.number().int().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
        prefix:        config.hasPrefix
            ? z.string().min(1, "Prefix is required").max(10)
            : z.string().optional(),
    }), []); // eslint-disable-line react-hooks/exhaustive-deps

    type FormType = z.infer<typeof formSchema>;

    const form = useForm<FormType>({
        defaultValues: { code: "", name: "", description: "", display_order: "", prefix: "" },
        mode:          "onChange",
        resolver:      zodResolver(formSchema),
    });

    const { formState: { errors } } = form;
    const codeValue     = useWatch({ control: form.control, name: "code" });
    const debouncedCode = useDebounce(codeValue, 1200);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setCheckingCode(false);
            setCodeTaken(null);
            setSubmitting(false);
            form.reset();
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Code uniqueness check
    useEffect(() => {
        if (!debouncedCode || !dbName || !schema) { setCodeTaken(null); return; }
        if (form.getFieldState("code").invalid) { setCodeTaken(null); return; }
        setCheckingCode(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { code: debouncedCode.toUpperCase() },
                        sqlId:   config.checkCodeExistsSqlId,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setCodeTaken(exists);
                if (exists) form.setError("code", { message: MESSAGES.ERROR_LOOKUP_CODE_EXISTS, type: "manual" });
                else form.clearErrors("code");
            })
            .catch(() => setCodeTaken(null))
            .finally(() => setCheckingCode(false));
    }, [debouncedCode]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: FormType) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            const xData: Record<string, unknown> = {
                code: data.code,
                name: data.name,
                ...(config.hasSystemFlag !== false && { is_system: false }),
            };
            if (config.hasDescription)  xData.description   = (data.description  || null);
            if (config.hasDisplayOrder) xData.display_order = (data.display_order ?? null);
            if (config.hasPrefix)       xData.prefix        = data.prefix || null;
            if (config.hasIsActive)     xData.is_active     = true;

            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({ tableName: config.tableName, xData }),
                },
            });
            toast.success(config.messages.created);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(config.messages.createFailed);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled = checkingCode || codeTaken === true || Object.keys(errors).length > 0 || submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-slate-800">
                        Add Record
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="al_code">
                                Code <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    autoComplete="off"
                                    className="pr-8 font-mono uppercase"
                                    id="al_code"
                                    placeholder="Unique code"
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
                        </div>

                        {/* Name */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="al_name">
                                Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                autoComplete="off"
                                id="al_name"
                                placeholder="Display name"
                                {...form.register("name")}
                            />
                            <FieldError message={errors.name?.message} />
                        </div>
                    </div>

                    {/* Prefix — only document_type */}
                    {config.hasPrefix && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="al_prefix">
                                Prefix <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                autoComplete="off"
                                className="font-mono uppercase"
                                id="al_prefix"
                                maxLength={10}
                                placeholder="e.g. JOB, INV"
                                {...form.register("prefix")}
                            />
                            <FieldError message={errors.prefix?.message} />
                        </div>
                    )}

                    {/* Description */}
                    {config.hasDescription && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="al_desc">Description</Label>
                            <Input
                                autoComplete="off"
                                id="al_desc"
                                placeholder="Optional description"
                                {...form.register("description")}
                            />
                        </div>
                    )}

                    {/* Display Order */}
                    {config.hasDisplayOrder && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="al_order">Display Order</Label>
                            <Input
                                id="al_order"
                                min={0}
                                placeholder="e.g. 10"
                                type="number"
                                {...form.register("display_order")}
                            />
                            <FieldError message={errors.display_order?.message} />
                        </div>
                    )}

                    <DialogFooter className="pt-2">
                        <Button disabled={submitting} type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                            disabled={submitDisabled}
                            type="submit"
                        >
                            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                            Add
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
