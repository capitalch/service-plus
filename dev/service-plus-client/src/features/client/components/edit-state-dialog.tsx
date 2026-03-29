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
import type { StateType } from "@/features/client/types/state";

// ─── Types ────────────────────────────────────────────────────────────────────

type EditStateDialogPropsType = {
    state:        StateType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type EditStateFormType = z.infer<typeof editStateSchema>;

type CheckQueryDataType = { genericQuery: { exists: boolean }[] | null };

// ─── Schema ───────────────────────────────────────────────────────────────────

const editStateSchema = z.object({
    country_code:       z.string()
                          .min(2, "Country code must be exactly 2 letters")
                          .max(2, "Country code must be exactly 2 letters")
                          .regex(/^[A-Za-z]{2}$/, "Only 2 letters allowed")
                          .transform((v) => v.toUpperCase()),
    gst_state_code:     z.string().max(2, "Max 2 characters").optional(),
    is_union_territory: z.boolean(),
    name:               z.string().min(2, "Name must be at least 2 characters"),
});

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditStateDialog = ({
    state,
    onOpenChange,
    onSuccess,
    open,
}: EditStateDialogPropsType) => {
    const [checkingName, setCheckingName] = useState(false);
    const [nameTaken,    setNameTaken]    = useState<boolean | null>(null);
    const [submitting,   setSubmitting]   = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useForm<EditStateFormType>({
        mode:     "onChange",
        resolver: zodResolver(editStateSchema),
    });

    const { formState: { errors } } = form;
    const nameValue     = useWatch({ control: form.control, name: "name" });
    const debouncedName = useDebounce(nameValue, 1200);

    // Pre-fill on open
    useEffect(() => {
        if (!open) return;
        form.reset({
            country_code:       state.country_code,
            gst_state_code:     state.gst_state_code ?? "",
            is_union_territory: state.is_union_territory,
            name:               state.name,
        });
        setNameTaken(null);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Name uniqueness check (exclude current id)
    useEffect(() => {
        if (!debouncedName || !dbName || !schema) { setNameTaken(null); return; }
        if (form.getFieldState("name").invalid) { setNameTaken(null); return; }
        if (debouncedName.toLowerCase() === state.name.toLowerCase()) { setNameTaken(false); return; }
        setCheckingName(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { id: state.id, name: debouncedName },
                        sqlId:   SQL_MAP.CHECK_STATE_NAME_EXISTS_EXCLUDE_ID,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setNameTaken(exists);
                if (exists) form.setError("name", { message: MESSAGES.ERROR_STATE_NAME_EXISTS_EDIT, type: "manual" });
                else form.clearErrors("name");
            })
            .catch(() => setNameTaken(null))
            .finally(() => setCheckingName(false));
    }, [debouncedName]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: EditStateFormType) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "state",
                        xData: {
                            country_code:       data.country_code,
                            gst_state_code:     data.gst_state_code || null,
                            id:                 state.id,
                            is_union_territory: data.is_union_territory,
                            name:               data.name,
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_STATE_UPDATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_STATE_UPDATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled =
        checkingName ||
        Object.keys(errors).length > 0 ||
        nameTaken === true ||
        submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Edit State / Province
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Code — read-only */}
                    <div className="flex flex-col gap-1.5">
                        <Label>Code</Label>
                        <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                            <span className="font-mono text-sm font-semibold text-slate-700">{state.code}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">State code cannot be changed.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Name */}
                        <div className="col-span-2 flex flex-col gap-1.5">
                            <Label htmlFor="est_name">
                                Name <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    autoComplete="off"
                                    className="pr-8"
                                    id="est_name"
                                    placeholder="State name"
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

                        {/* Country Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="est_country">
                                Country Code <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                autoComplete="off"
                                className="font-mono uppercase"
                                id="est_country"
                                maxLength={2}
                                placeholder="IN"
                                {...form.register("country_code")}
                            />
                            <FieldError message={errors.country_code?.message} />
                        </div>

                        {/* GST State Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="est_gst">GST State Code</Label>
                            <Input
                                autoComplete="off"
                                className="font-mono uppercase"
                                id="est_gst"
                                maxLength={2}
                                placeholder="e.g. 27"
                                {...form.register("gst_state_code")}
                            />
                            <FieldError message={errors.gst_state_code?.message} />
                        </div>
                    </div>

                    {/* Is Union Territory */}
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="est_ut"
                            checked={form.watch("is_union_territory")}
                            onCheckedChange={(v) => form.setValue("is_union_territory", !!v)}
                        />
                        <Label htmlFor="est_ut" className="cursor-pointer font-normal">
                            Union Territory
                        </Label>
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
                            className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                            disabled={submitDisabled}
                            type="submit"
                        >
                            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
