import { Activity } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SQL_MAP } from "@/constants/sql-map";

import { formatNumber } from "../common/formatters";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { useGenericQuery } from "../common/use-generic-query";

type OpenJobsByProductRowType = {
    oow_count: number;
    product_name: string;
    total_count: number;
    warranty_count: number;
};

type Props = {
    onClose: () => void;
    open: boolean;
};

const columns: ReportColumnType<OpenJobsByProductRowType>[] = [
    { header: "Product", id: "product_name", value: r => r.product_name },
    {
        align:  "right",
        cell:   r => formatNumber(r.warranty_count),
        footer: rs => formatNumber(rs.reduce((s, r) => s + r.warranty_count, 0)),
        header: "W",
        id:     "warranty_count",
        value:  r => r.warranty_count,
        width:  "90px",
    },
    {
        align:  "right",
        cell:   r => formatNumber(r.oow_count),
        footer: rs => formatNumber(rs.reduce((s, r) => s + r.oow_count, 0)),
        header: "OOW",
        id:     "oow_count",
        value:  r => r.oow_count,
        width:  "90px",
    },
    {
        align:  "right",
        cell:   r => <span className="font-semibold text-(--cl-text)">{formatNumber(r.total_count)}</span>,
        footer: rs => <span className="font-extrabold">{formatNumber(rs.reduce((s, r) => s + r.total_count, 0))}</span>,
        header: "Total",
        id:     "total_count",
        value:  r => r.total_count,
        width:  "90px",
    },
];

export const OpenJobsByProductDialog = ({ onClose, open }: Props) => {
    const { data, error, loading } = useGenericQuery<OpenJobsByProductRowType>({
        enabled: open,
        sqlId:   SQL_MAP.GET_DASHBOARD_OPEN_JOBS_BY_PRODUCT,
    });

    return (
        <Dialog onOpenChange={v => { if (!v) onClose(); }} open={open}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-(--cl-accent-text)" />
                        <span>Open Jobs by Product</span>
                    </DialogTitle>
                    <DialogDescription>
                        Warranty (W) vs Out-of-Warranty (OOW) counts for currently open jobs, by product.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-w-0">
                    {loading && <ReportLoading lines={3} />}
                    {!loading && error && <ReportError message={error.message} />}
                    {!loading && !error && data.length === 0 && <ReportEmpty message="No open jobs." />}
                    {!loading && !error && data.length > 0 && (
                        <ReportTable
                            columns={columns}
                            maxHeight="60vh"
                            rowKey={r => r.product_name}
                            rows={data}
                            showFooter
                            showRowIndex
                            stickyHeader={false}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
