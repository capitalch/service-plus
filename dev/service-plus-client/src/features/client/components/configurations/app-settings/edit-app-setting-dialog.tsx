import { useEffect, useRef, useState } from "react";
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

// Simple mode edits a bare scalar — `valueToString` strips the JSON quotes, so
// plain text like `example.com` is legitimate here and must NOT be JSON-parsed.
// It gets re-encoded to JSON on submit by `encodeSimpleValue`.
const simpleSchema = z.object({
    setting_value: z.string().min(1, "Value is required"),
    description:   z.string().optional(),
});

// JSON mode edits the raw JSON text, so it does have to parse.
const jsonSchema = z.object({
    setting_value: z.string().min(1, "Value is required").refine((v) => {
        try { JSON.parse(v); return true; } catch { return false; }
    }, "Must be valid JSON (e.g. {\"key\": \"value\"})"),
    description:   z.string().optional(),
});

type FormType = z.infer<typeof simpleSchema>;

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

/**
 * Turn what the user typed in Simple mode into the JSON text that the
 * `setting_value` jsonb column requires. Simple mode shows scalars unquoted, so
 * a plain string has to be re-quoted before it can be saved.
 */
function encodeSimpleValue(text: string, original: unknown): string {
    // Preserve the setting's existing type: a value already stored as a JSON
    // string stays one, so entering `123` there doesn't silently become a number.
    if (typeof original === "string") return JSON.stringify(text);

    const trimmed = text.trim();
    if (trimmed === "true" || trimmed === "false" || trimmed === "null") return trimmed;
    if (trimmed !== "" && Number.isFinite(Number(trimmed))) return trimmed;
    return JSON.stringify(text);
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
        resolver: zodResolver(valueMode === "json" ? jsonSchema : simpleSchema),
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

    // Re-validate when the mode changes: the resolver swaps with `valueMode`, so
    // an error raised under the old mode's rules has to be recomputed. Skipped on
    // first render so opening the dialog doesn't flag an untouched field.
    const skipModeValidation = useRef(true);
    useEffect(() => {
        if (skipModeValidation.current) { skipModeValidation.current = false; return; }
        form.trigger("setting_value");
    }, [valueMode, form]);

    function handleModeSwitch(m: ValueMode) {
        if (m === valueMode) return;
        const current = form.getValues("setting_value");

        if (m === "json") {
            // Show the real JSON for whatever Simple mode was holding, so the
            // textarea starts from valid, parseable text.
            const asJson = encodeSimpleValue(current, record.setting_value);
            try {
                form.setValue("setting_value", JSON.stringify(JSON.parse(asJson), null, 2));
            } catch {
                form.setValue("setting_value", asJson);
            }
        } else {
            // Back to Simple: unwrap a JSON scalar so the bare value is edited.
            // An object/array can't be shown unquoted, so it is left untouched.
            try {
                const parsed = JSON.parse(current);
                if (parsed === null || typeof parsed !== "object")
                    form.setValue("setting_value", String(parsed));
            } catch { /* leave as-is */ }
        }
        setValueMode(m);
    }

    async function onSubmit(data: FormType) {
        if (!dbName || !schema) return;
        // The column is jsonb, so Simple mode's bare scalar must be encoded as
        // JSON text; JSON mode is already exactly that.
        const settingValue = valueMode === "json"
            ? data.setting_value
            : encodeSimpleValue(data.setting_value, record.setting_value);
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
                            setting_value: settingValue,
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
                            {/* Mode toggle — real buttons, with the active one held visibly pressed */}
                            <div className="flex items-center gap-1.5">
                                {(["simple", "json"] as const).map(m => {
                                    const isActive = valueMode === m;
                                    return (
                                        <Button
                                            key={m}
                                            aria-pressed={isActive}
                                            className={isActive
                                                ? "translate-y-px inset-shadow-sm ring-1 ring-(--cl-accent)/40"
                                                : ""}
                                            size="xs"
                                            type="button"
                                            variant={isActive ? "default" : "outline"}
                                            onClick={() => handleModeSwitch(m)}
                                        >
                                            {m === "simple" ? "Simple" : "JSON"}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        {valueMode === "simple" ? (
                            <Input
                                autoComplete="off"
                                className="font-mono"
                                id="es_value"
                                placeholder="e.g. 18, true, or plain text"
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
