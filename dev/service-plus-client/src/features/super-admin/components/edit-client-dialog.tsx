import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@apollo/client/react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import type { ClientType } from "@/features/super-admin/types";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const editClientSchema = z.object({
	address_line1: z.string().optional(),
	address_line2: z.string().optional(),
	city: z.string().optional(),
	code: z.string(),
	country_code: z.literal("IN"),
	email: z.email({ message: "Enter a valid email address" }).or(z.literal("")).optional(),
	gstin: z
		.string()
		.regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)")
		.or(z.literal(""))
		.optional(),
	is_active: z.boolean(),
	name: z
		.string()
		.min(6, "Name must be at least 6 characters")
		.max(100, "Name must be at most 100 characters")
		.regex(/^[a-zA-Z0-9\s\-_.,]+$/, "Name can only contain letters, numbers, spaces, - _ . ,"),
	pan: z
		.string()
		.regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format (e.g. AAAAA0000A)")
		.or(z.literal(""))
		.optional(),
	phone: z.string().optional(),
	pincode: z.string().max(10, "Pincode must be at most 10 characters").optional(),
	state: z.string().optional(),
});

type EditClientFormType = z.infer<typeof editClientSchema>;

// ─── Types ────────────────────────────────────────────────────────────────────

type EditClientDialogPropsType = {
	client: ClientType | null;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

type GenericExistsQueryDataType = {
	genericQuery: { exists: boolean }[] | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
	return (
		<AnimatePresence>
			{message && (
				<motion.p
					animate={{ opacity: 1, y: 0 }}
					className="text-xs text-red-500"
					exit={{ opacity: 0, y: -4 }}
					initial={{ opacity: 0, y: -4 }}
				>
					{message}
				</motion.p>
			)}
		</AnimatePresence>
	);
}

function buildDefaults(client: ClientType): EditClientFormType {
	return {
		address_line1: client.address_line1 ?? "",
		address_line2: client.address_line2 ?? "",
		city: client.city ?? "",
		code: client.code,
		country_code: "IN",
		email: client.email ?? "",
		gstin: client.gstin ?? "",
		is_active: client.is_active,
		name: client.name,
		pan: client.pan ?? "",
		phone: client.phone ?? "",
		pincode: client.pincode ?? "",
		state: client.state ?? "",
	};
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditClientDialog = ({ client, onOpenChange, onSuccess, open }: EditClientDialogPropsType) => {
	const {
		clearErrors,
		control,
		formState: { errors, isSubmitting },
		getFieldState,
		handleSubmit,
		register,
		reset,
		setError,
	} = useForm<EditClientFormType>({
		defaultValues: client ? buildDefaults(client) : undefined,
		resolver: zodResolver(editClientSchema),
	});

	const [checkingUnique, setCheckingUnique] = useState(false);
	const [executeGenericUpdate, { loading: mutating }] = useMutation(GRAPHQL_MAP.genericUpdate);

	const nameValue = useWatch({ control, name: "name" });
	const debouncedName = useDebounce(nameValue, 1200);

	useEffect(() => {
		if (open && client) {
			reset(buildDefaults(client));
		}
	}, [open, client, reset]);

	useEffect(() => {
		if (!debouncedName || !client) return;
		const { invalid } = getFieldState("name");
		if (invalid) return;
		if (debouncedName === client.name) return;
		setCheckingUnique(true);
		apolloClient.query<GenericExistsQueryDataType>({
			query: GRAPHQL_MAP.genericQuery,
			variables: {
				db_name: "",
				schema: "public",
				value: graphQlUtils.buildGenericQueryValue({
					sqlArgs: { id: client.id, name: debouncedName },
					sqlId: SQL_MAP.CHECK_CLIENT_NAME_EXISTS_EXCLUDE_ID,
				}),
			},
		}).then((res) => {
			if (res.data?.genericQuery?.[0]?.exists) {
				setError("name", { message: MESSAGES.ERROR_CLIENT_NAME_EXISTS, type: "manual" });
			} else {
				clearErrors("name");
			}
		}).finally(() => {
			setCheckingUnique(false);
		});
	}, [debouncedName]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onSubmit(data: EditClientFormType) {
		if (!client) return;

		const xData: Record<string, unknown> = {
			id: client.id,
			is_active: data.is_active,
			name: data.name,
		};
		if (data.address_line1 !== undefined) xData.address_line1 = data.address_line1 || null;
		if (data.address_line2 !== undefined) xData.address_line2 = data.address_line2 || null;
		if (data.city !== undefined) xData.city = data.city || null;
		if (data.country_code) xData.country_code = data.country_code;
		if (data.email !== undefined) xData.email = data.email || null;
		if (data.gstin !== undefined) xData.gstin = data.gstin || null;
		if (data.pan !== undefined) xData.pan = data.pan || null;
		if (data.phone !== undefined) xData.phone = data.phone || null;
		if (data.pincode !== undefined) xData.pincode = data.pincode || null;
		if (data.state !== undefined) xData.state = data.state || null;

		try {
			const result = await executeGenericUpdate({
				variables: {
					db_name: "",
					schema: "public",
					value: graphQlUtils.buildGenericUpdateValue({
						tableName: "client",
						xData,
					}),
				},
			});
			if (result.error) {
				toast.error(MESSAGES.ERROR_CLIENT_UPDATE_FAILED);
				return;
			}
			toast.success(MESSAGES.SUCCESS_CLIENT_UPDATED);
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_CLIENT_UPDATE_FAILED);
		}
	}

	const busy = checkingUnique || isSubmitting || mutating;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Edit Client</DialogTitle>
					<DialogDescription>Update the details for this client.</DialogDescription>
				</DialogHeader>

				<form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
					{/* Code + Name */}
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="ec-code">Code</Label>
							<Input
								className="bg-slate-50 text-slate-500"
								id="ec-code"
								readOnly
								{...register("code")}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="ec-name">
								Name <span className="text-red-500">*</span>
							</Label>
							<Input
								id="ec-name"
								placeholder="e.g. Acme Corporation"
								{...register("name")}
								disabled={busy}
							/>
							<FieldError message={errors.name?.message} />
						</div>
					</div>

					{/* Email + Phone */}
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="ec-email">Email</Label>
							<Input
								id="ec-email"
								placeholder="contact@example.com"
								type="email"
								{...register("email")}
								disabled={busy}
							/>
							<FieldError message={errors.email?.message} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="ec-phone">Phone</Label>
							<Input
								id="ec-phone"
								placeholder="+91 98765 43210"
								type="tel"
								{...register("phone")}
								disabled={busy}
							/>
						</div>
					</div>

					{/* GSTIN + PAN */}
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="ec-gstin">GSTIN</Label>
							<Input
								id="ec-gstin"
								placeholder="22AAAAA0000A1Z5"
								{...register("gstin", { setValueAs: (v: string) => v.toUpperCase() })}
								disabled={busy}
							/>
							<FieldError message={errors.gstin?.message} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="ec-pan">PAN</Label>
							<Input
								id="ec-pan"
								placeholder="AAAAA0000A"
								{...register("pan", { setValueAs: (v: string) => v.toUpperCase() })}
								disabled={busy}
							/>
							<FieldError message={errors.pan?.message} />
						</div>
					</div>

					{/* Address Line 1 */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="ec-address1">Address Line 1</Label>
						<Input
							id="ec-address1"
							placeholder="Street / Building"
							{...register("address_line1")}
							disabled={busy}
						/>
					</div>

					{/* Address Line 2 */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="ec-address2">Address Line 2</Label>
						<Input
							id="ec-address2"
							placeholder="Area / Landmark"
							{...register("address_line2")}
							disabled={busy}
						/>
					</div>

					{/* City + State + Pincode */}
					<div className="grid grid-cols-3 gap-3">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="ec-city">City</Label>
							<Input id="ec-city" placeholder="Mumbai" {...register("city")} disabled={busy} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="ec-state">State</Label>
							<Input id="ec-state" placeholder="Maharashtra" {...register("state")} disabled={busy} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="ec-pincode">Pincode</Label>
							<Input id="ec-pincode" placeholder="400001" {...register("pincode")} disabled={busy} />
							<FieldError message={errors.pincode?.message} />
						</div>
					</div>

					{/* Country Code */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="ec-country">Country Code</Label>
						<Input
							className="max-w-[8rem] bg-slate-50 text-slate-500"
							id="ec-country"
							readOnly
							{...register("country_code")}
						/>
					</div>

					{/* Active */}
					<div className="flex items-center gap-2">
						<input
							className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
							id="ec-is_active"
							type="checkbox"
							{...register("is_active")}
							disabled={busy}
						/>
						<Label htmlFor="ec-is_active">Active</Label>
					</div>

					<DialogFooter showCloseButton>
						<Button
							className="bg-emerald-600 text-white hover:bg-emerald-700"
							disabled={busy || !!errors.name}
							type="submit"
						>
							{isSubmitting || mutating ? "Saving..." : "Save Changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
