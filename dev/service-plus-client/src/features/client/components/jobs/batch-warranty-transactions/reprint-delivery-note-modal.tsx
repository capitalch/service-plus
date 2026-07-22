import { Fragment, useEffect, useRef, useState } from "react";
import {
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    FileText, Loader2, Search, X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PdfPreviewModal } from "@/components/shared/pdf-preview-modal";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { SEARCH_DEBOUNCE_MS } from "@/constants/timing";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { DeliveredWarrantyJobGroupRow, DeliveredWarrantyJobRow } from "@/features/client/types/job";
import type { DivisionContextType } from "@/features/client/types/division";
import { buildDeliveryNotePdf } from "../deliver-job/deliver-job-pdf";
import { fetchDeliveryNoteJobsByIds } from "../deliver-job/fetch-delivery-note-jobs";

const PAGE_SIZE = 20;

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId:           number | null;
    branchName:         string | null;
    availableDivisions: DivisionContextType[];
    onClose:            () => void;
};

function groupKey(row: DeliveredWarrantyJobGroupRow): string {
    return `${row.customer_contact_id}:${row.delivery_date}`;
}

function buildAddress(row: DeliveredWarrantyJobGroupRow): string {
    return [
        row.customer_address_line1, row.customer_address_line2, row.customer_landmark,
        row.customer_city, row.customer_state, row.customer_postal_code,
    ].filter(Boolean).join(", ");
}

// Lets an operator browse every customer with warranty jobs delivered in the
// past (grouped by delivery date), pick one customer+date group, and reprint
// a combined delivery note for it — independent of the currently selected
// customer/live batch run in BatchWarrantySection.
export function ReprintDeliveryNoteModal({ branchId, branchName, availableDivisions, onClose }: Props) {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [groups,      setGroups]      = useState<DeliveredWarrantyJobGroupRow[]>([]);
    const [total,       setTotal]       = useState(0);
    const [page,        setPage]        = useState(1);
    const [loading,     setLoading]     = useState(false);
    const [search,      setSearch]      = useState("");
    const [searchQ,     setSearchQ]     = useState("");
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [creating,    setCreating]    = useState(false);
    const [pdfUrl,      setPdfUrl]      = useState<string | null>(null);
    const [showPdf,     setShowPdf]     = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!dbName || !schema || !branchId) return;
        setLoading(true);
        const args = { branch_id: branchId, search: searchQ, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };

        const countPromise = apolloClient.query<GenericQueryData<{ total: number }>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DELIVERED_WARRANTY_JOB_GROUPS_COUNT, sqlArgs: args }),
            },
        }).then(res => setTotal(Number(res.data?.genericQuery?.[0]?.total ?? 0)));

        const rowsPromise = apolloClient.query<GenericQueryData<DeliveredWarrantyJobGroupRow>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DELIVERED_WARRANTY_JOB_GROUPS_BY_BRANCH, sqlArgs: args }),
            },
        }).then(res => setGroups(res.data?.genericQuery ?? []));

        Promise.allSettled([countPromise, rowsPromise])
            .then(results => { if (results.some(r => r.status === "rejected")) toast.error("Failed to load delivered warranty jobs."); })
            .finally(() => setLoading(false));
    }, [dbName, schema, branchId, searchQ, page]);

    function handleSearchChange(value: string) {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSelectedKey(null); setSearchQ(value); }, SEARCH_DEBOUNCE_MS);
    }

    const groupedByDate = (() => {
        const map = new Map<string, DeliveredWarrantyJobGroupRow[]>();
        groups.forEach(g => {
            const list = map.get(g.delivery_date);
            if (list) list.push(g); else map.set(g.delivery_date, [g]);
        });
        return Array.from(map.entries());
    })();

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const selectedGroup = groups.find(g => groupKey(g) === selectedKey) ?? null;

    async function handleCreate() {
        if (!selectedGroup || !branchId) return;
        setCreating(true);
        try {
            const jobsRes = await apolloClient.query<GenericQueryData<DeliveredWarrantyJobRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_DELIVERED_WARRANTY_JOBS_BY_CUSTOMER,
                        sqlArgs: {
                            customer_contact_id: selectedGroup.customer_contact_id,
                            branch_id:           branchId,
                            delivery_date:       selectedGroup.delivery_date,
                        },
                    }),
                },
            });
            const jobRows = jobsRes.data?.genericQuery ?? [];
            if (jobRows.length === 0) { toast.error("No delivered jobs found for this selection."); return; }

            const noteJobs = await fetchDeliveryNoteJobsByIds(dbName, schema, jobRows.map(r => r.id));
            if (noteJobs.length === 0) { toast.error("Failed to generate delivery note."); return; }

            const divisionIds = new Set(jobRows.map(r => r.division_id ?? null));
            const singleDivisionId = divisionIds.size === 1 ? jobRows[0].division_id : null;
            const division = singleDivisionId ? (availableDivisions.find(d => d.id === singleDivisionId) ?? null) : null;

            const doc = buildDeliveryNotePdf(noteJobs, division, branchName);
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            setPdfUrl(URL.createObjectURL(doc.output("blob")));
            setShowPdf(true);
        } catch {
            toast.error("Failed to generate delivery note.");
        } finally {
            setCreating(false);
        }
    }

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
                <DialogHeader className="shrink-0">
                    <DialogTitle>Reprint Delivery Note</DialogTitle>
                </DialogHeader>

                <div className="relative shrink-0">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                    <Input
                        className="h-9 border-(--cl-surface-3) bg-white pl-8 pr-7 text-sm"
                        placeholder="Search customer, mobile, job no, device…"
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                    />
                    {search && (
                        <button
                            className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface) hover:bg-(--cl-text)"
                            type="button"
                            onClick={() => handleSearchChange("")}
                        >
                            <X className="h-2.5 w-2.5" />
                        </button>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded border border-(--cl-surface-3)">
                    <table className="min-w-full border-separate border-spacing-0">
                        <thead>
                            <tr>
                                <th className="w-8 border-b border-(--cl-surface-3) bg-(--cl-surface-2) p-2" />
                                <th className="border-b border-(--cl-surface-3) bg-(--cl-surface-2) p-2 text-left text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted)">Customer</th>
                                <th className="border-b border-(--cl-surface-3) bg-(--cl-surface-2) p-2 text-left text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted)">Mobile</th>
                                <th className="border-b border-(--cl-surface-3) bg-(--cl-surface-2) p-2 text-left text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted)">Jobs</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td className="p-4 text-center text-sm text-(--cl-text-muted)" colSpan={4}>Loading…</td></tr>
                            ) : groupedByDate.length === 0 ? (
                                <tr><td className="p-4 text-center text-sm text-(--cl-text-muted)" colSpan={4}>No delivered warranty jobs found.</td></tr>
                            ) : (
                                groupedByDate.map(([date, rows], groupIdx) => (
                                    <Fragment key={date}>
                                        <tr>
                                            <td
                                                className={`bg-(--cl-accent)/10 px-3 py-1.5 text-xs font-bold text-(--cl-accent) ${groupIdx > 0 ? "border-t border-(--cl-surface-3)" : ""}`}
                                                colSpan={4}
                                            >
                                                {date}
                                            </td>
                                        </tr>
                                        {rows.map(row => {
                                            const key = groupKey(row);
                                            const isSelected = selectedKey === key;
                                            const address = buildAddress(row);
                                            return (
                                                <tr
                                                    key={key}
                                                    className={`cursor-pointer align-top transition-colors ${isSelected ? "bg-emerald-50 dark:bg-emerald-950/20" : "hover:bg-(--cl-accent)/5"}`}
                                                    onClick={() => setSelectedKey(key)}
                                                >
                                                    <td className="p-2 text-center">
                                                        <div className="flex h-5 items-center justify-center">
                                                            <input
                                                                checked={isSelected}
                                                                className="h-3.5 w-3.5 accent-emerald-600"
                                                                type="radio"
                                                                onChange={() => setSelectedKey(key)}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="flex max-w-48 flex-col gap-0.5">
                                                            <span className="truncate text-sm font-medium leading-5 text-(--cl-text)" title={row.customer_name ?? undefined}>
                                                                {row.customer_name ?? "No name"}
                                                            </span>
                                                            {address && (
                                                                <span className="truncate text-[10px] text-(--cl-text-muted)" title={address}>{address}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="font-mono text-xs leading-5 text-(--cl-text-muted)">{row.mobile}</div>
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="flex max-w-56 items-start gap-1.5">
                                                            <span className="mt-0.5 shrink-0 rounded-full bg-(--cl-accent)/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-(--cl-accent)">
                                                                {row.job_count}
                                                            </span>
                                                            <span className="truncate font-mono text-xs leading-5 text-(--cl-text-muted)" title={row.job_nos ?? undefined}>
                                                                {row.job_nos ?? "—"}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex shrink-0 items-center justify-between border-t border-(--cl-surface-3) px-1 py-2">
                    <span className="text-xs text-(--cl-text-muted)">
                        {total === 0 ? "No groups" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} (Page ${page} of ${totalPages})`}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="First"    variant="ghost" onClick={() => setPage(1)}><ChevronsLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="Previous" variant="ghost" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Next" variant="ghost" onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Last" variant="ghost" onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4" /></Button>
                    </div>
                </div>

                <DialogFooter className="shrink-0">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={!selectedGroup || creating}
                        type="button"
                        onClick={() => void handleCreate()}
                    >
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        Create Delivery Note
                    </Button>
                </DialogFooter>

                <PdfPreviewModal
                    isOpen={showPdf}
                    pdfUrl={pdfUrl}
                    title="Job Delivery Note"
                    filename={`delivery-note-${selectedGroup?.delivery_date ?? "reprint"}.pdf`}
                    onClose={() => setShowPdf(false)}
                />
            </DialogContent>
        </Dialog>
    );
}
