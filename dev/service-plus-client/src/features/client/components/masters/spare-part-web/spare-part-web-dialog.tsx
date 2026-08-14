import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { EntityImageUpload } from "@/components/shared/entity-image-upload";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SEARCH_DEBOUNCE_MS } from "@/constants/timing";
import { SQL_MAP } from "@/constants/sql-map";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import {
    deleteSparePartWebImage,
    reorderSparePartWebImages,
    uploadSparePartWebImages,
} from "@/lib/image-service";
import { useAppSelector } from "@/store/hooks";
import { selectClientCode, selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectCurrentBu, selectSchema } from "@/store/context-slice";
import type { PartRow } from "@/features/client/components/inventory/part-code-input";
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
    const currentBu      = useAppSelector(selectCurrentBu);
    const clientCode     = useAppSelector(selectClientCode) ?? "";
    const buCode          = currentBu?.code ?? "";

    const [submitting, setSubmitting] = useState(false);
    const [images, setImages] = useState<string[]>([]);

    // Optional link to spare_part_master — search-as-you-type against the same
    // GET_PARTS_BY_KEYWORD query the job-parts screens already use.
    const [selectedPart,      setSelectedPart]      = useState<PartRow | null>(null);
    const [partSearch,        setPartSearch]        = useState("");
    const [partOptions,       setPartOptions]       = useState<PartRow[]>([]);
    const [partSearchLoading, setPartSearchLoading] = useState(false);
    const debouncedPartSearch = useDebounce(partSearch, SEARCH_DEBOUNCE_MS);

    const form = useForm<FormType>({
        defaultValues: isEdit ? partDefaultValues(part!) : addDefaultValues,
        mode:          "onChange",
        resolver:      zodResolver(schema) as any,
    });

    const { formState: { errors } } = form;

    // ── Reset / populate on open ───────────────────────────────────────────────
    useEffect(() => {
        if (!open) {
            setSubmitting(false);
            setPartSearch("");
            setPartOptions([]);
            if (!isEdit) {
                form.reset(addDefaultValues);
                setSelectedPart(null);
            }
            return;
        }

        if (isEdit) {
            form.reset(partDefaultValues(part!));
            // Seed the combobox with the currently-linked part (if any) so its
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
                    .then(res => setSelectedPart(res.data?.genericQuery?.[0] ?? null))
                    .catch(() => setSelectedPart(null));
            } else {
                setSelectedPart(null);
            }

            // The list row (Step 7) only carries the cover thumbnail — fetch the full
            // gallery for the editor from the same context query the image routes use.
            if (dbName && schema_) {
                apolloClient
                    .query<GenericQueryDataType<{ image_urls: string[] }>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema:  schema_,
                            value: graphQlUtils.buildGenericQueryValue({
                                sqlArgs: { id: part!.id },
                                sqlId:   SQL_MAP.GET_SPARE_PART_WEB_IMAGE_CONTEXT,
                            }),
                        },
                    })
                    .then(res => setImages(res.data?.genericQuery?.[0]?.image_urls ?? []))
                    .catch(() => setImages([]));
            }
        } else {
            form.reset(addDefaultValues);
            setSelectedPart(null);
            setImages([]);
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Part search ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!debouncedPartSearch.trim() || !dbName || !schema_) { setPartOptions([]); return; }
        setPartSearchLoading(true);
        apolloClient
            .query<GenericQueryDataType<PartRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { search: debouncedPartSearch.trim(), limit: 20, offset: 0 },
                        sqlId:   SQL_MAP.GET_PARTS_BY_KEYWORD,
                    }),
                },
            })
            .then(res => setPartOptions(res.data?.genericQuery ?? []))
            .catch(() => setPartOptions([]))
            .finally(() => setPartSearchLoading(false));
    }, [debouncedPartSearch, dbName, schema_]);

    function handleSelectPart(selected: PartRow | null) {
        setSelectedPart(selected);
        form.setValue("part_id", selected ? selected.id : null, { shouldValidate: true });
        if (selected) {
            if (!form.getValues("part_name")) form.setValue("part_name", selected.part_name);
            if (!form.getValues("model") && selected.model) form.setValue("model", selected.model);
            if (!form.getValues("hsn_code") && selected.hsn_code) form.setValue("hsn_code", selected.hsn_code);
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

    // Make sure the currently-selected part is always addressable in `items`,
    // even before/without a search matching it (e.g. right after opening in edit mode).
    const comboItems = selectedPart && !partOptions.some(p => p.id === selectedPart.id)
        ? [selectedPart, ...partOptions]
        : partOptions;

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
                        {isEdit ? "Edit Catalogue Part" : "Add Catalogue Part"}
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Optional link to spare_part_master */}
                    <SearchableCombobox<PartRow>
                        getDisplayValue={p => `${p.part_code} — ${p.part_name}`}
                        getFilterKey={p => `${p.part_code} ${p.part_name} ${p.part_description ?? ""}`}
                        getIdentifier={p => String(p.id)}
                        getItemDisabledReason={p =>
                            existingPartIds.includes(p.id) && p.id !== part?.part_id
                                ? "Already linked to another catalogue entry in this branch"
                                : null}
                        isLoading={partSearchLoading}
                        items={comboItems}
                        label="Link to Internal Part (optional)"
                        placeholder="Search by part name, description or model…"
                        renderItem={p => (
                            <div>
                                <p className="font-mono text-sm font-medium">{p.part_code} <span className="font-sans font-normal">{p.part_name}</span></p>
                                {p.part_description && <p className="text-xs text-(--cl-text-muted) truncate">{p.part_description}</p>}
                            </div>
                        )}
                        selectedValue={selectedPart ? String(selectedPart.id) : ""}
                        onInputChange={setPartSearch}
                        onSelect={handleSelectPart}
                    />
                    <p className="-mt-2 text-xs text-(--cl-text-muted)">
                        Leave unlinked for a market-sourced part with no internal part code.
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

                    {/* Photos — only available once the part exists (needs an id for the file-server folder). */}
                    {isEdit ? (
                        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
                            <Label>Photos</Label>
                            <EntityImageUpload
                                deleteImage={url => deleteSparePartWebImage(dbName!, schema_!, part!.id, url)}
                                images={images}
                                reorderImages={urls => reorderSparePartWebImages(dbName!, schema_!, part!.id, urls)}
                                uploadFiles={files => uploadSparePartWebImages(dbName!, schema_!, part!.id, clientCode, buCode, files)}
                                onChange={setImages}
                            />
                        </div>
                    ) : (
                        <p className="border-t border-border pt-3 text-xs text-(--cl-text-muted)">
                            Save the part first, then reopen it to add photos.
                        </p>
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
                            {isEdit ? "Save Changes" : "Add"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
