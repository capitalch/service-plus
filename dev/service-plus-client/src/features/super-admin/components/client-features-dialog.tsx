import { useEffect } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import type { Control, UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { CheckIcon, Loader2, ToggleRightIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { enquiryErrorMessage, runEnquiryMutation } from "@/components/shared/enquiries/enquiry-mutation";
import { BU_FEATURE_LIST } from "@/constants/bu-features";
import type { BuFeatureInfoType } from "@/constants/bu-features";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { useGenericQuery } from "@/features/client/components/reports/common/use-generic-query";
import type { ClientType } from "@/features/super-admin/types";
import { cn } from "@/lib/utils";
import type { Bu } from "@/types/db-schema-security";

type ClientFeaturesDialogPropsType = {
	client: ClientType;
	onOpenChange: (open: boolean) => void;
};

/** One row of GET_BU_FEATURES. `features` is read through to_jsonb, so it is always a list. */
type BuFeatureRowType = Pick<Bu, "code" | "id" | "is_active" | "name"> & { features: string[] };

const formSchema = z.object({
	bus: z.array(
		z.object({
			code: z.string(),
			features: z.array(z.string()),
			id: z.number(),
			is_active: z.boolean(),
			name: z.string(),
		}),
	),
});

type FeaturesFormType = z.infer<typeof formSchema>;

function toggle(features: string[], key: string, on: boolean): string[] {
	return on ? [...new Set([...features, key])].sort() : features.filter((f) => f !== key);
}

/** Feature cells that differ from what was loaded. */
function countChanges(initial: FeaturesFormType["bus"], current: FeaturesFormType["bus"]): number {
	return current.reduce((sum, bu, index) => {
		const before = initial[index]?.features ?? [];
		return sum + BU_FEATURE_LIST.filter((f) => before.includes(f.key) !== bu.features.includes(f.key)).length;
	}, 0);
}

// ─── A large, high-contrast tick box ──────────────────────────────────────────
// Own styling rather than components/ui/checkbox: that one is a small box with an emerald tick,
// which disappears on a filled background. This is the one control of the dialog, so it is big.

type BigCheckboxPropsType = {
	checked: boolean;
	label: string;
	onChange: (checked: boolean) => void;
	size?: "lg" | "md";
};

const BigCheckbox = ({ checked, label, onChange, size = "lg" }: BigCheckboxPropsType) => (
	<CheckboxPrimitive.Root
		aria-label={label}
		checked={checked}
		className={cn(
			"flex shrink-0 cursor-pointer items-center justify-center rounded-[6px] border-2 border-slate-300 bg-white shadow-sm transition-colors outline-none hover:border-teal-500 focus-visible:ring-3 focus-visible:ring-teal-500/40 data-[state=checked]:border-teal-600 data-[state=checked]:bg-teal-600",
			size === "lg" ? "size-6" : "size-5",
		)}
		onCheckedChange={(value) => onChange(value === true)}
	>
		<CheckboxPrimitive.Indicator>
			<CheckIcon className={cn("text-white", size === "lg" ? "size-4" : "size-3.5")} strokeWidth={3.5} />
		</CheckboxPrimitive.Indicator>
	</CheckboxPrimitive.Root>
);

// ─── One feature for one BU: a whole clickable tile ───────────────────────────

type FeatureTilePropsType = {
	buName: string;
	control: Control<FeaturesFormType>;
	feature: BuFeatureInfoType;
	index: number;
};

const FeatureTile = ({ buName, control, feature, index }: FeatureTilePropsType) => (
	<Controller
		control={control}
		name={`bus.${index}.features`}
		render={({ field }) => {
			const on = field.value.includes(feature.key);
			return (
				<label
					className={cn(
						"flex cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2 transition-colors select-none",
						on
							? "border-teal-500 bg-teal-50 hover:bg-teal-100/70"
							: "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
					)}
				>
					<BigCheckbox
						checked={on}
						label={`${feature.label} for ${buName}`}
						onChange={(checked) => field.onChange(toggle(field.value, feature.key, checked))}
					/>
					<span className="flex min-w-0 flex-col">
						<span className="truncate text-sm font-medium text-slate-800">{feature.label}</span>
						<span className={cn("text-xs font-semibold", on ? "text-teal-700" : "text-slate-400")}>
							{on ? "On" : "Off"}
						</span>
					</span>
				</label>
			);
		}}
	/>
);

// ─── A feature's header: name, count, and the "all BUs" switch ────────────────

type FeatureHeaderPropsType = {
	control: Control<FeaturesFormType>;
	feature: BuFeatureInfoType;
	setValue: UseFormSetValue<FeaturesFormType>;
};

/** Ticked when every BU has the feature; a click gives it to all of them, or takes it from all. */
const FeatureHeader = ({ control, feature, setValue }: FeatureHeaderPropsType) => {
	const bus = useWatch({ control, name: "bus" });
	const onCount = bus.filter((bu) => bu.features.includes(feature.key)).length;
	const allOn = bus.length > 0 && onCount === bus.length;

	function setAll(on: boolean) {
		bus.forEach((bu, index) =>
			setValue(`bus.${index}.features`, toggle(bu.features, feature.key, on), { shouldDirty: true }),
		);
	}

	return (
		<div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0">
				<p className="text-sm font-semibold text-slate-800">{feature.label}</p>
				<p className="text-xs text-slate-500">{feature.description}</p>
				<p className="mt-1 text-xs font-medium text-slate-600">
					{MESSAGES.BU_FEATURES_ON_COUNT.replace("{on}", String(onCount)).replace(
						"{total}",
						String(bus.length),
					)}
				</p>
			</div>
			<label
				className={cn(
					"flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors select-none",
					allOn
						? "border-teal-500 bg-teal-50 text-teal-800"
						: "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
				)}
			>
				<BigCheckbox
					checked={allOn}
					label={`${feature.label} for all business units`}
					size="md"
					onChange={setAll}
				/>
				All business units
			</label>
		</div>
	);
};

// ─── Dialog ───────────────────────────────────────────────────────────────────

/** Super Admin → Clients → Features: switch optional features on per BU of one client. */
export const ClientFeaturesDialog = ({ client, onOpenChange }: ClientFeaturesDialogPropsType) => {
	const dbName = client.db_name ?? "";
	const query = useGenericQuery<BuFeatureRowType>({
		dbName,
		enabled: !!client.db_name,
		schema: "security",
		sqlId: SQL_MAP.GET_BU_FEATURES,
	});
	const form = useForm<FeaturesFormType>({
		defaultValues: { bus: [] },
		mode: "onChange",
		resolver: zodResolver(formSchema),
	});
	const { fields } = useFieldArray({ control: form.control, keyName: "fieldKey", name: "bus" });
	const {
		formState: { defaultValues, isDirty, isSubmitting, isValid },
	} = form;
	const current = useWatch({ control: form.control, name: "bus" });
	const changes = countChanges((defaultValues?.bus ?? []) as FeaturesFormType["bus"], current);

	useEffect(() => {
		form.reset({ bus: query.data.map((bu) => ({ ...bu, features: [...(bu.features ?? [])].sort() })) });
	}, [form, query.data]);

	useEffect(() => {
		if (query.error) toast.error(MESSAGES.ERROR_BU_FEATURES_LOAD_FAILED);
	}, [query.error]);

	async function submit(values: FeaturesFormType) {
		try {
			await runEnquiryMutation(GRAPHQL_MAP.setBuFeatures, "setBuFeatures", dbName, {
				bus: values.bus.map((bu) => ({ features: bu.features, id: bu.id })),
			});
			toast.success(MESSAGES.SUCCESS_BU_FEATURES_SAVED);
			form.reset(values);
			query.refetch();
		} catch (error) {
			toast.error(enquiryErrorMessage(error, MESSAGES.ERROR_BU_FEATURES_SAVE_FAILED));
		}
	}

	return (
		<Dialog open onOpenChange={onOpenChange}>
			<DialogContent className="gap-5 sm:max-w-2xl">
				<DialogHeader className="flex-row items-start gap-3 space-y-0">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
						<ToggleRightIcon className="size-5" />
					</span>
					<div className="flex min-w-0 flex-col gap-1 text-left">
						<DialogTitle className="text-base font-semibold">Features — {client.name}</DialogTitle>
						<DialogDescription className="text-sm text-slate-500">
							{MESSAGES.BU_FEATURES_DIALOG_INTRO}
						</DialogDescription>
					</div>
				</DialogHeader>

				<form className="flex flex-col gap-5" onSubmit={form.handleSubmit(submit)}>
					{query.loading && !fields.length ? (
						<div className="flex justify-center py-10">
							<Loader2 className="h-5 w-5 animate-spin text-slate-400" />
						</div>
					) : !fields.length ? (
						<p className="py-8 text-center text-sm text-slate-500">{MESSAGES.BU_FEATURES_NO_BUS}</p>
					) : (
						<div className="flex max-h-[60vh] flex-col gap-5 overflow-auto pr-1">
							{BU_FEATURE_LIST.map((feature) => (
								<section className="flex flex-col gap-2" key={feature.key}>
									<FeatureHeader control={form.control} feature={feature} setValue={form.setValue} />
									<ul className="flex flex-col gap-2">
										{fields.map((bu, index) => (
											<li
												className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
												key={bu.fieldKey}
											>
												<div className={cn("min-w-0", !bu.is_active && "opacity-60")}>
													<p className="truncate font-medium text-slate-800">{bu.name}</p>
													<p className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
														{bu.code}
														{!bu.is_active && (
															<span className="rounded bg-slate-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-500 uppercase">
																Inactive
															</span>
														)}
													</p>
												</div>
												<div className="sm:w-56">
													<FeatureTile
														buName={bu.name}
														control={form.control}
														feature={feature}
														index={index}
													/>
												</div>
											</li>
										))}
									</ul>
								</section>
							))}
						</div>
					)}

					<DialogFooter className="items-center gap-2 sm:justify-between">
						<p className={cn("text-sm", changes ? "font-medium text-amber-700" : "text-slate-400")}>
							{changes
								? MESSAGES.BU_FEATURES_UNSAVED.replace("{count}", String(changes))
								: MESSAGES.BU_FEATURES_NO_CHANGES}
						</p>
						<div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								Close
							</Button>
							<Button
								className="bg-teal-600 text-white hover:bg-teal-700"
								disabled={!isDirty || !isValid || isSubmitting || !fields.length || !changes}
								type="submit"
							>
								{isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
								Save
							</Button>
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
