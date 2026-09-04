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
import { sendWhatsappJobInvoice, type WhatsappJobInvoiceResult } from "../send-whatsapp-job-invoice";

// Same confirm-before-send / in-flight-state / toast pattern every other
// WhatsApp send trigger in this codebase already uses
// (use-send-whatsapp-money-receipt.tsx, use-send-whatsapp-job-intake.tsx,
// WhatsappDeliveryControl's Yes/No dialog) — accidentally clicking "Send
// Invoice via WhatsApp" shouldn't fire a real message to a customer.
// AlertDialogCancel ("No") is Radix's own default-focused element, so the
// safe answer is what pressing Enter/Escape lands on. Reuses the same
// generic WHATSAPP_* message constants the other events already use, since
// the outcome wording doesn't depend on which event triggered the send.
export function useSendWhatsappJobInvoice() {
    const [sending, setSending] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const resolveConfirmRef = useRef<((confirmed: boolean) => void) | null>(null);

    async function doSend(
        dbName: string,
        schema: string,
        branchId: number,
        jobId: number,
    ): Promise<WhatsappJobInvoiceResult[]> {
        setSending(true);
        try {
            const { results, disabled } = await sendWhatsappJobInvoice(dbName, schema, branchId, jobId);
            if (disabled) {
                toast.warning(MESSAGES.WARN_WHATSAPP_EVENT_DISABLED);
            } else if (results.length === 0) {
                toast.error(MESSAGES.ERROR_WHATSAPP_SEND_FAILED);
            } else if (results.some(r => r.status === "FAILED")) {
                toast.error(results[0].error ?? MESSAGES.ERROR_WHATSAPP_SEND_FAILED);
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
        jobId: number,
    ): Promise<WhatsappJobInvoiceResult[]> {
        const confirmed = await new Promise<boolean>((resolve) => {
            resolveConfirmRef.current = resolve;
            setConfirmOpen(true);
        });
        if (!confirmed) return [];
        return doSend(dbName, schema, branchId, jobId);
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
                    <AlertDialogTitle>Send this invoice to the customer via WhatsApp?</AlertDialogTitle>
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
