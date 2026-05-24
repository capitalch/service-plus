import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type UndoJobInfo = {
    job_no:                  string;
    customer_name:           string | null;
    job_receive_manner_name: string | null | undefined;
    device_details:          string | null | undefined;
    job_status_name:         string;
};

type Props = {
    job:        UndoJobInfo;
    submitting: boolean;
    onConfirm:  () => void;
    onClose:    () => void;
};

export const UndoTransactionDialog = ({ job, submitting, onConfirm, onClose }: Props) => (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
        <DialogContent className="max-w-sm overflow-hidden bg-white dark:bg-zinc-950 border-(--cl-border)">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    Undo Last Transaction
                </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-(--cl-text)">
                <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) px-3 py-2.5 space-y-1.5 text-xs">
                    <div className="flex items-start gap-2 min-w-0">
                        <span className="w-24 shrink-0 text-(--cl-text-muted)">Job No</span>
                        <span className="font-mono font-semibold text-(--cl-accent) truncate">{job.job_no}</span>
                    </div>
                    <div className="flex items-start gap-2 min-w-0">
                        <span className="w-24 shrink-0 text-(--cl-text-muted)">Customer</span>
                        <span className="font-medium min-w-0 break-words">{job.customer_name}</span>
                    </div>
                    {job.job_receive_manner_name && (
                        <div className="flex items-start gap-2 min-w-0">
                            <span className="w-24 shrink-0 text-(--cl-text-muted)">Receive type</span>
                            <span className="min-w-0 break-words">{job.job_receive_manner_name}</span>
                        </div>
                    )}
                    {job.device_details && (
                        <div className="flex items-start gap-2 min-w-0">
                            <span className="w-24 shrink-0 text-(--cl-text-muted)">Device</span>
                            <span className="min-w-0 break-words">{job.device_details}</span>
                        </div>
                    )}
                    <div className="flex items-start gap-2 min-w-0">
                        <span className="w-24 shrink-0 text-(--cl-text-muted)">Current status</span>
                        <span className="font-semibold min-w-0 break-words">{job.job_status_name}</span>
                    </div>
                </div>
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                    The last transaction will be <span className="font-bold">permanently deleted</span> and the job restored to its previous status. This cannot be undone.
                </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-(--cl-border)">
                <Button
                    className="h-8 px-4 text-xs"
                    variant="ghost"
                    disabled={submitting}
                    onClick={onClose}
                >
                    Cancel
                </Button>
                <Button
                    className="h-8 px-4 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
                    disabled={submitting}
                    onClick={onConfirm}
                >
                    {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Yes, Undo
                </Button>
            </div>
        </DialogContent>
    </Dialog>
);
