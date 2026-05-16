import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { divisionSchema } from "./division-schema";
import type { DivisionFormValues } from "./division-schema";
import type { DivisionType } from "@/features/client/types/division";

// ─── Types ────────────────────────────────────────────────────────────────────

type EditDivisionDialogPropsType = {
    division:     DivisionType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type CheckQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

type StateType = {
    code: string;
    id:   number;
    name: string;
};

type StatesQueryDataType = {
    genericQuery: StateType[] | null;
};

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditDivisionDialog = ({
    division,
    onOpenChange,
    onSuccess,
    open,
}: EditDivisionDialogPropsType) => {
    const [checkingName, setCheckingName] = useState(false);
    const [nameTaken,    setNameTaken]    = useState<boolean | null>(null);
    const [states,       setStates]       = useState<StateType[]>([]);
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useForm<DivisionFormValues>({
        defaultValues: {
            address_line1: division.address_line1,
            address_line2: division.address_line2 ?? "",
            city:          division.city ?? "",
            country:       division.country ?? "",
            email:         division.email ?? "",
            gstin:         division.gstin ?? "",
            is_active:     division.is_active,
            name:          division.name,
            phone:         division.phone ?? "",
            pincode:       division.pincode ?? "",
            state_id:      division.state_id,
        },
        mode:     "onChange",
        resolver: zodResolver(divisionSchema) as any,
    });

    const { formState: { errors } } = form;
    const nameValue     = useWatch({ control: form.control, name: "name" });
    const debouncedName = useDebounce(nameValue, 1200);

    // Pre-fill and fetch states on open
    useEffect(() => {
        if (!open) return;
        form.reset({
            address_line1: division.address_line1,
            address_line2: division.address_line2 ?? "",
            city:          division.city ?? "",
            country:       division.country ?? "",
            email:         division.email ?? "",
            gstin:         division.gstin ?? "",
            is_active:     division.is_active,
            name:          division.name,
            phone:         division.phone ?? "",
            pincode:       division.pincode ?? "",
            state_id:      division.state_id,
        });
        setNameTaken(null);
        if (!dbName || !schema) return;
        apolloClient
            .query<StatesQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_STATES }),
                },
            })
            .then((res) => setStates(res.data?.genericQuery ?? []))
            .catch(() => toast.error(MESSAGES.ERROR_STATES_LOAD_FAILED));
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Name uniqueness check (exclude current id)
    useEffect(() => {
        if (!debouncedName || !dbName || !schema) { setNameTaken(null); return; }
        if (form.getFieldState("name").invalid) { setNameTaken(null); return; }
        if (debouncedName.toLowerCase() === division.name.toLowerCase()) { setNameTaken(false); return; }
        setCheckingName(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { branch_id: division.branch_id, id: division.id, name: debouncedName },
                        sqlId:   SQL_MAP.CHECK_DIVISION_NAME_EXISTS_EXCLUDE_ID,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setNameTaken(exists);
                if (exists) form.setError("name", { message: MESSAGES.ERROR_DIVISION_NAME_EXISTS_EDIT, type: "manual" });
                else form.clearErrors("name");
            })
            .catch(() => setNameTaken(null))
            .finally(() => setCheckingName(false));
    }, [debouncedName]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: DivisionFormValues) {
        if (!dbName || !schema) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "division",
                        xData: {
                            address_line1: data.address_line1,
                            address_line2: data.address_line2 || null,
                            city:          data.city || null,
                            country:       data.country || null,
                            email:         data.email || null,
                            gstin:         data.gstin || null,
                            id:            division.id,
                            is_active:     data.is_active,
                            name:          data.name,
                            phone:         data.phone || null,
                            pincode:       data.pincode || null,
                            state_id:      data.state_id,
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_DIVISION_UPDATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_DIVISION_UPDATE_FAILED);
        }
    }

    const submitDisabled =
        checkingName ||
        Object.keys(errors).length > 0 ||
        nameTaken === true ||
        form.formState.isSubmitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Edit Division
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="edv_name">
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                className="pr-8"
                                id="edv_name"
                                placeholder="Division name"
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

                    {/* Address line 1 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="edv_addr1">
                            Address <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            autoComplete="off"
                            id="edv_addr1"
                            placeholder="Street address"
                            {...form.register("address_line1")}
                        />
                        <FieldError message={errors.address_line1?.message} />
                    </div>

                    {/* Address line 2 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="edv_addr2">Address Line 2</Label>
                        <Input
                            autoComplete="off"
                            id="edv_addr2"
                            placeholder="Apartment, suite, etc."
                            {...form.register("address_line2")}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* State */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="edv_state">
                                State <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                defaultValue={String(division.state_id)}
                                onValueChange={(v) => form.setValue("state_id", Number(v), { shouldValidate: true })}
                            >
                                <SelectTrigger id="edv_state">
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
                            <Label htmlFor="edv_city">City</Label>
                            <Input
                                autoComplete="off"
                                id="edv_city"
                                placeholder="City"
                                {...form.register("city")}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Country */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="edv_country">Country</Label>
                            <Input
                                autoComplete="off"
                                id="edv_country"
                                placeholder="Country"
                                {...form.register("country")}
                            />
                        </div>

                        {/* Pincode */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="edv_pin">Pincode</Label>
                            <Input
                                autoComplete="off"
                                id="edv_pin"
                                placeholder="Pincode"
                                {...form.register("pincode")}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Phone */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="edv_phone">Phone</Label>
                            <Input
                                autoComplete="off"
                                id="edv_phone"
                                placeholder="Phone number"
                                {...form.register("phone")}
                            />
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="edv_email">Email</Label>
                            <Input
                                autoComplete="off"
                                id="edv_email"
                                placeholder="division@example.com"
                                type="email"
                                {...form.register("email")}
                            />
                            <FieldError message={errors.email?.message} />
                        </div>
                    </div>

                    {/* GSTIN */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="edv_gstin">GSTIN</Label>
                        <Input
                            autoComplete="off"
                            className="font-mono uppercase"
                            id="edv_gstin"
                            placeholder="15-character GSTIN (leave blank for non-GST)"
                            {...form.register("gstin")}
                        />
                        <FieldError message={errors.gstin?.message} />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            disabled={form.formState.isSubmitting}
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
                            {form.formState.isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
