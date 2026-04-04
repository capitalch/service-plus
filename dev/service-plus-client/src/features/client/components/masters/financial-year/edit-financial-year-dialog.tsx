import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
import type { FinancialYearType } from "@/features/client/types/financial-year";

// ─── Types ────────────────────────────────────────────────────────────────────

type EditFinancialYearDialogPropsType = {
    fy:           FinancialYearType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type EditFyFormType = z.infer<typeof editFySchema>;

type CheckOverlapDataType = { genericQuery: { overlaps: boolean }[] | null };

// ─── Schema ───────────────────────────────────────────────────────────────────

const editFySchema = z.object({
    end_date:   z.string().min(1, "End date is required"),
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

export const EditFinancialYearDialog = ({
    fy,
    onOpenChange,
    onSuccess,
    open,
}: EditFinancialYearDialogPropsType) => {
    const [checkingOverlap, setCheckingOverlap] = useState(false);
    const [submitting,      setSubmitting]      = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useForm<EditFyFormType>({
        defaultValues: { end_date: "", start_date: "" },
        mode:     "onChange",
        resolver: zodResolver(editFySchema),
    });

    const { formState: { errors }, setError, clearErrors } = form;
    const endDateValue = useWatch({ control: form.control, name: "end_date" });
    const debouncedEnd = useDebounce(endDateValue, 1200);

    // Pre-fill on open
    useEffect(() => {
        if (open) {
            form.reset({ start_date: fy.start_date, end_date: fy.end_date });
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Date overlap check (excluding current FY)
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
                        sqlArgs: { start_date: startDate, end_date: debouncedEnd, id: fy.id },
                        sqlId:   SQL_MAP.CHECK_FY_DATE_OVERLAP_EXCLUDE_ID,
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

    async function onSubmit(data: EditFyFormType) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "financial_year",
                        xData:     { id: fy.id, start_date: data.start_date, end_date: data.end_date },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_FY_UPDATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_FY_UPDATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled =
        checkingOverlap ||
        Object.keys(errors).length > 0 ||
        submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Edit Financial Year
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Year — read-only */}
                    <div className="flex flex-col gap-1.5">
                        <Label>Year</Label>
                        <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-500">
                            {fy.id}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Start date */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="efy_start">
                                Start Date <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="efy_start"
                                type="date"
                                {...form.register("start_date")}
                            />
                            <FieldError message={errors.start_date?.message} />
                        </div>

                        {/* End date */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="efy_end">
                                End Date <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    id="efy_end"
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
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
