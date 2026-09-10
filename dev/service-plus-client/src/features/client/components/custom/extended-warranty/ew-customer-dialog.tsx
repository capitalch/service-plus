import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { FIELD_VALIDATION_DEBOUNCE_MS } from "@/constants/timing";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { EwCustomerType } from "@/features/client/types/extended-warranty";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ewCustomerSchema } from "./extended-warranty-schema";
import type { EwCustomerFormType } from "./extended-warranty-schema";

type LookupRowType = {
	address: string | null;
	brand_id: number | null;
	city: string | null;
	email: string | null;
	full_name: string;
	model_name: string | null;
	product_id: number | null;
	purchase_date: string | null;
	serial_no: string | null;
	source: "CUSTOMER" | "EW";
	warranty_end_date: string | null;
};

type OptionType = { id: number; name: string };

type Props = {
	/** null = add; a row = edit. */
	editing: EwCustomerType | null;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

const EMPTY: EwCustomerFormType = {
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

export const EwCustomerDialog = ({ editing, onOpenChange, onSuccess, open }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const [brands, setBrands] = useState<OptionType[]>([]);
	const [products, setProducts] = useState<OptionType[]>([]);
	const [lookupHint, setLookupHint] = useState<string | null>(null);
	const [lookingUp, setLookingUp] = useState(false);
	const [saving, setSaving] = useState(false);

	const form = useForm<EwCustomerFormType>({
		defaultValues: EMPTY,
		mode: "onChange",
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		resolver: zodResolver(ewCustomerSchema) as any,
	});
	const {
		formState: { errors, isValid },
	} = form;

	const mobileValue = useWatch({ control: form.control, name: "mobile" });
	const debouncedMobile = useDebounce(mobileValue, FIELD_VALIDATION_DEBOUNCE_MS);

	useEffect(() => {
		if (!open || !dbName || !schema) return;
		void apolloClient
			.query<{ genericQuery: OptionType[] | null }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }),
				},
			})
			.then((res) => setBrands(res.data?.genericQuery ?? []))
			.catch(() => setBrands([]));
		void apolloClient
			.query<{ genericQuery: OptionType[] | null }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_PRODUCTS }),
				},
			})
			.then((res) => setProducts(res.data?.genericQuery ?? []))
			.catch(() => setProducts([]));
	}, [open, dbName, schema]);

	useEffect(() => {
		if (!open) {
			form.reset(EMPTY);
			setLookupHint(null);
			return;
		}
		form.reset(
			editing
				? {
						address: editing.address ?? "",
						brand_id: editing.brand_id,
						city: editing.city ?? "",
						email: editing.email ?? "",
						full_name: editing.full_name,
						mobile: editing.mobile,
						model_name: editing.model_name ?? "",
						product_id: editing.product_id ?? 0,
						purchase_date: editing.purchase_date ?? "",
						remarks: editing.remarks ?? "",
						serial_no: editing.serial_no ?? "",
						warranty_end_date: editing.warranty_end_date,
					}
				: EMPTY,
		);
	}, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

	/**
	 * The prompt's cross-lookup: one mobile, searched in the customer master AND the
	 * extended-warranty table, so a repeat customer never has to be retyped. Only
	 * prefills blank fields — it must never overwrite something staff just typed.
	 */
	useEffect(() => {
		if (editing || !open || !debouncedMobile || !dbName || !schema) return;
		if (form.getFieldState("mobile").invalid) return;
		setLookingUp(true);
		void apolloClient
			.query<{ genericQuery: LookupRowType[] | null }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { mobile: debouncedMobile },
						sqlId: SQL_MAP.GET_EW_CUSTOMER_BY_MOBILE,
					}),
				},
			})
			.then((res) => {
				const rows = res.data?.genericQuery ?? [];
				if (rows.length === 0) {
					setLookupHint(null);
					return;
				}
				// Prefer an existing warranty record over the customer master — it has
				// the device fields too.
				const hit = rows.find((r) => r.source === "EW") ?? rows[0];
				const setIfBlank = (name: keyof EwCustomerFormType, value: unknown) => {
					if (value == null || value === "") return;
					const current = form.getValues(name);
					if (current === "" || current === 0 || current == null) {
						form.setValue(name, value as never, { shouldValidate: true });
					}
				};
				setIfBlank("full_name", hit.full_name);
				setIfBlank("email", hit.email);
				setIfBlank("address", hit.address);
				setIfBlank("city", hit.city);
				setIfBlank("brand_id", hit.brand_id);
				setIfBlank("product_id", hit.product_id);
				setIfBlank("model_name", hit.model_name);
				setIfBlank("serial_no", hit.serial_no);
				setIfBlank("purchase_date", hit.purchase_date);
				setLookupHint(
					hit.source === "EW"
						? "Found an existing warranty record for this number — details filled in."
						: "Found this number in the customer master — details filled in.",
				);
			})
			.catch(() => setLookupHint(null))
			.finally(() => setLookingUp(false));
	}, [debouncedMobile, open, editing, dbName, schema]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onSubmit(data: EwCustomerFormType) {
		if (!dbName || !schema || !branch?.id) return;
		setSaving(true);
		try {
			await apolloClient.mutate({
				mutation: GRAPHQL_MAP.genericUpdate,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericUpdateValue({
						tableName: "ew_customer",
						xData: {
							address: data.address || null,
							branch_id: branch.id,
							brand_id: data.brand_id,
							city: data.city || null,
							email: data.email || null,
							full_name: data.full_name,
							id: editing?.id,
							mobile: data.mobile,
							model_name: data.model_name || null,
							product_id: data.product_id || null,
							purchase_date: data.purchase_date || null,
							remarks: data.remarks || null,
							serial_no: data.serial_no || null,
							warranty_end_date: data.warranty_end_date,
						},
					}),
				},
			});
			toast.success(MESSAGES.SUCCESS_EW_CUSTOMER_SAVED);
			onSuccess();
			onOpenChange(false);
		} catch {
			// The unique index on (mobile, serial_no, warranty_end_date) is the most
			// likely rejection — say so rather than showing a raw constraint name.
			toast.error("Could not save. A record with this mobile, serial no and warranty date may already exist.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{editing ? "Edit warranty record" : "Add warranty record"}</DialogTitle>
				</DialogHeader>

				<form className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
					<div>
						<Label htmlFor="ew-mobile">
							Mobile <span className="text-red-600">*</span>
						</Label>
						<Input id="ew-mobile" className="mt-1" {...form.register("mobile")} />
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
						<Input id="ew-name" className="mt-1" {...form.register("full_name")} />
						{errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>}
					</div>

					<div>
						<Label htmlFor="ew-brand">
							Brand <span className="text-red-600">*</span>
						</Label>
						<Select
							value={String(form.watch("brand_id") || "")}
							onValueChange={(v) => form.setValue("brand_id", Number(v), { shouldValidate: true })}
						>
							<SelectTrigger id="ew-brand" className="mt-1">
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
							value={String(form.watch("product_id") || "")}
							onValueChange={(v) => form.setValue("product_id", Number(v), { shouldValidate: true })}
						>
							<SelectTrigger id="ew-product" className="mt-1">
								<SelectValue placeholder="Select product" />
							</SelectTrigger>
							<SelectContent>
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
						<Input id="ew-model" className="mt-1" {...form.register("model_name")} />
					</div>

					<div>
						<Label htmlFor="ew-serial">Serial no</Label>
						<Input id="ew-serial" className="mt-1" {...form.register("serial_no")} />
					</div>

					<div>
						<Label htmlFor="ew-purchase">Purchase date</Label>
						<Input id="ew-purchase" className="mt-1" type="date" {...form.register("purchase_date")} />
						{errors.purchase_date && (
							<p className="mt-1 text-xs text-red-600">{errors.purchase_date.message}</p>
						)}
					</div>

					<div>
						<Label htmlFor="ew-expiry">
							Warranty ends <span className="text-red-600">*</span>
						</Label>
						<Input id="ew-expiry" className="mt-1" type="date" {...form.register("warranty_end_date")} />
						{errors.warranty_end_date && (
							<p className="mt-1 text-xs text-red-600">{errors.warranty_end_date.message}</p>
						)}
					</div>

					<div className="sm:col-span-2">
						<Label htmlFor="ew-address">Address</Label>
						<Input id="ew-address" className="mt-1" {...form.register("address")} />
					</div>

					<div>
						<Label htmlFor="ew-city">City</Label>
						<Input id="ew-city" className="mt-1" {...form.register("city")} />
					</div>

					<div>
						<Label htmlFor="ew-email">Email</Label>
						<Input id="ew-email" className="mt-1" {...form.register("email")} />
						{errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
					</div>

					<div className="sm:col-span-2">
						<Label htmlFor="ew-remarks">Remarks</Label>
						<Textarea id="ew-remarks" className="mt-1" {...form.register("remarks")} />
					</div>

					<DialogFooter className="sm:col-span-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button disabled={!isValid || saving} type="submit">
							{saving ? "Saving…" : "Save"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
