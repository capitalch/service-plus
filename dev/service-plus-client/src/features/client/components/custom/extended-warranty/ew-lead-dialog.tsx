import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { FIELD_VALIDATION_DEBOUNCE_MS } from "@/constants/timing";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import type { EwLeadByMobileType, EwLeadType } from "@/features/client/types/extended-warranty";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { normalizeMobile } from "@/lib/mobile";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { isDuplicateLeadError } from "./ew-mutations";
import { isCompleteMobile } from "./ew-state-machine";
import { buildEwLeadSchema } from "./extended-warranty-schema";
import type { EwLeadFormType } from "./extended-warranty-schema";

type OptionType = { id: number; name: string };

type Props = {
	/** null = New Lead; a row = Edit Lead. */
	editing: EwLeadType | null;
	onClose: () => void;
	onSaved: () => void;
};

const EMPTY: EwLeadFormType = {
	address: "",
	brand_id: 0,
	city: "",
	email: "",
	full_name: "",
	mobile: "",
	model_name: "",
	product_id: 0,
	purchase_date: "",
	remarks: "",
	serial_no: "",
	warranty_end_date: "",
};

function toForm(row: EwLeadType): EwLeadFormType {
	return {
		address: row.address ?? "",
		brand_id: row.brand_id,
		city: row.city ?? "",
		email: row.email ?? "",
		full_name: row.full_name,
		mobile: row.mobile,
		model_name: row.model_name ?? "",
		product_id: row.product_id ?? 0,
		purchase_date: row.purchase_date ?? "",
		remarks: row.remarks ?? "",
		serial_no: row.serial_no ?? "",
		warranty_end_date: row.warranty_end_date,
	};
}

/**
 * New Lead / Edit Lead (§C7.8). Writes only contact, device and remarks fields through
 * genericUpdate — never state, stage or timestamps, which change only through the EW
 * mutations. A mobile lookup fills blank fields from an earlier lead or a Jobs customer.
 */
export const EwLeadDialog = ({ editing, onClose, onSaved }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);
	const user = useAppSelector(selectCurrentUser);

	const [brands, setBrands] = useState<OptionType[]>([]);
	const [lookupHint, setLookupHint] = useState<string | null>(null);
	const [lookingUp, setLookingUp] = useState(false);
	const [products, setProducts] = useState<OptionType[]>([]);
	const [saving, setSaving] = useState(false);

	const leadSchema = useMemo(() => buildEwLeadSchema(!!editing), [editing]);
	const form = useForm<EwLeadFormType>({
		defaultValues: editing ? toForm(editing) : EMPTY,
		mode: "onChange",
		resolver: zodResolver(leadSchema),
	});
	const {
		formState: { errors, isValid },
	} = form;

	const brandId = useWatch({ control: form.control, name: "brand_id" });
	const mobile = useWatch({ control: form.control, name: "mobile" });
	const productId = useWatch({ control: form.control, name: "product_id" });
	const purchaseDate = useWatch({ control: form.control, name: "purchase_date" });
	const warrantyEnd = useWatch({ control: form.control, name: "warranty_end_date" });
	const debouncedMobile = useDebounce(mobile, FIELD_VALIDATION_DEBOUNCE_MS);

	useEffect(() => {
		if (!dbName || !schema) return;
		for (const [sqlId, setter] of [
			[SQL_MAP.GET_ALL_BRANDS, setBrands],
			[SQL_MAP.GET_ALL_PRODUCTS, setProducts],
		] as const) {
			void apolloClient
				.query<{ genericQuery: OptionType[] | null }>({
					fetchPolicy: "network-only",
					query: GRAPHQL_MAP.genericQuery,
					variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId }) },
				})
				.then((res) => setter(res.data?.genericQuery ?? []))
				.catch(() => setter([]));
		}
	}, [dbName, schema]);

	// Lookup on a valid mobile (New Lead only). It fills BLANK fields only — never what staff
	// have already typed — preferring an earlier warranty lead, which has device fields too.
	useEffect(() => {
		if (editing || !dbName || !schema || !isCompleteMobile(debouncedMobile)) return;
		let cancelled = false;
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setLookingUp(true);
		void apolloClient
			.query<{ genericQuery: EwLeadByMobileType[] | null }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { mobile: normalizeMobile(debouncedMobile) },
						sqlId: SQL_MAP.GET_EW_LEAD_BY_MOBILE,
					}),
				},
			})
			.then((res) => {
				if (cancelled) return;
				const rows = res.data?.genericQuery ?? [];
				const hit = rows.find((r) => r.source === "EW") ?? rows[0];
				if (!hit) {
					setLookupHint(null);
					return;
				}
				function setIfBlank(name: keyof EwLeadFormType, value: unknown) {
					if (value === null || value === undefined || value === "") return;
					const current = form.getValues(name);
					if (current === "" || current === 0) form.setValue(name, value as never, { shouldValidate: true });
				}
				setIfBlank("address", hit.address);
				setIfBlank("brand_id", hit.brand_id);
				setIfBlank("city", hit.city);
				setIfBlank("email", hit.email);
				setIfBlank("full_name", hit.full_name);
				setIfBlank("model_name", hit.model_name);
				setIfBlank("product_id", hit.product_id);
				setIfBlank("purchase_date", hit.purchase_date);
				setIfBlank("serial_no", hit.serial_no);
				setLookupHint(
					hit.source === "EW" ? MESSAGES.INFO_EW_LOOKUP_FROM_LEAD : MESSAGES.INFO_EW_LOOKUP_FROM_CUSTOMER,
				);
			})
			.catch(() => !cancelled && setLookupHint(null))
			.finally(() => !cancelled && setLookingUp(false));
		return () => {
			cancelled = true;
		};
	}, [debouncedMobile, editing, dbName, schema]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onSubmit(data: EwLeadFormType) {
		if (!dbName || !schema || !branch?.id) return;
		setSaving(true);
		const fields = {
			address: data.address.trim() || null,
			brand_id: data.brand_id,
			city: data.city.trim() || null,
			email: data.email.trim() || null,
			full_name: data.full_name.trim(),
			mobile: normalizeMobile(data.mobile),
			model_name: data.model_name.trim() || null,
			product_id: data.product_id || null,
			purchase_date: data.purchase_date || null,
			remarks: data.remarks.trim() || null,
			serial_no: data.serial_no.trim() || null,
			warranty_end_date: data.warranty_end_date,
		};
		try {
			await apolloClient.mutate({
				mutation: GRAPHQL_MAP.genericUpdate,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericUpdateValue({
						tableName: "ew_lead",
						xData: editing
							? { ...fields, id: editing.ew_lead_id }
							: { ...fields, branch_id: branch.id, created_by: user?.id ? Number(user.id) : null },
					}),
				},
			});
			toast.success(MESSAGES.SUCCESS_EW_LEAD_SAVED);
			onSaved();
			onClose();
		} catch (err) {
			toast.error(
				isDuplicateLeadError(err) ? MESSAGES.ERROR_EW_LEAD_DUPLICATE : MESSAGES.ERROR_EW_LEAD_SAVE_FAILED,
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{editing ? "Edit Lead" : "New Lead"}</DialogTitle>
				</DialogHeader>

				<form className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
					<div>
						<Label htmlFor="ew-mobile">
							Mobile <span className="text-red-600">*</span>
						</Label>
						<Input className="mt-1" id="ew-mobile" inputMode="numeric" {...form.register("mobile")} />
						{errors.mobile && <p className="mt-1 text-xs text-red-600">{errors.mobile.message}</p>}
						{lookingUp && (
							<p className="mt-1 flex items-center gap-1 text-xs text-(--cl-text-muted)">
								<Loader2 className="size-3 animate-spin" /> Looking up…
							</p>
						)}
						{lookupHint && !lookingUp && (
							<p className="mt-1 text-xs text-(--cl-text-muted)">{lookupHint}</p>
						)}
					</div>

					<div>
						<Label htmlFor="ew-name">
							Full name <span className="text-red-600">*</span>
						</Label>
						<Input className="mt-1" id="ew-name" {...form.register("full_name")} />
						{errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>}
					</div>

					<div>
						<Label htmlFor="ew-brand">
							Brand <span className="text-red-600">*</span>
						</Label>
						<Select
							value={brandId ? String(brandId) : ""}
							onValueChange={(v) => form.setValue("brand_id", Number(v), { shouldValidate: true })}
						>
							<SelectTrigger className="mt-1" id="ew-brand">
								<SelectValue placeholder="Select brand" />
							</SelectTrigger>
							<SelectContent>
								{brands.map((b) => (
									<SelectItem key={b.id} value={String(b.id)}>
										{b.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{errors.brand_id && <p className="mt-1 text-xs text-red-600">{errors.brand_id.message}</p>}
					</div>

					<div>
						<Label htmlFor="ew-product">Product</Label>
						<Select
							value={String(productId || 0)}
							onValueChange={(v) => form.setValue("product_id", Number(v), { shouldValidate: true })}
						>
							<SelectTrigger className="mt-1" id="ew-product">
								<SelectValue placeholder="Select product" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="0">None</SelectItem>
								{products.map((p) => (
									<SelectItem key={p.id} value={String(p.id)}>
										{p.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div>
						<Label htmlFor="ew-model">Model</Label>
						<Input className="mt-1" id="ew-model" {...form.register("model_name")} />
					</div>

					<div>
						<Label htmlFor="ew-serial">Serial no</Label>
						<Input className="mt-1" id="ew-serial" {...form.register("serial_no")} />
					</div>

					<div>
						<Label>Purchase date</Label>
						<LocaleDateInput
							className="mt-1"
							value={purchaseDate}
							onChange={(iso) => form.setValue("purchase_date", iso, { shouldValidate: true })}
						/>
						{errors.purchase_date && (
							<p className="mt-1 text-xs text-red-600">{errors.purchase_date.message}</p>
						)}
					</div>

					<div>
						<Label>
							Warranty ends <span className="text-red-600">*</span>
						</Label>
						<LocaleDateInput
							className="mt-1"
							value={warrantyEnd}
							onChange={(iso) => form.setValue("warranty_end_date", iso, { shouldValidate: true })}
						/>
						{errors.warranty_end_date && (
							<p className="mt-1 text-xs text-red-600">{errors.warranty_end_date.message}</p>
						)}
					</div>

					<div className="sm:col-span-2">
						<Label htmlFor="ew-address">Address</Label>
						<Input className="mt-1" id="ew-address" {...form.register("address")} />
					</div>

					<div>
						<Label htmlFor="ew-city">City</Label>
						<Input className="mt-1" id="ew-city" {...form.register("city")} />
					</div>

					<div>
						<Label htmlFor="ew-email">Email</Label>
						<Input className="mt-1" id="ew-email" {...form.register("email")} />
						{errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
					</div>

					<div className="sm:col-span-2">
						<Label htmlFor="ew-remarks">Remarks</Label>
						<Textarea className="mt-1" id="ew-remarks" {...form.register("remarks")} />
					</div>

					<DialogFooter className="sm:col-span-2">
						<Button disabled={saving} type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button
							className="bg-teal-600 text-white hover:bg-teal-700"
							disabled={!isValid || saving}
							type="submit"
						>
							{saving && <Loader2 className="h-4 w-4 animate-spin" />}
							Save
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
