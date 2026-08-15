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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { PartCodeInput, type PartRow } from "@/features/client/components/inventory/part-code-input";
import type { BrandOption } from "@/features/client/types/model";
import type { SparePartWebType } from "@/features/client/types/spare-part-web";

// ─── Types ────────────────────────────────────────────────────────────────────

type BaseProps = {
    existingPartIds: number[];
    onOpenChange:    (open: boolean) => void;
    onSuccess:       () => void;
    open:            boolean;
};

export type SparePartWebDialogProps = BaseProps & (
    | { mode: "add" }
    | { mode: "edit"; part: SparePartWebType }
);

type GenericQueryDataType<T> = { genericQuery: T[] | null };

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
    part_id:          z.number().nullable(),
    part_name:        z.string().min(1, "Part name is required").max(200),
    part_description: z.string().optional(),
    price: z.string()
        .min(1, "Price is required")
        .refine(v => !isNaN(Number(v)) && Number(v) > 0, { message: "Price must be greater than 0" }),
    model:    z.string().optional(),
    hsn_code: z.string().optional()
        .refine(v => !v || (/^\d+$/.test(v) && [4, 6, 8].includes(v.length)), { message: "HSN must be 4, 6, or 8 digits" }),
});

type FormType = z.infer<typeof schema>;

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function partDefaultValues(part: SparePartWebType): FormType {
    return {
        part_id:          part.part_id,
        part_name:        part.part_name,
        part_description: part.part_description ?? "",
        price:            part.price != null ? Number(part.price).toFixed(2) : "",
        model:            part.model ?? "",
        hsn_code:         part.hsn_code ?? "",
    };
}

const addDefaultValues: FormType = {
    part_id:          null,
    part_name:        "",
    part_description: "",
    price:            "",
    model:            "",
    hsn_code:         "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SparePartWebDialog = (props: SparePartWebDialogProps) => {
    const { existingPartIds, onOpenChange, onSuccess, open } = props;
    const isEdit = props.mode === "edit";
    const part   = isEdit ? props.part : null;

    const dbName        = useAppSelector(selectDbName);
    const schema_        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    const [submitting, setSubmitting] = useState(false);

    // Optional link to spare_part_master — uses the same PartCodeInput control
    // as the inventory screens. Brand narrows the code lookup/browse and seeds
    // the "Add new part" flow, mirroring how other PartCodeInput callers work.
    const [brands,       setBrands]       = useState<BrandOption[]>([]);
    const [brandId,      setBrandId]      = useState<number | null>(null);
    const [linkedPart,   setLinkedPart]   = useState<PartRow | null>(null);
    const [partCodeText, setPartCodeText] = useState("");

    useEffect(() => {
        if (!dbName || !schema_) return;
        apolloClient
            .query<GenericQueryDataType<BrandOption>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }),
                },
            })
            .then(res => setBrands(res.data?.genericQuery ?? []))
            .catch(() => setBrands([]));
    }, [dbName, schema_]);

    const form = useForm<FormType>({
        defaultValues: isEdit ? partDefaultValues(part!) : addDefaultValues,
        mode:          "onChange",
        resolver:      zodResolver(schema) as any,
    });

    const { formState: { errors } } = form;
    const partIdValue = useWatch({ control: form.control, name: "part_id" });

    // ── Reset / populate on open ───────────────────────────────────────────────
    useEffect(() => {
        if (!open) {
            setSubmitting(false);
            if (!isEdit) {
                form.reset(addDefaultValues);
                setLinkedPart(null);
                setPartCodeText("");
                setBrandId(null);
            }
            return;
        }

        if (isEdit) {
            form.reset(partDefaultValues(part!));
            // Seed the part-code control with the currently-linked part (if any) so its
            // code/name show without the user having to search for it again.
            if (part!.part_id && part!.part_code && dbName && schema_) {
                apolloClient
                    .query<GenericQueryDataType<PartRow>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema:  schema_,
                            value: graphQlUtils.buildGenericQueryValue({
                                sqlArgs: { code: part!.part_code, brand_id: null },
                                sqlId:   SQL_MAP.GET_PART_BY_CODE,
                            }),
                        },
                    })
                    .then(res => {
                        const row = res.data?.genericQuery?.[0] ?? null;
                        setLinkedPart(row);
                        setPartCodeText(row?.part_code ?? part!.part_code ?? "");
                        setBrandId(row?.brand_id ?? null);
                    })
                    .catch(() => {
                        setLinkedPart(null);
                        setPartCodeText(part!.part_code ?? "");
                        setBrandId(null);
                    });
            } else {
                setLinkedPart(null);
                setPartCodeText("");
                setBrandId(null);
            }
        } else {
            form.reset(addDefaultValues);
            setLinkedPart(null);
            setPartCodeText("");
            setBrandId(null);
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleBrandChange(id: number) {
        setBrandId(id);
        setLinkedPart(null);
        setPartCodeText("");
        form.setValue("part_id", null, { shouldValidate: true });
    }

    function handleSelectPart(selected: PartRow) {
        if (existingPartIds.includes(selected.id) && selected.id !== part?.part_id) {
            toast.error("Already linked to another web part in this branch.");
            return;
        }
        setLinkedPart(selected);
        setPartCodeText(selected.part_code);
        setBrandId(selected.brand_id);
        form.setValue("part_id", selected.id, { shouldValidate: true });
        if (!form.getValues("part_name")) form.setValue("part_name", selected.part_name);
        if (!form.getValues("model") && selected.model) form.setValue("model", selected.model);
        if (!form.getValues("hsn_code") && selected.hsn_code) form.setValue("hsn_code", selected.hsn_code);
    }

    function handleClearPart() {
        setLinkedPart(null);
        setPartCodeText("");
        form.setValue("part_id", null, { shouldValidate: true });
    }

    function handlePartCodeChange(code: string) {
        setPartCodeText(code);
        if (linkedPart) {
            setLinkedPart(null);
            form.setValue("part_id", null, { shouldValidate: true });
        }
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    async function onSubmit(data: FormType) {
        if (!dbName || !schema_ || !currentBranch) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "spare_part_web",
                        xData: {
                            ...(isEdit ? { id: part!.id } : { branch_id: currentBranch.id }),
                            part_id:          data.part_id,
                            part_name:        data.part_name,
                            part_description: data.part_description || null,
                            price:            Number(data.price),
                            model:            data.model || null,
                            hsn_code:         data.hsn_code || null,
                        },
                    }),
                },
            });
            toast.success(isEdit ? MESSAGES.SUCCESS_SPARE_PART_WEB_UPDATED : MESSAGES.SUCCESS_SPARE_PART_WEB_CREATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(isEdit ? MESSAGES.ERROR_SPARE_PART_WEB_UPDATE_FAILED : MESSAGES.ERROR_SPARE_PART_WEB_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled = Object.keys(errors).length > 0 || submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                onCloseAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
                aria-describedby={undefined}
                className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
            >
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        {isEdit ? "Edit Web Part" : "Add Web Part"}
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Optional link to spare_part_master */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>Brand</Label>
                            <Select
                                value={brandId ? String(brandId) : ""}
                                onValueChange={v => handleBrandChange(Number(v))}
                            >
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Select brand…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {brands.map(b => (
                                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Part Code (optional)</Label>
                            <PartCodeInput
                                brandId={brandId}
                                brandName={brands.find(b => b.id === brandId)?.name}
                                costPrice={linkedPart?.cost_price ?? null}
                                partCode={partCodeText}
                                partDescription={linkedPart?.part_description ?? null}
                                partId={partIdValue}
                                partName={linkedPart?.part_name ?? ""}
                                selectedBrandId={brandId}
                                onChange={handlePartCodeChange}
                                onClear={handleClearPart}
                                onSelect={handleSelectPart}
                            />
                        </div>
                    </div>
                    <p className="-mt-2 text-xs text-(--cl-text-muted)">
                        Keep part code empty for market-sourced part.
                    </p>

                    {/* Part Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="spw_name">
                            Part Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            autoComplete="off"
                            id="spw_name"
                            placeholder="Name shown to customers"
                            {...form.register("part_name")}
                        />
                        <FieldError message={errors.part_name?.message} />
                    </div>

                    {/* Description */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="spw_desc">Description</Label>
                        <Input
                            autoComplete="off"
                            id="spw_desc"
                            placeholder="Optional description"
                            {...form.register("part_description")}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {/* Price */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="spw_price">
                                Price <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                {...form.register("price")}
                                className="text-right"
                                id="spw_price"
                                inputMode="decimal"
                                placeholder="0.00"
                                type="text"
                                onFocus={e => e.target.select()}
                                onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) e.target.value = v.toFixed(2); }}
                            />
                            <FieldError message={errors.price?.message} />
                        </div>

                        {/* Model */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="spw_model">Model</Label>
                            <Input
                                autoComplete="off"
                                id="spw_model"
                                placeholder="e.g. Galaxy S24"
                                {...form.register("model")}
                            />
                        </div>

                        {/* HSN Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="spw_hsn">HSN Code</Label>
                            <Input
                                {...form.register("hsn_code")}
                                autoComplete="off"
                                className="font-mono"
                                id="spw_hsn"
                                inputMode="numeric"
                                placeholder="e.g. 8517"
                                onFocus={e => e.target.select()}
                            />
                            <FieldError message={errors.hsn_code?.message} />
                        </div>
                    </div>

                    <p className="text-xs text-(--cl-text-muted)">
                        Prices are shown to customers as indicative and subject to change without notice.
                    </p>

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
                            {isEdit ? "Save Changes" : "Add"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
