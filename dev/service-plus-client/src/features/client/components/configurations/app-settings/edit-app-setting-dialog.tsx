import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { AppSettingRecord } from "@/features/client/types/app-setting";

// ─── Types ────────────────────────────────────────────────────────────────────

type ValueMode = "simple" | "json";

type EditAppSettingDialogProps = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    record:       AppSettingRecord;
};

const formSchema = z.object({
    setting_value: z.string().min(1, "Value is required").refine((v) => {
        try { JSON.parse(v); return true; } catch { return false; }
    }, "Must be a valid JSON value (e.g. 18, true, \"text\", or {\"key\": \"value\"})"),
    description:   z.string().optional(),
});

type FormType = z.infer<typeof formSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectMode(v: unknown): ValueMode {
    if (v !== null && typeof v === "object") return "json";
    return "simple";
}

function valueToString(v: unknown): string {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v, null, 2);
    return String(v);
}

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditAppSettingDialog = ({
    onOpenChange,
    onSuccess,
    open,
    record,
}: EditAppSettingDialogProps) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [valueMode, setValueMode] = useState<ValueMode>(() => detectMode(record.setting_value));

    const form = useForm<FormType>({
        defaultValues: {
            setting_value: valueToString(record.setting_value),
            description:   record.description ?? "",
        },
        mode:     "onChange",
        resolver: zodResolver(formSchema),
    });

    const { formState: { errors } } = form;

    // Pre-fill on open
    useEffect(() => {
        if (!open) return;
        const mode = detectMode(record.setting_value);
        setValueMode(mode);
        form.reset({
            setting_value: valueToString(record.setting_value),
            description:   record.description ?? "",
        });
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleModeSwitch(m: ValueMode) {
        if (m === "json") {
            try {
                const parsed = JSON.parse(form.getValues("setting_value"));
                if (typeof parsed === "object" && parsed !== null)
                    form.setValue("setting_value", JSON.stringify(parsed, null, 2), { shouldValidate: true });
            } catch { /* leave as-is */ }
        }
        setValueMode(m);
    }

    async function onSubmit(data: FormType) {
        if (!dbName || !schema) return;
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
                            setting_value: data.setting_value,
                            description:   data.description || null,
                        },
                    }),
                },
            });
            toast.success("App setting updated.");
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error("Failed to update app setting.");
        }
    }

    const submitDisabled = Object.keys(errors).length > 0 || form.formState.isSubmitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Edit App Setting
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Key — read-only */}
                    <div className="flex flex-col gap-1.5">
                        <Label>Key</Label>
                        <div className="rounded-md border border-(--cl-border) bg-(--cl-surface-3) px-3 py-2 font-mono text-sm text-(--cl-text-muted)">
                            {record.setting_key}
                        </div>
                    </div>

                    {/* Value */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="es_value">
                                Value <span className="text-red-500">*</span>
                            </Label>
                            {/* Mode toggle */}
                            <div className="flex gap-0.5 rounded-md border border-(--cl-border) bg-(--cl-surface-3) p-0.5">
                                {(["simple", "json"] as const).map(m => (
                                    <button
                                        key={m}
                                        className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
                                            valueMode === m
                                                ? "bg-white dark:bg-zinc-800 text-(--cl-text) shadow-sm"
                                                : "text-(--cl-text-muted) hover:text-(--cl-text)"
                                        }`}
                                        type="button"
                                        onClick={() => handleModeSwitch(m)}
                                    >
                                        {m === "simple" ? "Simple" : "JSON"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {valueMode === "simple" ? (
                            <Input
                                autoComplete="off"
                                className="font-mono"
                                id="es_value"
                                placeholder='e.g. 18, true, "some text"'
                                {...form.register("setting_value")}
                            />
                        ) : (
                            <Textarea
                                autoComplete="off"
                                className="font-mono text-sm"
                                id="es_value"
                                placeholder={'{\n  "key": "value"\n}'}
                                rows={6}
                                {...form.register("setting_value")}
                            />
                        )}
                        <FieldError message={errors.setting_value?.message} />
                    </div>

                    {/* Description */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="es_desc">Description</Label>
                        <Input
                            autoComplete="off"
                            id="es_desc"
                            placeholder="Optional description"
                            {...form.register("description")}
                        />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button disabled={form.formState.isSubmitting} type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                            disabled={submitDisabled}
                            type="submit"
                        >
                            {form.formState.isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
