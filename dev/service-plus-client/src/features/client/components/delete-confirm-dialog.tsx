import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangleIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeleteConfirmDialogPropsType = {
    open:               boolean;
    onOpenChange:       (open: boolean) => void;
    onSuccess:          () => void;
    title:              string;
    entityName:         string;
    confirmKey:         string;
    confirmKeyClass?:   string;
    confirmInputClass?: string;
    confirmMatch?:      (typed: string, key: string) => boolean;
    blockedMessage?:    string | null;
    inUseMessage?:      string;
    onCheckInUse?:      () => Promise<boolean | null>;
    onDelete:           () => Promise<void>;
    toastMessages:      { success: string; error: string };
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteConfirmDialog = ({
    open,
    onOpenChange,
    onSuccess,
    title,
    entityName,
    confirmKey,
    confirmKeyClass,
    confirmInputClass,
    confirmMatch = (typed, key) => typed.toLowerCase() === key.toLowerCase(),
    blockedMessage,
    inUseMessage,
    onCheckInUse,
    onDelete,
    toastMessages,
}: DeleteConfirmDialogPropsType) => {
    const [checkingInUse, setCheckingInUse] = useState(false);
    const [confirmValue,  setConfirmValue]  = useState("");
    const [inUse,         setInUse]         = useState<boolean | null>(null);
    const [submitting,    setSubmitting]    = useState(false);

    useEffect(() => {
        if (!open) {
            setCheckingInUse(false);
            setConfirmValue("");
            setInUse(null);
            setSubmitting(false);
            return;
        }
        if (blockedMessage || !onCheckInUse) return;
        setCheckingInUse(true);
        onCheckInUse()
            .then((result) => setInUse(result))
            .catch(() => setInUse(null))
            .finally(() => setCheckingInUse(false));
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const isBlocked       = !!blockedMessage || inUse === true;
    // Require the in-use check to have resolved to false (not null) before enabling delete.
    // When no onCheckInUse is provided, treat it as resolved.
    const inUseCheckPassed = !onCheckInUse || inUse === false;
    const deleteEnabled    = inUseCheckPassed && !isBlocked && !checkingInUse && confirmMatch(confirmValue, confirmKey);

    async function handleDelete() {
        setSubmitting(true);
        try {
            await onDelete();
            toast.success(toastMessages.success);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(toastMessages.error);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" overlayStyle={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "none" }}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Permanently delete{" "}
                        <span className="font-semibold text-slate-800">{entityName}</span>?
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <p className="text-sm text-slate-600">This action cannot be undone.</p>

                    {(blockedMessage || inUse === true) && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <p className="text-sm text-amber-800">
                                {blockedMessage || inUseMessage}
                            </p>
                        </div>
                    )}

                    {!isBlocked && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="delete_confirm_input">
                                Type{" "}
                                <span className={`font-semibold text-slate-800${confirmKeyClass ? ` ${confirmKeyClass}` : ""}`}>
                                    {confirmKey}
                                </span>{" "}
                                to confirm
                            </Label>
                            <Input
                                autoComplete="off"
                                className={confirmInputClass}
                                id="delete_confirm_input"
                                placeholder={confirmKey}
                                value={confirmValue}
                                onChange={(e) => setConfirmValue(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button disabled={submitting} variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        disabled={submitting || checkingInUse || !deleteEnabled}
                        onClick={handleDelete}
                    >
                        {(submitting || checkingInUse) ? (
                            <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
