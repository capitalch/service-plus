import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

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

import { ReportEmpty } from "../_common/report-empty";
import { ReportError } from "../_common/report-error";
import { ReportLoading } from "../_common/report-loading";
import { ReportTable } from "../_common/report-table";
import type { ReportColumnType } from "../_common/report-table";
import { formatNumber } from "../_common/formatters";

export type PipelineCellType = {
    statusCode: string;
    statusName: string;
    bucketLabel: string;
    ageMin: number;
    ageMax: number;
};

type CellJobType = {
    id: number;
    job_no: string;
    job_date: string;
    days_old: number;
    customer_name: string;
    product_name: string | null;
    brand_name: string | null;
    model_name: string | null;
    technician_name: string | null;
    is_warranty: boolean;
};

type Props = {
    cell: PipelineCellType | null;
    onClose: () => void;
};

const COLUMNS: ReportColumnType<CellJobType>[] = [
    {
        header: "Job No",
        id:     "job_no",
        value:  r => r.job_no,
        width:  "120px",
    },
    {
        header: "Customer",
        id:     "customer",
        value:  r => r.customer_name,
    },
    {
        header: "Model",
        id:     "model",
        value:  r => [r.brand_name, r.model_name].filter(Boolean).join(" ") || "—",
    },
    {
        header: "Technician",
        id:     "technician",
        value:  r => r.technician_name ?? "—",
        width:  "140px",
    },
    {
        header: "Warranty",
        id:     "warranty",
        value:  r => (r.is_warranty ? "Yes" : "No"),
        width:  "90px",
    },
    {
        align:  "right",
        header: "Days Old",
        id:     "days_old",
        value:  r => Number(r.days_old),
        width:  "90px",
    },
];

export const JobPipelineCellDialog = ({ cell, onClose }: Props) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [rows, setRows]       = useState<CellJobType[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError]     = useState<string | null>(null);

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
                    sqlArgs: { age_max: cell.ageMax, age_min: cell.ageMin, status_code: cell.statusCode },
                    sqlId:   SQL_MAP.GET_JOB_PIPELINE_CELL_JOBS,
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
        <Dialog onOpenChange={v => { if (!v) onClose(); }} open={open}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Timer className="h-4 w-4 text-(--cl-accent-text)" />
                        <span>{cell?.statusName ?? "Jobs"}</span>
                        {cell && <span className="font-mono text-(--cl-accent-text)">{cell.bucketLabel}</span>}
                    </DialogTitle>
                    <DialogDescription>
                        {cell ? `Open jobs in “${cell.statusName}” aged ${cell.bucketLabel}.` : ""}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[60vh] overflow-y-auto">
                    {loading && <ReportLoading lines={3} />}
                    {!loading && error && <ReportError message={error} />}
                    {!loading && !error && rows.length === 0 && <ReportEmpty message="No jobs in this cell." />}
                    {!loading && !error && rows.length > 0 && (
                        <>
                            <div className="mb-2 text-xs text-(--cl-text-muted)">
                                {formatNumber(rows.length)} job(s)
                            </div>
                            <ReportTable
                                columns={COLUMNS}
                                rowKey={r => r.id}
                                rows={rows}
                                stickyHeader={false}
                            />
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
