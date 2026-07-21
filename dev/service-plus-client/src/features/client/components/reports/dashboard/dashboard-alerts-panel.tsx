import { Timer } from "lucide-react";

import { ReportEmpty } from "../common/report-empty";

type OverdueRowType = {
    customer_name: string;
    days_old: number;
    id: number;
    job_date: string;
    job_no: string;
    status_name: string;
    technician_name: string | null;
};

type Props = {
    overdue: OverdueRowType[];
};

export const DashboardAlertsPanel = ({ overdue }: Props) => {
    if (overdue.length === 0) return <ReportEmpty message="Nothing overdue. Nice." />;

    return (
        <ul className="space-y-2">
            {overdue.map(row => (
                <li
                    key={row.id}
                    className="flex items-start gap-2 rounded-md border border-(--cl-border) bg-(--cl-surface) p-2 text-xs"
                >
                    <span className="mt-0.5 rounded-md bg-amber-500/10 p-1.5 text-amber-500">
                        <Timer className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-bold text-(--cl-accent-text)">
                                {row.job_no}
                            </span>
                            <span className="text-[10px] font-bold text-amber-600">
                                {row.days_old}d old
                            </span>
                        </div>
                        <p className="truncate text-(--cl-text)">{row.customer_name}</p>
                        <p className="truncate text-[10px] text-(--cl-text-muted)">
                            {row.status_name}
                            {row.technician_name ? ` • ${row.technician_name}` : ""}
                        </p>
                    </div>
                </li>
            ))}
        </ul>
    );
};
