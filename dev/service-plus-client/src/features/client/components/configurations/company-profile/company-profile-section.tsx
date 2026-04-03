import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Loader2, Save } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";

// ─── Types ────────────────────────────────────────────────────────────────────

type CompanyInfoFormType = z.infer<typeof companyInfoSchema>;

type StateType = {
    code: string;
    id:   number;
    name: string;
};

type CompanyInfoRow = {
    id:            number;
    company_name:  string;
    address_line1: string;
    address_line2: string | null;
    city:          string | null;
    state_id:      number;
    country:       string | null;
    pincode:       string | null;
    phone:         string | null;
    email:         string | null;
    gstin:         string | null;
    is_active:     boolean;
};

type GenericQueryData<T> = {
    genericQuery: T[] | null;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const companyInfoSchema = z.object({
    company_name:  z.string().min(2, "Company name is required"),
    address_line1: z.string().min(3, "Address is required"),
    address_line2: z.string().optional(),
    city:          z.string().optional(),
    state_id:      z.number().min(1, "State is required"),
    country:       z.string().optional(),
    pincode:       z.string().optional(),
    phone:         z.string().optional(),
    email:         z.string().email("Invalid email").or(z.literal("")).optional(),
    gstin:         z.string().regex(/^[0-9A-Z]{15}$/, "Invalid GSTIN (15 characters)").or(z.literal("")).optional(),
});

// ─── Field error helper ───────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CompanyProfileSection = () => {
    const [existingId,  setExistingId]  = useState<number | null>(null);
    const [loading,     setLoading]     = useState(true);
    const [states,      setStates]      = useState<StateType[]>([]);
    const [submitting,  setSubmitting]  = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useForm<CompanyInfoFormType>({
        defaultValues: {
            company_name:  "",
            address_line1: "",
            address_line2: "",
            city:          "",
            state_id:      0,
            country:       "IN",
            pincode:       "",
            phone:         "",
            email:         "",
            gstin:         "",
        },
        mode:     "onChange",
        resolver: zodResolver(companyInfoSchema),
    });

    const { formState: { errors } } = form;

    // Fetch states + company info on mount
    useEffect(() => {
        if (!dbName || !schema) return;

        const fetchAll = async () => {
            setLoading(true);
            try {
                // Fetch states
                const statesRes = await apolloClient.query<GenericQueryData<StateType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_STATES }),
                    },
                });
                setStates(statesRes.data?.genericQuery ?? []);

                // Fetch company info
                const compRes = await apolloClient.query<GenericQueryData<CompanyInfoRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_COMPANY_INFO }),
                    },
                });

                const rows = compRes.data?.genericQuery ?? [];
                if (rows.length > 0) {
                    const row = rows[0];
                    setExistingId(row.id);
                    form.reset({
                        company_name:  row.company_name,
                        address_line1: row.address_line1,
                        address_line2: row.address_line2 ?? "",
                        city:          row.city          ?? "",
                        state_id:      row.state_id,
                        country:       row.country       ?? "IN",
                        pincode:       row.pincode        ?? "",
                        phone:         row.phone          ?? "",
                        email:         row.email          ?? "",
                        gstin:         row.gstin          ?? "",
                    });
                }
            } catch {
                toast.error(MESSAGES.ERROR_COMPANY_PROFILE_LOAD_FAILED);
            } finally {
                setLoading(false);
            }
        };

        void fetchAll();
    }, [dbName, schema]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: CompanyInfoFormType) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            const xData: Record<string, unknown> = {
                company_name:  data.company_name,
                address_line1: data.address_line1,
                address_line2: data.address_line2 || null,
                city:          data.city          || null,
                state_id:      data.state_id,
                country:       data.country       || "IN",
                pincode:       data.pincode        || null,
                phone:         data.phone          || null,
                email:         data.email          || null,
                gstin:         data.gstin          || null,
            };

            // company_info always has a single row with id=1
            xData.id = existingId ?? 1;
            if (existingId === null) {
                xData.isIdInsert = true;
            }

            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "company_info",
                        xData,
                    }),
                },
            });

            // id is always 1 for company_info (single row)
            if (existingId === null) setExistingId(1);

            toast.success(MESSAGES.SUCCESS_COMPANY_PROFILE_SAVED);
        } catch {
            toast.error(MESSAGES.ERROR_COMPANY_PROFILE_SAVE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled = Object.keys(errors).length > 0 || submitting || loading;

    // ── Render ─────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--cl-accent)]" />
            </div>
        );
    }

    return (
        <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
            initial={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
        >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-[var(--cl-border)] pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--cl-accent)]/10">
                    <Building2 className="h-5 w-5 text-[var(--cl-accent)]" />
                </div>
                <div>
                    <h2 className="text-base font-semibold text-[var(--cl-text)]">Company Profile</h2>
                    <p className="text-xs text-[var(--cl-text-muted)]">
                        {existingId ? "Update your company details" : "Set up your company profile"}
                    </p>
                </div>
            </div>

            {/* Form */}
            <form
                className="flex flex-col gap-5"
                onSubmit={form.handleSubmit(onSubmit)}
            >
                {/* Company Name */}
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cp_name">
                        Company Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        autoComplete="off"
                        id="cp_name"
                        placeholder="e.g. Acme Electronics Pvt Ltd"
                        {...form.register("company_name")}
                    />
                    <FieldError message={errors.company_name?.message} />
                </div>

                {/* Address Line 1 */}
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cp_addr1">
                        Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        autoComplete="off"
                        id="cp_addr1"
                        placeholder="Street address"
                        {...form.register("address_line1")}
                    />
                    <FieldError message={errors.address_line1?.message} />
                </div>

                {/* Address Line 2 */}
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cp_addr2">Address Line 2</Label>
                    <Input
                        autoComplete="off"
                        id="cp_addr2"
                        placeholder="Apartment, suite, floor, etc."
                        {...form.register("address_line2")}
                    />
                </div>

                {/* City / State / Pincode */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cp_city">City</Label>
                        <Input
                            autoComplete="off"
                            id="cp_city"
                            placeholder="City"
                            {...form.register("city")}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cp_state">
                            State <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={form.watch("state_id") ? String(form.watch("state_id")) : ""}
                            onValueChange={(v) => form.setValue("state_id", Number(v), { shouldValidate: true })}
                        >
                            <SelectTrigger id="cp_state">
                                <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                                {states.map((s) => (
                                    <SelectItem key={s.id} value={String(s.id)}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FieldError message={errors.state_id?.message} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cp_pin">Pincode</Label>
                        <Input
                            autoComplete="off"
                            id="cp_pin"
                            placeholder="Pincode"
                            {...form.register("pincode")}
                        />
                    </div>
                </div>

                {/* Country / Phone / Email */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cp_country">Country</Label>
                        <Input
                            autoComplete="off"
                            id="cp_country"
                            placeholder="IN"
                            {...form.register("country")}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cp_phone">Phone</Label>
                        <Input
                            autoComplete="off"
                            id="cp_phone"
                            placeholder="Phone number"
                            {...form.register("phone")}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cp_email">Email</Label>
                        <Input
                            autoComplete="off"
                            id="cp_email"
                            placeholder="company@example.com"
                            type="email"
                            {...form.register("email")}
                        />
                        <FieldError message={errors.email?.message} />
                    </div>
                </div>

                {/* GSTIN */}
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cp_gstin">GSTIN</Label>
                    <Input
                        autoComplete="off"
                        className="font-mono uppercase"
                        id="cp_gstin"
                        placeholder="15-character GSTIN"
                        {...form.register("gstin")}
                    />
                    <FieldError message={errors.gstin?.message} />
                </div>

                {/* Submit */}
                <div className="flex justify-end border-t border-[var(--cl-border)] pt-4">
                    <Button
                        className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                        disabled={submitDisabled}
                        type="submit"
                    >
                        {submitting
                            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            : <Save className="mr-1.5 h-4 w-4" />
                        }
                        Save Profile
                    </Button>
                </div>
            </form>
        </motion.div>
    );
};
