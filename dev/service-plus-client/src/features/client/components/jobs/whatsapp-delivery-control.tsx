import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { isValidMobile } from "@/lib/mobile";

import { useSendWhatsappJobDelivery } from "./use-send-whatsapp-job-delivery";
import { getJobDeliveryOtpPending } from "./get-job-delivery-otp-pending";
import { VerifyOtpDialog } from "./deliver-job/verify-otp-dialog";

// One control, two independent entry points (delivery-modal.tsx and
// batch-warranty-transactions' results screen — plans/plan.md, Step 4,
// "Two independent UI entry points... easy to ship one and forget the
// other"). Built once and reused, rather than copy-pasted twice, specifically
// to avoid that drift: the send button and the OTP dialog / "Verify Code"
// resume affordance both live here together.
//
// No manual-override path here (removed after review): by the time this
// control is even shown, the job is already DELIVERED_OK/NOT_OK — delivery
// itself doesn't depend on WhatsApp at all. This control only replaces
// *printing* the Delivery Note/Invoice with a WhatsApp send; a customer with
// no valid mobile simply can't use it (button disabled below) and staff falls
// back to the existing "Invoice + Receipt" / "Delivery Note" print buttons,
// exactly as before this feature existed. There is nothing here for a manual
// confirmation to stand in for.
//
// `jobIds` must all belong to one customer — both call sites already enforce
// this (Deliver Job constrains multi-select to one customer_contact_id;
// Batch Warranty Jobs is scoped to one warranty customer up front), matching
// sendWhatsappJobDelivery's own per-customer grouping.
type Props = {
    dbName:      string | null;
    schema:      string | null;
    branchId:    number | null;
    jobIds:      number[];
    mobile:      string;
    customerLabel: string;
    disabled?:     boolean;
    disabledReason?: string;
    // Called once the OTP is verified, so the caller can refresh whatever
    // badge/state it shows — this control has no server-truth badge of its own.
    onConfirmed?: (jobIds: number[]) => void;
};

export function WhatsappDeliveryControl({
    dbName, schema, branchId, jobIds, mobile, customerLabel, disabled, disabledReason, onConfirmed,
}: Props) {
    const { sending, send, ConfirmDialog } = useSendWhatsappJobDelivery();
    const [otpDialogOpen, setOtpDialogOpen] = useState(false);
    const [otpJobIds, setOtpJobIds] = useState<number[]>(jobIds);
    const [otpPending, setOtpPending] = useState(false);

    const jobIdsKey = jobIds.join(",");
    const mobileValid = isValidMobile(mobile);

    // Checked once per job-set, not polled — this is only ever stale for the
    // rare case of a second, concurrent send for the same jobs (plans/plan.md
    // Watch-outs: "accepted limitation, not solved").
    useEffect(() => {
        let cancelled = false;
        if (!dbName || !schema || jobIds.length === 0) {
            setOtpPending(false);
            return;
        }
        getJobDeliveryOtpPending(dbName, schema, jobIds)
            .then(pending => { if (!cancelled) setOtpPending(pending); })
            .catch(() => { /* best-effort — "Verify Code" simply won't offer to reopen */ });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbName, schema, jobIdsKey]);

    async function handleSendClick() {
        if (!dbName || !schema || !branchId || jobIds.length === 0) return;
        const results = await send(dbName, schema, branchId, jobIds);
        const sent = results.find(r => r.status === "SENT");
        if (sent) {
            setOtpJobIds(sent.job_ids);
            setOtpPending(true);
            setOtpDialogOpen(true);
        }
    }

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5 px-3 text-sm border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={disabled || sending || !mobileValid}
                title={
                    !mobileValid
                        ? "No valid mobile number on file — use Invoice + Receipt / Delivery Note to print instead"
                        : disabled ? disabledReason : undefined
                }
                onClick={() => void handleSendClick()}
            >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WhatsAppIcon className="h-3.5 w-3.5" />}
                Whatsapp Delivery
            </Button>

            {otpPending && (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5 px-3 text-sm"
                    onClick={() => { setOtpJobIds(jobIds); setOtpDialogOpen(true); }}
                >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verify Code
                </Button>
            )}

            {ConfirmDialog}

            <VerifyOtpDialog
                open={otpDialogOpen}
                jobIds={otpJobIds}
                dbName={dbName}
                schema={schema}
                customerLabel={customerLabel}
                resending={sending}
                onClose={() => setOtpDialogOpen(false)}
                onVerified={(ids) => {
                    setOtpDialogOpen(false);
                    setOtpPending(false);
                    toast.success("Delivery confirmed.");
                    onConfirmed?.(ids);
                }}
                onResend={() => void handleSendClick()}
            />
        </>
    );
}
