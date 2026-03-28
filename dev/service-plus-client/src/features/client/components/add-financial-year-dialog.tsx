import { useEffect, useState } from "react";
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
import { SQL_MAP } from "@/constants/sql-map";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddFinancialYearDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type AddFyFormType = z.infer<typeof addFySchema>;

type CheckExistsDataType    = { genericQuery: { exists: boolean }[] | null };
type CheckOverlapDataType   = { genericQuery: { overlaps: boolean }[] | null };

// ─── Schema ───────────────────────────────────────────────────────────────────

const addFySchema = z.object({
    end_date:   z.string().min(1, "End date is required"),
    id:         z.coerce.number()
                  .int("Year must be a whole number")
                  .min(2000, "Year must be 2000 or later")
                  .max(2100, "Year must be 2100 or earlier"),
    start_date: z.string().min(1, "Start date is required"),
}).refine((d) => d.start_date < d.end_date, {
    message: "Start date must be before end date",
    path: ["end_date"],
});

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddFinancialYearDialog = ({
    onOpenChange,
    onSuccess,
    open,
}: AddFinancialYearDialogPropsType) => {
    const [checkingId,      setCheckingId]      = useState(false);
    const [checkingOverlap, setCheckingOverlap] = useState(false);
    const [idTaken,         setIdTaken]         = useState<boolean | null>(null);
    const [submitting,      setSubmitting]      = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useForm<AddFyFormType>({
        defaultValues: { end_date: "", id: "" as unknown as number, start_date: "" },
        mode:     "onChange",
        resolver: zodResolver(addFySchema),
    });

    const { formState: { errors }, setValue, clearErrors, setError } = form;
    const idValue       = useWatch({ control: form.control, name: "id" });
    const endDateValue  = useWatch({ control: form.control, name: "end_date" });
    const debouncedId   = useDebounce(idValue, 1200);
    const debouncedEnd  = useDebounce(endDateValue, 1200);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setCheckingId(false);
            setCheckingOverlap(false);
            setIdTaken(null);
            setSubmitting(false);
            form.reset();
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-fill dates when year changes
    useEffect(() => {
        const year = Number(debouncedId);
        if (!year || year < 2000 || year > 2100) return;
        setValue("start_date", `${year}-04-01`, { shouldValidate: true });
        setValue("end_date",   `${year + 1}-03-31`, { shouldValidate: true });
    }, [debouncedId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Year uniqueness check
    useEffect(() => {
        const year = Number(debouncedId);
        if (!year || !dbName || !schema) { setIdTaken(null); return; }
        if (form.getFieldState("id").invalid) { setIdTaken(null); return; }
        setCheckingId(true);
        apolloClient
            .query<CheckExistsDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { id: year },
                        sqlId:   SQL_MAP.CHECK_FY_ID_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setIdTaken(exists);
                if (exists) setError("id", { message: MESSAGES.ERROR_FY_ID_EXISTS, type: "manual" });
                else clearErrors("id");
            })
            .catch(() => setIdTaken(null))
            .finally(() => setCheckingId(false));
    }, [debouncedId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Date overlap check (triggered by end_date change)
    useEffect(() => {
        const startDate = form.getValues("start_date");
        if (!debouncedEnd || !startDate || !dbName || !schema) return;
        if (form.getFieldState("end_date").invalid) return;
        setCheckingOverlap(true);
        apolloClient
            .query<CheckOverlapDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { start_date: startDate, end_date: debouncedEnd },
                        sqlId:   SQL_MAP.CHECK_FY_DATE_OVERLAP,
                    }),
                },
            })
            .then((res) => {
                const overlaps = res.data?.genericQuery?.[0]?.overlaps ?? false;
                if (overlaps) setError("end_date", { message: MESSAGES.ERROR_FY_DATE_OVERLAP, type: "manual" });
                else clearErrors("end_date");
            })
            .catch(() => {})
            .finally(() => setCheckingOverlap(false));
    }, [debouncedEnd]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: AddFyFormType) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName:  "financial_year",
                        isIdInsert: true,
                        xData:      { id: data.id, start_date: data.start_date, end_date: data.end_date },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_FY_CREATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_FY_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled =
        checkingId ||
        checkingOverlap ||
        idTaken === true ||
        Object.keys(errors).length > 0 ||
        submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Add Financial Year
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Year */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="fy_id">
                            Year <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                id="fy_id"
                                placeholder="e.g. 2025"
                                type="number"
                                {...form.register("id")}
                            />
                            {checkingId && (
                                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                            )}
                            {!checkingId && idTaken === false && !errors.id && (
                                <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                            )}
                        </div>
                        <FieldError message={errors.id?.message} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Start date */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="fy_start">
                                Start Date <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="fy_start"
                                type="date"
                                {...form.register("start_date")}
                            />
                            <FieldError message={errors.start_date?.message} />
                        </div>

                        {/* End date */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="fy_end">
                                End Date <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    id="fy_end"
                                    type="date"
                                    {...form.register("end_date")}
                                />
                                {checkingOverlap && (
                                    <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                                )}
                            </div>
                            <FieldError message={errors.end_date?.message} />
                        </div>
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
                            Add Financial Year
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
