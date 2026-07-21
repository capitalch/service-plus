import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers, Play, Search, X } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerInput } from "@/features/client/components/shared/customer-select";
import { PdfPreviewModal } from "@/components/shared/pdf-preview-modal";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectAvailableDivisions, selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";
import type { CustomerSearchRow } from "@/features/client/types/sales";
import type { TechnicianRow, WarrantyBatchJobRow } from "@/features/client/types/job";
import { JobDetailsModal } from "../job-pipeline/job-details-modal";
import { buildDeliveryNotePdf, type DeliveryNoteJobInfo } from "../deliver-job/deliver-job-pdf";

import { WarrantyJobsGrid } from "./warranty-jobs-grid";
import { BatchResultsModal } from "./batch-results-modal";
import { executeBatch, type ExecResult } from "./batch-execute";
import { ProcessJobsModal, type ProcessJobsArgs } from "./process-jobs-modal";

type GenericQueryData<T> = { genericQuery: T[] | null };
type DeliveryMannerRow = { id: number; name: string };

export function BatchWarrantySection() {
    const dbName      = useAppSelector(selectDbName);
    const schema      = useAppSelector(selectSchema);
    const currentUser = useAppSelector(selectCurrentUser);
    const branch      = useAppSelector(selectCurrentBranch);
    const availableDivisions = useAppSelector(selectAvailableDivisions);
    const branchId    = branch?.id ?? null;

    // ── Meta (fetched once per branch) ───────────────────────────────────────
    const [customerTypes, setCustomerTypes]   = useState<CustomerTypeOption[]>([]);
    const [masterStates,  setMasterStates]    = useState<StateOption[]>([]);
    const [technicians,   setTechnicians]     = useState<TechnicianRow[]>([]);
    const [deliveryManners, setDeliveryManners] = useState<DeliveryMannerRow[]>([]);
    const [deliveredOkStatusId, setDeliveredOkStatusId] = useState<number | null>(null);

    useEffect(() => {
        if (!dbName || !schema || !branchId) return;
        const gq = <T,>(sqlId: string, sqlArgs?: Record<string, unknown>) =>
            apolloClient.query<GenericQueryData<T>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }) },
            });
        void gq<CustomerTypeOption>(SQL_MAP.GET_ALL_CUSTOMER_TYPES).then(res => setCustomerTypes(res.data?.genericQuery ?? []));
        void gq<StateOption>(SQL_MAP.GET_ALL_STATES).then(res => setMasterStates(res.data?.genericQuery ?? []));
        void gq<TechnicianRow>(SQL_MAP.GET_ALL_TECHNICIANS, { branch_id: branchId }).then(res => setTechnicians(res.data?.genericQuery ?? []));
        void gq<DeliveryMannerRow>(SQL_MAP.GET_JOB_DELIVERY_MANNERS).then(res => setDeliveryManners(res.data?.genericQuery ?? []));
        void gq<{ id: number; code: string }>(SQL_MAP.GET_JOB_STATUSES).then(res => {
            const statuses = res.data?.genericQuery ?? [];
            setDeliveredOkStatusId(statuses.find(s => s.code === "DELIVERED_OK")?.id ?? null);
        });
    }, [dbName, schema, branchId]);

    // ── Customer selection ────────────────────────────────────────────────────
    const [customerId,      setCustomerId]      = useState<number | null>(null);
    const [customerName,    setCustomerName]    = useState("");
    const [customerMobile,  setCustomerMobile]  = useState<string | null>(null);
    const [customerAddress, setCustomerAddress] = useState<string | null>(null);

    // ── Eligible jobs for the selected customer ───────────────────────────────
    const [jobs,        setJobs]        = useState<WarrantyBatchJobRow[]>([]);
    const [jobsLoading,  setJobsLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [gridSearch,  setGridSearch]  = useState("");

    const loadJobs = useCallback(async (custId: number) => {
        if (!dbName || !schema || !branchId) return;
        setJobsLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryData<WarrantyBatchJobRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_WARRANTY_JOBS_BY_CUSTOMER,
                        sqlArgs: { customer_contact_id: custId, branch_id: branchId },
                    }),
                },
            });
            setJobs(res.data?.genericQuery ?? []);
        } catch {
            toast.error("Failed to load warranty jobs for this customer.");
            setJobs([]);
        } finally {
            setJobsLoading(false);
        }
    }, [dbName, schema, branchId]);

    useEffect(() => {
        setSelectedIds(new Set());
        setGridSearch("");
        if (customerId != null) void loadJobs(customerId);
        else setJobs([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerId, loadJobs]);

    function handleCustomerSelect(c: CustomerSearchRow) {
        setCustomerId(c.id);
        setCustomerName(c.full_name ?? c.mobile);
        setCustomerMobile(c.mobile ?? null);
        setCustomerAddress(c.address_line1 ?? null);
    }

    function handleCustomerClear() {
        setCustomerId(null);
        setCustomerName("");
        setCustomerMobile(null);
        setCustomerAddress(null);
    }

    function handleCustomerChange(name: string) {
        setCustomerName(name);
        if (!name.trim()) handleCustomerClear();
    }

    function handleSelectionChange(id: number, checked: boolean) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    }

    const selectedJobs = useMemo(() => jobs.filter(j => selectedIds.has(j.id)), [jobs, selectedIds]);

    // ── Process modal + execution ─────────────────────────────────────────────
    const [showProcessModal, setShowProcessModal] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [results,   setResults]   = useState<ExecResult[] | null>(null);
    const [viewJobId, setViewJobId] = useState<number | null>(null);

    // Jobs actually delivered in the last run, so "Job Delivery Note" only
    // enables once at least one job in the batch was successfully delivered.
    const [deliveredJobIds, setDeliveredJobIds] = useState<Set<number>>(new Set());
    const [lastRunDate,     setLastRunDate]     = useState("");
    const [pdfUrl,          setPdfUrl]          = useState<string | null>(null);
    const [showPdfPreview,  setShowPdfPreview]  = useState(false);

    async function handleProceed(args: ProcessJobsArgs) {
        if (!dbName || !schema) return;
        setExecuting(true);
        try {
            const batchResults = await executeBatch({
                dbName, schema,
                jobs: selectedJobs,
                checkedKinds:    args.checkedKinds,
                technicianId:    args.technicianId,
                remarks:         args.remarks,
                transactionDate: args.transactionDate,
                performedByUserId: currentUser?.id ?? null,
                deliveredOkStatusId,
                deliveryMannerName: deliveryManners[0]?.name ?? null,
            });
            setResults(batchResults);
            setDeliveredJobIds(new Set(
                batchResults.filter(r => r.kind === "DELIVER" && r.status === "success").map(r => r.jobId),
            ));
            setLastRunDate(args.transactionDate);
            setShowProcessModal(false);
        } finally {
            setExecuting(false);
        }
    }

    function handlePrintDeliveryNote() {
        const delivered = selectedJobs.filter(j => deliveredJobIds.has(j.id));
        if (delivered.length === 0) return;

        // Mirrors delivery-modal.tsx's handleDeliveryNote(): only look up a
        // division header when every delivered job is the same single job;
        // otherwise the note prints without a division header.
        const divisionId = delivered.length === 1 ? delivered[0].division_id : null;
        const division   = divisionId != null ? (availableDivisions.find(d => d.id === divisionId) ?? null) : null;

        const jobsForPdf: DeliveryNoteJobInfo[] = delivered.map(j => ({
            customer_contact_id: j.customer_contact_id,
            job_no:              j.job_no,
            alternate_job_no:    j.alternate_job_no,
            job_date:            j.job_date,
            customer_name:       j.customer_name ?? "",
            mobile:              j.mobile,
            device_details:      j.device_details,
            technician_name:     j.technician_name,
            amount:              j.amount,
            delivery_date:       lastRunDate,
        }));

        const doc = buildDeliveryNotePdf(jobsForPdf, division, branch?.name ?? null);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(URL.createObjectURL(doc.output("blob")));
        setShowPdfPreview(true);
    }

    function handleResultsClose() {
        setResults(null);
        setSelectedIds(new Set());
        setDeliveredJobIds(new Set());
        if (customerId != null) void loadJobs(customerId);
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden gap-4 p-4"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-(--cl-border) pb-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                    <Layers className="h-4 w-4" />
                </div>
                <h1 className="text-lg font-bold text-(--cl-text)">Batch Warranty Jobs</h1>
                <span className="text-xs text-(--cl-text-muted)">
                    Process multiple no-parts warranty jobs for one customer together
                </span>
            </div>

            {/* Customer selection + grid search + process button */}
            <div className="flex flex-wrap items-start gap-4">
                <div className="max-w-md flex-1 min-w-[260px]">
                    <Label className="mb-1 block">Customer</Label>
                    <CustomerInput
                        customerId={customerId}
                        customerName={customerName}
                        customerMobile={customerMobile}
                        customerAddress={customerAddress}
                        customerTypes={customerTypes}
                        states={masterStates}
                        onChange={handleCustomerChange}
                        onClear={handleCustomerClear}
                        onSelect={handleCustomerSelect}
                    />
                </div>

                {customerId != null && (
                    <>
                        <div className="min-w-[220px] max-w-xs flex-1">
                            <Label className="mb-1 block">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                                <Input
                                    className="h-9 border-(--cl-border) bg-white pl-8 pr-7 text-sm"
                                    placeholder="Search job no, device, status, technician…"
                                    value={gridSearch}
                                    onChange={e => setGridSearch(e.target.value)}
                                />
                                {gridSearch && (
                                    <button
                                        className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface) hover:bg-(--cl-text)"
                                        type="button"
                                        onClick={() => setGridSearch("")}
                                    >
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <Label className="mb-1 block invisible">Process</Label>
                            <Button
                                className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={selectedIds.size <= 1}
                                title={selectedIds.size <= 1 ? "Select more than one job to process together" : undefined}
                                onClick={() => setShowProcessModal(true)}
                            >
                                <Play className="h-4 w-4" />
                                Process {selectedIds.size} Jobs
                            </Button>
                        </div>
                    </>
                )}
            </div>

            {customerId != null && (
                <WarrantyJobsGrid
                    rows={jobs}
                    loading={jobsLoading}
                    search={gridSearch}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                    onViewJob={setViewJobId}
                />
            )}

            {showProcessModal && (
                <ProcessJobsModal
                    jobs={selectedJobs}
                    technicians={technicians}
                    executing={executing}
                    onCancel={() => setShowProcessModal(false)}
                    onRemoveJob={id => handleSelectionChange(id, false)}
                    onProceed={args => void handleProceed(args)}
                />
            )}

            {results && (
                <BatchResultsModal
                    results={results}
                    canPrintDeliveryNote={deliveredJobIds.size > 0}
                    onPrintDeliveryNote={handlePrintDeliveryNote}
                    onClose={handleResultsClose}
                />
            )}

            <PdfPreviewModal
                isOpen={showPdfPreview}
                pdfUrl={pdfUrl}
                title="Job Delivery Note"
                filename={`delivery-note-${lastRunDate || "batch"}.pdf`}
                onClose={() => setShowPdfPreview(false)}
            />

            {viewJobId !== null && (
                <JobDetailsModal jobId={viewJobId} onClose={() => setViewJobId(null)} />
            )}
        </motion.div>
    );
}
