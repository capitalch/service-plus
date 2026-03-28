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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { BrandOption } from "@/features/client/types/model";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddPartDialogPropsType = {
    brands:       BrandOption[];
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type CheckQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

const schema = z.object({
    brand_id:         z.coerce.number({ required_error: "Brand is required" }).positive("Brand is required"),
    part_code:        z.string().min(1, "Part code is required").max(50).transform(v => v.toUpperCase()),
    part_name:        z.string().min(1, "Part name is required").max(200),
    part_description: z.string().optional(),
    category:         z.string().optional(),
    model:            z.string().optional(),
    uom:              z.string().min(1, "UOM is required").max(20),
    cost_price:       z.coerce.number().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
    mrp:              z.coerce.number().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
    hsn_code:         z.string().optional(),
    gst_rate:         z.coerce.number().min(0).max(100).optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
});

type FormType = z.infer<typeof schema>;

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddPartDialog = ({
    brands,
    onOpenChange,
    onSuccess,
    open,
}: AddPartDialogPropsType) => {
    const [checkingCode, setCheckingCode] = useState(false);
    const [codeTaken,    setCodeTaken]    = useState<boolean | null>(null);
    const [submitting,   setSubmitting]   = useState(false);

    const dbName  = useAppSelector(selectDbName);
    const schema_ = useAppSelector(selectSchema);

    const form = useForm<FormType>({
        defaultValues: { part_code: "", part_name: "", uom: "NOS" } as unknown as FormType,
        mode:          "onChange",
        resolver:      zodResolver(schema),
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
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Add Part
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Brand */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ap_brand">
                                Brand <span className="text-red-500">*</span>
                            </Label>
                            <Select onValueChange={(v) => {
                                form.setValue("brand_id", Number(v), { shouldValidate: true });
                                setCodeTaken(null);
                            }}>
                                <SelectTrigger id="ap_brand">
                                    <SelectValue placeholder="Select brand" />
                                </SelectTrigger>
                                <SelectContent>
                                    {brands.map((b) => (
                                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError message={errors.brand_id?.message} />
                        </div>

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
                                id="ap_cost"
                                min={0}
                                placeholder="0.00"
                                step="0.01"
                                type="number"
                                {...form.register("cost_price")}
                            />
                            <FieldError message={errors.cost_price?.message} />
                        </div>

                        {/* MRP */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ap_mrp">MRP</Label>
                            <Input
                                id="ap_mrp"
                                min={0}
                                placeholder="0.00"
                                step="0.01"
                                type="number"
                                {...form.register("mrp")}
                            />
                            <FieldError message={errors.mrp?.message} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* HSN Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ap_hsn">HSN Code</Label>
                            <Input
                                autoComplete="off"
                                className="font-mono"
                                id="ap_hsn"
                                placeholder="e.g. 8517"
                                {...form.register("hsn_code")}
                            />
                        </div>

                        {/* GST Rate */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ap_gst">GST Rate (%)</Label>
                            <Input
                                id="ap_gst"
                                max={100}
                                min={0}
                                placeholder="e.g. 18"
                                step="0.01"
                                type="number"
                                {...form.register("gst_rate")}
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
