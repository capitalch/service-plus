import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";

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
import { SQL_MAP } from "@/constants/sql-map";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { StateOption } from "@/features/client/types/customer";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddVendorDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    states:       StateOption[];
};

type AddVendorFormType = z.infer<typeof addVendorSchema>;

type CheckQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const addVendorSchema = z.object({
    name:          z.string().min(2, "Name must be at least 2 characters"),
    phone:         z.string().optional(),
    email:         z.string().email("Invalid email address").or(z.literal("")).optional(),
    gstin:         z.string().optional(),
    pan:           z.string().optional(),
    address_line1: z.string().optional(),
    address_line2: z.string().optional(),
    city:          z.string().optional(),
    state_id:      z.coerce.number().positive("State is required"),
    pincode:       z.string().optional(),
    remarks:       z.string().optional(),
});

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddVendorDialog = ({
    onOpenChange,
    onSuccess,
    open,
    states,
}: AddVendorDialogPropsType) => {
    const [checkingName, setCheckingName] = useState(false);
    const [nameTaken,    setNameTaken]    = useState<boolean | null>(null);
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useForm<AddVendorFormType>({
        defaultValues: {
            address_line1: "",
            address_line2: "",
            city:          "",
            email:          "",
            gstin:         "",
            name:          "",
            pan:           "",
            phone:         "",
            pincode:       "",
            remarks:       "",
            state_id:      0,
        },
        mode:     "onChange",
        resolver: zodResolver(addVendorSchema) as any,
    });

    const { formState: { errors } } = form;
    const nameValue     = useWatch({ control: form.control, name: "name" });
    const debouncedName = useDebounce(nameValue, 1200);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setCheckingName(false);
            setNameTaken(null);
            form.reset();
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Name uniqueness check
    useEffect(() => {
        if (!debouncedName || !dbName || !schema) { setNameTaken(null); return; }
        if (form.getFieldState("name").invalid) { setNameTaken(null); return; }
        setCheckingName(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { name: debouncedName },
                        sqlId:   SQL_MAP.CHECK_VENDOR_NAME_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setNameTaken(exists);
                if (exists) form.setError("name", { message: MESSAGES.ERROR_VENDOR_NAME_EXISTS, type: "manual" });
                else form.clearErrors("name");
            })
            .catch(() => setNameTaken(null))
            .finally(() => setCheckingName(false));
    }, [debouncedName]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: AddVendorFormType) {
        if (!dbName || !schema) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "supplier",
                        xData: {
                            name:          data.name,
                            phone:         data.phone || null,
                            email:         data.email || null,
                            gstin:         data.gstin || null,
                            pan:           data.pan || null,
                            address_line1: data.address_line1 || null,
                            address_line2: data.address_line2 || null,
                            city:          data.city || null,
                            state_id:      data.state_id,
                            pincode:       data.pincode || null,
                            remarks:       data.remarks || null,
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_VENDOR_CREATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_VENDOR_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled = checkingName || nameTaken === true || Object.keys(errors).length > 0 || submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Add Vendor
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="av_name">
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                className="pr-8"
                                id="av_name"
                                placeholder="Vendor / supplier name"
                                {...form.register("name")}
                            />
                            {checkingName && (
                                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                            )}
                            {!checkingName && nameTaken === false && !errors.name && (
                                <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                            )}
                        </div>
                        <FieldError message={errors.name?.message} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Phone */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="av_phone">Phone</Label>
                            <Input
                                autoComplete="off"
                                id="av_phone"
                                placeholder="Phone number"
                                {...form.register("phone")}
                            />
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="av_email">Email</Label>
                            <Input
                                autoComplete="off"
                                id="av_email"
                                placeholder="vendor@example.com"
                                type="email"
                                {...form.register("email")}
                            />
                            <FieldError message={errors.email?.message} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* GSTIN */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="av_gstin">GSTIN</Label>
                            <Input
                                autoComplete="off"
                                className="font-mono uppercase"
                                id="av_gstin"
                                placeholder="15-character GSTIN"
                                {...form.register("gstin")}
                            />
                        </div>

                        {/* PAN */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="av_pan">PAN</Label>
                            <Input
                                autoComplete="off"
                                className="font-mono uppercase"
                                id="av_pan"
                                placeholder="10-character PAN"
                                {...form.register("pan")}
                            />
                        </div>
                    </div>

                    {/* Address Line 1 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="av_addr1">Address</Label>
                        <Input
                            autoComplete="off"
                            id="av_addr1"
                            placeholder="Street address"
                            {...form.register("address_line1")}
                        />
                    </div>

                    {/* Address Line 2 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="av_addr2">Address Line 2</Label>
                        <Input
                            autoComplete="off"
                            id="av_addr2"
                            placeholder="Apartment, suite, etc."
                            {...form.register("address_line2")}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {/* State */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="av_state">
                                State <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                onValueChange={(v) => form.setValue("state_id", Number(v), { shouldValidate: true })}
                            >
                                <SelectTrigger id="av_state">
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
                            <Label htmlFor="av_city">City</Label>
                            <Input
                                autoComplete="off"
                                id="av_city"
                                placeholder="City"
                                {...form.register("city")}
                            />
                        </div>

                        {/* Pincode */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="av_pin">Pincode</Label>
                            <Input
                                autoComplete="off"
                                id="av_pin"
                                placeholder="Pincode"
                                {...form.register("pincode")}
                            />
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="av_remarks">Remarks</Label>
                        <Input
                            autoComplete="off"
                            id="av_remarks"
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
                            Add Vendor
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
