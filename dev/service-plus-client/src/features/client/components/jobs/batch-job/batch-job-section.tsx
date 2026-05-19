import { useCallback, useEffect, useRef, useState } from "react";
import {
    Briefcase, ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Loader2, MoreHorizontal, Paperclip, Pencil, Printer, RefreshCw, Save, Search, Trash2, X, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import { ViewModeToggle, type ViewMode } from "@/features/client/components/inventory/view-mode-toggle";
import { JobImageUpload } from "@/features/client/components/jobs/single-job/job-image-upload";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName, selectCurrentUser } from "@/features/auth/store/auth-slice";
import { selectAvailableDivisions, selectCurrentBranch, selectCurrentDivision, selectDefaultDivisionId, selectSchema } from "@/store/context-slice";
import type { JobBatchDetailRow, JobDetailType, JobInBatchRow, JobLookupRow, ModelRow } from "@/features/client/types/job";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";
import type { BrandOption, ProductOption } from "@/features/client/types/model";
import type { DivisionContextType } from "@/features/client/types/division";

import { NewBatchJobForm } from "./new-batch-job-form";
import { BatchJobQuickInfoCard } from "./batch-job-quick-info-card";
import { BatchJobViewModal } from "./batch-job-view-modal";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { batchJobFormSchema, type BatchJobFormValues, getBatchJobDefaultValues } from "./batch-job-schema";
import { getBatchJobSheetBlobUrl } from "../job-sheet-pdf";
import { PdfPreviewModal } from "@/components/shared/pdf-preview-modal";
import { deleteJobFiles } from "@/lib/image-service";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type PostSaveJob = { jobId: number; jobNo: string };

type BatchGroup = {
    batch_no:     number;
    batch_date:   string;
    customer_name: string | null;
    division_id:  number | null;
    mobile:       string;
    job_count:    number;
    jobs:         JobInBatchRow[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const DEBOUNCE_MS = 1600;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const BatchJobSection = ({ initialEditBatchNo, onEditBatchNoApplied, onReturnToSingleJob }: { initialEditBatchNo?: number | null; onEditBatchNoApplied?: () => void; onReturnToSingleJob?: () => void }) => {
    const dbName             = useAppSelector(selectDbName);
    const schema             = useAppSelector(selectSchema);
    const globalBranch       = useAppSelector(selectCurrentBranch);
    const currentUser        = useAppSelector(selectCurrentUser);
    const availableDivisions = useAppSelector(selectAvailableDivisions);
    const currentDivision    = useAppSelector(selectCurrentDivision);
    const defaultDivisionId  = useAppSelector(selectDefaultDivisionId);
    const branchId           = globalBranch?.id ?? null;

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

    // List data
    const [jobs,    setJobs]    = useState<JobInBatchRow[]>([]);
    const [total,   setTotal]   = useState(0);
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(false);

    // Delete
    const [deleteBatchNo,  setDeleteBatchNo]  = useState<number | null>(null);
    const [deleteJobCount, setDeleteJobCount] = useState(0);
    const [deleting,       setDeleting]       = useState(false);

    // Delete individual job
    const [deleteJobId,    setDeleteJobId]    = useState<number | null>(null);
    const [deleteJobNo,    setDeleteJobNo]    = useState<string>("");

    // Attach files for individual job from list
    const [attachJobId,    setAttachJobId]    = useState<number | null>(null);
    const [attachJobNo,    setAttachJobNo]    = useState<string>("");
    const [attachRowIdx,   setAttachRowIdx]   = useState<number | null>(null);

    // Edit
    const [editBatchNo, setEditBatchNo] = useState<number | null>(null);
    const [editSourceMode, setEditSourceMode] = useState<ViewMode>("new");
    const [editFromSingleJob, setEditFromSingleJob] = useState(false);
    const [editRows,    setEditRows]    = useState<JobBatchDetailRow[]>([]);

    // View
    const [viewBatchNo,  setViewBatchNo]  = useState<number | null>(null);
    const [viewJobs,     setViewJobs]     = useState<JobDetailType[]>([]);
    const [viewLoading,  setViewLoading]  = useState(false);

    // PDF Preview
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [pdfFilename,   setPdfFilename]   = useState<string>("Job-Sheet.pdf");
    const [showPdfModal,  setShowPdfModal]  = useState(false);

    // Post-save file attachment
    const [postSaveJobs,    setPostSaveJobs]    = useState<PostSaveJob[] | null>(null);
    const [postSaveBatchNo, setPostSaveBatchNo] = useState<number | null>(null);

    // Quick info card refresh
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [submitting, setSubmitting] = useState(false);

    const form = useForm<BatchJobFormValues>({
        defaultValues: getBatchJobDefaultValues(defaultDivisionId),
        mode: "onChange",
        resolver: zodResolver(batchJobFormSchema) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    function handleReset() {
        form.reset(getBatchJobDefaultValues(defaultDivisionId));
        setPostSaveJobs(null);
        setPostSaveBatchNo(null);
    }

    const executeSave = async (values: BatchJobFormValues) => {
        setSubmitting(true);
        if (!branchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_JOB_CREATE_FAILED);
            setSubmitting(false);
            return;
        }
        const formRows = values.rows ?? [];
        try {
            if (editBatchNo) {
                const originalIds   = new Set((editRows ?? []).map(r => r.id));
                const currentIds    = new Set(formRows.filter(r => r.id).map(r => r.id!));
                const deletedJobIds = [...originalIds].filter(id => !currentIds.has(id));
                const addedJobs     = formRows.filter(r => !r.id).map(r => ({
                    job_type_id:              r.job_type_id,
                    product_brand_model_id:   r.product_brand_model_id,
                    alternate_job_no:         r.alternate_job_no || null,
                    serial_no:                r.serial_no || null,
                    problem_reported:         r.problem_reported || null,
                    warranty_card_no:         r.warranty_card_no || null,
                    job_receive_condition_id: r.job_receive_condition_id,
                    remarks:                  r.remarks || null,
                    quantity:                 r.quantity,
                }));
                const updatedJobs   = formRows.filter(r => r.id).map(r => ({
                    id:                       r.id!,
                    job_type_id:              r.job_type_id,
                    product_brand_model_id:   r.product_brand_model_id,
                    alternate_job_no:         r.alternate_job_no || null,
                    serial_no:                r.serial_no || null,
                    problem_reported:         r.problem_reported || null,
                    warranty_card_no:         r.warranty_card_no || null,
                    job_receive_condition_id: r.job_receive_condition_id,
                    remarks:                  r.remarks || null,
                    quantity:                 r.quantity,
                }));

                const payload = encodeURIComponent(JSON.stringify({
                    batch_no: editBatchNo,
                    sharedData: {
                        branch_id:             branchId,
                        division_id:           values.division_id ?? defaultDivisionId,
                        batch_date:            values.batch_date,
                        customer_contact_id:   values.customer_id,
                        job_receive_manner_id: values.receive_manner_id,
                        performed_by_user_id:  currentUser?.id ?? null,
                    },
                    addedJobs, updatedJobs, deletedJobIds,
                }));

                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.updateJobBatch,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(`Batch #${editBatchNo} updated`);
                setRefreshTrigger(t => t + 1);
                handleReset();
                if (editFromSingleJob) {
                    setEditFromSingleJob(false);
                    onReturnToSingleJob?.();
                } else {
                    setMode(editSourceMode);
                }
            } else {
                const payload = encodeURIComponent(JSON.stringify({
                    sharedData: {
                        branch_id:             branchId,
                        division_id:           values.division_id ?? defaultDivisionId,
                        batch_date:            values.batch_date,
                        customer_contact_id:   values.customer_id,
                        job_receive_manner_id: values.receive_manner_id,
                        job_status_id:         jobStatuses.find(s => s.code === "RECEIVED")?.id ?? null,
                        performed_by_user_id:  currentUser?.id ?? null,
                    },
                    jobs: formRows.map(r => ({
                        job_type_id:              r.job_type_id,
                        product_brand_model_id:   r.product_brand_model_id,
                        alternate_job_no:         r.alternate_job_no || null,
                        serial_no:                r.serial_no || null,
                        problem_reported:         r.problem_reported || null,
                        warranty_card_no:         r.warranty_card_no || null,
                        job_receive_condition_id: r.job_receive_condition_id,
                        remarks:                  r.remarks || null,
                        quantity:                 r.quantity,
                    })),
                }));

                const result  = await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.createJobBatch,
                    variables: { db_name: dbName, schema, value: payload },
                });
                const data    = result.data as { createJobBatch?: { batch_no: number; job_ids: number[]; job_nos: string[] } };
                const batchNo = data?.createJobBatch?.batch_no;
                const jobIds  = data?.createJobBatch?.job_ids  ?? [];
                const jobNos  = data?.createJobBatch?.job_nos  ?? [];

                toast.success(`Batch #${batchNo} created with ${formRows.length} job${formRows.length !== 1 ? "s" : ""}`);
                setRefreshTrigger(t => t + 1);
                form.reset(getBatchJobDefaultValues(defaultDivisionId));

                // Show post-save file attachment panel
                const postJobs: PostSaveJob[] = jobIds.map((id, i) => ({ jobId: id, jobNo: jobNos[i] ?? "" }));
                setPostSaveJobs(postJobs);
                setPostSaveBatchNo(batchNo ?? null);
            }
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
    }, [mode, recalc, jobs.length]);

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

    const loadData = useCallback(async (bId: number, q: string, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bId, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<JobInBatchRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_BATCHES_WITH_JOBS_PAGED, sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE } }) },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_BATCHES_WITH_JOBS_COUNT, sqlArgs: commonArgs }) },
                }),
            ]);
            setJobs(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
        } catch { toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED); }
        finally { setLoading(false); }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId || mode !== "view") return;
        void loadData(Number(branchId), searchQ, page);
    }, [branchId, searchQ, page, loadData, mode]);

    useEffect(() => {
        if (initialEditBatchNo) {
            setEditFromSingleJob(true);
            void handleEdit(initialEditBatchNo);
            onEditBatchNoApplied?.();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialEditBatchNo]);

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
            setEditSourceMode(mode);
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
            if (branchId) void loadData(Number(branchId), searchQ, page);
        } catch { toast.error("Failed to delete batch"); }
        finally { setDeleting(false); }
    };

    const handleDeleteSingleJob = async () => {
        if (!deleteJobId || !dbName || !schema) return;
        if (deleteJobCount <= 2) {
            toast.error("Cannot delete job. A batch must have at least 2 jobs.");
            setDeleteJobId(null);
            return;
        }
        setDeleting(true);
        try {
            // Delete attached files first if any exist
            const fileCount = jobs.find(j => j.id === deleteJobId)?.file_count ?? 0;
            if (fileCount > 0) {
                try {
                    await deleteJobFiles(dbName, schema, deleteJobId);
                } catch (err: unknown) {
                    console.warn(`Failed to delete files for job ${deleteJobId}: ${(err as Error).message}`);
                }
            }
            const payload = encodeURIComponent(JSON.stringify({ tableName: "job", deletedIds: [deleteJobId] }));
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: payload },
            });
            toast.success(`Job #${deleteJobNo} deleted`);
            setDeleteJobId(null);
            setDeleteJobNo("");
            if (branchId) void loadData(Number(branchId), searchQ, page);
        } catch (err: unknown) {
            console.error("Failed to delete job:", err);
            toast.error(`Failed to delete job: ${(err as Error).message}`);
        } finally {
            setDeleting(false);
        }
    };

    const handleViewBatch = async (batchNo: number): Promise<JobDetailType[]> => {
        if (!dbName || !schema) return [];
        setViewBatchNo(batchNo);
        setViewLoading(true);
        setViewJobs([]);
        try {
            const res = await apolloClient.query<GenericQueryData<JobDetailType>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_BATCH_DETAIL, sqlArgs: { batch_no: batchNo } }) },
            });
            const fetched = res.data?.genericQuery ?? [];
            setViewJobs(fetched);
            return fetched;
        } catch { toast.error(MESSAGES.ERROR_JOB_DETAIL_LOAD_FAILED); return []; }
        finally { setViewLoading(false); }
    };

    const handlePrintBatch = (batchJobs: JobDetailType[]) => {
        const firstJob = batchJobs[0];
        const batchDivision = firstJob?.division_id
            ? (availableDivisions.find(d => d.id === firstJob.division_id) ?? currentDivision)
            : currentDivision;
        if (!batchDivision) {
            toast.error("Division info not available");
            return;
        }
        const url = getBatchJobSheetBlobUrl(batchJobs, batchDivision, globalBranch?.code);
        setPdfPreviewUrl(url);
        setPdfFilename(`Batch-Job-Sheet_${batchJobs[0]?.job_no ?? "batch"}.pdf`);
        setShowPdfModal(true);
    };


    const groupedBatches = jobs.reduce<BatchGroup[]>((acc, job) => {
        let group = acc.find(g => g.batch_no === job.batch_no);
        if (!group) {
            group = {
                batch_no: job.batch_no,
                batch_date: job.job_date,
                customer_name: job.customer_name,
                division_id: job.division_id ?? null,
                mobile: job.mobile,
                job_count: 0,
                jobs: [],
            };
            acc.push(group);
        }
        group.jobs.push(job);
        group.job_count = group.jobs.length;
        return acc;
    }, []);

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
                    onNewClick={() => { setEditBatchNo(null); setEditSourceMode("new"); setEditRows([]); handleReset(); setMode("new"); }}
                    onViewClick={() => {
                        setEditBatchNo(null); setEditSourceMode("new"); setEditRows([]); setMode("view");
                        if (branchId) void loadData(Number(branchId), searchQ, page);
                    }}
                />

                <div className={`flex items-center gap-2 ${mode !== "new" ? "hidden md:flex md:invisible pointer-events-none" : ""}`}>
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]"
                        disabled={submitting} variant="ghost"
                        onClick={() => { setEditBatchNo(null); setEditSourceMode("new"); setEditRows([]); handleReset(); }}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${submitting ? "animate-spin" : ""}`} />
                        Reset
                    </Button>
                    <Button
                        className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest transition-all disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                        disabled={!form.formState.isValid || submitting}
                        onClick={form.handleSubmit(executeSave)}
                    >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Batch
                    </Button>
                </div>
            </div>

            {mode === "new" ? (
                <div className="flex-1 overflow-y-auto pb-6 flex flex-col gap-4">
                    {/* Quick info card */}
                    <BatchJobQuickInfoCard
                        refreshTrigger={refreshTrigger}
                        onAttach={postJobs => {
                            setPostSaveJobs(postJobs);
                            setPostSaveBatchNo(null);
                        }}
                        onAttachJob={(jobId, jobNo) => {
                            setAttachJobId(jobId);
                            setAttachJobNo(jobNo);
                        }}
                        onEdit={(batchNo) => void handleEdit(batchNo)}
                        onView={(batchNo) => void handleViewBatch(batchNo)}
                        onPrint={(batchNo) => {
                            if (!dbName || !schema) return;
                            void apolloClient.query<GenericQueryData<JobDetailType>>({
                                fetchPolicy: "network-only",
                                query: GRAPHQL_MAP.genericQuery,
                                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_BATCH_DETAIL, sqlArgs: { batch_no: batchNo } }) },
                            }).then(res => {
                                const detailJobs = res.data?.genericQuery ?? [];
                                if (detailJobs.length > 0) handlePrintBatch(detailJobs);
                                else toast.error("No jobs found in batch");
                            }).catch(() => {
                                toast.error("Failed to load batch for printing");
                            });
                        }}
                    />

                    <FormProvider {...form}>
                        <NewBatchJobForm
                            branchId={branchId}
                            divisions={availableDivisions}
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
                            onAttachFiles={(jobId, jobNo, rowIdx) => { setAttachJobId(jobId); setAttachJobNo(jobNo); setAttachRowIdx(rowIdx ?? null); }}
                            form={form}
                        />
                    </FormProvider>
                </div>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[var(--cl-surface-2)]/30">
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                            <Input className="h-8 border-[var(--cl-border)] bg-white pl-8 text-xs" placeholder="Batch no, customer or mobile…" value={search} onChange={e => handleSearchChange(e.target.value)} />
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
                            <Button className="h-8 px-2.5 text-xs" disabled={loading || !branchId} size="sm" variant="outline" onClick={() => { if (branchId) void loadData(Number(branchId), searchQ, page); }}>
                                <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                        <div ref={scrollWrapperRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: mode === "view" ? maxHeight : undefined }}>
                            {loading ? (
                                <table className="min-w-full border-collapse">
                                    <thead><tr className="bg-[var(--cl-surface-2)]">{["#", "Batch", "Date", "Customer", "Mobile", "Device Details", "Job Type", "Status", "Technician", "Amount", "Actions"].map(h => <th key={h} className={thClass}>{h}</th>)}</tr></thead>
                                    <tbody>{Array.from({ length: 8 }).map((_, i) => (<tr key={i} className="animate-pulse">{Array.from({ length: 11 }).map((__, j) => (<td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-[var(--cl-border)]" /></td>))}</tr>))}</tbody>
                                </table>
                            ) : groupedBatches.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">No batches found for the selected filters.</div>
                            ) : (
                                <table className="min-w-full border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        <tr>
                                            <th className={thClass}>#</th>
                                            <th className={`${thClass} whitespace-nowrap`}>Date</th>
                                            <th className={thClass}>Job</th>
                                            <th className={thClass}>Customer</th>
                                            <th className={thClass}>Mobile</th>
                                            <th className={`${thClass} w-[10rem]`}>Device Details</th>
                                            <th className={thClass}>Job Type</th>
                                            <th className={thClass}>Status</th>
                                            <th className={thClass}>Technician</th>
                                            <th className={`${thClass} text-right`}>Amount</th>
                                            <th className={`${thClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)]`}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                        {groupedBatches.map((batch, groupIdx) => (
                                            <BatchGroupRow
                                                key={batch.batch_no}
                                                availableDivisions={availableDivisions}
                                                batch={batch}
                                                groupIdx={groupIdx}
                                                page={page}
                                                onEdit={() => void handleEdit(batch.batch_no)}
                                                onView={() => void handleViewBatch(batch.batch_no)}
                                                 onPrint={() => {
                                                    if (!dbName || !schema) return;
                                                    void apolloClient.query<GenericQueryData<JobDetailType>>({
                                                        fetchPolicy: "network-only",
                                                        query: GRAPHQL_MAP.genericQuery,
                                                        variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_BATCH_DETAIL, sqlArgs: { batch_no: batch.batch_no } }) },
                                                    }).then(res => {
                                                        const detailJobs = res.data?.genericQuery ?? [];
                                                        handlePrintBatch(detailJobs);
                                                    });
                                                }}
                                                onDelete={() => { setDeleteBatchNo(batch.batch_no); setDeleteJobCount(batch.job_count); }}
                                                onAttachJob={(jobId, jobNo) => { setAttachJobId(jobId); setAttachJobNo(jobNo); }}
                                                onDeleteJob={(jobId, jobNo, _batchNo, jobCount) => { setDeleteJobId(jobId); setDeleteJobNo(jobNo); setDeleteJobCount(jobCount); }}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between border-t border-[var(--cl-border)] px-4 py-2">
                            <span className="text-xs text-[var(--cl-text-muted)]">
                                {total === 0 ? "No batches" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} batch${total !== 1 ? "es" : ""} (Page ${page} of ${totalPages})`}
                            </span>
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
                        <DialogContent aria-describedby={undefined} className="sm:max-w-sm bg-white dark:bg-zinc-950 text-[var(--cl-text)]">
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

                    {/* Delete Single Job Dialog */}
                    <Dialog open={deleteJobId !== null} onOpenChange={open => { if (!open) setDeleteJobId(null); }}>
                        <DialogContent aria-describedby={undefined} className="sm:max-w-sm bg-white dark:bg-zinc-950 text-[var(--cl-text)]">
                            <DialogHeader><DialogTitle>Delete Job #{deleteJobNo}</DialogTitle></DialogHeader>
                            {deleteJobCount <= 2 ? (
                                <p className="text-sm text-red-500">
                                    Cannot delete this job. A batch must have at least 2 jobs. This batch currently has {deleteJobCount} job{deleteJobCount !== 1 ? "s" : ""}.
                                </p>
                            ) : (
                                <p className="text-sm text-[var(--cl-text-muted)]">
                                    This will permanently delete this job. This action cannot be undone.
                                </p>
                            )}
                            <DialogFooter>
                                <Button variant="outline" disabled={deleting} onClick={() => setDeleteJobId(null)}>Cancel</Button>
                                <Button variant="destructive" disabled={deleting || deleteJobCount <= 2} onClick={() => void handleDeleteSingleJob()}>
                                    {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

            {/* Post-save / manual file attachment dialog */}
            <Dialog
                open={postSaveJobs !== null}
                onOpenChange={open => { if (!open) { setPostSaveJobs(null); setPostSaveBatchNo(null); } }}
            >
                <DialogContent
                    aria-describedby={undefined}
                    className="sm:max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-zinc-950 text-[var(--cl-text)]"
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-violet-500" />
                            Attach Files
                            {postSaveBatchNo && <span className="text-sm font-normal text-[var(--cl-text-muted)]">— Batch #{postSaveBatchNo}</span>}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col gap-6 py-2">
                        {(postSaveJobs ?? []).map(job => (
                            <div key={job.jobId} className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-bold text-[var(--cl-accent)]">{job.jobNo}</span>
                                    <span className="text-xs text-[var(--cl-text-muted)]">Job ID: {job.jobId}</span>
                                </div>
                                <JobImageUpload jobId={job.jobId} />
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button onClick={() => { setPostSaveJobs(null); setPostSaveBatchNo(null); }}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </>
        )}

        {/* Attach Files Dialog */}
        <Dialog
            open={attachJobId !== null}
            onOpenChange={open => { if (!open) { setAttachJobId(null); setAttachJobNo(""); setAttachRowIdx(null); setRefreshTrigger(k => k + 1); } }}
        >
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-zinc-950 text-[var(--cl-text)]"
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-violet-500" />
                        Attach Files — Job #{attachJobNo}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-2">
                    {attachJobId !== null && (
                        <JobImageUpload
                            jobId={attachJobId}
                            jobNo={attachJobNo}
                            onFileCountChange={(count: number) => {
                                if (attachRowIdx !== null) {
                                    form.setValue(`rows.${attachRowIdx}.file_count`, count);
                                }
                                // Update jobs array directly for immediate view-mode grid refresh
                                setJobs(prev => prev.map(j => j.id === attachJobId ? { ...j, file_count: count } : j));
                                setRefreshTrigger(k => k + 1);
                                if (branchId) void loadData(Number(branchId), searchQ, page);
                            }}
                        />
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={() => { setAttachJobId(null); setAttachJobNo(""); setAttachRowIdx(null); }}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* View Batch Modal */}
        <BatchJobViewModal
            isOpen={viewBatchNo !== null}
            batchNo={viewBatchNo}
            jobs={viewJobs}
            loading={viewLoading}
            onClose={() => { setViewBatchNo(null); setViewJobs([]); }}
            onPrintBatch={(detailJobs) => {
                handlePrintBatch(detailJobs);
            }}
            onFileCountChange={(jobId, count) => {
                setViewJobs(prev => prev.map(j => j.id === jobId ? { ...j, file_count: count } : j));
                setRefreshTrigger(k => k + 1);
                if (branchId) void loadData(Number(branchId), searchQ, page);
            }}
        />

        {/* PDF Preview Modal */}
        <PdfPreviewModal
            isOpen={showPdfModal}
            pdfUrl={pdfPreviewUrl}
            title={`Job Sheet`}
            filename={pdfFilename}
            onClose={() => {
                setShowPdfModal(false);
                setPdfPreviewUrl(null);
            }}
        />
    </motion.div>
    );
};

// ─── Batch Group Row Component ────────────────────────────────────────────────

type BatchGroupRowProps = {
    availableDivisions: DivisionContextType[];
    batch: BatchGroup;
    groupIdx: number;
    page: number;
    onEdit: () => void;
    onView: () => void;
    onPrint: () => void;
    onDelete: () => void;
    onAttachJob: (jobId: number, jobNo: string) => void;
    onDeleteJob: (jobId: number, jobNo: string, batchNo: number, jobCount: number) => void;
};

function BatchGroupRow({ availableDivisions, batch, onEdit, onView, onPrint, onDelete, onAttachJob, onDeleteJob }: BatchGroupRowProps) {
    const batchDivision = batch.division_id ? availableDivisions.find(d => d.id === batch.division_id) : null;
    return (
        <>
            {/* Batch Header Row */}
            <tr className="bg-[var(--cl-surface-2)]">
                <td colSpan={10} className={`${tdClass} font-bold`}>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-[var(--cl-accent)]">#{batch.batch_no}</span>
                        <span className="text-xs text-[var(--cl-text-muted)]">{batch.batch_date}</span>
                        {batchDivision && (
                            <span className="font-mono text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 rounded px-1.5 py-0.5">
                                {batchDivision.code}
                            </span>
                        )}
                        <span className="text-xs text-[var(--cl-text)]">{batch.customer_name ?? "—"}</span>
                        <span className="text-xs font-mono text-[var(--cl-text-muted)]">{batch.mobile}</span>
                        <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                            {batch.job_count} job{batch.job_count !== 1 ? "s" : ""}
                        </span>
                    </div>
                </td>
                <td className={`${tdClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)] group`}>
                    <div className="flex items-center justify-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="h-8 w-8 p-0 hover:bg-[var(--cl-accent)]/15" variant="ghost">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[160px] bg-white dark:bg-zinc-950 border-[var(--cl-border)] shadow-[0_10px_30px_rgba(0,0,0,0.2)] z-50">
                                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-blue-500 focus:bg-blue-500/10 focus:text-blue-600" onClick={onView}>
                                    <Eye className="h-4 w-4" />
                                    <span>View Batch</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-indigo-500 focus:bg-indigo-500/10 focus:text-indigo-600" onClick={onPrint}>
                                    <Printer className="h-4 w-4" />
                                    <span>Print PDF</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-amber-500 focus:bg-amber-500/10 focus:text-amber-600" onClick={onEdit}>
                                    <Pencil className="h-4 w-4" />
                                    <span>Edit Batch</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-red-500 focus:bg-red-500/10 focus:text-red-600" onClick={onDelete}>
                                    <Trash2 className="h-4 w-4" />
                                    <span>Delete Batch</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </td>
            </tr>

            {/* Job Rows (indented) */}
            {batch.jobs.map((job, jobIdx) => (
                <tr key={job.id} className="group transition-colors hover:bg-[var(--cl-accent)]/5">
                    <td className={`${tdClass} text-[var(--cl-text-muted)] text-xs`}>
                        {batch.batch_no}.{jobIdx + 1}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-xs`}>{job.job_date}</td>
                    <td className={tdClass}>
                        <div className="flex flex-col gap-0.5">
                            <div className="font-mono font-medium text-xs text-[var(--cl-accent)]">
                                {job.job_no}
                                {job.is_closed && (
                                    <span className="ml-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 rounded px-1 py-0.5">CLOSED</span>
                                )}
                            </div>
                            {job.file_count != null && job.file_count >= 0 ? (
                                <button
                                    type="button"
                                    className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 w-fit bg-blue-50 dark:bg-blue-950/40 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                                    onClick={() => onAttachJob(job.id, job.job_no)}
                                >
                                    <Paperclip className="h-2.5 w-2.5" />
                                    <span>{job.file_count} File{job.file_count !== 1 ? "s" : ""}</span>
                                </button>
                            ) : null}
                        </div>
                    </td>
                    <td className={`${tdClass} text-xs`}>{job.customer_name ?? "—"}</td>
                    <td className={`${tdClass} font-mono text-xs`}>{job.mobile}</td>
                    <td className={`${tdClass} text-xs`}>{job.device_details ?? "—"}</td>
                    <td className={`${tdClass} text-xs`}>{job.job_type_name}</td>
                    <td className={`${tdClass} text-xs`}>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                            {job.job_status_name}
                        </span>
                    </td>
                    <td className={`${tdClass} text-xs`}>{job.technician_name ?? "—"}</td>
                    <td className={`${tdClass} text-right text-xs`}>
                        {job.amount != null ? `₹${Number(job.amount).toFixed(2)}` : "—"}
                    </td>
                    <td className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`}>
                        <div className="flex items-center gap-1 justify-center">
                            <Button className="h-7 w-7 p-0 text-violet-500 hover:bg-violet-500/10" variant="ghost" title="Attach Files" onClick={() => onAttachJob(job.id, job.job_no)}>
                                <Paperclip className="h-3.5 w-3.5" />
                            </Button>
                            {batch.job_count > 2 && (
                                <Button className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10" variant="ghost" title="Delete Job" onClick={() => onDeleteJob(job.id, job.job_no, batch.batch_no, batch.job_count)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    </td>
                </tr>
            ))}
        </>
    );
}
