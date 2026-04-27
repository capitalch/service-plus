import { JobImageUpload } from "./job-image-upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    jobId:   number | null;
    jobNo:   string;
    mode?:   "attach" | "view";
    onClose: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const JobAttachDialog = ({ jobId, jobNo, mode = "attach", onClose }: Props) => {
    const title = mode === "view" ? "Attachments" : "Attach Files";

    return (
        <Dialog open={jobId !== null} onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-2xl bg-white dark:bg-zinc-950 text-[var(--cl-text)] shadow-2xl border border-[var(--cl-border)]"
            >
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">
                        {title}
                        {jobNo && (
                            <span className="ml-2 text-sm font-mono font-normal text-[var(--cl-accent)]">
                                — Job #{jobNo}
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="max-h-[60vh] overflow-y-auto">
                    {jobId !== null && (
                        <JobImageUpload jobId={jobId} />
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

