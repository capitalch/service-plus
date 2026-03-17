import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

// ─── Zod schema ───────────────────────────────────────────────────────────────

const addClientSchema = z.object({
	address_line1: z.string().optional(),
	address_line2: z.string().optional(),
	city: z.string().optional(),
	code: z
		.string()
		.min(4, "Code must be at least 4 characters")
		.max(20, "Code must be at most 20 characters")
		.regex(/^[a-zA-Z0-9]+$/, "Code can only contain letters and numbers, no spaces"),
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

type AddClientFormType = z.infer<typeof addClientSchema>;

const EMPTY_DEFAULTS: AddClientFormType = {
	address_line1: "",
	address_line2: "",
	city: "",
	code: "",
	country_code: "IN",
	email: "",
	gstin: "",
	is_active: true,
	name: "",
	pan: "",
	phone: "",
	pincode: "",
	state: "",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type CreateClientResultType = {
	createClient: { email_sent: boolean; id: number };
};

type AddClientDialogPropsType = {
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

// ─── Component ────────────────────────────────────────────────────────────────

export const AddClientDialog = ({ onOpenChange, onSuccess, open }: AddClientDialogPropsType) => {
	const {
		clearErrors,
		control,
		formState: { errors, isSubmitting },
		getFieldState,
		handleSubmit,
		register,
		reset,
		setError,
	} = useForm<AddClientFormType>({
		defaultValues: EMPTY_DEFAULTS,
		resolver: zodResolver(addClientSchema),
	});

	const [checkingUnique, setCheckingUnique] = useState(false);
	const [mutating, setMutating] = useState(false);

	const codeValue = useWatch({ control, name: "code" });
	const nameValue = useWatch({ control, name: "name" });
	const debouncedCode = useDebounce(codeValue, 1200);
	const debouncedName = useDebounce(nameValue, 1200);

	useEffect(() => {
		if (!open) reset();
	}, [open, reset]);

	useEffect(() => {
		if (!debouncedCode) return;
		const { invalid } = getFieldState("code");
		if (invalid) return;
		setCheckingUnique(true);
		apolloClient.query<GenericExistsQueryDataType>({
			query: GRAPHQL_MAP.genericQuery,
			variables: {
				db_name: "",
				schema: "public",
				value: graphQlUtils.buildGenericQueryValue({
					sqlArgs: { code: debouncedCode },
					sqlId: SQL_MAP.CHECK_CLIENT_CODE_EXISTS,
				}),
			},
		}).then((res) => {
			if (res.data?.genericQuery?.[0]?.exists) {
				setError("code", { message: MESSAGES.ERROR_CLIENT_CODE_EXISTS, type: "manual" });
			} else {
				clearErrors("code");
			}
		}).finally(() => {
			setCheckingUnique(false);
		});
	}, [debouncedCode]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!debouncedName) return;
		const { invalid } = getFieldState("name");
		if (invalid) return;
		setCheckingUnique(true);
		apolloClient.query<GenericExistsQueryDataType>({
			query: GRAPHQL_MAP.genericQuery,
			variables: {
				db_name: "",
				schema: "public",
				value: graphQlUtils.buildGenericQueryValue({
					sqlArgs: { name: debouncedName },
					sqlId: SQL_MAP.CHECK_CLIENT_NAME_EXISTS,
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

	async function onSubmit(data: AddClientFormType) {
		const payload: Record<string, unknown> = {
			code:      data.code,
			is_active: data.is_active,
			name:      data.name,
		};
		if (data.address_line1) payload.address_line1 = data.address_line1;
		if (data.address_line2) payload.address_line2 = data.address_line2;
		if (data.city)          payload.city          = data.city;
		if (data.country_code)  payload.country_code  = data.country_code;
		if (data.email)         payload.email         = data.email;
		if (data.gstin)         payload.gstin         = data.gstin;
		if (data.pan)           payload.pan           = data.pan;
		if (data.phone)         payload.phone         = data.phone;
		if (data.pincode)       payload.pincode       = data.pincode;
		if (data.state)         payload.state         = data.state;

		setMutating(true);
		try {
			const result = await apolloClient.mutate<CreateClientResultType>({
				mutation: GRAPHQL_MAP.createClient,
				variables: {
					db_name: "",
					schema: "public",
					value: encodeURIComponent(JSON.stringify(payload)),
				},
			});

			if (result.error) {
				toast.error(MESSAGES.ERROR_CLIENT_ADD_FAILED);
				return;
			}

			const emailSent = result.data?.createClient?.email_sent ?? false;
			if (emailSent) {
				toast.success(MESSAGES.SUCCESS_CLIENT_ADDED_WITH_EMAIL);
			} else if (data.email) {
				toast.success(MESSAGES.SUCCESS_CLIENT_ADDED);
				toast.warning(MESSAGES.WARN_CLIENT_WELCOME_EMAIL_NOT_SENT);
			} else {
				toast.success(MESSAGES.SUCCESS_CLIENT_ADDED);
			}
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_CLIENT_ADD_FAILED);
		} finally {
			setMutating(false);
		}
	}

	const busy = checkingUnique || isSubmitting || mutating;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add New Client</DialogTitle>
					<DialogDescription>Fill in the details below to register a new client.</DialogDescription>
				</DialogHeader>

				<form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
					{/* Code + Name */}
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="code">
								Code <span className="text-red-500">*</span>
							</Label>
							<Input
								id="code"
								placeholder="e.g. ACME01"
								{...register("code")}
								disabled={busy}
							/>
							<FieldError message={errors.code?.message} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="name">
								Name <span className="text-red-500">*</span>
							</Label>
							<Input
								id="name"
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
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								placeholder="contact@example.com"
								type="email"
								{...register("email")}
								disabled={busy}
							/>
							<FieldError message={errors.email?.message} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="phone">Phone</Label>
							<Input
								id="phone"
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
							<Label htmlFor="gstin">GSTIN</Label>
							<Input
								id="gstin"
								placeholder="22AAAAA0000A1Z5"
								{...register("gstin", { setValueAs: (v: string) => v.toUpperCase() })}
								disabled={busy}
							/>
							<FieldError message={errors.gstin?.message} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="pan">PAN</Label>
							<Input
								id="pan"
								placeholder="AAAAA0000A"
								{...register("pan", { setValueAs: (v: string) => v.toUpperCase() })}
								disabled={busy}
							/>
							<FieldError message={errors.pan?.message} />
						</div>
					</div>

					{/* Address Line 1 */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="address_line1">Address Line 1</Label>
						<Input
							id="address_line1"
							placeholder="Street / Building"
							{...register("address_line1")}
							disabled={busy}
						/>
					</div>

					{/* Address Line 2 */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="address_line2">Address Line 2</Label>
						<Input
							id="address_line2"
							placeholder="Area / Landmark"
							{...register("address_line2")}
							disabled={busy}
						/>
					</div>

					{/* City + State + Pincode */}
					<div className="grid grid-cols-3 gap-3">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="city">City</Label>
							<Input id="city" placeholder="Mumbai" {...register("city")} disabled={busy} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="state">State</Label>
							<Input id="state" placeholder="Maharashtra" {...register("state")} disabled={busy} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="pincode">Pincode</Label>
							<Input id="pincode" placeholder="400001" {...register("pincode")} disabled={busy} />
							<FieldError message={errors.pincode?.message} />
						</div>
					</div>

					{/* Country Code */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="country_code">Country Code</Label>
						<Input
							className="max-w-[8rem] bg-slate-50 text-slate-500"
							id="country_code"
							readOnly
							{...register("country_code")}
						/>
					</div>

					{/* Active */}
					<div className="flex items-center gap-2">
						<input
							className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
							id="is_active"
							type="checkbox"
							{...register("is_active")}
							defaultChecked
							disabled={busy}
						/>
						<Label htmlFor="is_active">Active</Label>
					</div>

					<DialogFooter showCloseButton>
						<Button
							className="bg-emerald-600 text-white hover:bg-emerald-700"
							disabled={busy || !!errors.code || !!errors.name}
							type="submit"
						>
							{isSubmitting || mutating ? "Saving..." : "Add Client"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
