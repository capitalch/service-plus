import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {RotateCcw, ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Loader2, MoreHorizontal, Pencil, RefreshCw, Save, Search, Trash2, X} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
import { currentFinancialYearRange } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { JobDetailType, JobControlRow, JobLookupRow, ModelRow, TechnicianRow } from "@/features/client/types/job";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";
import type { BrandOption, ProductOption } from "@/features/client/types/model";
import type { DocumentSequenceRow } from "@/features/client/types/sales";

import { JobTypeBadge, StatusBadge } from "../job-badges";
import { OpeningJobForm } from "./opening-job-form";
import { openingJobFormSchema, type OpeningJobFormValues, getOpeningJobDefaultValues, normalizeJobNo } from "./opening-job-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1600;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) p-3 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
const tdClass = "p-3 text-sm text-(--cl-text) border-b border-(--cl-border)";

// ─── Component ────────────────────────────────────────────────────────────────

export const OpeningJobSection = () => {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId     = globalBranch?.id ?? null;

    const { from: defaultFrom, to: defaultTo } = currentFinancialYearRange();

    // Filters
    const [fromDate, setFromDate] = useState(defaultFrom);
    const [toDate,   setToDate]   = useState(defaultTo);
    const [search,   setSearch]   = useState("");
    const [searchQ,  setSearchQ]  = useState("");

    // Mode
    const [mode, setMode] = useState<ViewMode>("new");

    // Metadata
    const [docSequences,      setDocSequences]      = useState<DocumentSequenceRow[]>([]);
    const [jobStatuses,       setJobStatuses]       = useState<JobLookupRow[]>([]);
    const [jobTypes,          setJobTypes]          = useState<JobLookupRow[]>([]);
    const [receiveMannners,   setReceiveManners]    = useState<JobLookupRow[]>([]);
    const [receiveConditions, setReceiveConditions] = useState<JobLookupRow[]>([]);
    const [technicians,       setTechnicians]       = useState<TechnicianRow[]>([]);
    const [models,            setModels]            = useState<ModelRow[]>([]);
    const [brands,            setBrands]            = useState<BrandOption[]>([]);
    const [products,          setProducts]          = useState<ProductOption[]>([]);
    const [customerTypes,     setCustomerTypes]     = useState<CustomerTypeOption[]>([]);
    const [masterStates,      setMasterStates]      = useState<StateOption[]>([]);

    // Data
    const [jobs,    setJobs]    = useState<JobControlRow[]>([]);
    const [total,   setTotal]   = useState(0);
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(false);

    // Dialogs
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Edit
    const [editJob, setEditJob] = useState<JobDetailType | null>(null);

    const form = useForm<OpeningJobFormValues>({
        defaultValues: getOpeningJobDefaultValues(),
        mode:          "onChange",
        resolver:      zodResolver(openingJobFormSchema) as any,
    });
    const currentUser = useAppSelector(selectCurrentUser);

    const jobSheetSequence = docSequences.find(
        ds => ds.document_type_code === "JOB_SHEET" && ds.id != null
    ) ?? null;

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

    // Load metadata on mount
    useEffect(() => {
        if (!dbName || !schema || !branchId) return;
        const fetchMeta = async () => {
            try {
                const [statusRes, typeRes, mannerRes, condRes, techRes, modelRes, brandRes, prodRes, custTypeRes, stateRes, seqRes] =
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
                        apolloClient.query<GenericQueryData<DocumentSequenceRow>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_BRANCH_ONLY_DOCUMENT_SEQUENCES, sqlArgs: { branch_id: branchId } }) },
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
                    id: s.id, code: (s as any).gst_state_code ?? s.code, name: s.name,
                })));
                setDocSequences(seqRes.data?.genericQuery ?? []);
            } catch {
                toast.error(MESSAGES.ERROR_OPENING_JOB_LOAD_FAILED);
            }
        };
        void fetchMeta();
    }, [dbName, schema, branchId]);

    const loadData = useCallback(async (bId: number, from: string, to: string, q: string, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bId, from_date: from, to_date: to, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<JobControlRow>>({
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
            toast.error(MESSAGES.ERROR_OPENING_JOB_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId || mode !== "view") return;
        void loadData(Number(branchId), fromDate, toDate, searchQ, page);
    }, [branchId, fromDate, toDate, searchQ, page, loadData, mode]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    };

    const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
        setter(v); setPage(1);
    };

    const handleDelete = async () => {
        if (!deleteId || !dbName || !schema) return;
        setDeleting(true);
        try {
            const payload = encodeObj({ tableName: "job", deletedIds: [deleteId] });
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: payload },
            });
            toast.success(MESSAGES.SUCCESS_OPENING_JOB_DELETED);
            setDeleteId(null);
            if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, page);
        } catch {
            toast.error(MESSAGES.ERROR_OPENING_JOB_DELETE_FAILED);
        } finally {
            setDeleting(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const executeSave = async (values: OpeningJobFormValues) => {
        if (!branchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_OPENING_JOB_CREATE_FAILED);
            return;
        }
        if (!editJob && (!jobSheetSequence || !jobSheetSequence.prefix.trim())) {
            toast.error(MESSAGES.ERROR_DOC_SEQ_JOB_NOT_CONFIGURED);
            return;
        }
        const normalizedJobNo = normalizeJobNo(values.job_no);
        const isWarranty = jobTypes.find(t => t.id === values.job_type_id)?.code === "UNDER_WARRANTY";
        try {
            if (editJob) {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "job",
                    xData: {
                        id:                       editJob.id,
                        job_no:                   normalizedJobNo,
                        job_date:                 values.job_date,
                        customer_contact_id:      values.customer_id,
                        job_type_id:              values.job_type_id,
                        job_receive_manner_id:    values.receive_manner_id,
                        job_receive_condition_id: values.receive_condition_id ?? null,
                        job_status_id:            values.job_status_id,
                        technician_id:            values.technician_id ?? null,
                        product_brand_model_id:   values.model_id ?? null,
                        serial_no:                values.serial_no?.trim() || null,
                        qty:                 values.qty,
                        problem_reported:         values.problem_reported.trim(),
                        diagnosis:                values.diagnosis?.trim() || null,
                        work_done:                values.work_done?.trim() || null,
                        amount:                   values.amount !== "" ? Number(values.amount) : null,
                        delivery_date:            values.delivery_date || null,
                        is_closed:                values.is_closed ?? false,
                        is_final:                 values.is_final ?? false,
                        warranty_card_no:         values.warranty_card_no?.trim() || null,
                        remarks:                  values.remarks?.trim() || null,
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_OPENING_JOB_UPDATED);
            } else {
                const sqlObject = {
                    tableName:         "job",
                    doc_sequence_id:   null,
                    doc_sequence_next: null,
                    xData: {
                        branch_id:                branchId,
                        job_no:                   normalizedJobNo,
                        job_date:                 values.job_date,
                        customer_contact_id:      values.customer_id,
                        job_type_id:              values.job_type_id,
                        job_receive_manner_id:    values.receive_manner_id,
                        job_receive_condition_id: values.receive_condition_id ?? null,
                        job_status_id:            values.job_status_id,
                        technician_id:            values.technician_id ?? null,
                        product_brand_model_id:   values.model_id ?? null,
                        serial_no:                values.serial_no?.trim() || null,
                        qty:                 values.qty,
                        problem_reported:         values.problem_reported.trim(),
                        diagnosis:                values.diagnosis?.trim() || null,
                        work_done:                values.work_done?.trim() || null,
                        amount:                   values.amount !== "" ? Number(values.amount) : null,
                        delivery_date:            values.delivery_date || null,
                        is_closed:                values.is_closed ?? false,
                        is_final:                 values.is_final ?? false,
                        is_warranty:              isWarranty,
                        warranty_card_no:         values.warranty_card_no?.trim() || null,
                        remarks:                  values.remarks?.trim() || null,
                        performed_by_user_id:     currentUser?.id ?? null,
                    },
                };
                const encoded = encodeURIComponent(JSON.stringify(sqlObject));
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.createSingleJob,
                    variables: { db_name: dbName, schema, value: encoded },
                });
                toast.success(MESSAGES.SUCCESS_OPENING_JOB_CREATED);
            }
            form.reset(getOpeningJobDefaultValues());
            if (editJob) {
                setEditJob(null);
                setMode("view");
                if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, 1);
            }
        } catch {
            toast.error(MESSAGES.ERROR_OPENING_JOB_CREATE_FAILED);
        }
    };

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-(--cl-border) bg-(--cl-surface) px-4 py-1">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                        <RotateCcw className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2 overflow-hidden">
                        <h1 className="text-lg font-bold text-(--cl-text) truncate">
                            Opening Jobs
                            {mode === "new" && !editJob && <span className="ml-2 text-sm font-medium text-(--cl-text-muted) whitespace-nowrap">— New</span>}
                            {mode === "new" &&  editJob && <span className="ml-2 text-sm font-medium text-amber-500 whitespace-nowrap">— Edit</span>}
                            {mode === "view" && <span className="ml-2 text-sm font-medium text-(--cl-text-muted) whitespace-nowrap">— View</span>}
                        </h1>
                        {mode === "view" && (
                            <span className="text-xs text-(--cl-text-muted) whitespace-nowrap">
                                {loading ? "Loading…" : `(${total})`}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1" />

                <ViewModeToggle
                    isEditing={!!editJob}
                    mode={mode}
                    onNewClick={() => { setEditJob(null); setMode("new"); }}
                    onViewClick={() => {
                        setEditJob(null);
                        setMode("view");
                        if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, page);
                    }}
                />

                {/* Reset · Save — hidden in view mode */}
                <div className={`flex items-center gap-2 ${mode !== "new" ? "hidden md:flex md:invisible pointer-events-none" : ""}`}>
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-(--cl-text)"
                        disabled={form.formState.isSubmitting}
                        variant="ghost"
                        onClick={() => { setEditJob(null); form.reset(getOpeningJobDefaultValues()); }}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${form.formState.isSubmitting ? "animate-spin" : ""}`} />
                        Reset
                    </Button>
                    <Button
                        className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest transition-all disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                        disabled={!form.formState.isValid || form.formState.isSubmitting}
                        onClick={form.handleSubmit(executeSave)}
                    >
                        {form.formState.isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Job
                    </Button>
                </div>
            </div>

            {mode === "new" ? (
                <div className="flex-1 overflow-y-auto">
                    <FormProvider {...form}>
                        <OpeningJobForm
                            branchId={branchId}
                            brands={brands}
                            customerTypes={customerTypes}
                            editJob={editJob}
                            jobStatuses={jobStatuses}
                            jobTypes={jobTypes}
                            masterStates={masterStates}
                            models={models}
                            products={products}
                            receiveConditions={receiveConditions}
                            receiveMannners={receiveMannners}
                            technicians={technicians}
                            onRefreshModels={refreshModels}
                        />
                    </FormProvider>
                </div>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-(--cl-surface-2)/30">
                        <div className="flex items-center gap-1">
                            <Input
                                className="h-8 w-32 border-(--cl-border) bg-(--cl-surface) text-xs"
                                disabled={loading}
                                type="date"
                                value={fromDate}
                                onChange={e => handleFilterChange(setFromDate)(e.target.value)}
                            />
                            <span className="text-(--cl-text-muted) text-xs">—</span>
                            <Input
                                className="h-8 w-32 border-(--cl-border) bg-(--cl-surface) text-xs"
                                disabled={loading}
                                type="date"
                                value={toDate}
                                onChange={e => handleFilterChange(setToDate)(e.target.value)}
                            />
                        </div>
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                            <Input
                                className="h-8 border-(--cl-border) bg-(--cl-surface) pl-8 text-xs"
                                placeholder="Job no, customer or mobile…"
                                value={search}
                                onChange={e => handleSearchChange(e.target.value)}
                            />
                            {search && (
                                <button
                                    className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface) hover:bg-(--cl-text) focus:outline-none"
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
                                onClick={() => { if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, page); }}
                            >
                                <RefreshCw className="mr-1.5 h-3 w-3" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Data Grid */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm">
                        <div
                            ref={scrollWrapperRef}
                            className="flex-1 overflow-x-auto overflow-y-auto"
                            style={{ maxHeight: mode === "view" ? maxHeight : undefined }}
                        >
                            {loading ? (
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr className="bg-(--cl-surface-2)">
                                            {["#", "Date", "Job No", "Customer", "Mobile", "Job Type", "Status", "Technician", "Amount", "Actions"].map(h => (
                                                <th key={h} className={thClass}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({ length: 12 }).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                {Array.from({ length: 10 }).map((__, j) => (
                                                    <td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-(--cl-border)" /></td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : jobs.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                                    No opening jobs found for the selected filters.
                                </div>
                            ) : (
                                <table className="min-w-full border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        <tr>
                                            <th className={thClass}>#</th>
                                            <th className={thClass}>Date</th>
                                            <th className={thClass}>Job No</th>
                                            <th className={thClass}>Customer</th>
                                            <th className={thClass}>Mobile</th>
                                            <th className={thClass}>Job Type</th>
                                            <th className={thClass}>Status</th>
                                            <th className={thClass}>Technician</th>
                                            <th className={`${thClass} text-right`}>Amount</th>
                                            <th className={`${thClass} sticky right-0 z-20 !bg-(--cl-surface-2)`}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-(--cl-border) bg-(--cl-surface)">
                                        {jobs.map((job, idx) => (
                                            <tr key={job.id} className="group transition-colors hover:bg-(--cl-accent)/5">
                                                <td className={`${tdClass} text-(--cl-text-muted)`}>
                                                    {(page - 1) * PAGE_SIZE + idx + 1}
                                                </td>
                                                <td className={tdClass}>{job.job_date}</td>
                                                <td className={`${tdClass} font-mono font-medium text-(--cl-accent)`}>
                                                    {job.job_no}
                                                    {job.is_closed && (
                                                        <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 rounded px-1 py-0.5">CLOSED</span>
                                                    )}
                                                </td>
                                                <td className={tdClass}>{job.customer_name ?? "—"}</td>
                                                <td className={`${tdClass} font-mono text-xs`}>{job.mobile}</td>
                                                <td className={tdClass}>
                                                    <JobTypeBadge code={job.job_type_code} name={job.job_type_name} />
                                                </td>
                                                <td className={tdClass}>
                                                    <StatusBadge code={job.job_status_code} name={job.job_status_name} />
                                                </td>
                                                <td className={tdClass}>{job.technician_name ?? "—"}</td>
                                                <td className={`${tdClass} text-right`}>
                                                    {job.amount != null ? `₹${Number(job.amount).toFixed(2)}` : "—"}
                                                </td>
                                                <td className={`${tdClass} sticky right-0 z-10 bg-(--cl-surface) group-hover:bg-(--cl-surface-2)`}>
                                                    <div className="flex items-center justify-center">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button className="h-8 w-8 p-0 hover:bg-(--cl-accent)/15" variant="ghost">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                    <span className="sr-only">Open menu</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-[140px] bg-white dark:bg-zinc-950 border-(--cl-border) shadow-[0_10px_30px_rgba(0,0,0,0.2)] z-50">
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer text-amber-500 focus:bg-amber-500/10 focus:text-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                                                    disabled={!!job.is_final}
                                                                    title={job.is_final ? "Job is finalized — edit not allowed" : undefined}
                                                                    onClick={() => { if (!job.is_final) { setEditJob(job as unknown as JobDetailType); setMode("new"); } }}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                    <span>Edit Job</span>
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
                        <div className="flex items-center justify-between border-t border-(--cl-border) px-4 py-2">
                            <span className="text-xs text-(--cl-text-muted)">
                                {total === 0 ? "No jobs" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} jobs (Page ${page} of ${totalPages})`}
                            </span>
                            <div className="flex items-center gap-1">
                                <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="First page" variant="ghost" onClick={() => setPage(1)}>
                                    <ChevronsLeftIcon className="h-4 w-4" />
                                </Button>
                                <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="Previous page" variant="ghost" onClick={() => setPage(p => p - 1)}>
                                    <ChevronLeftIcon className="h-4 w-4" />
                                </Button>
                                <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Next page" variant="ghost" onClick={() => setPage(p => p + 1)}>
                                    <ChevronRightIcon className="h-4 w-4" />
                                </Button>
                                <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Last page" variant="ghost" onClick={() => setPage(totalPages)}>
                                    <ChevronsRightIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Delete Confirm Dialog */}
                    <Dialog open={deleteId !== null} onOpenChange={open => { if (!open && !deleting) setDeleteId(null); }}>
                        <DialogContent aria-describedby={undefined} className="sm:max-w-sm !bg-(--cl-surface) text-(--cl-text)">
                            <DialogHeader>
                                <DialogTitle>Delete Opening Job</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-(--cl-text-muted)">
                                This will permanently delete the opening job and all associated records. This action cannot be undone.
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
        </motion.div>
    );
};
