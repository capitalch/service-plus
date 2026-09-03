import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import { verifyJobDeliveryOtp, type VerifyJobDeliveryOtpStatus } from "../verify-job-delivery-otp";

// Distinct wording per outcome (plans/plan.md, Step 4) — "wrong code" and
// "expired"/"locked out" point the staff member at different next actions
// (retry vs. resend), so they're never collapsed into one generic error.
const STATUS_MESSAGE: Record<Exclude<VerifyJobDeliveryOtpStatus, "CONFIRMED">, string> = {
    INCORRECT_CODE:    "Incorrect code. Please try again.",
    EXPIRED:           "This code has expired. Use “Resend Code” to get a new one.",
    TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Use “Resend Code” to get a new one.",
    NO_PENDING_OTP:    "No pending code found for these jobs. Use “Resend Code”.",
    JOB_SET_MISMATCH:  "These jobs don't share one delivery code — use “Resend Code”.",
};

// No no-mobile state here — WhatsappDeliveryControl only ever opens this
// dialog after a successful send, which itself requires a valid mobile
// (the send button is disabled otherwise), so that case can't occur here.
type Props = {
    open:          boolean;
    jobIds:        number[];
    dbName:        string | null;
    schema:        string | null;
    customerLabel: string;
    resending:     boolean;
    onClose:       () => void;
    onVerified:    (jobIds: number[]) => void;
    onResend:      () => void;
};

export function VerifyOtpDialog({
    open, jobIds, dbName, schema, customerLabel, resending,
    onClose, onVerified, onResend,
}: Props) {
    const [code, setCode] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const jobIdsKey = jobIds.join(",");

    // Fresh state every time the dialog opens against a (possibly new, after
    // a resend) job_ids set — a stale error from a previous code should never
    // linger onto the next one.
    useEffect(() => {
        if (open) {
            setCode("");
            setErrorMessage(null);
        }
    }, [open, jobIdsKey]);

    async function handleVerify() {
        if (!dbName || !schema || code.length !== 4) return;
        setVerifying(true);
        setErrorMessage(null);
        try {
            const result = await verifyJobDeliveryOtp(dbName, schema, jobIds, code);
            if (result.status === "CONFIRMED") {
                onVerified(result.job_ids);
            } else {
                setErrorMessage(STATUS_MESSAGE[result.status]);
                setCode("");
            }
        } catch {
            setErrorMessage("Verification failed. Please try again.");
        } finally {
            setVerifying(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Verify Delivery Code</DialogTitle>
                    <p className="text-sm text-(--cl-text-muted) mt-0.5">{customerLabel}</p>
                </DialogHeader>

                <div className="py-2 space-y-3">
                    <p className="text-sm text-(--cl-text)">
                        Ask the customer to read out the 4-digit code from the WhatsApp message, and
                        enter it below.
                    </p>
                    <Input
                        autoFocus
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="0000"
                        className="h-11 text-center text-2xl tracking-[0.5em] font-mono"
                        value={code}
                        onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setErrorMessage(null); }}
                        onKeyDown={e => { if (e.key === "Enter" && code.length === 4) void handleVerify(); }}
                    />
                    {errorMessage && (
                        <p className="text-xs text-red-500">{errorMessage}</p>
                    )}
                </div>

                <DialogFooter className="sm:justify-between">
                    <Button variant="outline" size="sm" disabled={resending} onClick={onResend}>
                        {resending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Resend Code
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>Close</Button>
                        <Button
                            disabled={code.length !== 4 || verifying}
                            onClick={() => void handleVerify()}
                        >
                            {verifying
                                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                            }
                            Verify
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
