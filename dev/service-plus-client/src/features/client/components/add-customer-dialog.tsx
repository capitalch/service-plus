import { useEffect, useState } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddCustomerDialogPropsType = {
    customerTypes: CustomerTypeOption[];
    onOpenChange:  (open: boolean) => void;
    onSuccess:     () => void;
    open:          boolean;
    states:        StateOption[];
};

type AddCustomerFormType = z.infer<typeof addCustomerSchema>;

// ─── Schema ───────────────────────────────────────────────────────────────────

const addCustomerSchema = z.object({
    customer_type_id: z.coerce.number({ required_error: "Customer type is required" }).positive("Customer type is required"),
    full_name:        z.string().optional(),
    mobile:           z.string().min(1, "Mobile is required"),
    alternate_mobile: z.string().optional(),
    email:            z.string().email("Invalid email address").or(z.literal("")).optional(),
    gstin:            z.string().optional(),
    address_line1:    z.string().min(1, "Address line 1 is required"),
    address_line2:    z.string().optional(),
    landmark:         z.string().optional(),
    state_id:         z.coerce.number({ required_error: "State is required" }).positive("State is required"),
    city:             z.string().optional(),
    postal_code:      z.string().optional(),
    remarks:          z.string().optional(),
});

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddCustomerDialog = ({
    customerTypes,
    onOpenChange,
    onSuccess,
    open,
    states,
}: AddCustomerDialogPropsType) => {
    const [submitting, setSubmitting] = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useForm<AddCustomerFormType>({
        defaultValues: {
            customer_type_id: 0,
            full_name:        "",
            mobile:           "",
            alternate_mobile: "",
            email:            "",
            gstin:            "",
            address_line1:    "",
            address_line2:    "",
            landmark:         "",
            state_id:         0,
            city:             "",
            postal_code:      "",
            remarks:          "",
        },
        mode:     "onChange",
        resolver: zodResolver(addCustomerSchema),
    });

    const { formState: { errors } } = form;

    // Reset on close
    useEffect(() => {
        if (!open) {
            setSubmitting(false);
            form.reset();
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: AddCustomerFormType) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "customer_contact",
                        xData: {
                            customer_type_id: data.customer_type_id,
                            full_name:        data.full_name || null,
                            mobile:           data.mobile,
                            alternate_mobile: data.alternate_mobile || null,
                            email:            data.email || null,
                            gstin:            data.gstin || null,
                            address_line1:    data.address_line1,
                            address_line2:    data.address_line2 || null,
                            landmark:         data.landmark || null,
                            state_id:         data.state_id,
                            city:             data.city || null,
                            postal_code:      data.postal_code || null,
                            remarks:          data.remarks || null,
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_CUSTOMER_CREATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_CUSTOMER_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled = Object.keys(errors).length > 0 || submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Add Customer
                    </DialogTitle>
                </DialogHeader>

                <form
                    className="flex flex-col gap-4 overflow-y-auto px-1 pt-1"
                    onSubmit={form.handleSubmit(onSubmit)}
                >
                    <div className="grid grid-cols-2 gap-4">
                        {/* Customer Type */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ac_type">
                                Customer Type <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                onValueChange={(v) => form.setValue("customer_type_id", Number(v), { shouldValidate: true })}
                            >
                                <SelectTrigger id="ac_type">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {customerTypes.map((ct) => (
                                        <SelectItem key={ct.id} value={String(ct.id)}>
                                            {ct.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError message={errors.customer_type_id?.message} />
                        </div>

                        {/* Full Name */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ac_name">Full Name</Label>
                            <Input
                                autoComplete="off"
                                id="ac_name"
                                placeholder="Customer name"
                                {...form.register("full_name")}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Mobile */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ac_mobile">
                                Mobile <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                autoComplete="off"
                                id="ac_mobile"
                                placeholder="Mobile number"
                                {...form.register("mobile")}
                            />
                            <FieldError message={errors.mobile?.message} />
                        </div>

                        {/* Alternate Mobile */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ac_alt_mobile">Alternate Mobile</Label>
                            <Input
                                autoComplete="off"
                                id="ac_alt_mobile"
                                placeholder="Alternate number"
                                {...form.register("alternate_mobile")}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ac_email">Email</Label>
                            <Input
                                autoComplete="off"
                                id="ac_email"
                                placeholder="customer@example.com"
                                type="email"
                                {...form.register("email")}
                            />
                            <FieldError message={errors.email?.message} />
                        </div>

                        {/* GSTIN */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ac_gstin">GSTIN</Label>
                            <Input
                                autoComplete="off"
                                className="font-mono uppercase"
                                id="ac_gstin"
                                placeholder="15-character GSTIN"
                                {...form.register("gstin")}
                            />
                        </div>
                    </div>

                    {/* Address Line 1 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ac_addr1">
                            Address <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            autoComplete="off"
                            id="ac_addr1"
                            placeholder="Street address"
                            {...form.register("address_line1")}
                        />
                        <FieldError message={errors.address_line1?.message} />
                    </div>

                    {/* Address Line 2 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ac_addr2">Address Line 2</Label>
                        <Input
                            autoComplete="off"
                            id="ac_addr2"
                            placeholder="Apartment, suite, etc."
                            {...form.register("address_line2")}
                        />
                    </div>

                    {/* Landmark */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ac_landmark">Landmark</Label>
                        <Input
                            autoComplete="off"
                            id="ac_landmark"
                            placeholder="Nearby landmark"
                            {...form.register("landmark")}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {/* State */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ac_state">
                                State <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                onValueChange={(v) => form.setValue("state_id", Number(v), { shouldValidate: true })}
                            >
                                <SelectTrigger id="ac_state">
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

                        {/* City */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ac_city">City</Label>
                            <Input
                                autoComplete="off"
                                id="ac_city"
                                placeholder="City"
                                {...form.register("city")}
                            />
                        </div>

                        {/* Postal Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ac_postal">Postal Code</Label>
                            <Input
                                autoComplete="off"
                                id="ac_postal"
                                placeholder="Postal code"
                                {...form.register("postal_code")}
                            />
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ac_remarks">Remarks</Label>
                        <Input
                            autoComplete="off"
                            id="ac_remarks"
                            placeholder="Any remarks"
                            {...form.register("remarks")}
                        />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            disabled={submitting}
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
                            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                            Add Customer
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
