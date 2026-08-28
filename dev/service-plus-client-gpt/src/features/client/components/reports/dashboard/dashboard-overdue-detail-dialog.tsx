import { Timer } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SQL_MAP } from "@/constants/sql-map";

import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { useGenericQuery } from "../common/use-generic-query";
import type { OverdueRowType } from "./dashboard-alerts-panel";

type Props = {
    onClose: () => void;
    open: boolean;
    overdueDays: number;
};

const OVERDUE_LIMIT = 100;

const columns: ReportColumnType<OverdueRowType>[] = [
    {
        cell:   r => <span className="font-mono text-xs font-semibold text-(--cl-accent-text)">{r.job_no}</span>,
        header: "Job No",
        id:     "job_no",
        value:  r => r.job_no,
        width:  "110px",
    },
    { header: "Date", id: "job_date", value: r => r.job_date, width: "100px" },
    { header: "Customer", id: "customer_name", value: r => r.customer_name },
    {
        align:  "right",
        cell:   r => <span className="font-bold text-amber-600">{r.days_old}d</span>,
        header: "Age",
        id:     "days_old",
        value:  r => r.days_old,
        width:  "80px",
    },
    { header: "Status", id: "status_name", value: r => r.status_name },
    { header: "Technician", id: "technician_name", value: r => r.technician_name ?? "—" },
];

export const DashboardOverdueDetailDialog = ({ onClose, open, overdueDays }: Props) => {
    const { data, error, loading } = useGenericQuery<OverdueRowType>({
        enabled: open,
        sqlArgs: { limit: OVERDUE_LIMIT, overdue_days: overdueDays },
        sqlId:   SQL_MAP.GET_DASHBOARD_OVERDUE_JOBS,
    });

    return (
        <Dialog onOpenChange={v => { if (!v) onClose(); }} open={open}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Timer className="h-4 w-4 text-amber-500" />
                        <span>Overdue Jobs</span>
                    </DialogTitle>
                    <DialogDescription>Open jobs older than {overdueDays} days.</DialogDescription>
                </DialogHeader>

                <div className="min-w-0">
                    {loading && <ReportLoading lines={3} />}
                    {!loading && error && <ReportError message={error.message} />}
                    {!loading && !error && data.length === 0 && <ReportEmpty message="Nothing overdue. Nice." />}
                    {!loading && !error && data.length > 0 && (
                        <ReportTable
                            columns={columns}
                            maxHeight="60vh"
                            rowKey={r => r.id}
                            rows={data}
                            showRowIndex
                            stickyHeader={false}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
