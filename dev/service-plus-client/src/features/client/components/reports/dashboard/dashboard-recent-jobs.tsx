import { ShieldCheck } from "lucide-react";

import { ReportTable } from "../_common/report-table";
import type { ReportColumnType } from "../_common/report-table";
import { formatDateShort } from "../_common/formatters";

type JobRowType = {
    brand_name: string | null;
    customer_name: string;
    id: number;
    is_warranty: boolean;
    job_date: string;
    job_no: string;
    model_name: string | null;
    product_name: string | null;
    status_code: string;
    status_name: string;
    technician_name: string | null;
};

type Props = {
    jobs: JobRowType[];
};

const COLUMNS: ReportColumnType<JobRowType>[] = [
    {
        cell:    r => <span className="font-mono text-(--cl-accent-text)">{r.job_no}</span>,
        header:  "Job No",
        id:      "job_no",
        value:   r => r.job_no,
        width:   "120px",
    },
    {
        cell:    r => formatDateShort(r.job_date),
        header:  "Date",
        id:      "job_date",
        value:   r => r.job_date,
        width:   "110px",
    },
    {
        cell:    r => r.customer_name,
        header:  "Customer",
        id:      "customer",
        value:   r => r.customer_name,
    },
    {
        cell:    r => (
            <div className="flex flex-col">
                <span>{r.product_name || "—"}</span>
                <span className="text-[10px] text-(--cl-text-muted)">
                    {[r.brand_name, r.model_name].filter(Boolean).join(" • ")}
                </span>
            </div>
        ),
        header:  "Device",
        id:      "device",
        value:   r => `${r.product_name ?? ""} ${r.brand_name ?? ""} ${r.model_name ?? ""}`,
    },
    {
        cell:    r => (
            <span className="rounded-md bg-(--cl-hover) px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-(--cl-accent-text)">
                {r.status_name}
            </span>
        ),
        header:  "Status",
        id:      "status",
        value:   r => r.status_name,
        width:   "150px",
    },
    {
        cell:    r => r.technician_name ?? "—",
        header:  "Technician",
        id:      "technician",
        value:   r => r.technician_name ?? "",
        width:   "120px",
    },
    {
        align:   "center",
        cell:    r => r.is_warranty
            ? <ShieldCheck className="mx-auto h-4 w-4 text-emerald-500" />
            : <span className="text-(--cl-text-muted)">—</span>,
        header:  "Warranty",
        id:      "warranty",
        sortable: false,
        width:   "90px",
    },
];

export const DashboardRecentJobs = ({ jobs }: Props) => {
    return (
        <ReportTable
            columns={COLUMNS}
            emptyMessage="No recent jobs."
            rowKey={r => r.id}
            rows={jobs}
            stickyHeader={false}
        />
    );
};
