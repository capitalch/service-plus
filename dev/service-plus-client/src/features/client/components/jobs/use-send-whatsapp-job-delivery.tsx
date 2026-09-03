import { useRef, useState } from "react";
import { toast } from "sonner";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MESSAGES } from "@/constants/messages";
import { sendWhatsappJobDelivery, type WhatsappJobDeliveryResult } from "./send-whatsapp-job-delivery";

// Copy of use-send-whatsapp-job-intake.tsx (plans/plan.md, Step 4) — same
// confirm-first/in-flight-state/toast pattern, reused as-is: the outcome
// wording doesn't depend on which event triggered the send. A "FAILED —
// Invalid or missing mobile number" result means more here than it does for
// the other two events (there is no other way to deliver the code), but that
// distinction is the caller's to act on, not this hook's — it just reports
// results back.
export function useSendWhatsappJobDelivery() {
    const [sending, setSending] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const resolveConfirmRef = useRef<((confirmed: boolean) => void) | null>(null);

    async function doSend(
        dbName: string,
        schema: string,
        branchId: number,
        jobIds: number[],
    ): Promise<WhatsappJobDeliveryResult[]> {
        setSending(true);
        try {
            const { results, disabled } = await sendWhatsappJobDelivery(dbName, schema, branchId, jobIds);
            if (disabled) {
                toast.warning(MESSAGES.WARN_WHATSAPP_EVENT_DISABLED);
            } else if (results.length === 0) {
                toast.error(MESSAGES.ERROR_WHATSAPP_SEND_FAILED);
            } else if (results.some(r => r.status === "FAILED")) {
                // Show the provider's own reason, not just the generic warning —
                // a template/config breakage (e.g. a rejected OTP send) is
                // otherwise only readable as a tooltip on the status cell, which
                // is how one took a code read to diagnose.
                const reasons = [...new Set(
                    results.filter(r => r.status === "FAILED" && r.error).map(r => r.error!),
                )];
                toast.warning(MESSAGES.WARN_WHATSAPP_PARTIAL_SEND, {
                    description: reasons.length ? reasons.join(" · ") : undefined,
                });
            } else {
                toast.success(MESSAGES.SUCCESS_WHATSAPP_SENT);
            }
            return results;
        } catch {
            toast.error(MESSAGES.ERROR_WHATSAPP_SEND_FAILED);
            return [];
        } finally {
            setSending(false);
        }
    }

    async function send(
        dbName: string,
        schema: string,
        branchId: number,
        jobIds: number[],
    ): Promise<WhatsappJobDeliveryResult[]> {
        const confirmed = await new Promise<boolean>((resolve) => {
            resolveConfirmRef.current = resolve;
            setConfirmOpen(true);
        });
        if (!confirmed) return [];
        return doSend(dbName, schema, branchId, jobIds);
    }

    function handleAnswer(confirmed: boolean) {
        setConfirmOpen(false);
        resolveConfirmRef.current?.(confirmed);
        resolveConfirmRef.current = null;
    }

    const ConfirmDialog = (
        <AlertDialog open={confirmOpen} onOpenChange={(open) => { if (!open) handleAnswer(false); }}>
            <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                    <AlertDialogTitle>Send Whatsapp message for Job Delivery?</AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => handleAnswer(false)}>No</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleAnswer(true)}>Yes</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    return { sending, send, ConfirmDialog };
}
