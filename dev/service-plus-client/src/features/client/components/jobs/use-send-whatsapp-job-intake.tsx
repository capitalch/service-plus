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
import { sendWhatsappJobIntake, type WhatsappJobIntakeResult } from "./send-whatsapp-job-intake";

// Shared by every "Whatsapp Job Intake" entry point at job-creation time (single job,
// batch, and re-send from the job details modal) — see plans/plan-whatsapp.md,
// Step 7. Mirrors the in-flight-state/toast pattern already used for
// sendWhatsappCompletion (customer-connect-section.tsx's handleConfirmSend),
// simplified: no selection grid or delivery-tracking banner here, just
// "click, dispatch, toast" — reuses the same generic WHATSAPP message constants
// since the outcome wording doesn't depend on which event triggered the send.
//
// Every trigger goes through send(), which now confirms first — accidentally
// clicking "Whatsapp Job Intake" shouldn't fire a real WhatsApp message to a
// customer. AlertDialogCancel ("No") is Radix's own default-focused element, so
// the safe answer is what pressing Enter/Escape lands on, matching "default false."
// The caller must render the returned ConfirmDialog element once, anywhere in its
// tree — every call site sharing one hook instance shares one dialog.
export function useSendWhatsappJobIntake() {
    const [sending, setSending] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const resolveConfirmRef = useRef<((confirmed: boolean) => void) | null>(null);

    async function doSend(
        dbName: string,
        schema: string,
        branchId: number,
        jobIds: number[],
    ): Promise<WhatsappJobIntakeResult[]> {
        setSending(true);
        try {
            const { results, disabled } = await sendWhatsappJobIntake(dbName, schema, branchId, jobIds);
            if (disabled) {
                toast.warning(MESSAGES.WARN_WHATSAPP_EVENT_DISABLED);
            } else if (results.length === 0) {
                toast.error(MESSAGES.ERROR_WHATSAPP_SEND_FAILED);
            } else if (results.some(r => r.status === "FAILED")) {
                toast.warning(MESSAGES.WARN_WHATSAPP_PARTIAL_SEND);
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
    ): Promise<WhatsappJobIntakeResult[]> {
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
                    <AlertDialogTitle>Send Whatsapp message for Job Intake?</AlertDialogTitle>
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
