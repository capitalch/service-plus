import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";

import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { JobFinalInfoModal } from "../../jobs/final-a-job/job-final-info-modal";

import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { formatNumber } from "../common/formatters";

export type ProfitCellType = {
    technicianId:   number;
    technicianName: string;
    monthLabel:     string;
    from:           string;
    to:             string;
};

type CellJobType = {
    id: number;
    job_no: string;
    delivery_date: string;
    customer_name: string;
    profit: number;
    total_charges: number;
};

type Props = {
    cell: ProfitCellType | null;
    onClose: () => void;
};

export const TechnicianProfitCellDialog = ({ cell, onClose }: Props) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [rows, setRows]       = useState<CellJobType[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError]     = useState<string | null>(null);
    const [finalInfoJobId, setFinalInfoJobId] = useState<number | null>(null);

    const columns: ReportColumnType<CellJobType>[] = [
        { header: "Delivery Date", id: "delivery_date", value: r => r.delivery_date, width: "110px" },
        {
            cell:   r => <span className="font-mono text-xs font-semibold text-(--cl-accent) hover:underline">{r.job_no}</span>,
            header: "Job No",
            id:     "job_no",
            value:  r => r.job_no,
            width:  "110px",
        },
        { header: "Customer",      id: "customer",      value: r => r.customer_name },
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
                    sqlArgs: { technician_id: cell.technicianId, from: cell.from, to: cell.to },
                    sqlId:   SQL_MAP.GET_TECHNICIAN_PROFIT_MONTH_JOBS,
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
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-(--cl-accent-text)" />
                        <span>{cell?.technicianName ?? "Jobs"}</span>
                        {cell && <span className="font-mono text-(--cl-accent-text)">{cell.monthLabel}</span>}
                    </DialogTitle>
                    <DialogDescription>
                        {cell ? `Delivered-OK jobs for “${cell.technicianName}” in ${cell.monthLabel}.` : ""}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[60vh] overflow-y-auto">
                    {loading && <ReportLoading lines={3} />}
                    {!loading && error && <ReportError message={error} />}
                    {!loading && !error && rows.length === 0 && <ReportEmpty message="No delivered jobs in this month." />}
                    {!loading && !error && rows.length > 0 && (
                        <>
                            <div className="mb-2 text-xs text-(--cl-text-muted)">
                                {rows.length} job(s)
                            </div>
                            <ReportTable
                                columns={columns}
                                rowKey={r => r.id}
                                rows={rows}
                                showFooter
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
