import { useCallback, useEffect, useRef, useState } from "react";
import {Briefcase, ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Loader2, Pencil, RefreshCw, Save, Search, Trash2, X} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { ViewModeToggle, type ViewMode } from "@/features/client/components/inventory/view-mode-toggle";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { currentFinancialYearRange } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { DocumentSequenceRow } from "@/features/client/types/sales";
import type { BatchJobRow, JobBatchDetailRow, JobBatchListRow, JobLookupRow, ModelRow } from "@/features/client/types/job";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";
import type { BrandOption, ProductOption } from "@/features/client/types/model";

import { NewBatchJobForm } from "./new-batch-job-form";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { batchJobFormSchema, type BatchJobFormValues, getBatchJobDefaultValues, blankBatchRow } from "./batch-job-schema";
import { selectCurrentUser } from "@/features/auth/store/auth-slice";
import { uploadJobFile } from "@/lib/image-service";
import { type StagedFile } from "@/features/client/components/jobs/single-job/job-image-upload";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const DEBOUNCE_MS = 1200;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const BatchJobSection = () => {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const currentUser  = useAppSelector(selectCurrentUser);
    const branchId     = globalBranch?.id ?? null;

    const { from: defaultFrom, to: defaultTo } = currentFinancialYearRange();

    const [fromDate, setFromDate] = useState(defaultFrom);
    const [toDate,   setToDate]   = useState(defaultTo);
    const [search,   setSearch]   = useState("");
    const [searchQ,  setSearchQ]  = useState("");

    const [mode, setMode] = useState<ViewMode>("new");

    // Metadata
     
     
    const [jobStatuses,       setJobStatuses]       = useState<JobLookupRow[]>([]);
    const [jobTypes,          setJobTypes]          = useState<JobLookupRow[]>([]);
    const [receiveMannners,   setReceiveManners]    = useState<JobLookupRow[]>([]);
     
    const [receiveConditions, setReceiveConditions] = useState<JobLookupRow[]>([]);
    const [models,            setModels]            = useState<ModelRow[]>([]);
    const [brands,            setBrands]            = useState<BrandOption[]>([]);
    const [products,          setProducts]          = useState<ProductOption[]>([]);
    const [customerTypes,     setCustomerTypes]     = useState<CustomerTypeOption[]>([]);
    const [masterStates,      setMasterStates]      = useState<StateOption[]>([]);
    const [docSequences,      setDocSequences]      = useState<DocumentSequenceRow[]>([]);

    // List data
    const [batches, setBatches] = useState<JobBatchListRow[]>([]);
    const [total,   setTotal]   = useState(0);
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(false);

    // Delete
    const [deleteBatchNo, setDeleteBatchNo] = useState<number | null>(null);
    const [deleteJobCount, setDeleteJobCount] = useState(0);
    const [deleting, setDeleting]   = useState(false);

    // Edit
    const [editBatchNo,  setEditBatchNo]  = useState<number | null>(null);
    const [editRows,     setEditRows]     = useState<JobBatchDetailRow[]>([]);

    // Form
    const [submitting, setSubmitting] = useState(false);
    const [rows, setRows] = useState<BatchJobRow[]>([]);
    const [pendingFiles, setPendingFiles] = useState<Record<string, StagedFile[]>>({});

    const form = useForm<BatchJobFormValues>({
        defaultValues: getBatchJobDefaultValues(),
        mode: "onChange",
        resolver: zodResolver(batchJobFormSchema) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });
    
    const rowsValid = rows.length > 0 && rows.every(r => !!r.product_brand_model_id && r.quantity >= 1);
    
    function handleReset() {
        form.reset(getBatchJobDefaultValues());
        setPendingFiles({});
        setRows([blankBatchRow(jobSequence, 0)]);
    }


    const executeSave = async (values: BatchJobFormValues) => {
        setSubmitting(true);
        if (!branchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_JOB_CREATE_FAILED);
            return;
        }
        try {
            if (editBatchNo) {
                const originalIds   = new Set((editRows ?? []).map(r => r.id));
                const currentIds    = new Set(rows.filter(r => r.id).map(r => r.id!));
                const deletedJobIds = [...originalIds].filter(id => !currentIds.has(id));
                const addedJobs     = rows.filter(r => !r.id).map(r => ({
                    job_no: r.job_no, product_brand_model_id: r.product_brand_model_id,
                    serial_no: r.serial_no || null, problem_reported: r.problem_reported,
                    warranty_card_no: r.warranty_card_no || null,
                    job_receive_condition_id: r.job_receive_condition_id, remarks: r.remarks || null,
                    quantity: r.quantity,
                }));
                const updatedJobs   = rows.filter(r => r.id).map(r => ({
                    id: r.id!, product_brand_model_id: r.product_brand_model_id,
                    serial_no: r.serial_no || null, problem_reported: r.problem_reported,
                    warranty_card_no: r.warranty_card_no || null,
                    job_receive_condition_id: r.job_receive_condition_id, remarks: r.remarks || null,
                    quantity: r.quantity,
                }));

                const payload = encodeURIComponent(JSON.stringify({
                    batch_no: editBatchNo,
                    sharedData: {
                        branch_id: branchId, batch_date: values.batch_date,
                        customer_contact_id: values.customer_id, job_type_id: values.job_type_id,
                        job_receive_manner_id: values.receive_manner_id,
                        performed_by_user_id: currentUser?.id ?? null,
                    },
                    addedJobs, updatedJobs, deletedJobIds,
                    job_doc_sequence_id:   addedJobs.length > 0 ? (jobSequence?.id ?? null) : null,
                    job_doc_sequence_next: addedJobs.length > 0 ? (jobSequence ? jobSequence.next_number + addedJobs.length : null) : null,
                }));

                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.updateJobBatch,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(`Batch #${editBatchNo} updated`);
            } else {
                const payload = encodeURIComponent(JSON.stringify({
                    sharedData: {
                        branch_id: branchId, batch_date: values.batch_date,
                        customer_contact_id: values.customer_id, job_type_id: values.job_type_id,
                        job_receive_manner_id: values.receive_manner_id,
                        job_status_id: jobStatuses.find(s => s.is_initial)?.id ?? null,
                        performed_by_user_id: currentUser?.id ?? null,
                        job_doc_sequence_id:   jobSequence?.id ?? null,
                        job_doc_sequence_next: jobSequence ? jobSequence.next_number + rows.length : null,
                    },
                    jobs: rows.map(r => ({
                        job_no: r.job_no, product_brand_model_id: r.product_brand_model_id,
                        serial_no: r.serial_no || null, problem_reported: r.problem_reported,
                        warranty_card_no: r.warranty_card_no || null,
                        job_receive_condition_id: r.job_receive_condition_id, remarks: r.remarks || null,
                        quantity: r.quantity,
                    })),
                }));

                const result = await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.createJobBatch,
                    variables: { db_name: dbName, schema, value: payload },
                });
                const data   = result.data as { createJobBatch?: { batch_no: number; job_ids: number[] } };
                const batchNo = data?.createJobBatch?.batch_no;
                const jobIds  = data?.createJobBatch?.job_ids ?? [];

                await Promise.all(
                    rows.map(async (row, idx) => {
                        const jobId = jobIds[idx];
                        if (!jobId) return;
                        for (const { file, about } of (pendingFiles[row.localId] ?? [])) {
                            try {
                                await uploadJobFile(dbName, schema, jobId, about, file);
                            } catch (err: unknown) {
                                toast.error(`Upload failed for "${about}": ${(err as Error).message}`);
                            }
                        }
                    })
                );
                toast.success(`Batch #${batchNo} created with ${rows.length} job${rows.length !== 1 ? "s" : ""}`);
            }
            handleReset();
            setMode("view");
        } catch {
            toast.error(editBatchNo ? "Failed to update batch" : MESSAGES.ERROR_JOB_CREATE_FAILED);
        }
        setSubmitting(false);
    };

    const debounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);
    const [maxHeight, setMaxHeight] = useState(0);

    const recalc = useCallback(() => {
        if (scrollWrapperRef.current) {
            const rect = scrollWrapperRef.current.getBoundingClientRect();
            setMaxHeight(Math.max(200, window.innerHeight - rect.top - 60));
        }
    }, []);

    useEffect(() => {
        if (mode === "view") {
            const timer = setTimeout(recalc, 100);
            window.addEventListener("resize", recalc);
            return () => { clearTimeout(timer); window.removeEventListener("resize", recalc); };
        }
    }, [mode, recalc, batches.length]);

    const refreshModels = useCallback(async () => {
        if (!dbName || !schema) return;
        try {
            const res = await apolloClient.query<GenericQueryData<ModelRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_MODELS }) },
            });
            setModels(res.data?.genericQuery ?? []);
        } catch { /* ignore */ }
    }, [dbName, schema]);

    const jobSequence = docSequences.find(ds => ds.document_type_code === "JOB") ?? null;

    useEffect(() => {
        if (!dbName || !schema || !branchId) return;
        const fetchMeta = async () => {
            try {
                const [statusRes, typeRes, mannerRes, condRes, modelRes, brandRes, prodRes, custTypeRes, stateRes] =
                    await Promise.all([
                        apolloClient.query<GenericQueryData<JobLookupRow>>({ fetchPolicy: "network-only", query: GRAPHQL_MAP.genericQuery, variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_STATUSES }) } }),
                        apolloClient.query<GenericQueryData<JobLookupRow>>({ fetchPolicy: "network-only", query: GRAPHQL_MAP.genericQuery, variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_TYPES }) } }),
                        apolloClient.query<GenericQueryData<JobLookupRow>>({ fetchPolicy: "network-only", query: GRAPHQL_MAP.genericQuery, variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_RECEIVE_MANNERS }) } }),
                        apolloClient.query<GenericQueryData<JobLookupRow>>({ fetchPolicy: "network-only", query: GRAPHQL_MAP.genericQuery, variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_RECEIVE_CONDITIONS }) } }),
                        apolloClient.query<GenericQueryData<ModelRow>>({ fetchPolicy: "network-only", query: GRAPHQL_MAP.genericQuery, variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_MODELS }) } }),
                        apolloClient.query<GenericQueryData<BrandOption>>({ fetchPolicy: "network-only", query: GRAPHQL_MAP.genericQuery, variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }) } }),
                        apolloClient.query<GenericQueryData<ProductOption>>({ fetchPolicy: "network-only", query: GRAPHQL_MAP.genericQuery, variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_PRODUCTS }) } }),
                        apolloClient.query<GenericQueryData<CustomerTypeOption>>({ fetchPolicy: "network-only", query: GRAPHQL_MAP.genericQuery, variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_CUSTOMER_TYPES }) } }),
                        apolloClient.query<GenericQueryData<StateOption>>({ fetchPolicy: "network-only", query: GRAPHQL_MAP.genericQuery, variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_STATES }) } }),
                    ]);
                setJobStatuses(statusRes.data?.genericQuery ?? []);
                setJobTypes(typeRes.data?.genericQuery ?? []);
                setReceiveManners(mannerRes.data?.genericQuery ?? []);
                setReceiveConditions(condRes.data?.genericQuery ?? []);
                setModels(modelRes.data?.genericQuery ?? []);
                setBrands(brandRes.data?.genericQuery ?? []);
                setProducts(prodRes.data?.genericQuery ?? []);
                setCustomerTypes(custTypeRes.data?.genericQuery ?? []);
                setMasterStates((stateRes.data?.genericQuery ?? []).map(s => ({
                    id: s.id, code: (s as { gst_state_code?: string }).gst_state_code ?? s.code, name: s.name,
                })));
            } catch { toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED); }
        };
        void fetchMeta();
    }, [dbName, schema, branchId]);

    useEffect(() => {
        if (!dbName || !schema || !branchId) return;
        apolloClient.query<GenericQueryData<DocumentSequenceRow>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DOCUMENT_SEQUENCES, sqlArgs: { branch_id: branchId } }) },
        }).then(res => setDocSequences(res.data?.genericQuery ?? [])).catch(() => {});
    }, [dbName, schema, branchId]);



    const loadData = useCallback(async (bId: number, from: string, to: string, q: string, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bId, from_date: from, to_date: to, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<JobBatchListRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_BATCHES_PAGED, sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE } }) },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_BATCHES_COUNT, sqlArgs: commonArgs }) },
                }),
            ]);
            setBatches(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
        } catch { toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED); }
        finally { setLoading(false); }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId || mode !== "view") return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadData(Number(branchId), fromDate, toDate, searchQ, page);
    }, [branchId, fromDate, toDate, searchQ, page, loadData, mode]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    };

    const handleEdit = async (batchNo: number) => {
        if (!dbName || !schema) return;
        try {
            const res = await apolloClient.query<GenericQueryData<JobBatchDetailRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_BATCH_DETAIL, sqlArgs: { batch_no: batchNo } }) },
            });
            setEditBatchNo(batchNo);
            setEditRows(res.data?.genericQuery ?? []);
            setMode("new");
        } catch { toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED); }
    };

    const handleDelete = async () => {
        if (!deleteBatchNo || !dbName || !schema) return;
        setDeleting(true);
        try {
            const payload = encodeURIComponent(JSON.stringify({ batch_no: deleteBatchNo }));
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.deleteJobBatch,
                variables: { db_name: dbName, schema, value: payload },
            });
            toast.success(`Batch #${deleteBatchNo} deleted`);
            setDeleteBatchNo(null);
            if (branchId)  
        void loadData(Number(branchId), fromDate, toDate, searchQ, page);
        } catch { toast.error("Failed to delete batch"); }
        finally { setDeleting(false); }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-1">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                        <Briefcase className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2 overflow-hidden">
                        <h1 className="text-lg font-bold text-[var(--cl-text)] truncate">
                            Batch Jobs
                            {mode === "new" && !editBatchNo && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)] whitespace-nowrap">— New</span>}
                            {mode === "new" &&  editBatchNo && <span className="ml-2 text-sm font-medium text-amber-500 whitespace-nowrap">— Edit #{editBatchNo}</span>}
                            {mode === "view" && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)] whitespace-nowrap">— View</span>}
                        </h1>
                        {mode === "view" && (
                            <span className="text-xs text-[var(--cl-text-muted)] whitespace-nowrap">
                                {loading ? "Loading…" : `(${total})`}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1" />

                <ViewModeToggle
                    mode={mode}
                    isEditing={!!editBatchNo}
                    onNewClick={() => { setEditBatchNo(null); setEditRows([]); setMode("new"); }}
                    onViewClick={() => {
                        setEditBatchNo(null); setEditRows([]); setMode("view");
                        if (branchId)  
        void loadData(Number(branchId), fromDate, toDate, searchQ, page);
                    }}
                />

                <div className={`flex items-center gap-2 ${mode !== "new" ? "hidden md:flex md:invisible pointer-events-none" : ""}`}>
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]"
                        disabled={submitting} variant="ghost"
                        onClick={() => { setEditBatchNo(null); setEditRows([]); }}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${submitting ? "animate-spin" : ""}`} />
                        Reset
                    </Button>
                    <Button
                        className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest transition-all disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                        disabled={!form.formState.isValid || !rowsValid || submitting}
                        onClick={form.handleSubmit(executeSave)}
                    >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Batch
                    </Button>
                </div>
            </div>

            {mode === "new" ? (
                <div className="flex-1 overflow-y-auto">
                    <FormProvider {...form}>
                        <NewBatchJobForm
                            branchId={branchId}
                            docSequence={jobSequence}
                            jobTypes={jobTypes}
                            receiveMannners={receiveMannners}
                            receiveConditions={receiveConditions}
                            models={models}
                            brands={brands}
                            products={products}
                            customerTypes={customerTypes}
                            masterStates={masterStates}
                            editBatchNo={editBatchNo}
                            editRows={editRows}
                            onRefreshModels={refreshModels}
                            rows={rows}
                            setRows={setRows}
                            
                            setPendingFiles={setPendingFiles}
                        />
                    </FormProvider>
                </div>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[var(--cl-surface-2)]/30">
                        <div className="flex items-center gap-1">
                            <Input className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs" disabled={loading} type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} />
                            <span className="text-[var(--cl-text-muted)] text-xs">—</span>
                            <Input className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs" disabled={loading} type="date" value={toDate}   onChange={e => { setToDate(e.target.value);   setPage(1); }} />
                        </div>
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                            <Input className="h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-8 text-xs" disabled={loading} placeholder="Batch no, customer or mobile…" value={search} onChange={e => handleSearchChange(e.target.value)} />
                            {search && (
                                <button
                                    className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--cl-text-muted)] text-[var(--cl-surface)] hover:bg-[var(--cl-text)] focus:outline-none"
                                    type="button"
                                    onClick={() => handleSearchChange("")}
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            )}
                        </div>
                        <div className="ml-auto">
                            <Button className="h-8 px-2.5 text-xs" disabled={loading || !branchId} size="sm" variant="outline" onClick={() => { if (branchId)  
        void loadData(Number(branchId), fromDate, toDate, searchQ, page); }}>
                                <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                        <div ref={scrollWrapperRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: mode === "view" ? maxHeight : undefined }}>
                            {loading ? (
                                <table className="min-w-full border-collapse">
                                    <thead><tr className="bg-[var(--cl-surface-2)]">{["#","Batch No","Date","Customer","Mobile","Job Type","# Jobs","Actions"].map(h => <th key={h} className={thClass}>{h}</th>)}</tr></thead>
                                    <tbody>{Array.from({ length: 8 }).map((_, i) => (<tr key={i} className="animate-pulse">{Array.from({ length: 8 }).map((__, j) => (<td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-[var(--cl-border)]" /></td>))}</tr>))}</tbody>
                                </table>
                            ) : batches.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">No batches found for the selected filters.</div>
                            ) : (
                                <table className="min-w-full border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        <tr>
                                            {["#","Batch No","Date","Customer","Mobile","Job Type","# Jobs"].map(h => <th key={h} className={thClass}>{h}</th>)}
                                            <th className={`${thClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)]`}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                        {batches.map((b, idx) => (
                                            <tr key={b.batch_no} className="group transition-colors hover:bg-[var(--cl-accent)]/5">
                                                <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                                <td className={`${tdClass} font-mono font-medium text-[var(--cl-accent)]`}>#{b.batch_no}</td>
                                                <td className={tdClass}>{b.batch_date}</td>
                                                <td className={tdClass}>{b.customer_name ?? "—"}</td>
                                                <td className={`${tdClass} font-mono text-xs`}>{b.mobile}</td>
                                                <td className={tdClass}>{b.job_type_name}</td>
                                                <td className={tdClass}>
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                                                        {b.job_count}
                                                    </span>
                                                </td>
                                                <td className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`}>
                                                    <div className="flex items-center gap-1">
                                                        <Button className="h-7 w-7 p-0 text-amber-500 hover:bg-amber-500/10" variant="ghost" title="Edit" onClick={() => void handleEdit(b.batch_no)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10" variant="ghost" title="Delete" onClick={() => { setDeleteBatchNo(b.batch_no); setDeleteJobCount(b.job_count); }}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between border-t border-[var(--cl-border)] px-4 py-2">
                            <span className="text-xs text-[var(--cl-text-muted)]">Page {page} of {totalPages} · {total} records</span>
                            <div className="flex items-center gap-1">
                                <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" variant="ghost" title="First"    onClick={() => setPage(1)}><ChevronsLeftIcon  className="h-4 w-4" /></Button>
                                <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" variant="ghost" title="Previous" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon  className="h-4 w-4" /></Button>
                                <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" variant="ghost" title="Next" onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></Button>
                                <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" variant="ghost" title="Last" onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </div>

                    {/* Delete Dialog */}
                    <Dialog open={deleteBatchNo !== null} onOpenChange={open => { if (!open && !deleting) setDeleteBatchNo(null); }}>
                        <DialogContent aria-describedby={undefined} className="sm:max-w-sm !bg-[var(--cl-surface)] text-[var(--cl-text)]">
                            <DialogHeader><DialogTitle>Delete Batch #{deleteBatchNo}</DialogTitle></DialogHeader>
                            <p className="text-sm text-[var(--cl-text-muted)]">
                                This will permanently delete all {deleteJobCount} job{deleteJobCount !== 1 ? "s" : ""} in this batch. This action cannot be undone.
                            </p>
                            <DialogFooter>
                                <Button disabled={deleting} variant="outline" onClick={() => setDeleteBatchNo(null)}>Cancel</Button>
                                <Button disabled={deleting} variant="destructive" onClick={() => void handleDelete()}>
                                    {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </motion.div>
    );
};
