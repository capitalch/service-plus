import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";

import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";
import { JobFinalInfoModal } from "../../jobs/final-a-job/job-final-info-modal";

import { ReportEmpty } from "./report-empty";
import { ReportError } from "./report-error";
import { ReportLoading } from "./report-loading";
import { ReportTable } from "./report-table";
import type { ReportColumnType } from "./report-table";
import { formatNumber } from "./formatters";

export type CategoryRangeCellType = {
    reportTitle:   string;
    rowLabel:      string;
    categoryValue: string;
    bucketLabel:   string;
    from:          string;
    to:            string;
    sqlId:         string;
    showFinancials?: boolean;
};

type CellJobType = {
    row_key:       string;
    id:            number;
    job_no:        string;
    event_date:    string;
    customer_name: string | null;
    brand_name:    string | null;
    model_name:    string | null;
    product_name:  string | null;
    is_warranty:   boolean;
    total_cost?:   number;
    total_charges?: number;
    profit?:       number;
};

type Props = {
    cell: CategoryRangeCellType | null;
    onClose: () => void;
};

export const CategoryRangeCellDialog = ({ cell, onClose }: Props) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [rows, setRows]       = useState<CellJobType[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError]     = useState<string | null>(null);
    const [finalInfoJobId, setFinalInfoJobId] = useState<number | null>(null);

    const showFinancials = cell?.showFinancials ?? false;

    const columns: ReportColumnType<CellJobType>[] = [
        { header: "Date", id: "event_date", value: r => r.event_date, width: "100px" },
        {
            cell:   r => <span className="font-mono text-xs font-semibold text-(--cl-accent) hover:underline">{r.job_no}</span>,
            header: "Job No",
            id:     "job_no",
            value:  r => r.job_no,
            width:  "110px",
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
        ...(showFinancials ? [
            {
                align:  "right",
                cell:   r => formatNumber(Number(r.total_cost ?? 0)),
                footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.total_cost ?? 0), 0)),
                header: "Cost",
                id:     "total_cost",
                value:  r => Number(r.total_cost ?? 0),
                width:  "100px",
            },
            {
                align:  "right",
                cell:   r => <span className="font-light text-amber-600 dark:text-amber-400">{formatNumber(Number(r.total_charges ?? 0))}</span>,
                footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.total_charges ?? 0), 0)),
                header: "Sale",
                id:     "charges",
                value:  r => Number(r.total_charges ?? 0),
                width:  "110px",
            },
            {
                align:  "right",
                cell:   r => <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(Number(r.profit ?? 0))}</span>,
                footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.profit ?? 0), 0)),
                header: "Profit",
                id:     "profit",
                value:  r => Number(r.profit ?? 0),
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
                    sqlArgs: { category_name: cell.categoryValue, from: cell.from, to: cell.to },
                    sqlId:   cell.sqlId,
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
                dialog's edges visibly peeking out from behind it. */}
            <DialogContent className={cn("sm:max-w-3xl", finalInfoJobId != null && "invisible")}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-blue-600" />
                        <span>{cell?.reportTitle ?? "Jobs"}</span>
                        {cell && <span className="font-mono text-(--cl-accent-text)">{cell.bucketLabel}</span>}
                    </DialogTitle>
                    <DialogDescription>
                        {cell ? `${cell.rowLabel} “${cell.categoryValue}” — ${cell.bucketLabel}.` : ""}
                    </DialogDescription>
                </DialogHeader>

                <div>
                    {loading && <ReportLoading lines={3} />}
                    {!loading && error && <ReportError message={error} />}
                    {!loading && !error && rows.length === 0 && <ReportEmpty message="No jobs in this range." />}
                    {!loading && !error && rows.length > 0 && (
                        <>
                            <div className="mb-2 text-xs text-(--cl-text-muted)">
                                {rows.length} job(s)
                            </div>
                            <ReportTable
                                columns={columns}
                                maxHeight="60vh"
                                rowKey={r => r.row_key}
                                rows={rows}
                                showFooter={showFinancials}
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
