import { ClipboardList } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { useGenericQuery } from "../common/use-generic-query";
import { DashboardRecentJobs } from "./dashboard-recent-jobs";
import type { JobRowType } from "./dashboard-recent-jobs";

type Props = {
    description?: string;
    emptyMessage?: string;
    onClose: () => void;
    open: boolean;
    sqlArgs?: Record<string, unknown>;
    sqlId: string;
    title: string;
};

export const DashboardJobsListDialog = ({ description, emptyMessage = "No jobs found.", onClose, open, sqlArgs, sqlId, title }: Props) => {
    const { data, error, loading } = useGenericQuery<JobRowType>({
        enabled: open,
        sqlArgs,
        sqlId,
    });

    return (
        <Dialog onOpenChange={v => { if (!v) onClose(); }} open={open}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-(--cl-accent-text)" />
                        <span>{title}</span>
                    </DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>

                <div className="min-w-0">
                    {loading && <ReportLoading lines={3} />}
                    {!loading && error && <ReportError message={error.message} />}
                    {!loading && !error && data.length === 0 && <ReportEmpty message={emptyMessage} />}
                    {!loading && !error && data.length > 0 && (
                        <>
                            <div className="mb-2 text-xs text-(--cl-text-muted)">
                                {data.length} job(s)
                            </div>
                            <div className="max-h-[60vh] overflow-auto rounded-lg">
                                <DashboardRecentJobs jobs={data} showRowIndex />
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
