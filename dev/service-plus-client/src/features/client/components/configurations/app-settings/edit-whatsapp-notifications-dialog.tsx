import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { AppSettingRecord } from "@/features/client/types/app-setting";

// ─── Types ────────────────────────────────────────────────────────────────────

// Keys mirror job.whatsapp_notifications' own event keys (plans/plan.md) — this
// dialog is the friendly editor for that one app_setting row, in place of the
// generic Simple/JSON editor every other setting key still uses.
type WhatsappNotificationsValue = {
    JOB_CREATION:      boolean;
    JOB_COMPLETION:    boolean;
    JOB_DELIVERY:      boolean;
    JOB_MONEY_RECEIPT: boolean;
    JOB_INVOICE:       boolean;
};

type EditWhatsappNotificationsDialogProps = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    record:       AppSettingRecord;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toValue(v: unknown): WhatsappNotificationsValue {
    const obj = (v && typeof v === "object") ? v as Record<string, unknown> : {};
    return {
        JOB_CREATION:      obj.JOB_CREATION === true,
        JOB_COMPLETION:    obj.JOB_COMPLETION === true,
        JOB_DELIVERY:      obj.JOB_DELIVERY === true,
        JOB_MONEY_RECEIPT: obj.JOB_MONEY_RECEIPT === true,
        JOB_INVOICE:       obj.JOB_INVOICE === true,
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditWhatsappNotificationsDialog = ({
    onOpenChange,
    onSuccess,
    open,
    record,
}: EditWhatsappNotificationsDialogProps) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [value,      setValue]      = useState<WhatsappNotificationsValue>(() => toValue(record.setting_value));
    const [submitting, setSubmitting] = useState(false);

    // Pre-fill on open — same reset-on-open pattern as EditAppSettingDialog.
    useEffect(() => {
        if (open) setValue(toValue(record.setting_value));
    }, [open, record.setting_value]);

    function toggle(key: keyof WhatsappNotificationsValue) {
        setValue(v => ({ ...v, [key]: !v[key] }));
    }

    async function handleSave() {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "app_setting",
                        xData: {
                            id:            record.id,
                            setting_value: JSON.stringify(value),
                        },
                    }),
                },
            });
            toast.success("WhatsApp notification settings updated.");
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error("Failed to update WhatsApp notification settings.");
        } finally {
            setSubmitting(false);
        }
    }

    const rows: { key: keyof WhatsappNotificationsValue; label: string; note?: string }[] = [
        { key: "JOB_CREATION",      label: "Job Intake Message" },
        { key: "JOB_COMPLETION",    label: "Job Completed" },
        { key: "JOB_DELIVERY",      label: "Job Delivery" },
        { key: "JOB_MONEY_RECEIPT", label: "Money Receipt" },
        { key: "JOB_INVOICE",       label: "Invoice" },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        WhatsApp Notifications
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4 pt-1">
                    <p className="text-sm text-(--cl-text-muted)">
                        Turn outbound WhatsApp messages on or off per event, for this business unit.
                    </p>

                    <div className="flex flex-col gap-3">
                        {rows.map(({ key, label, note }) => (
                            <div
                                key={key}
                                className="flex items-center justify-between rounded-md border border-(--cl-border) bg-(--cl-surface-2) px-3 py-2.5"
                            >
                                <Label className="flex flex-col gap-0.5" htmlFor={`wn_${key}`}>
                                    <span className="text-sm font-medium text-(--cl-text)">{label}</span>
                                    {note && (
                                        <span className="text-xs text-(--cl-text-muted)">{note}</span>
                                    )}
                                </Label>
                                <Switch
                                    checked={value[key]}
                                    id={`wn_${key}`}
                                    onCheckedChange={() => toggle(key)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter className="pt-2">
                    <Button disabled={submitting} type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                        disabled={submitting}
                        type="button"
                        onClick={() => void handleSave()}
                    >
                        {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
