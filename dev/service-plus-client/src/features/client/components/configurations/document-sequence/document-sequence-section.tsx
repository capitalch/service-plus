import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { FileText, Loader2, Save } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";

// ─── Types & Schema ───────────────────────────────────────────────────────────

type SequenceRow = {
    document_type_id: number;
    document_type_name: string;
    document_type_code: string;
    id: number | null;
    prefix: string | null;
    next_number: number | null;
    padding: number | null;
    separator: string | null;
    branch_id: number | null;
};

const sequenceItemSchema = z.object({
    document_type_id:   z.number(),
    document_type_name: z.string(),
    id:                 z.number().nullable(),
    prefix:             z.string().catch(""),
    next_number:        z.number({ message: "Required" }).min(1, "Must be ≥ 1"),
    padding:            z.number({ message: "Required" }).min(0, "Must be ≥ 0"),
    separator:          z.string().max(5, "Max 5 chars").catch(""),
});

const sequencesFormSchema = z.object({
    sequences: z.array(sequenceItemSchema),
});

type SequencesFormType = z.infer<typeof sequencesFormSchema>;

type GenericQueryData<T> = {
    genericQuery: T[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DocumentSequenceSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    const [loading,       setLoading]       = useState(false);
    const form = useForm<SequencesFormType>({
        defaultValues: { sequences: [] },
        mode: "onChange",
        resolver: zodResolver(sequencesFormSchema),
    });

    const { fields } = useFieldArray({
        control: form.control,
        name: "sequences",
    });

    const { formState: { errors } } = form;

    // 1. Load sequences when branch changes
    const loadSequences = async (branchId: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryData<SequenceRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { branch_id: branchId },
                        sqlId: SQL_MAP.GET_DOCUMENT_SEQUENCES,
                    }),
                },
            });

            const rows = res.data?.genericQuery ?? [];
            form.reset({
                sequences: rows.map(r => ({
                    document_type_id:   r.document_type_id,
                    document_type_name: r.document_type_name,
                    id:                 r.id,
                    prefix:             r.prefix ?? "",
                    next_number:        r.next_number ?? 1,
                    padding:            r.padding ?? 5,
                    separator:          r.separator ?? "/",
                })),
            });
        } catch {
            toast.error(MESSAGES.ERROR_DOCUMENT_SEQUENCE_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentBranch?.id) {
            void loadSequences(currentBranch.id);
        } else {
            form.reset({ sequences: [] });
        }
    }, [currentBranch?.id, dbName, schema]); // eslint-disable-line react-hooks/exhaustive-deps

    // 3. Submit
    async function onSubmit(data: SequencesFormType) {
        if (!dbName || !schema || !currentBranch?.id) return;
        try {
            const branchId = currentBranch.id;
            
            // Build the array of xData for genericUpdate
            const xDataArray = data.sequences.map(seq => {
                const row: Record<string, unknown> = {
                    document_type_id: seq.document_type_id,
                    branch_id:        branchId,
                    prefix:           seq.prefix || "",
                    next_number:      seq.next_number,
                    padding:          seq.padding,
                    separator:        seq.separator || "",
                };
                if (seq.id) {
                    row.id = seq.id;
                }
                return row;
            });

            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "document_sequence",
                        xData: xDataArray,
                    }),
                },
            });

            toast.success(MESSAGES.SUCCESS_DOCUMENT_SEQUENCE_SAVED);
            await loadSequences(branchId);
        } catch {
            toast.error(MESSAGES.ERROR_DOCUMENT_SEQUENCE_SAVE_FAILED);
        }
    }

    const submitDisabled = Object.keys(errors).length > 0 || form.formState.isSubmitting || loading || !currentBranch?.id;

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
            initial={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
        >
            {/* Header & Branch Selector */}
            <div className="flex flex-col gap-4 border-b border-[var(--cl-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--cl-accent)]/10">
                        <FileText className="h-5 w-5 text-[var(--cl-accent)]" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-[var(--cl-text)]">Numbering / Auto Series</h2>
                        <p className="text-xs text-[var(--cl-text-muted)]">
                            Configure document sequence prefixes and padding for <b>{currentBranch?.name || "selected branch"}</b>
                        </p>
                    </div>
                </div>
            </div>

            {/* Form */}
            {loading ? (
                <div className="flex flex-1 items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--cl-accent)]" />
                </div>
            ) : fields.length === 0 ? (
                <div className="flex flex-1 items-center justify-center py-10 text-sm text-[var(--cl-text-muted)]">
                    No document types found.
                </div>
            ) : (
                <form
                    className="flex flex-col gap-6"
                    onSubmit={form.handleSubmit(onSubmit)}
                >
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)]">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-4 text-xs font-semibold uppercase text-[var(--cl-text-muted)]">
                            <div className="col-span-4">Document Type</div>
                            <div className="col-span-3">Prefix</div>
                            <div className="col-span-1">Separator</div>
                            <div className="col-span-2">Padding</div>
                            <div className="col-span-2">Next Number</div>
                        </div>

                        {/* Table Body */}
                        <div className="flex flex-col divide-y divide-[var(--cl-border)]">
                            {fields.map((field, index) => {
                                const err = errors.sequences?.[index];
                                return (
                                    <div key={field.id} className="grid grid-cols-12 items-center gap-4 p-4 hover:bg-[var(--cl-surface-2)]/30">
                                        <div className="col-span-4 text-sm font-medium text-[var(--cl-text)]">
                                            {field.document_type_name}
                                        </div>
                                        <div className="col-span-3">
                                            <Input
                                                autoComplete="off"
                                                className="h-8 shadow-none"
                                                placeholder="e.g. INV"
                                                {...form.register(`sequences.${index}.prefix`)}
                                            />
                                            {err?.prefix && <p className="mt-1 text-[10px] text-red-500">{err.prefix.message}</p>}
                                        </div>
                                        <div className="col-span-1">
                                            <Input
                                                autoComplete="off"
                                                className="h-8 shadow-none"
                                                placeholder="/"
                                                {...form.register(`sequences.${index}.separator`)}
                                            />
                                            {err?.separator && <p className="mt-1 text-[10px] text-red-500">{err.separator.message}</p>}
                                        </div>
                                        <div className="col-span-2">
                                            <Input
                                                autoComplete="off"
                                                className="h-8 shadow-none"
                                                type="number"
                                                {...form.register(`sequences.${index}.padding`, { valueAsNumber: true })}
                                            />
                                            {err?.padding && <p className="mt-1 text-[10px] text-red-500">{err.padding.message}</p>}
                                        </div>
                                        <div className="col-span-2">
                                            <Input
                                                autoComplete="off"
                                                className="h-8 shadow-none"
                                                type="number"
                                                {...form.register(`sequences.${index}.next_number`, { valueAsNumber: true })}
                                            />
                                            {err?.next_number && <p className="mt-1 text-[10px] text-red-500">{err.next_number.message}</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                            disabled={submitDisabled}
                            type="submit"
                        >
                            {form.formState.isSubmitting
                                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                : <Save className="mr-1.5 h-4 w-4" />
                            }
                            Save Sequences
                        </Button>
                    </div>
                </form>
            )}
        </motion.div>
    );
};
