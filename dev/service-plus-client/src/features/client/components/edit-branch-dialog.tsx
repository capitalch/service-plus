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
import type { BranchType } from "@/features/client/types/branch";

// ─── Types ────────────────────────────────────────────────────────────────────

type EditBranchDialogPropsType = {
    branch:       BranchType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type EditBranchFormType = z.infer<typeof editBranchSchema>;

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

// ─── Schema ───────────────────────────────────────────────────────────────────

const editBranchSchema = z.object({
    address_line1:  z.string().min(3, "Address is required"),
    address_line2:  z.string().optional(),
    city:           z.string().optional(),
    email:          z.string().email("Invalid email").or(z.literal("")).optional(),
    gstin:          z.string().regex(/^[0-9A-Z]{15}$/, "Invalid GSTIN (15 characters)").or(z.literal("")).optional(),
    name:           z.string().min(2, "Name must be at least 2 characters"),
    phone:          z.string().optional(),
    pincode:        z.string().min(4, "Pincode is required"),
    state_id:       z.coerce.number().positive("State is required"),
});

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditBranchDialog = ({
    branch,
    onOpenChange,
    onSuccess,
    open,
}: EditBranchDialogPropsType) => {
    const [checkingName, setCheckingName] = useState(false);
    const [nameTaken,    setNameTaken]    = useState<boolean | null>(null);
    const [states,       setStates]       = useState<StateType[]>([]);
    const [submitting,   setSubmitting]   = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useForm<EditBranchFormType>({
        mode:     "onChange",
        resolver: zodResolver(editBranchSchema),
    });

    const { formState: { errors } } = form;
    const nameValue     = useWatch({ control: form.control, name: "name" });
    const debouncedName = useDebounce(nameValue, 1200);

    // Pre-fill form and fetch states on open
    useEffect(() => {
        if (!open) return;
        form.reset({
            address_line1:  branch.address_line1,
            address_line2:  branch.address_line2 ?? "",
            city:           branch.city ?? "",
            email:          branch.email ?? "",
            gstin:          branch.gstin ?? "",
            name:           branch.name,
            phone:          branch.phone ?? "",
            pincode:        branch.pincode,
            state_id:       branch.state_id,
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
        if (debouncedName.toLowerCase() === branch.name.toLowerCase()) { setNameTaken(false); return; }
        setCheckingName(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { id: branch.id, name: debouncedName },
                        sqlId:   SQL_MAP.CHECK_BRANCH_NAME_EXISTS_EXCLUDE_ID,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setNameTaken(exists);
                if (exists) form.setError("name", { message: MESSAGES.ERROR_BRANCH_NAME_EXISTS_EDIT, type: "manual" });
                else form.clearErrors("name");
            })
            .catch(() => setNameTaken(null))
            .finally(() => setCheckingName(false));
    }, [debouncedName]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: EditBranchFormType) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "branch",
                        xData: {
                            address_line1:  data.address_line1,
                            address_line2:  data.address_line2 || null,
                            city:           data.city || null,
                            email:          data.email || null,
                            gstin:          data.gstin || null,
                            id:             branch.id,
                            name:           data.name,
                            phone:          data.phone || null,
                            pincode:        data.pincode,
                            state_id:       data.state_id,
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_BRANCH_UPDATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_BRANCH_UPDATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled =
        checkingName ||
        Object.keys(errors).length > 0 ||
        nameTaken === true ||
        submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Edit Branch
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Code — read-only */}
                    <div className="flex flex-col gap-1.5">
                        <Label>Code</Label>
                        <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                            <span className="font-mono text-sm font-semibold text-slate-700">
                                {branch.code}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400">Branch code cannot be changed.</p>
                    </div>

                    {/* Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ebr_name">
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                className="pr-8"
                                id="ebr_name"
                                placeholder="Branch name"
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
                        <Label htmlFor="ebr_addr1">
                            Address <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            autoComplete="off"
                            id="ebr_addr1"
                            placeholder="Street address"
                            {...form.register("address_line1")}
                        />
                        <FieldError message={errors.address_line1?.message} />
                    </div>

                    {/* Address line 2 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ebr_addr2">Address Line 2</Label>
                        <Input
                            autoComplete="off"
                            id="ebr_addr2"
                            placeholder="Apartment, suite, etc."
                            {...form.register("address_line2")}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* State */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ebr_state">
                                State <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                defaultValue={String(branch.state_id)}
                                onValueChange={(v) => form.setValue("state_id", Number(v), { shouldValidate: true })}
                            >
                                <SelectTrigger id="ebr_state">
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
                            <Label htmlFor="ebr_city">City</Label>
                            <Input
                                autoComplete="off"
                                id="ebr_city"
                                placeholder="City"
                                {...form.register("city")}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Pincode */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ebr_pin">
                                Pincode <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                autoComplete="off"
                                id="ebr_pin"
                                placeholder="Pincode"
                                {...form.register("pincode")}
                            />
                            <FieldError message={errors.pincode?.message} />
                        </div>

                        {/* Phone */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ebr_phone">Phone</Label>
                            <Input
                                autoComplete="off"
                                id="ebr_phone"
                                placeholder="Phone number"
                                {...form.register("phone")}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ebr_email">Email</Label>
                            <Input
                                autoComplete="off"
                                id="ebr_email"
                                placeholder="branch@example.com"
                                type="email"
                                {...form.register("email")}
                            />
                            <FieldError message={errors.email?.message} />
                        </div>

                        {/* GSTIN */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="ebr_gstin">GSTIN</Label>
                            <Input
                                autoComplete="off"
                                className="font-mono uppercase"
                                id="ebr_gstin"
                                placeholder="15-character GSTIN"
                                {...form.register("gstin")}
                            />
                            <FieldError message={errors.gstin?.message} />
                        </div>
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
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
