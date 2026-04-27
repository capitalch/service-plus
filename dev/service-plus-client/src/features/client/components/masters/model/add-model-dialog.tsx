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
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { BrandOption, ProductOption } from "@/features/client/types/model";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddModelDialogPropsType = {
    brands:       BrandOption[];
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    products:     ProductOption[];
};

type CheckQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

const schema = z.object({
    product_id:  z.coerce.number().positive("Product is required"),
    brand_id:    z.coerce.number().positive("Brand is required"),
    model_name:  z.string().min(1, "Model name is required").max(100),
    launch_year: z.coerce.number().int().min(1900).max(2100).optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
    remarks:     z.string().optional(),
});

type FormType = z.infer<typeof schema>;

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddModelDialog = ({
    brands,
    onOpenChange,
    onSuccess,
    open,
    products,
}: AddModelDialogPropsType) => {
    const [checkingModel, setCheckingModel] = useState(false);
    const [modelTaken,    setModelTaken]    = useState<boolean | null>(null);
    const dbName  = useAppSelector(selectDbName);
    const schema_ = useAppSelector(selectSchema);

    const form = useForm<FormType>({
        defaultValues: {
            brand_id:    "" as any,
            launch_year: "" as any,
            model_name:  "",
            product_id:  "" as any,
            remarks:     "",
        },
        mode:          "onChange",
        resolver:      zodResolver(schema) as any,
    });

    const { formState: { errors } } = form;
    const modelNameValue  = useWatch({ control: form.control, name: "model_name" });
    const productIdValue  = useWatch({ control: form.control, name: "product_id" });
    const brandIdValue    = useWatch({ control: form.control, name: "brand_id" });
    const debouncedModel  = useDebounce(modelNameValue, 1200);

    useEffect(() => {
        if (!open) {
            setCheckingModel(false);
            setModelTaken(null);
            form.reset();
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Uniqueness check on (product_id, brand_id, model_name)
    useEffect(() => {
        const pid = Number(productIdValue);
        const bid = Number(brandIdValue);
        if (!debouncedModel || !pid || !bid || !dbName || !schema_) { setModelTaken(null); return; }
        if (form.getFieldState("model_name").invalid) { setModelTaken(null); return; }
        setCheckingModel(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { product_id: pid, brand_id: bid, model_name: debouncedModel },
                        sqlId:   SQL_MAP.CHECK_MODEL_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setModelTaken(exists);
                if (exists) form.setError("model_name", { message: "This model already exists for the selected product and brand.", type: "manual" });
                else form.clearErrors("model_name");
            })
            .catch(() => setModelTaken(null))
            .finally(() => setCheckingModel(false));
    }, [debouncedModel, productIdValue, brandIdValue]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: FormType) {
        if (!dbName || !schema_) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "product_brand_model",
                        xData: {
                            product_id:  data.product_id,
                            brand_id:    data.brand_id,
                            model_name:  data.model_name,
                            launch_year: data.launch_year ?? null,
                            remarks:     data.remarks || null,
                        },
                    }),
                },
            });
            toast.success("Model created successfully.");
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error("Failed to create model. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled = checkingModel || modelTaken === true || Object.keys(errors).length > 0 || submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Add Model
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Product */}
                        <div className="flex flex-col gap-1">
                            <SearchableCombobox<ProductOption>
                                getDisplayValue={(p) => p.name}
                                getFilterKey={(p) => p.name}
                                getIdentifier={(p) => p.id.toString()}
                                isError={!!errors.product_id}
                                items={products}
                                label={
                                    <>
                                        Product <span className="text-red-500 ml-0.5">*</span>
                                    </>
                                }
                                onSelect={(p) => {
                                    form.setValue("product_id", p ? p.id : null as any, { shouldValidate: true });
                                    setModelTaken(null);
                                }}
                                placeholder="Search product..."
                                renderItem={(p) => <span>{p.name}</span>}
                                selectedValue={productIdValue?.toString() || ""}
                                showOnFocus={false}
                            />
                            <FieldError message={errors.product_id?.message} />
                        </div>

                        {/* Brand */}
                        <div className="flex flex-col gap-1">
                            <SearchableCombobox<BrandOption>
                                getDisplayValue={(b) => b.name}
                                getFilterKey={(b) => b.name}
                                getIdentifier={(b) => b.id.toString()}
                                isError={!!errors.brand_id}
                                items={brands}
                                label={
                                    <>
                                        Brand <span className="text-red-500 ml-0.5">*</span>
                                    </>
                                }
                                onSelect={(b) => {
                                    form.setValue("brand_id", b ? b.id : null as any, { shouldValidate: true });
                                    setModelTaken(null);
                                }}
                                placeholder="Search brand..."
                                renderItem={(b) => <span>{b.name}</span>}
                                selectedValue={brandIdValue?.toString() || ""}
                                showOnFocus={false}
                            />
                            <FieldError message={errors.brand_id?.message} />
                        </div>
                    </div>

                    {/* Model Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="am_model">
                            Model Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                className="pr-8"
                                id="am_model"
                                placeholder="e.g. Galaxy S24, iPhone 16 Pro"
                                {...form.register("model_name")}
                            />
                            {checkingModel && (
                                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                            )}
                            {!checkingModel && modelTaken === false && !errors.model_name && (
                                <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                            )}
                        </div>
                        <FieldError message={errors.model_name?.message} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Launch Year */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="am_year">Launch Year</Label>
                            <Input
                                id="am_year"
                                max={2100}
                                min={1900}
                                placeholder="e.g. 2024"
                                type="number"
                                {...form.register("launch_year")}
                            />
                            <FieldError message={errors.launch_year?.message} />
                        </div>

                        {/* Remarks */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="am_remarks">Remarks</Label>
                            <Input
                                autoComplete="off"
                                id="am_remarks"
                                placeholder="Optional remarks"
                                {...form.register("remarks")}
                            />
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
