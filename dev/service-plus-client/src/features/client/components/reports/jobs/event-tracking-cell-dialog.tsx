import { useEffect, useState } from "react";
import { History } from "lucide-react";

import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";
import { JobFinalInfoModal } from "../../jobs/final-a-job/job-final-info-modal";

import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { formatDateShort, formatNumber, formatTimeShort } from "../common/formatters";

// Cost/Sale/Profit only make sense once a job has been costed out — meaningful
// for Finalize (COMPLETED_OK) and Deliver, not for Received/Status Change.
const COST_EVENTS = new Set(["Finalize", "Deliver"]);

export type EventTrackingCellType = {
    eventName:   string;
    bucketLabel: string;
    from:        string;
    to:          string;
};

type CellJobType = {
    row_key:       string;
    id:            number;
    job_no:        string;
    event_date:    string;
    event_time:    string | null;
    status_label:  string;
    customer_name: string | null;
    brand_name:    string | null;
    model_name:    string | null;
    product_name:  string | null;
    is_warranty:   boolean;
    division_code: string | null;
    total_cost:    number;
    total_charges: number;
    profit:        number;
};

type Props = {
    cell: EventTrackingCellType | null;
    onClose: () => void;
};

export const EventTrackingCellDialog = ({ cell, onClose }: Props) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [rows, setRows]       = useState<CellJobType[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError]     = useState<string | null>(null);
    const [finalInfoJobId, setFinalInfoJobId] = useState<number | null>(null);

    const showCosts = cell != null && COST_EVENTS.has(cell.eventName);

    const columns: ReportColumnType<CellJobType>[] = [
        {
            cell:   r => (
                <div className="flex flex-col gap-0.5">
                    <span>{formatDateShort(r.event_date)}</span>
                    {r.event_time && (
                        <span className="text-[10px] text-(--cl-text-muted)">{formatTimeShort(r.event_time)}</span>
                    )}
                </div>
            ),
            header: "Event Date",
            id:     "event_date",
            value:  r => r.event_date,
            width:  "110px",
        },
        {
            cell:   r => (
                <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs font-semibold text-(--cl-accent) hover:underline">{r.job_no}</span>
                    {r.division_code && (
                        <span className="text-[9px] font-medium uppercase tracking-tight text-indigo-600 dark:text-indigo-400">
                            {r.division_code}
                        </span>
                    )}
                </div>
            ),
            header: "Job No",
            id:     "job_no",
            value:  r => r.job_no,
            width:  "120px",
        },
        {
            cell:   r => <span className="text-(--cl-text-muted)">{r.status_label}</span>,
            header: "Status",
            id:     "status",
            value:  r => r.status_label,
            width:  "140px",
        },
        { header: "Customer", id: "customer", value: r => r.customer_name ?? "—" },
        {
            cell:   r => (
                <div className="flex flex-col">
                    <span>{r.product_name ?? "—"}</span>
                    <span className="text-[10px] text-(--cl-text-muted)">
                        {[r.brand_name, r.model_name].filter(Boolean).join(" • ")}
                    </span>
                </div>
            ),
            header: "Device",
            id:     "device",
            value:  r => `${r.product_name ?? ""} ${r.brand_name ?? ""} ${r.model_name ?? ""}`,
        },
        {
            cell:   r => r.is_warranty
                ? <Badge className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50" variant="outline">Warranty</Badge>
                : <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50" variant="outline">OOW</Badge>,
            header: "Type",
            id:     "warranty",
            value:  r => r.is_warranty ? "Warranty" : "OOW",
            width:  "100px",
        },
        ...(showCosts ? [
            {
                align:  "right",
                cell:   r => formatNumber(Number(r.total_cost)),
                footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.total_cost), 0)),
                header: "Cost",
                id:     "total_cost",
                value:  r => Number(r.total_cost),
                width:  "100px",
            },
            {
                align:  "right",
                cell:   r => <span className="font-light text-amber-600 dark:text-amber-400">{formatNumber(Number(r.total_charges))}</span>,
                footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.total_charges), 0)),
                header: "Sale",
                id:     "charges",
                value:  r => Number(r.total_charges),
                width:  "110px",
            },
            {
                align:  "right",
                cell:   r => <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(Number(r.profit))}</span>,
                footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.profit), 0)),
                header: "Profit",
                id:     "profit",
                value:  r => Number(r.profit),
                width:  "110px",
            },
        ] as ReportColumnType<CellJobType>[] : []),
    ];

    useEffect(() => {
        if (!cell || !dbName || !schema) return;
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        setError(null);

        apolloClient.query<{ genericQuery: CellJobType[] | null }>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   {
                db_name: dbName,
                schema,
                value:   graphQlUtils.buildGenericQueryValue({
                    sqlArgs: { event_name: cell.eventName, from: cell.from, to: cell.to },
                    sqlId:   SQL_MAP.GET_EVENT_TRACKING_JOBS,
                }),
            },
        }).then(res => {
            if (cancelled) return;
            setRows(res.data?.genericQuery ?? []);
        }).catch(err => {
            if (cancelled) return;
            setError(err instanceof Error ? err.message : MESSAGES.ERROR_REPORTS_FETCH_FAILED);
            setRows([]);
        }).finally(() => {
            if (cancelled) return;
            setLoading(false);
        });

        return () => { cancelled = true; };
    }, [cell, dbName, schema]);

    const open = cell != null;

    return (
        <>
        <Dialog onOpenChange={v => { if (!v) onClose(); }} open={open}>
            {/* Hidden (not unmounted) while the nested Job Final Info modal is open — a
                fixed-position dialog narrower than this one would otherwise leave this
                dialog's edges visibly peeking out from behind it. Content and Overlay
                are hidden separately since DialogContent's className only reaches the
                content box, not its own Overlay. */}
            <DialogContent
                className={cn("sm:max-w-4xl", finalInfoJobId != null && "invisible")}
                overlayClassName={cn(finalInfoJobId != null && "invisible")}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-4 w-4 text-orange-600" />
                        <span>{cell?.eventName ?? "Events"}</span>
                        {cell && <span className="font-mono text-(--cl-accent-text)">{cell.bucketLabel}</span>}
                    </DialogTitle>
                    <DialogDescription>
                        {cell ? `“${cell.eventName}” events — ${cell.bucketLabel}.` : ""}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-w-0">
                    {loading && <ReportLoading lines={3} />}
                    {!loading && error && <ReportError message={error} />}
                    {!loading && !error && rows.length === 0 && <ReportEmpty message="No events in this range." />}
                    {!loading && !error && rows.length > 0 && (
                        <>
                            <div className="mb-2 text-xs text-(--cl-text-muted)">
                                {rows.length} event(s)
                            </div>
                            <ReportTable
                                columns={columns}
                                maxHeight="60vh"
                                rowKey={r => r.row_key}
                                rows={rows}
                                showFooter={showCosts}
                                showRowIndex
                                stickyHeader={false}
                                onRowClick={r => setFinalInfoJobId(r.id)}
                            />
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>

        {finalInfoJobId != null && (
            <JobFinalInfoModal jobId={finalInfoJobId} onClose={() => setFinalInfoJobId(null)} />
        )}
        </>
    );
};
