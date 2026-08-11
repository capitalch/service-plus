import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import type { CustomerGroup } from "./customer-connect-schema";

type Props = {
    isOpen:    boolean;
    groups:    CustomerGroup[];
    sending:   boolean;
    onClose:   () => void;
    onConfirm: (groups: CustomerGroup[]) => void;
};

// Pre-send confirmation — per-customer message preview, with a drop-a-customer
// escape hatch before the click actually fires the sends (plan-whatsapp.md §5e).
export function SendMessagesModal({ isOpen, groups, sending, onClose, onConfirm }: Props) {
    const [droppedIds, setDroppedIds] = useState<Set<number>>(new Set());

    useEffect(() => { if (isOpen) setDroppedIds(new Set()); }, [isOpen]);

    const activeGroups = groups.filter(g => !droppedIds.has(g.customer_contact_id));
    const totalJobs = activeGroups.reduce((s, g) => s + g.job_ids.length, 0);

    return (
        <Dialog open={isOpen} onOpenChange={open => { if (!open && !sending) onClose(); }}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-2xl max-h-[85vh] !p-0 overflow-hidden flex flex-col bg-white dark:bg-zinc-950 text-(--cl-text)"
            >
                <DialogHeader className="px-6 pt-6 pb-3 border-b border-(--cl-border)">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <WhatsAppIcon className="h-4 w-4 text-emerald-600" />
                        Send Completion Messages
                    </DialogTitle>
                    <p className="text-xs text-(--cl-text-muted)">
                        {totalJobs} job{totalJobs !== 1 ? "s" : ""} · {activeGroups.length} customer{activeGroups.length !== 1 ? "s" : ""} —
                        one WhatsApp message per customer, never one per job.
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                    {groups.map(g => {
                        const dropped = droppedIds.has(g.customer_contact_id);
                        return (
                            <div
                                key={g.customer_contact_id}
                                className={`rounded-lg border px-3 py-2.5 transition-opacity ${
                                    dropped ? "opacity-40 border-(--cl-border)" : "border-(--cl-border) bg-(--cl-surface-2)"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-semibold text-(--cl-text)">{g.customer_name}</span>
                                            <span className="font-mono text-xs text-(--cl-text-muted)">{g.mobile}</span>
                                        </div>
                                        <p className="mt-1 text-xs text-(--cl-text-muted)">
                                            Job(s) {g.job_nos.join(", ")} ready for pickup. Amount due ₹{g.amount.toFixed(2)}.
                                        </p>
                                    </div>
                                    {!dropped ? (
                                        <button
                                            type="button"
                                            className="shrink-0 text-(--cl-text-muted) hover:text-red-600 cursor-pointer"
                                            title="Drop this customer from the send"
                                            onClick={() => setDroppedIds(prev => new Set(prev).add(g.customer_contact_id))}
                                        >
                                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="shrink-0 text-xs font-semibold text-(--cl-accent) hover:underline cursor-pointer"
                                            onClick={() => setDroppedIds(prev => { const next = new Set(prev); next.delete(g.customer_contact_id); return next; })}
                                        >
                                            Undo
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <DialogFooter className="px-6 pt-3 pb-6 border-t border-(--cl-border)">
                    <Button disabled={sending} variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={sending || activeGroups.length === 0}
                        onClick={() => onConfirm(activeGroups)}
                    >
                        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WhatsAppIcon className="h-3.5 w-3.5" />}
                        Send {activeGroups.length} Message{activeGroups.length !== 1 ? "s" : ""}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
