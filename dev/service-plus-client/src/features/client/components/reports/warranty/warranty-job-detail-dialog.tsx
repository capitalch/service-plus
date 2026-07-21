import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

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

import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { formatInr, formatNumber } from "../common/formatters";
import type { WarrantyDetailLineType } from "./warranty-types";

type Props = {
    jobId: number | null;
    jobNo: string | null;
    onClose: () => void;
};

const COLUMNS: ReportColumnType<WarrantyDetailLineType>[] = [
    {
        header: "Part Code",
        id:     "part_code",
        value:  r => r.part_code,
        width:  "120px",
    },
    {
        header: "Part Name",
        id:     "part_name",
        value:  r => r.part_name,
    },
    {
        header: "Brand",
        id:     "brand",
        value:  r => r.brand_name ?? "—",
        width:  "120px",
    },
    {
        align:  "right",
        footer: rows => formatNumber(rows.reduce((s, r) => s + Number(r.qty), 0)),
        header: "Qty",
        id:     "qty",
        value:  r => Number(r.qty),
        width:  "80px",
    },
    {
        align:  "right",
        cell:   r => formatInr(Number(r.cost_price)),
        header: "Cost ₹",
        id:     "cost",
        value:  r => Number(r.cost_price),
        width:  "100px",
    },
    {
        align:  "right",
        cell:   r => formatInr(Number(r.line_value)),
        footer: rows => formatInr(rows.reduce((s, r) => s + Number(r.line_value), 0)),
        header: "Value ₹",
        id:     "value",
        value:  r => Number(r.line_value),
        width:  "120px",
    },
];

export const WarrantyJobDetailDialog = ({ jobId, jobNo, onClose }: Props) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [rows, setRows]       = useState<WarrantyDetailLineType[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        if (!jobId || !dbName || !schema) return;
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        setError(null);

        apolloClient.query<{ genericQuery: WarrantyDetailLineType[] | null }>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   {
                db_name: dbName,
                schema,
                value:   graphQlUtils.buildGenericQueryValue({
                    sqlArgs: { job_id: jobId },
                    sqlId:   SQL_MAP.GET_WARRANTY_JOB_PARTS_DETAIL,
                }),
            },
        }).then(res => {
            if (cancelled) return;
            setRows(res.data?.genericQuery ?? []);
        }).catch(err => {
            if (cancelled) return;
            setError(err instanceof Error ? err.message : MESSAGES.ERROR_WARRANTY_DETAIL_LOAD_FAILED);
            setRows([]);
        }).finally(() => {
            if (cancelled) return;
            setLoading(false);
        });

        return () => { cancelled = true; };
    }, [jobId, dbName, schema]);

    const open = jobId != null;

    return (
        <Dialog onOpenChange={v => { if (!v) onClose(); }} open={open}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span>Warranty Job</span>
                        {jobNo && <span className="font-mono text-(--cl-accent-text)">{jobNo}</span>}
                    </DialogTitle>
                    <DialogDescription>
                        Parts consumed against this in-warranty job.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[60vh] overflow-y-auto">
                    {loading && <ReportLoading lines={3} />}
                    {!loading && error && <ReportError message={error} />}
                    {!loading && !error && rows.length === 0 && <ReportEmpty message="No parts consumed for this job." />}
                    {!loading && !error && rows.length > 0 && (
                        <ReportTable
                            columns={COLUMNS}
                            rowKey={r => r.line_id}
                            rows={rows}
                            showFooter
                            stickyHeader={false}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
