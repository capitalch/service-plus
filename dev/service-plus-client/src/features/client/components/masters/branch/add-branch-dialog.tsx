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

// ─── Types ────────────────────────────────────────────────────────────────────

type AddBranchDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:   () => void;
    open:        boolean;
};

type AddBranchFormType = z.infer<typeof addBranchSchema>;

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

const addBranchSchema = z.object({
    address_line1:  z.string().min(3, "Address is required"),
    address_line2:  z.string().optional(),
    city:           z.string().optional(),
    code:           z.string()
                      .min(2, "Code must be at least 2 characters")
                      .max(20, "Code must be 20 characters or fewer")
                      .regex(/^[A-Za-z0-9_]+$/, "Only letters, numbers and underscores")
                      .transform((v) => v.toUpperCase()),
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

export const AddBranchDialog = ({
    onOpenChange,
    onSuccess,
    open,
}: AddBranchDialogPropsType) => {
    const [checkingCode, setCheckingCode] = useState(false);
    const [checkingName, setCheckingName] = useState(false);
    const [codeTaken,    setCodeTaken]    = useState<boolean | null>(null);
    const [nameTaken,    setNameTaken]    = useState<boolean | null>(null);
    const [states,       setStates]       = useState<StateType[]>([]);
    const [submitting,   setSubmitting]   = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useForm<AddBranchFormType>({
        defaultValues: {
            address_line1: "",
            address_line2: "",
            city:          "",
            code:          "",
            email:         "",
            gstin:         "",
            name:          "",
            phone:         "",
            pincode:       "",
            state_id:      0,
        },
        mode:     "onChange",
        resolver: zodResolver(addBranchSchema) as any,
    });

    const { formState: { errors } } = form;
    const codeValue     = useWatch({ control: form.control, name: "code" });
    const debouncedCode = useDebounce(codeValue, 1200);
    const nameValue     = useWatch({ control: form.control, name: "name" });
    const debouncedName = useDebounce(nameValue, 1200);

    // Fetch states on open
    useEffect(() => {
        if (!open || !dbName || !schema) return;
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

    // Reset on close
    useEffect(() => {
        if (!open) {
            setCheckingCode(false);
            setCheckingName(false);
            setCodeTaken(null);
            setNameTaken(null);
            setStates([]);
            setSubmitting(false);
            form.reset();
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Code uniqueness check
    useEffect(() => {
        if (!debouncedCode || !dbName || !schema) { setCodeTaken(null); return; }
        if (form.getFieldState("code").invalid) { setCodeTaken(null); return; }
        setCheckingCode(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { code: debouncedCode },
                        sqlId:   SQL_MAP.CHECK_BRANCH_CODE_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setCodeTaken(exists);
                if (exists) form.setError("code", { message: MESSAGES.ERROR_BRANCH_CODE_EXISTS, type: "manual" });
                else form.clearErrors("code");
            })
            .catch(() => setCodeTaken(null))
            .finally(() => setCheckingCode(false));
    }, [debouncedCode]); // eslint-disable-line react-hooks/exhaustive-deps

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
                        sqlId:   SQL_MAP.CHECK_BRANCH_NAME_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setNameTaken(exists);
                if (exists) form.setError("name", { message: MESSAGES.ERROR_BRANCH_NAME_EXISTS, type: "manual" });
                else form.clearErrors("name");
            })
            .catch(() => setNameTaken(null))
            .finally(() => setCheckingName(false));
    }, [debouncedName]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: AddBranchFormType) {
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
                            code:           data.code,
                            email:          data.email || null,
                            gstin:          data.gstin || null,
                            name:           data.name,
                            phone:          data.phone || null,
                            pincode:        data.pincode,
                            state_id:       data.state_id,
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_BRANCH_CREATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_BRANCH_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled =
        checkingCode ||
        checkingName ||
        Object.keys(errors).length > 0 ||
        codeTaken === true ||
        nameTaken === true ||
        submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Add Branch
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="br_code">
                                Code <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    autoComplete="off"
                                    className="pr-8 font-mono uppercase"
                                    id="br_code"
                                    placeholder="e.g. HQ"
                                    {...form.register("code")}
                                />
                                {checkingCode && (
                                    <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                                )}
                                {!checkingCode && codeTaken === false && !errors.code && (
                                    <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                                )}
                            </div>
                            <FieldError message={errors.code?.message} />
                        </div>

                        {/* Name */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="br_name">
                                Name <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    autoComplete="off"
                                    className="pr-8"
                                    id="br_name"
                                    placeholder="e.g. Head Office"
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
                    </div>

                    {/* Address line 1 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="br_addr1">
                            Address <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            autoComplete="off"
                            id="br_addr1"
                            placeholder="Street address"
                            {...form.register("address_line1")}
                        />
                        <FieldError message={errors.address_line1?.message} />
                    </div>

                    {/* Address line 2 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="br_addr2">Address Line 2</Label>
                        <Input
                            autoComplete="off"
                            id="br_addr2"
                            placeholder="Apartment, suite, etc."
                            {...form.register("address_line2")}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* State */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="br_state">
                                State <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                onValueChange={(v) => form.setValue("state_id", Number(v), { shouldValidate: true })}
                            >
                                <SelectTrigger id="br_state">
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
                            <Label htmlFor="br_city">City</Label>
                            <Input
                                autoComplete="off"
                                id="br_city"
                                placeholder="City"
                                {...form.register("city")}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Pincode */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="br_pin">
                                Pincode <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                autoComplete="off"
                                id="br_pin"
                                placeholder="Pincode"
                                {...form.register("pincode")}
                            />
                            <FieldError message={errors.pincode?.message} />
                        </div>

                        {/* Phone */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="br_phone">Phone</Label>
                            <Input
                                autoComplete="off"
                                id="br_phone"
                                placeholder="Phone number"
                                {...form.register("phone")}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="br_email">Email</Label>
                            <Input
                                autoComplete="off"
                                id="br_email"
                                placeholder="branch@example.com"
                                type="email"
                                {...form.register("email")}
                            />
                            <FieldError message={errors.email?.message} />
                        </div>

                        {/* GSTIN */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="br_gstin">GSTIN</Label>
                            <Input
                                autoComplete="off"
                                className="font-mono uppercase"
                                id="br_gstin"
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
                            Add Branch
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
