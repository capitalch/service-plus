import { IndianRupee } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SQL_MAP } from "@/constants/sql-map";

import { formatInr } from "../common/formatters";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { useGenericQuery } from "../common/use-generic-query";

type RevenueRowType = {
    amount: number;
    customer_name: string;
    invoice_date: string;
    invoice_id: number;
    is_warranty: boolean;
    job_no: string;
    product_name: string | null;
};

type Props = {
    onClose: () => void;
    open: boolean;
    sqlArgs?: Record<string, unknown>;
};

const columns: ReportColumnType<RevenueRowType>[] = [
    {
        cell:   r => r.invoice_date,
        header: "Date",
        id:     "invoice_date",
        value:  r => r.invoice_date,
        width:  "100px",
    },
    {
        cell:   r => <span className="font-mono text-xs font-semibold text-(--cl-accent-text)">{r.job_no}</span>,
        header: "Job No",
        id:     "job_no",
        value:  r => r.job_no,
        width:  "110px",
    },
    { header: "Customer", id: "customer_name", value: r => r.customer_name },
    { header: "Product", id: "product_name", value: r => r.product_name ?? "—" },
    {
        cell:   r => r.is_warranty ? "Warranty" : "OOW",
        header: "Type",
        id:     "is_warranty",
        value:  r => r.is_warranty ? "Warranty" : "OOW",
        width:  "90px",
    },
    {
        align:  "right",
        cell:   r => formatInr(r.amount),
        footer: rs => formatInr(rs.reduce((s, r) => s + r.amount, 0)),
        header: "Amount",
        id:     "amount",
        value:  r => r.amount,
        width:  "120px",
    },
];

export const DashboardRevenueDetailDialog = ({ onClose, open, sqlArgs }: Props) => {
    const { data, error, loading } = useGenericQuery<RevenueRowType>({
        enabled: open,
        sqlArgs,
        sqlId:   SQL_MAP.GET_DASHBOARD_REVENUE_DETAIL,
    });

    return (
        <Dialog onOpenChange={v => { if (!v) onClose(); }} open={open}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IndianRupee className="h-4 w-4 text-emerald-500" />
                        <span>Revenue Detail</span>
                    </DialogTitle>
                    <DialogDescription>Invoices raised in the selected range.</DialogDescription>
                </DialogHeader>

                <div className="min-w-0">
                    {loading && <ReportLoading lines={3} />}
                    {!loading && error && <ReportError message={error.message} />}
                    {!loading && !error && data.length === 0 && <ReportEmpty message="No invoices in this range." />}
                    {!loading && !error && data.length > 0 && (
                        <ReportTable
                            columns={columns}
                            maxHeight="60vh"
                            rowKey={r => r.invoice_id}
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
