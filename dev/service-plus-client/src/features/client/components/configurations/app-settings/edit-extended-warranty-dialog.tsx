import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { isValidMobile, normalizeMobile } from "@/lib/mobile";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { AppSettingRecord } from "@/features/client/types/app-setting";

// ─── Types ────────────────────────────────────────────────────────────────────

// The friendly editor for the one `extended_warranty` app_setting row, in place of the
// generic Simple/JSON editor every other key still uses. `enabled` is the add-on's master
// switch — it was its own app_setting row until the settings consolidation, so the JSON
// this dialog writes is what makes the Custom menu appear.
type ExtendedWarrantyValue = {
	auto_send_enabled: boolean;
	contact_phone: string;
	daily_send_cap: number;
	enabled: boolean;
	notify_email: string;
	reminder_days_before: number[];
	staff_whatsapp_number: string;
	whatsapp_number: string;
};

type EditExtendedWarrantyDialogProps = {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
	record: AppSettingRecord;
};

const DEFAULT_STAGES = [60, 30, 7, 0];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toObject(v: unknown): Record<string, unknown> {
	if (typeof v === "string") {
		try {
			const parsed: unknown = JSON.parse(v);
			return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
		} catch {
			return {};
		}
	}
	return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function toStages(v: unknown): number[] {
	if (!Array.isArray(v)) return [...DEFAULT_STAGES];
	const cleaned = v.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0);
	return cleaned.length > 0 ? [...new Set(cleaned)].sort((a, b) => b - a) : [...DEFAULT_STAGES];
}

function toText(v: unknown): string {
	return typeof v === "string" ? v : "";
}

function toValue(v: unknown): ExtendedWarrantyValue {
	const obj = toObject(v);
	return {
		auto_send_enabled: obj.auto_send_enabled === true,
		contact_phone: toText(obj.contact_phone),
		daily_send_cap: Number.isFinite(Number(obj.daily_send_cap)) ? Number(obj.daily_send_cap) : 250,
		enabled: obj.enabled === true,
		notify_email: toText(obj.notify_email),
		reminder_days_before: toStages(obj.reminder_days_before),
		staff_whatsapp_number: toText(obj.staff_whatsapp_number),
		whatsapp_number: toText(obj.whatsapp_number),
	};
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditExtendedWarrantyDialog = ({
	onOpenChange,
	onSuccess,
	open,
	record,
}: EditExtendedWarrantyDialogProps) => {
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const [newStage, setNewStage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [value, setValue] = useState<ExtendedWarrantyValue>(() => toValue(record.setting_value));

	// Pre-fill on open — same reset-on-open pattern as EditWhatsappNotificationsDialog.
	useEffect(() => {
		if (open) {
			setNewStage("");
			setValue(toValue(record.setting_value));
		}
	}, [open, record.setting_value]);

	function addStage() {
		const n = Number(newStage.trim());
		if (!Number.isInteger(n) || n < 0 || value.reminder_days_before.includes(n)) return;
		setValue((v) => ({ ...v, reminder_days_before: [...v.reminder_days_before, n].sort((a, b) => b - a) }));
		setNewStage("");
	}

	function removeStage(day: number) {
		// Never leave the list empty — with no stages nothing is ever due.
		if (value.reminder_days_before.length <= 1) return;
		setValue((v) => ({ ...v, reminder_days_before: v.reminder_days_before.filter((d) => d !== day) }));
	}

	function setField<K extends keyof ExtendedWarrantyValue>(key: K, next: ExtendedWarrantyValue[K]) {
		setValue((v) => ({ ...v, [key]: next }));
	}

	const capError = !Number.isInteger(value.daily_send_cap) || value.daily_send_cap < 0;
	const emailError = value.notify_email.trim() !== "" && !EMAIL_REGEX.test(value.notify_email.trim());
	const phoneErrors = {
		contact_phone: !isValidMobile(value.contact_phone),
		staff_whatsapp_number: !isValidMobile(value.staff_whatsapp_number),
		whatsapp_number: !isValidMobile(value.whatsapp_number),
	};
	const hasError = capError || emailError || Object.values(phoneErrors).some(Boolean);

	async function handleSave() {
		if (!dbName || !schema || hasError) return;
		setSubmitting(true);
		try {
			// Spread the stored object first so any key this dialog does not know about
			// survives the round trip — genericUpdate replaces setting_value wholesale.
			const merged = { ...toObject(record.setting_value), ...value };
			await apolloClient.mutate({
				mutation: GRAPHQL_MAP.genericUpdate,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericUpdateValue({
						tableName: "app_setting",
						xData: {
							id: record.id,
							setting_value: JSON.stringify(merged),
						},
					}),
				},
			});
			toast.success(MESSAGES.SUCCESS_EW_SETTINGS_SAVED);
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_EW_SETTINGS_SAVE_FAILED);
		} finally {
			setSubmitting(false);
		}
	}

	const switches: { hint: string; key: "auto_send_enabled" | "enabled"; label: string }[] = [
		{ hint: MESSAGES.INFO_EW_ENABLED_HINT, key: "enabled", label: "Enabled" },
		{ hint: MESSAGES.INFO_EW_AUTO_SEND_INERT, key: "auto_send_enabled", label: "Auto send" },
	];

	const numbers: {
		error: boolean;
		key: "contact_phone" | "staff_whatsapp_number" | "whatsapp_number";
		label: string;
	}[] = [
		{ error: phoneErrors.contact_phone, key: "contact_phone", label: "Contact phone" },
		{ error: phoneErrors.whatsapp_number, key: "whatsapp_number", label: "WhatsApp number" },
		{ error: phoneErrors.staff_whatsapp_number, key: "staff_whatsapp_number", label: "Staff WhatsApp number" },
	];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent aria-describedby={undefined} className="max-h-[85vh] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold text-foreground">
						Extended Warranty Settings
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-4 pt-1">
					<p className="text-sm text-(--cl-text-muted)">{MESSAGES.INFO_EW_SETTINGS_INTRO}</p>

					<div className="flex flex-col gap-3">
						{switches.map(({ hint, key, label }) => (
							<div
								key={key}
								className="flex items-center justify-between rounded-md border border-(--cl-border) bg-(--cl-surface-2) px-3 py-2.5"
							>
								<Label className="flex flex-col gap-0.5" htmlFor={`ew_${key}`}>
									<span className="text-sm font-medium text-(--cl-text)">{label}</span>
									<span className="text-xs text-(--cl-text-muted)">{hint}</span>
								</Label>
								<Switch
									checked={value[key]}
									id={`ew_${key}`}
									onCheckedChange={(next) => setField(key, next)}
								/>
							</div>
						))}
					</div>

					<div>
						<Label className="text-sm font-medium text-(--cl-text)">Reminder days before expiry</Label>
						<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
							{value.reminder_days_before.map((day) => (
								<span
									key={day}
									className="inline-flex items-center gap-1 rounded-md border border-(--cl-border) bg-(--cl-surface-2) px-2 py-1 text-xs font-medium text-(--cl-text)"
								>
									{day === 0 ? "On expiry" : `${day} days`}
									<button
										aria-label={`Remove ${day}`}
										className="cursor-pointer text-(--cl-text-muted) hover:text-(--cl-text) disabled:opacity-40"
										disabled={value.reminder_days_before.length <= 1}
										type="button"
										onClick={() => removeStage(day)}
									>
										<X className="h-3 w-3" />
									</button>
								</span>
							))}
							<Input
								className="h-7 w-20 text-xs"
								inputMode="numeric"
								placeholder="Days"
								value={newStage}
								onChange={(e) => setNewStage(e.target.value.replace(/\D/g, ""))}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										addStage();
									}
								}}
							/>
							<Button className="h-7 px-2" size="sm" type="button" variant="ghost" onClick={addStage}>
								<Plus className="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>

					<div>
						<Label className="text-sm font-medium text-(--cl-text)" htmlFor="ew_daily_send_cap">
							Daily send cap
						</Label>
						<Input
							className="mt-1"
							id="ew_daily_send_cap"
							inputMode="numeric"
							value={String(value.daily_send_cap)}
							onChange={(e) => setField("daily_send_cap", Number(e.target.value.replace(/\D/g, "") || 0))}
						/>
						{capError && <p className="mt-1 text-xs text-red-600">Enter 0 or more.</p>}
					</div>

					{numbers.map(({ error, key, label }) => (
						<div key={key}>
							<Label className="text-sm font-medium text-(--cl-text)" htmlFor={`ew_${key}`}>
								{label}
							</Label>
							<Input
								className="mt-1"
								id={`ew_${key}`}
								inputMode="numeric"
								value={value[key]}
								onChange={(e) => setField(key, normalizeMobile(e.target.value))}
							/>
							{error && (
								<p className="mt-1 text-xs text-red-600">Enter a valid 10-digit mobile number.</p>
							)}
						</div>
					))}

					<div>
						<Label className="text-sm font-medium text-(--cl-text)" htmlFor="ew_notify_email">
							Notify email
						</Label>
						<Input
							className="mt-1"
							id="ew_notify_email"
							value={value.notify_email}
							onChange={(e) => setField("notify_email", e.target.value)}
						/>
						{emailError && <p className="mt-1 text-xs text-red-600">Enter a valid email address.</p>}
					</div>
				</div>

				<DialogFooter className="pt-2">
					<Button disabled={submitting} type="button" variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
						disabled={hasError || submitting}
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
