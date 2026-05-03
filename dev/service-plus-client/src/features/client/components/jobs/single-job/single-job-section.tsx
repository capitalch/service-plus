import { useCallback, useEffect, useRef, useState } from "react";
import {Briefcase, ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon, Eye,
    Loader2, MoreHorizontal, Paperclip, Pencil, Printer, RefreshCw, Save, Search, Trash2, X} from "lucide-react";
import { SingleJobViewModal } from "./single-job-view-modal";
import { toast } from "sonner";
import { motion } from "framer-motion";


import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { singleJobFormSchema, type SingleJobFormValues, getSingleJobDefaultValues } from "./single-job-schema";
import { deleteJobFiles } from "@/lib/image-service";

import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import { ViewModeToggle, type ViewMode } from "@/features/client/components/inventory/view-mode-toggle";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";

import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { JobDetailType, JobListRow, JobLookupRow, ModelRow, TechnicianRow } from "@/features/client/types/job";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";
import type { BrandOption, ProductOption } from "@/features/client/types/model";

import { NewSingleJobForm } from "./new-single-job-form";
import { JobAttachDialog } from "./job-attach-dialog";
import { getJobSheetBlobUrl, type CompanyInfoType } from "./single-job-sheet-pdf";
import { PdfPreviewModal } from "@/components/shared/pdf-preview-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const DEBOUNCE_MS = 1200;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const SingleJobSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId = globalBranch?.id ?? null;

    // Filters
    const [search, setSearch] = useState("");
    const [searchQ, setSearchQ] = useState("");

    // Mode
    const [mode, setMode] = useState<ViewMode>("new");

    // Metadata
    const [jobStatuses, setJobStatuses] = useState<JobLookupRow[]>([]);
    const [jobTypes, setJobTypes] = useState<JobLookupRow[]>([]);
    const [receiveMannners, setReceiveManners] = useState<JobLookupRow[]>([]);
    const [receiveConditions, setReceiveConditions] = useState<JobLookupRow[]>([]);
    const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
    const [models, setModels] = useState<ModelRow[]>([]);
    const [brands, setBrands] = useState<BrandOption[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [customerTypes, setCustomerTypes] = useState<CustomerTypeOption[]>([]);
    const [masterStates, setMasterStates] = useState<StateOption[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfoType | null>(null);
    const [jobs, setJobs] = useState<JobListRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    // Dialogs
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Edit / View
    const [editJob, setEditJob] = useState<JobDetailType | null>(null);
    const [viewJob, setViewJob] = useState<JobDetailType | null>(null);

    // PDF Preview
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [pdfFilename, setPdfFilename] = useState<string>("Job-Sheet.pdf");
    const [showPdfModal, setShowPdfModal] = useState(false);

    // Attach Files dialog
    const [attachJobId,  setAttachJobId]  = useState<number | null>(null);
    const [attachJobNo,  setAttachJobNo]  = useState<string>("");
    const [attachMode,   setAttachMode]   = useState<"attach" | "view">("attach");

    // Quick info card refresh key — increment to trigger re-fetch
    const [quickInfoKey, setQuickInfoKey] = useState(0);

    // Form
    const [submitting, setSubmitting] = useState(false);
    const currentUser = useAppSelector(selectCurrentUser);

    const form = useForm<SingleJobFormValues>({
        defaultValues: getSingleJobDefaultValues(),
        mode: "onChange",
        resolver: zodResolver(singleJobFormSchema) as unknown as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const executeSave = async (values: SingleJobFormValues) => {
        if (!branchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_JOB_CREATE_FAILED);
            return;
        }
        setSubmitting(true);
        try {
            if (editJob) {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "job",
                    xData: {
                        id:                       editJob.id,
                        customer_contact_id:      values.customer_id,
                        job_date:                 values.job_date,
                        job_type_id:              values.job_type_id,
                        job_receive_manner_id:    values.receive_manner_id,
                        job_receive_condition_id: values.receive_condition_id ?? null,
                        job_status_id:            values.job_status_id ?? null,
                        product_brand_model_id:   values.model_id ?? null,
                        serial_no:                values.serial_no?.trim() || null,
                        quantity:                 values.quantity,
                        problem_reported:         values.problem_reported?.trim() ?? "",
                        warranty_card_no:         values.warranty_card_no?.trim() || null,
                        remarks:                  values.remarks?.trim() || null,
                        address_snapshot:         values.address_snapshot?.trim() || null,
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_JOB_UPDATED);
            } else {
                const receivedStatusId = jobStatuses.find(s => s.code === "RECEIVED")?.id ?? null;
                const sqlObject = {
                    tableName:         "job",
                    xData: {
                        branch_id:                branchId,
                        job_date:                 values.job_date,
                        customer_contact_id:      values.customer_id,
                        job_type_id:              values.job_type_id,
                        job_receive_manner_id:    values.receive_manner_id,
                        job_receive_condition_id: values.receive_condition_id || null,
                        job_status_id:            receivedStatusId,
                        product_brand_model_id:   values.model_id || null,
                        serial_no:                values.serial_no?.trim() || null,
                        quantity:                 values.quantity,
                        problem_reported:         values.problem_reported?.trim() || null,
                        warranty_card_no:         values.warranty_card_no?.trim() || null,
                        remarks:                  values.remarks?.trim() || null,
                        performed_by_user_id:     currentUser?.id || null,
                        address_snapshot:         values.address_snapshot?.trim() || null,
                    },
                };
                const encoded  = encodeURIComponent(JSON.stringify(sqlObject));
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.createSingleJob,
                    variables: { db_name: dbName, schema, value: encoded },
                });
                toast.success(MESSAGES.SUCCESS_JOB_CREATED);
                setQuickInfoKey(k => k + 1);
            }
            form.reset(getSingleJobDefaultValues());
            // call onSuccess manually
            if (editJob) {
                setEditJob(null);
                setMode("view");
                if (branchId) void loadData(Number(branchId), searchQ, 1);
            }
        } catch {
            toast.error(editJob ? MESSAGES.ERROR_JOB_UPDATE_FAILED : MESSAGES.ERROR_JOB_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    // Load metadata on mount
    useEffect(() => {
        if (!dbName || !schema || !branchId) return;
        const fetchMeta = async () => {
            try {
                const [statusRes, typeRes, mannerRes, condRes, techRes, modelRes, brandRes, prodRes, custTypeRes, stateRes, compRes] =
                    await Promise.all([
                        apolloClient.query<GenericQueryData<JobLookupRow>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_STATUSES }) },
                        }),
                        apolloClient.query<GenericQueryData<JobLookupRow>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_TYPES }) },
                        }),
                        apolloClient.query<GenericQueryData<JobLookupRow>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_RECEIVE_MANNERS }) },
                        }),
                        apolloClient.query<GenericQueryData<JobLookupRow>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_RECEIVE_CONDITIONS }) },
                        }),
                        apolloClient.query<GenericQueryData<TechnicianRow>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_TECHNICIANS, sqlArgs: { branch_id: branchId } }) },
                        }),
                        apolloClient.query<GenericQueryData<ModelRow>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_MODELS }) },
                        }),
                        apolloClient.query<GenericQueryData<BrandOption>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }) },
                        }),
                        apolloClient.query<GenericQueryData<ProductOption>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_PRODUCTS }) },
                        }),
                        apolloClient.query<GenericQueryData<CustomerTypeOption>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_CUSTOMER_TYPES }) },
                        }),
                        apolloClient.query<GenericQueryData<StateOption>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_STATES }) },
                        }),
                        apolloClient.query<GenericQueryData<CompanyInfoType>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_COMPANY_INFO }) },
                        }),
                    ]);
                setJobStatuses(statusRes.data?.genericQuery ?? []);
                setJobTypes(typeRes.data?.genericQuery ?? []);
                setReceiveManners(mannerRes.data?.genericQuery ?? []);
                setReceiveConditions(condRes.data?.genericQuery ?? []);
                setTechnicians(techRes.data?.genericQuery ?? []);
                setModels(modelRes.data?.genericQuery ?? []);
                setBrands(brandRes.data?.genericQuery ?? []);
                setProducts(prodRes.data?.genericQuery ?? []);
                setCustomerTypes(custTypeRes.data?.genericQuery ?? []);
                setMasterStates((stateRes.data?.genericQuery ?? []).map(s => ({
                    id: s.id, code: (s as { gst_state_code?: string }).gst_state_code ?? s.code, name: s.name,
                })));
                setCompanyInfo(compRes.data?.genericQuery?.[0] ?? null);
            } catch {
                toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED);
            }
        };
        void fetchMeta();
    }, [dbName, schema, branchId]);

    const loadData = useCallback(async (bId: number, q: string, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bId, search: q, from_date: "2000-01-01", to_date: "3000-12-31" };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<JobListRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOBS_PAGED,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOBS_COUNT,
                            sqlArgs: commonArgs,
                        }),
                    },
                }),
            ]);
            setJobs(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId) return;
        if (mode === "view") {
            void loadData(Number(branchId), searchQ, page);
        }

    }, [branchId, mode, loadData]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    };

    const handleDelete = async () => {
        if (!deleteId || !dbName || !schema) return;
        setDeleting(true);
        try {
            // Delete attached files first if any exist
            const fileCount = jobs.find(j => j.id === deleteId)?.file_count ?? 0;
            if (fileCount > 0) {
                try {
                    await deleteJobFiles(dbName, schema, deleteId);
                } catch (err: unknown) {
                    console.warn(`Failed to delete files for job ${deleteId}: ${(err as Error).message}`);
                }
            }
            const payload = encodeObj({ tableName: "job", deletedIds: [deleteId] });
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: payload },
            });
            toast.success(MESSAGES.SUCCESS_JOB_DELETED);
            setDeleteId(null);
            if (branchId) void loadData(Number(branchId), searchQ, page);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_DELETE_FAILED);
        } finally {
            setDeleting(false);
        }
    };

    const handleViewJob = async (job: JobListRow) => {
        if (!dbName || !schema) return;
        const loadingToast = toast.loading(MESSAGES.INFO_JOB_DETAIL_LOADING);

        try {
            const res = await apolloClient.query<GenericQueryData<JobDetailType>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_JOB_DETAIL,
                        sqlArgs: { id: job.id },
                    }),
                },
            });

            const details = res.data?.genericQuery?.[0];
            if (!details) {
                toast.error(MESSAGES.ERROR_JOB_DETAIL_LOAD_FAILED, { id: loadingToast });
                return;
            }

            toast.dismiss(loadingToast);
            setViewJob(details);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_DETAIL_LOAD_FAILED, { id: loadingToast });
        }
    };

    const handlePrintFromView = () => {
        if (!viewJob) return;
        const url = getJobSheetBlobUrl(viewJob, companyInfo);
        setPdfPreviewUrl(url);
        setPdfFilename(`Job-Sheet_${viewJob.job_date}_${viewJob.customer_name || "customer"}.pdf`);
        setShowPdfModal(true);
    };

    const handlePrintPdf = async (job: JobListRow) => {
        if (!dbName || !schema) return;
        const loadingToast = toast.loading(MESSAGES.INFO_JOB_DETAIL_LOADING);
        try {
            const res = await apolloClient.query<GenericQueryData<JobDetailType>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_JOB_DETAIL,
                        sqlArgs: { id: job.id },
                    }),
                },
            });
            const details = res.data?.genericQuery?.[0];
            if (!details) {
                toast.error(MESSAGES.ERROR_JOB_DETAIL_LOAD_FAILED, { id: loadingToast });
                return;
            }
            toast.dismiss(loadingToast);
            const url = getJobSheetBlobUrl(details, companyInfo);
            setPdfPreviewUrl(url);
            setPdfFilename(`Job-Sheet_${details.job_date}_${details.customer_name || "customer"}.pdf`);
            setShowPdfModal(true);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_DETAIL_LOAD_FAILED, { id: loadingToast });
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-1">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                        <Briefcase className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2 overflow-hidden">
                        <h1 className="text-lg font-bold text-[var(--cl-text)] truncate">
                            Single Job
                            {mode === "new" && !editJob && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)] whitespace-nowrap">— New</span>}
                            {mode === "new" && editJob && <span className="ml-2 text-sm font-medium text-amber-500 whitespace-nowrap">— Edit</span>}
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
                    isEditing={!!editJob}
                    onNewClick={() => { setEditJob(null); setMode("new"); }}
                    onViewClick={() => {
                        setEditJob(null);
                        setMode("view");
                    }}
                />

                {/* Reset · Save — hidden in view mode */}
                <div className={`flex items-center gap-2 ${mode !== "new" ? "hidden md:flex md:invisible pointer-events-none" : ""}`}>
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]"
                        disabled={submitting}
                        variant="ghost"
                        onClick={() => { setEditJob(null); }}
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
                        Save Job
                    </Button>
                </div>
            </div>

            {mode === "new" ? (
                <div className="flex-1 overflow-y-auto">
                    <FormProvider {...form}>
                        <NewSingleJobForm
                        branchId={branchId}
                        
                        jobStatuses={jobStatuses}
                        jobTypes={jobTypes}
                        receiveMannners={receiveMannners}
                        receiveConditions={receiveConditions}
                        technicians={technicians}
                        models={models}
                        brands={brands}
                        products={products}
                        customerTypes={customerTypes}
                        masterStates={masterStates}
                        editJob={editJob}
                        onRefreshModels={refreshModels}
                        onViewJob={(j: JobListRow) => void handleViewJob(j)}
                        onPrintPdf={(j: JobListRow) => void handlePrintPdf(j)}
                        onAttachFiles={(jobNo: string, jobId: number) => { setAttachJobId(jobId); setAttachJobNo(jobNo); setAttachMode("attach"); }}
                        refreshTrigger={quickInfoKey}
                        />
                    </FormProvider>
                </div>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[var(--cl-surface-2)]/30">
                        <div className="relative flex-1 sm:max-w-md">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                            <Input
                                className="h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-8 text-xs"
                                disabled={loading}
                                placeholder="Job no, customer, mobile, model, brand, sl no"
                                value={search}
                                onChange={e => handleSearchChange(e.target.value)}
                            />
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
                            <Button
                                className="h-8 px-2.5 text-xs"
                                disabled={loading || !branchId}
                                size="sm"
                                variant="outline"
                                onClick={() => { if (branchId) void loadData(Number(branchId), searchQ, page); }}
                            >
                                <RefreshCw className="mr-1.5 h-3 w-3" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Data Grid */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                        <div
                            ref={scrollWrapperRef}
                            className="flex-1 overflow-x-auto overflow-y-auto"
                            style={{ maxHeight: mode === "view" ? maxHeight : undefined }}
                        >
                            {loading ? (
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr className="bg-[var(--cl-surface-2)]">
                                            {["#", "Date", "Job", "Customer", "Mobile", "Device Details", "Job Type", "Status", "Technician", "Amount", "Actions"].map(h => (
                                                <th key={h} className={thClass}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({ length: 12 }).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                {Array.from({ length: 11 }).map((__, j) => (
                                                    <td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-[var(--cl-border)]" /></td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : jobs.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                                    No jobs found for the selected filters.
                                </div>
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
                                        {jobs.map((job, idx) => (
                                            <tr key={job.id} className="group transition-colors hover:bg-[var(--cl-accent)]/5">
                                                <td className={`${tdClass} text-[var(--cl-text-muted)]`}>
                                                    {(page - 1) * PAGE_SIZE + idx + 1}
                                                </td>
                                                <td className={`${tdClass} whitespace-nowrap`}>{job.job_date}</td>
                                                <td className={tdClass}>
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="font-mono font-medium text-[var(--cl-text)]">
                                                            {job.job_no}
                                                            {job.is_closed && (
                                                                <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 rounded px-1 py-0.5">CLOSED</span>
                                                            )}
                                                        </div>
                                                        {job.file_count > 0 && (
                                                            <button
                                                                type="button"
                                                                className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer bg-blue-50 dark:bg-blue-950/40 rounded px-1.5 py-0.5 w-fit border-0 transition-colors"
                                                                onClick={() => { setAttachJobId(job.id); setAttachJobNo(job.job_no); setAttachMode("view"); }}
                                                            >
                                                                <Paperclip className="h-2.5 w-2.5" />
                                                                <span>{job.file_count} File{job.file_count !== 1 ? "s" : ""}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className={tdClass}>{job.customer_name ?? "—"}</td>
                                                <td className={`${tdClass} font-mono text-xs`}>{job.mobile}</td>
                                                <td className={`${tdClass} text-xs`}>{job.device_details || "—"}</td>
                                                <td className={tdClass}>{job.job_type_name}</td>
                                                <td className={tdClass}>
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                                                        {job.job_status_name}
                                                    </span>
                                                </td>
                                                <td className={tdClass}>{job.technician_name ?? "—"}</td>
                                                <td className={`${tdClass} text-right`}>
                                                    {job.amount != null ? `₹${Number(job.amount).toFixed(2)}` : "—"}
                                                </td>
                                                <td className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`}>
                                                    <div className="flex items-center justify-center">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button className="h-8 w-8 p-0 hover:bg-[var(--cl-accent)]/15" variant="ghost">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                    <span className="sr-only">Open menu</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-[140px] bg-white dark:bg-zinc-950 border-[var(--cl-border)] shadow-[0_10px_30px_rgba(0,0,0,0.2)] z-50">
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer text-amber-500 focus:bg-amber-500/10 focus:text-amber-600"
                                                                    onClick={() => { setEditJob(job as unknown as JobDetailType); setMode("new"); }}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                    <span>Edit Job</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer text-blue-500 focus:bg-blue-500/10 focus:text-blue-600 font-semibold"
                                                                    onClick={() => void handleViewJob(job)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                    <span>View Job</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer text-indigo-500 focus:bg-indigo-500/10 focus:text-indigo-600 font-semibold"
                                                                    onClick={() => void handlePrintPdf(job)}
                                                                >
                                                                    <Printer className="h-4 w-4" />
                                                                    <span>Print PDF</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer text-violet-500 focus:bg-violet-500/10 focus:text-violet-600 font-semibold"
                                                                    onClick={() => { setAttachJobId(job.id); setAttachJobNo(job.job_no); setAttachMode("attach"); }}
                                                                >
                                                                    <Paperclip className="h-4 w-4" />
                                                                    <span>Attach Files</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer text-red-500 focus:bg-red-500/10 focus:text-red-600 font-semibold"
                                                                    onClick={() => setDeleteId(job.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    <span>Delete Job</span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
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
                            <span className="text-xs text-[var(--cl-text-muted)]">
                                Page {page} of {totalPages} · {total} records
                            </span>
                            <div className="flex items-center gap-1">
                                <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" variant="ghost" title="First page" onClick={() => setPage(1)}>
                                    <ChevronsLeftIcon className="h-4 w-4" />
                                </Button>
                                <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" variant="ghost" title="Previous page" onClick={() => setPage(p => p - 1)}>
                                    <ChevronLeftIcon className="h-4 w-4" />
                                </Button>
                                <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" variant="ghost" title="Next page" onClick={() => setPage(p => p + 1)}>
                                    <ChevronRightIcon className="h-4 w-4" />
                                </Button>
                                <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" variant="ghost" title="Last page" onClick={() => setPage(totalPages)}>
                                    <ChevronsRightIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Delete Confirm Dialog */}
                    <Dialog open={deleteId !== null} onOpenChange={open => { if (!open && !deleting) setDeleteId(null); }}>
                        <DialogContent aria-describedby={undefined} className="sm:max-w-sm bg-white dark:bg-zinc-950 text-[var(--cl-text)] shadow-2xl border border-[var(--cl-border)]">
                            <DialogHeader>
                                <DialogTitle>Delete Job</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-[var(--cl-text-muted)]">
                                This will permanently delete the job and all associated records. This action cannot be undone.
                            </p>
                            <DialogFooter>
                                <Button disabled={deleting} variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                                <Button disabled={deleting} variant="destructive" onClick={() => void handleDelete()}>
                                    {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>


                </>
            )}

            {/* Shared dialogs - visible in both new and view modes */}
            <SingleJobViewModal
                isOpen={viewJob !== null}
                job={viewJob}
                onClose={() => setViewJob(null)}
                onPrint={handlePrintFromView}
            />

             <JobAttachDialog
                 jobId={attachJobId}
                 jobNo={attachJobNo}
                 mode={attachMode}
                 onFilesChanged={() => {
                     setQuickInfoKey(k => k + 1);
                     if (branchId) void loadData(Number(branchId), searchQ, page);
                 }}
                 onClose={() => { setAttachJobId(null); setAttachJobNo(""); setAttachMode("attach"); }}
             />

            <PdfPreviewModal
                isOpen={showPdfModal}
                pdfUrl={pdfPreviewUrl}
                title={`Job Sheet #${viewJob?.job_no || ""}`}
                filename={pdfFilename}
                onClose={() => {
                    setShowPdfModal(false);
                    setPdfPreviewUrl(null);
                }}
            />
        </motion.div>
    );
};
