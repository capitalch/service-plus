import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { WhatsappCompletionResult } from "../send-whatsapp-completion";

type Props = {
    isOpen:  boolean;
    results: WhatsappCompletionResult[];
    onClose: () => void;
};

// Post-send results — the call already returned, so this is a plain list, no
// live progress bar (plan-whatsapp.md §2b/§5e).
export function SendResultsDialog({ isOpen, results, onClose }: Props) {
    const sentCount   = results.filter(r => r.status === "SENT").length;
    const failedCount = results.length - sentCount;

    return (
        <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-xl max-h-[80vh] !p-0 overflow-hidden flex flex-col bg-white dark:bg-zinc-950 text-(--cl-text)"
            >
                <DialogHeader className="px-6 pt-6 pb-3 border-b border-(--cl-border)">
                    <DialogTitle className="text-base font-bold">Send Results</DialogTitle>
                    <p className="text-xs text-(--cl-text-muted)">
                        {sentCount} sent{failedCount > 0 ? `, ${failedCount} failed` : ""} — {results.length} customer{results.length !== 1 ? "s" : ""} total.
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                    {results.length === 0 ? (
                        <p className="text-sm text-(--cl-text-muted)">No messages were sent.</p>
                    ) : results.map(r => (
                        <div
                            key={r.customer_name + r.job_ids.join(",")}
                            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                                r.status === "SENT"
                                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                                    : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                            }`}
                        >
                            {r.status === "SENT"
                                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            }
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-(--cl-text)">{r.customer_name}</span>
                                    <span className="text-xs text-(--cl-text-muted)">Job(s) {r.job_ids.length}</span>
                                </div>
                                {r.status === "FAILED" && r.error && (
                                    <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{r.error}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <DialogFooter className="px-6 pt-3 pb-6 border-t border-(--cl-border)">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
