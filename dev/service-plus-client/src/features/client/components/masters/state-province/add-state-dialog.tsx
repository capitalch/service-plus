import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { selectSchema } from "@/store/context-slice";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddStateDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type AddStateFormType = z.infer<typeof addStateSchema>;

type CheckQueryDataType = { genericQuery: { exists: boolean }[] | null };

// ─── Schema ───────────────────────────────────────────────────────────────────

const addStateSchema = z.object({
    code:               z.string()
                          .min(2, "Code must be exactly 2 letters")
                          .max(2, "Code must be exactly 2 letters")
                          .regex(/^[A-Za-z]{2}$/, "Only 2 letters allowed")
                          .transform((v) => v.toUpperCase()),
    country_code:       z.string()
                          .min(2, "Country code must be exactly 2 letters")
                          .max(2, "Country code must be exactly 2 letters")
                          .regex(/^[A-Za-z]{2}$/, "Only 2 letters allowed")
                          .transform((v) => v.toUpperCase()),
    gst_state_code:     z.string().max(2, "Max 2 characters").optional(),
    is_union_territory: z.boolean().default(false),
    name:               z.string().min(2, "Name must be at least 2 characters"),
});

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddStateDialog = ({
    onOpenChange,
    onSuccess,
    open,
}: AddStateDialogPropsType) => {
    const [checkingCode, setCheckingCode] = useState(false);
    const [checkingName, setCheckingName] = useState(false);
    const [codeTaken,    setCodeTaken]    = useState<boolean | null>(null);
    const [nameTaken,    setNameTaken]    = useState<boolean | null>(null);
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useForm<AddStateFormType>({
        defaultValues: {
            code:               "",
            country_code:       "IN",
            gst_state_code:     "",
            is_union_territory: false,
            name:               "",
        },
        mode:     "onChange",
        resolver: zodResolver(addStateSchema) as any,
    });

    const { formState: { errors } } = form;
    const codeValue     = useWatch({ control: form.control, name: "code" });
    const debouncedCode = useDebounce(codeValue, 1200);
    const nameValue     = useWatch({ control: form.control, name: "name" });
    const debouncedName = useDebounce(nameValue, 1200);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setCheckingCode(false);
            setCheckingName(false);
            setCodeTaken(null);
            setNameTaken(null);
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
                        sqlId:   SQL_MAP.CHECK_STATE_CODE_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setCodeTaken(exists);
                if (exists) form.setError("code", { message: MESSAGES.ERROR_STATE_CODE_EXISTS, type: "manual" });
                else form.clearErrors("code");
            })
            .catch(() => setCodeTaken(null))
            .finally(() => setCheckingCode(false));
    }, [debouncedCode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Name uniqueness check
    useEffect(() => {
        if (!debouncedName || !dbName || !schema) { setNameTaken(null); return; }
        if (form.getFieldState("name").invalid) { setNameTaken(null); return; }
        setCheckingName(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { name: debouncedName },
                        sqlId:   SQL_MAP.CHECK_STATE_NAME_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setNameTaken(exists);
                if (exists) form.setError("name", { message: MESSAGES.ERROR_STATE_NAME_EXISTS, type: "manual" });
                else form.clearErrors("name");
            })
            .catch(() => setNameTaken(null))
            .finally(() => setCheckingName(false));
    }, [debouncedName]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: AddStateFormType) {
        if (!dbName || !schema) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "state",
                        xData: {
                            code:               data.code,
                            country_code:       data.country_code,
                            gst_state_code:     data.gst_state_code || null,
                            is_union_territory: data.is_union_territory,
                            name:               data.name,
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_STATE_CREATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_STATE_CREATE_FAILED);
        }
    }

    const submitDisabled =
        checkingCode ||
        checkingName ||
        Object.keys(errors).length > 0 ||
        codeTaken === true ||
        nameTaken === true ||
        form.formState.isSubmitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Add State / Province
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="st_code">
                                Code <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    autoComplete="off"
                                    className="pr-8 font-mono uppercase"
                                    id="st_code"
                                    maxLength={2}
                                    placeholder="e.g. MH"
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

                        {/* Country Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="st_country">
                                Country Code <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                autoComplete="off"
                                className="font-mono uppercase"
                                id="st_country"
                                maxLength={2}
                                placeholder="IN"
                                {...form.register("country_code")}
                            />
                            <FieldError message={errors.country_code?.message} />
                        </div>
                    </div>

                    {/* Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="st_name">
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                className="pr-8"
                                id="st_name"
                                placeholder="e.g. Maharashtra"
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

                    {/* GST State Code */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="st_gst">GST State Code</Label>
                        <Input
                            autoComplete="off"
                            className="font-mono uppercase"
                            id="st_gst"
                            maxLength={2}
                            placeholder="e.g. 27"
                            {...form.register("gst_state_code")}
                        />
                        <FieldError message={errors.gst_state_code?.message} />
                    </div>

                    {/* Is Union Territory */}
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="st_ut"
                            checked={form.watch("is_union_territory")}
                            onCheckedChange={(v) => form.setValue("is_union_territory", !!v)}
                        />
                        <Label htmlFor="st_ut" className="cursor-pointer font-normal">
                            Union Territory
                        </Label>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            disabled={form.formState.isSubmitting}
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                            disabled={submitDisabled}
                            type="submit"
                        >
                            {form.formState.isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                            Add State
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
