import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { AppSettingRecord } from "@/features/client/types/app-setting";

// ─── Types ────────────────────────────────────────────────────────────────────

// The editor is chosen by the stored value's type — there is no manual mode toggle.
// An object/array is edited as JSON; a number gets a numeric input; any other scalar
// is plain text. Booleans use a switch and never reach these schemas' rules.
type ValueKindType = "json" | "number" | "text";

type EditAppSettingDialogProps = {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
	record: AppSettingRecord;
};

const requiredValue = z.string().trim().min(1, MESSAGES.ERROR_APP_SETTING_VALUE_REQUIRED);

const SCHEMAS = {
	json: z.object({
		description: z.string().optional(),
		setting_value: requiredValue.refine((v) => {
			try {
				JSON.parse(v);
				return true;
			} catch {
				return false;
			}
		}, MESSAGES.ERROR_APP_SETTING_INVALID_JSON),
	}),
	number: z.object({
		description: z.string().optional(),
		setting_value: requiredValue
			.refine((v) => Number.isFinite(Number(v)), MESSAGES.ERROR_APP_SETTING_NOT_A_NUMBER)
			.refine((v) => !(Number(v) < 0), MESSAGES.ERROR_APP_SETTING_NEGATIVE_NUMBER),
	}),
	text: z.object({
		description: z.string().optional(),
		setting_value: requiredValue,
	}),
};

type FormType = z.infer<typeof SCHEMAS.text>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectKind(v: unknown): ValueKindType {
	if (v !== null && typeof v === "object") return "json";
	if (typeof v === "number") return "number";
	return "text";
}

/**
 * Turn the edited text into the JSON text that the `setting_value` jsonb column
 * requires, keeping the setting's stored type: a number stays a number, text is
 * re-quoted, and JSON is already JSON.
 */
function encodeValue(text: string, kind: ValueKindType, original: unknown): string {
	if (kind === "json") return text;
	if (kind === "number") return String(Number(text.trim()));
	if (typeof original === "boolean") return text.trim();
	return JSON.stringify(text);
}

// A setting stored as true/false (or the text "true"/"false") is edited with a switch, not free text.
function isBooleanValue(v: unknown): boolean {
	return typeof v === "boolean" || v === "true" || v === "false";
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

export const EditAppSettingDialog = ({ onOpenChange, onSuccess, open, record }: EditAppSettingDialogProps) => {
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const isBoolean = isBooleanValue(record.setting_value);
	const valueKind = detectKind(record.setting_value);

	const form = useForm<FormType>({
		defaultValues: {
			description: record.description ?? "",
			setting_value: valueToString(record.setting_value),
		},
		mode: "onChange",
		resolver: zodResolver(SCHEMAS[valueKind]),
	});

	const {
		formState: { errors },
	} = form;

	// Pre-fill on open
	useEffect(() => {
		if (!open) return;
		form.reset({
			description: record.description ?? "",
			setting_value: valueToString(record.setting_value),
		});
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onSubmit(data: FormType) {
		if (!dbName || !schema) return;
		// The column is jsonb, so the edited text must be encoded as JSON text.
		const settingValue = encodeValue(data.setting_value, valueKind, record.setting_value);
		try {
			await apolloClient.mutate({
				mutation: GRAPHQL_MAP.genericUpdate,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericUpdateValue({
						tableName: "app_setting",
						xData: {
							id: record.id,
							setting_value: settingValue,
							description: data.description || null,
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

	const switchOn = form.watch("setting_value").trim() === "true";

	const submitDisabled = Object.keys(errors).length > 0 || form.formState.isSubmitting;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent aria-describedby={undefined} className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold text-foreground">Edit App Setting</DialogTitle>
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
					{isBoolean ? (
						<div className="flex items-center justify-between gap-3 rounded-md border border-(--cl-border) px-3 py-2.5">
							<Label htmlFor="es_value">{switchOn ? "On (true)" : "Off (false)"}</Label>
							<Switch
								checked={switchOn}
								id="es_value"
								onCheckedChange={(checked) =>
									form.setValue("setting_value", String(checked), { shouldDirty: true })
								}
							/>
						</div>
					) : (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="es_value">
								Value <span className="text-red-500">*</span>
							</Label>
							{valueKind === "json" ? (
								<Textarea
									autoComplete="off"
									className="font-mono text-sm"
									id="es_value"
									placeholder={'{\n  "key": "value"\n}'}
									rows={6}
									{...form.register("setting_value")}
								/>
							) : (
								<Input
									autoComplete="off"
									className="font-mono"
									id="es_value"
									inputMode={valueKind === "number" ? "decimal" : undefined}
									placeholder={valueKind === "number" ? "e.g. 18" : "Enter value"}
									{...form.register("setting_value")}
								/>
							)}
							<FieldError message={errors.setting_value?.message} />
						</div>
					)}

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
						<Button
							disabled={form.formState.isSubmitting}
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
						>
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
