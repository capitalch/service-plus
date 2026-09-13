import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangleIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { ewSettingsSchema } from "@/features/client/components/custom/extended-warranty/extended-warranty-schema";
import type { EwSettingsFormType } from "@/features/client/components/custom/extended-warranty/extended-warranty-schema";
import type { AppSettingRecord } from "@/features/client/types/app-setting";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema, setExtendedWarrantyEnabled } from "@/store/context-slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

type Props = {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
	record: AppSettingRecord;
};

type NumberFieldType = "contact_phone" | "staff_whatsapp_number" | "whatsapp_number";

function text(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function toObject(value: unknown): Record<string, unknown> {
	if (typeof value === "string") {
		try {
			const parsed: unknown = JSON.parse(value);
			return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
		} catch {
			return {};
		}
	}
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toForm(value: unknown): EwSettingsFormType {
	const obj = toObject(value);
	const cap = Number(obj.daily_send_cap);
	return {
		contact_phone: text(obj.contact_phone),
		daily_send_cap: String(Number.isInteger(cap) && cap >= 0 ? cap : 250),
		enabled: obj.enabled === true,
		notify_email: text(obj.notify_email),
		staff_whatsapp_number: text(obj.staff_whatsapp_number),
		whatsapp_number: text(obj.whatsapp_number),
	};
}

/**
 * The friendly editor for the `extended_warranty` app_setting row (§C8), in place of the
 * generic JSON editor. Reminder windows are fixed (D13), so there is nothing to configure
 * about them. Saving refreshes the Custom menu flag straight away.
 */
export const EditExtendedWarrantyDialog = ({ onOpenChange, onSuccess, open, record }: Props) => {
	const dbName = useAppSelector(selectDbName);
	const dispatch = useAppDispatch();
	const schema = useAppSelector(selectSchema);
	const [submitting, setSubmitting] = useState(false);

	const form = useForm<EwSettingsFormType>({
		defaultValues: toForm(record.setting_value),
		mode: "onChange",
		resolver: zodResolver(ewSettingsSchema),
	});
	const {
		formState: { errors, isValid },
	} = form;
	const enabled = useWatch({ control: form.control, name: "enabled" });
	const notifyEmail = useWatch({ control: form.control, name: "notify_email" });
	const staffNumber = useWatch({ control: form.control, name: "staff_whatsapp_number" });

	// Re-read the stored row every time the dialog opens.
	useEffect(() => {
		if (open) form.reset(toForm(record.setting_value));
	}, [open, record.setting_value]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onSubmit(values: EwSettingsFormType) {
		if (!dbName || !schema) return;
		setSubmitting(true);
		try {
			// Spread the stored object first so a key this dialog does not know survives —
			// genericUpdate replaces setting_value wholesale.
			const merged = {
				...toObject(record.setting_value),
				contact_phone: values.contact_phone.trim(),
				daily_send_cap: Number(values.daily_send_cap),
				enabled: values.enabled,
				notify_email: values.notify_email.trim(),
				staff_whatsapp_number: values.staff_whatsapp_number.trim(),
				whatsapp_number: values.whatsapp_number.trim(),
			};
			await apolloClient.mutate({
				mutation: GRAPHQL_MAP.genericUpdate,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericUpdateValue({
						tableName: "app_setting",
						xData: { id: record.id, setting_value: JSON.stringify(merged) },
					}),
				},
			});
			dispatch(setExtendedWarrantyEnabled(values.enabled));
			toast.success(MESSAGES.SUCCESS_EW_SETTINGS_SAVED);
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_EW_SETTINGS_SAVE_FAILED);
		} finally {
			setSubmitting(false);
		}
	}

	const numbers: { key: NumberFieldType; label: string; required: boolean }[] = [
		{ key: "contact_phone", label: "Contact phone", required: enabled },
		{ key: "whatsapp_number", label: "WhatsApp number", required: enabled },
		{ key: "staff_whatsapp_number", label: "Staff WhatsApp number", required: false },
	];

	return (
		<Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
			<DialogContent aria-describedby={undefined} className="max-h-[85vh] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold text-foreground">
						Extended Warranty Settings
					</DialogTitle>
				</DialogHeader>

				<form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
					<p className="text-sm text-(--cl-text-muted)">{MESSAGES.INFO_EW_SETTINGS_INTRO}</p>

					<div className="flex items-center justify-between rounded-md border border-(--cl-border) bg-(--cl-surface-2) px-3 py-2.5">
						<Label className="flex flex-col gap-0.5" htmlFor="ew_enabled">
							<span className="text-sm font-medium text-(--cl-text)">Enabled</span>
							<span className="text-xs text-(--cl-text-muted)">{MESSAGES.INFO_EW_ENABLED_HINT}</span>
						</Label>
						<Switch
							checked={enabled}
							id="ew_enabled"
							onCheckedChange={(next) =>
								form.setValue("enabled", next, { shouldDirty: true, shouldValidate: true })
							}
						/>
					</div>

					{numbers.map(({ key, label, required }) => (
						<div key={key}>
							<Label className="text-sm font-medium text-(--cl-text)" htmlFor={`ew_${key}`}>
								{label} {required && <span className="text-red-600">*</span>}
							</Label>
							<Input className="mt-1" id={`ew_${key}`} inputMode="numeric" {...form.register(key)} />
							{errors[key] && <p className="mt-1 text-xs text-red-600">{errors[key]?.message}</p>}
						</div>
					))}

					<div>
						<Label className="text-sm font-medium text-(--cl-text)" htmlFor="ew_notify_email">
							Notify email
						</Label>
						<Input className="mt-1" id="ew_notify_email" {...form.register("notify_email")} />
						{errors.notify_email && (
							<p className="mt-1 text-xs text-red-600">{errors.notify_email.message}</p>
						)}
					</div>

					{!staffNumber.trim() && !notifyEmail.trim() && (
						<p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
							<AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
							{MESSAGES.INFO_EW_NO_NOTIFY_CHANNEL}
						</p>
					)}

					<div>
						<Label className="text-sm font-medium text-(--cl-text)" htmlFor="ew_daily_send_cap">
							Daily send cap
						</Label>
						<Input
							className="mt-1"
							id="ew_daily_send_cap"
							inputMode="numeric"
							{...form.register("daily_send_cap")}
						/>
						<p className="mt-1 text-xs text-(--cl-text-muted)">{MESSAGES.INFO_EW_CAP_HINT}</p>
						{errors.daily_send_cap && (
							<p className="mt-1 text-xs text-red-600">{errors.daily_send_cap.message}</p>
						)}
					</div>

					<DialogFooter className="pt-2">
						<Button disabled={submitting} type="button" variant="ghost" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
							disabled={!isValid || submitting}
							type="submit"
						>
							{submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
							Save Changes
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
