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
    // DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddPartDialogPropsType = {
    onOpenChange:   (open: boolean) => void;
    onSuccess:      () => void;
    open:           boolean;
    prefillCode?:   string;
    defaultBrandId: number;
    brandName:      string;
};

type CheckQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

const schema = z.object({
    brand_id:         z.coerce.number().positive("Brand is required"),
    part_code:        z.string().min(1, "Part code is required").max(50).transform(v => v.toUpperCase()),
    part_name:        z.string().min(1, "Part name is required").max(200),
    part_description: z.string().optional(),
    category:         z.string().optional(),
    model:            z.string().optional(),
    uom:              z.string().min(1, "UOM is required").max(20),
    cost_price:       z.coerce.number().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
    mrp:              z.coerce.number().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
    hsn_code:         z.string().optional().refine(v => !v || (/^\d+$/.test(v) && [4,6,8].includes(v.length)), { message: "HSN must be 4, 6, or 8 digits" }),
    gst_rate:         z.coerce.number().min(0).lt(60, "GST rate must be less than 60%").optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
}).superRefine((data, ctx) => {
    if (data.mrp != null && data.cost_price != null && data.mrp <= data.cost_price) {
        ctx.addIssue({ code: "custom", message: "MRP must be greater than cost price", path: ["mrp"] });
    }
});

type FormType = z.infer<typeof schema>;

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddPartDialog = ({
    onOpenChange,
    onSuccess,
    open,
    prefillCode,
    defaultBrandId,
    brandName,
}: AddPartDialogPropsType) => {
    const [checkingCode, setCheckingCode] = useState(false);
    const [codeTaken,    setCodeTaken]    = useState<boolean | null>(null);
    const [submitting,   setSubmitting]   = useState(false);

    const dbName  = useAppSelector(selectDbName);
    const schema_ = useAppSelector(selectSchema);

    const form = useForm<FormType>({
        defaultValues: {
            brand_id:         "" as any,
            category:         "",
            cost_price:       "" as any,
            gst_rate:         "" as any,
            hsn_code:         "",
            model:            "",
            mrp:              "" as any,
            part_code:        "",
            part_description: "",
            part_name:        "",
            uom:              "NOS",
        },
        mode:          "onChange",
        resolver:      zodResolver(schema) as any,
    });

    const { formState: { errors } } = form;
    const partCodeValue  = useWatch({ control: form.control, name: "part_code" });
    const brandIdValue   = useWatch({ control: form.control, name: "brand_id" });
    const debouncedCode  = useDebounce(partCodeValue, 1200);

    useEffect(() => {
        if (!open) {
            setCheckingCode(false);
            setCodeTaken(null);
            setSubmitting(false);
            form.reset({ part_code: "", part_name: "", uom: "NOS" } as unknown as FormType);
        } else {
            if (!defaultBrandId) {
                toast.warning("Please select a brand before adding a part.");
                onOpenChange(false);
                return;
            }
            // Populate pre-fills if provided
            if (prefillCode) form.setValue("part_code", prefillCode.toUpperCase());
            form.setValue("brand_id", defaultBrandId);
        }
    }, [open, prefillCode, defaultBrandId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const bid = Number(brandIdValue);
        if (!debouncedCode || !bid || !dbName || !schema_) { setCodeTaken(null); return; }
        if (form.getFieldState("part_code").invalid) { setCodeTaken(null); return; }
        setCheckingCode(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { brand_id: bid, part_code: debouncedCode.toUpperCase() },
                        sqlId:   SQL_MAP.CHECK_PART_CODE_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setCodeTaken(exists);
                if (exists) form.setError("part_code", { message: "This part code already exists for the selected brand.", type: "manual" });
                else form.clearErrors("part_code");
            })
            .catch(() => setCodeTaken(null))
            .finally(() => setCheckingCode(false));
    }, [debouncedCode, brandIdValue]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: FormType) {
        if (!dbName || !schema_) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "spare_part_master",
                        xData: {
                            brand_id:         data.brand_id,
                            part_code:        data.part_code,
                            part_name:        data.part_name,
                            part_description: data.part_description || null,
                            category:         data.category || null,
                            model:            data.model || null,
                            uom:              data.uom,
                            cost_price:       data.cost_price ?? null,
                            mrp:              data.mrp ?? null,
                            hsn_code:         data.hsn_code || null,
                            gst_rate:         data.gst_rate ?? null,
                        },
                    }),
                },
            });
            toast.success("Part created successfully.");
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error("Failed to create part. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled = checkingCode || codeTaken === true || Object.keys(errors).length > 0 || submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header row: title + brand */}
                <div className="flex items-center justify-between gap-4 pr-8 pb-3 border-b border-border">
                    <DialogTitle className="text-base font-semibold text-foreground shrink-0">
                        Add Part
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="ap_brand" className="shrink-0 text-xs text-muted-foreground">
                            Brand <span className="text-red-500">*</span>
                        </Label>
                        <Input disabled className="h-8 bg-slate-200 font-semibold text-slate-800 text-sm w-44" value={brandName} />
                        <FieldError message={errors.brand_id?.message} />
                    </div>
                </div>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Part Code */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ap_code">
                            Part Code <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                className="pr-8 font-mono uppercase"
                                id="ap_code"
                                placeholder="Unique part code"
                                {...form.register("part_code")}
                            />
                            {checkingCode && (
                                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                            )}
                            {!checkingCode && codeTaken === false && !errors.part_code && (
                                <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                            )}
                        </div>
                        <FieldError message={errors.part_code?.message} />
                    </div>

                    {/* Part Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ap_pname">
                            Part Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            autoComplete="off"
                            id="ap_pname"
                            placeholder="Full part name"
                            {...form.register("part_name")}
                        />
                        <FieldError message={errors.part_name?.message} />
                    </div>

                    {/* Description */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ap_desc">Description</Label>
                        <Input
                            autoComplete="off"
                            id="ap_desc"
                            placeholder="Optional description"
                            {...form.register("part_description")}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {/* Category */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ap_cat">Category</Label>
                            <Input
                                autoComplete="off"
                                id="ap_cat"
                                placeholder="e.g. Display, Battery"
                                {...form.register("category")}
                            />
                        </div>

                        {/* Model */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ap_model">Compatible Model</Label>
                            <Input
                                autoComplete="off"
                                id="ap_model"
                                placeholder="e.g. Galaxy S24"
                                {...form.register("model")}
                            />
                        </div>

                        {/* UOM */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ap_uom">
                                UOM <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                autoComplete="off"
                                id="ap_uom"
                                placeholder="e.g. NOS, MTR"
                                {...form.register("uom")}
                            />
                            <FieldError message={errors.uom?.message} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Cost Price */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ap_cost">Cost Price</Label>
                            <Input
                                {...form.register("cost_price")}
                                className="text-right"
                                id="ap_cost"
                                inputMode="decimal"
                                placeholder="0.00"
                                type="text"
                                onFocus={e => e.target.select()}
                                onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) e.target.value = v.toFixed(2); }}
                            />
                            <FieldError message={errors.cost_price?.message} />
                        </div>

                        {/* MRP */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ap_mrp">MRP</Label>
                            <Input
                                {...form.register("mrp")}
                                className="text-right"
                                id="ap_mrp"
                                inputMode="decimal"
                                placeholder="0.00"
                                type="text"
                                onFocus={e => e.target.select()}
                                onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) e.target.value = v.toFixed(2); }}
                            />
                            <FieldError message={errors.mrp?.message} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* HSN Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ap_hsn">HSN Code</Label>
                            <Input
                                {...form.register("hsn_code")}
                                autoComplete="off"
                                className="font-mono"
                                id="ap_hsn"
                                inputMode="numeric"
                                placeholder="e.g. 8517"
                                onFocus={e => e.target.select()}
                            />
                            <FieldError message={errors.hsn_code?.message} />
                        </div>

                        {/* GST Rate */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ap_gst">GST Rate (%)</Label>
                            <Input
                                {...form.register("gst_rate")}
                                className="text-right"
                                id="ap_gst"
                                inputMode="decimal"
                                placeholder="0.00"
                                type="text"
                                onFocus={e => e.target.select()}
                                onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) e.target.value = v.toFixed(2); }}
                            />
                            <FieldError message={errors.gst_rate?.message} />
                        </div>
                    </div>

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
