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
import { selectCurrentBranch, selectHomeStateId, selectPostDataToAccounts, selectSchema } from "@/store/context-slice";
import { addDivisionSchema } from "./division-schema";
import type { AddDivisionFormValues } from "./division-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddDivisionDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:   () => void;
    open:        boolean;
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

export const AddDivisionDialog = ({
    onOpenChange,
    onSuccess,
    open,
}: AddDivisionDialogPropsType) => {
    const [checkingName, setCheckingName] = useState(false);
    const [nameTaken,    setNameTaken]    = useState<boolean | null>(null);
    const [checkingCode, setCheckingCode] = useState(false);
    const [codeTaken,    setCodeTaken]    = useState<boolean | null>(null);
    const [states,       setStates]       = useState<StateType[]>([]);
    const [suggestedId,  setSuggestedId]  = useState<number | null>(null);
    const dbName             = useAppSelector(selectDbName);
    const schema             = useAppSelector(selectSchema);
    const currentBranch      = useAppSelector(selectCurrentBranch);
    const homeStateId        = useAppSelector(selectHomeStateId);
    const postDataToAccounts = useAppSelector(selectPostDataToAccounts);

    const form = useForm<AddDivisionFormValues>({
        defaultValues: {
            id:              0,
            code:            "",
            address_line1:   "",
            address_line2:   "",
            city:            "",
            country:         "",
            email:           "",
            gstin:           "",
            is_active:       true,
            name:            "",
            phone:           "",
            pincode:         "",
            state_id:        0,
            web_site:        "",
            account_setting: null,
        },
        mode:     "onChange",
        resolver: zodResolver(addDivisionSchema) as any,
    });

    const { formState: { errors } } = form;
    const nameValue     = useWatch({ control: form.control, name: "name" });
    const debouncedName = useDebounce(nameValue, 1200);
    const codeValue     = useWatch({ control: form.control, name: "code" });
    const debouncedCode = useDebounce(codeValue, 1200);

    // Fetch states and suggested ID on open; default to home state
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
        apolloClient
            .query<{ genericQuery: { next_id: number }[] | null }>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_NEXT_DIVISION_ID }),
                },
            })
            .then((res) => setSuggestedId(res.data?.genericQuery?.[0]?.next_id ?? null))
            .catch(() => setSuggestedId(null));
        if (homeStateId) form.setValue("state_id", homeStateId);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset on close
    useEffect(() => {
        if (!open) {
            setCheckingName(false);
            setNameTaken(null);
            setCheckingCode(false);
            setCodeTaken(null);
            setSuggestedId(null);
            setStates([]);
            form.reset();
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Code uniqueness check within branch
    useEffect(() => {
        if (!debouncedCode || !dbName || !schema || !currentBranch) { setCodeTaken(null); return; }
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
                        sqlArgs: { branch_id: currentBranch.id, code: debouncedCode },
                        sqlId:   SQL_MAP.CHECK_DIVISION_CODE_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setCodeTaken(exists);
                if (exists) form.setError("code", { message: MESSAGES.ERROR_DIVISION_CODE_EXISTS, type: "manual" });
                else form.clearErrors("code");
            })
            .catch(() => setCodeTaken(null))
            .finally(() => setCheckingCode(false));
    }, [debouncedCode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Name uniqueness check within branch
    useEffect(() => {
        if (!debouncedName || !dbName || !schema || !currentBranch) { setNameTaken(null); return; }
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
                        sqlArgs: { branch_id: currentBranch.id, name: debouncedName },
                        sqlId:   SQL_MAP.CHECK_DIVISION_NAME_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setNameTaken(exists);
                if (exists) form.setError("name", { message: MESSAGES.ERROR_DIVISION_NAME_EXISTS, type: "manual" });
                else form.clearErrors("name");
            })
            .catch(() => setNameTaken(null))
            .finally(() => setCheckingName(false));
    }, [debouncedName]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: AddDivisionFormValues) {
        if (!dbName || !schema || !currentBranch) return;
        const as = data.account_setting;
        const accountSettingValue = (postDataToAccounts && as?.clientCode)
            ? {
                clientCode: as.clientCode,
                buCode:     as.buCode,
                receipt: {
                    debitAccountId:  as.receipt?.debitAccountId  ?? "",
                    creditAccountId: as.receipt?.creditAccountId ?? "",
                },
              }
            : null;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "division",
                        xData: {
                            id:              data.id,
                            isIdInsert:      true,
                            address_line1:   data.address_line1,
                            address_line2:   data.address_line2 || null,
                            branch_id:       currentBranch.id,
                            city:            data.city || null,
                            country:         data.country || null,
                            email:           data.email || null,
                            gstin:           data.gstin || null,
                            code:            data.code,
                            is_active:       data.is_active,
                            name:            data.name,
                            phone:           data.phone || null,
                            pincode:         data.pincode || null,
                            state_id:        data.state_id,
                            web_site:        data.web_site || null,
                            account_setting: accountSettingValue ? JSON.stringify(accountSettingValue) : null,
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_DIVISION_CREATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_DIVISION_CREATE_FAILED);
        }
    }

    const submitDisabled =
        checkingName ||
        checkingCode ||
        Object.keys(errors).length > 0 ||
        nameTaken === true ||
        codeTaken === true ||
        form.formState.isSubmitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-lg flex flex-col max-h-[90vh]">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Add Division
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col min-h-0 flex-1" onSubmit={form.handleSubmit(onSubmit)}>
                <div className="flex flex-col gap-4 pt-1 overflow-y-auto min-h-0 flex-1 pr-1">
                    <div className="grid grid-cols-2 gap-4">
                        {/* ID */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-baseline justify-between">
                                <Label htmlFor="dv_id">
                                    ID <span className="text-red-500">*</span>
                                </Label>
                                {suggestedId !== null && (
                                    <button
                                        className="text-xs text-sky-600 hover:underline focus:outline-none cursor-pointer"
                                        type="button"
                                        onClick={() => form.setValue("id", suggestedId, { shouldValidate: true })}
                                    >
                                        Use {suggestedId}
                                    </button>
                                )}
                            </div>
                            <Input
                                autoComplete="off"
                                id="dv_id"
                                placeholder="Unique integer ID"
                                type="number"
                                {...form.register("id")}
                            />
                            <FieldError message={errors.id?.message} />
                        </div>

                        {/* Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dv_code">
                                Code <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    autoComplete="off"
                                    className="pr-8 font-mono uppercase"
                                    id="dv_code"
                                    placeholder="e.g. MAIN"
                                    {...form.register("code", { setValueAs: (v: string) => v.toUpperCase() })}
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
                    </div>

                    {/* Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="dv_name">
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                className="pr-8"
                                id="dv_name"
                                placeholder="e.g. Main Division"
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
                        <Label htmlFor="dv_addr1">
                            Address <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            autoComplete="off"
                            id="dv_addr1"
                            placeholder="Street address"
                            {...form.register("address_line1")}
                        />
                        <FieldError message={errors.address_line1?.message} />
                    </div>

                    {/* Address line 2 */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="dv_addr2">Address Line 2</Label>
                        <Input
                            autoComplete="off"
                            id="dv_addr2"
                            placeholder="Apartment, suite, etc."
                            {...form.register("address_line2")}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* State */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dv_state">
                                State <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={String(form.watch("state_id") || "")}
                                onValueChange={(v) => form.setValue("state_id", Number(v), { shouldValidate: true })}
                            >
                                <SelectTrigger id="dv_state">
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
                            <Label htmlFor="dv_city">City</Label>
                            <Input
                                autoComplete="off"
                                id="dv_city"
                                placeholder="City"
                                {...form.register("city")}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Country */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dv_country">Country</Label>
                            <Input
                                autoComplete="off"
                                id="dv_country"
                                placeholder="Country"
                                {...form.register("country")}
                            />
                        </div>

                        {/* Pincode */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dv_pin">Pincode</Label>
                            <Input
                                autoComplete="off"
                                id="dv_pin"
                                placeholder="Pincode"
                                {...form.register("pincode")}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Phone */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dv_phone">Phone</Label>
                            <Input
                                autoComplete="off"
                                id="dv_phone"
                                placeholder="Phone number"
                                {...form.register("phone")}
                            />
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dv_email">Email</Label>
                            <Input
                                autoComplete="off"
                                id="dv_email"
                                placeholder="division@example.com"
                                type="email"
                                {...form.register("email")}
                            />
                            <FieldError message={errors.email?.message} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* GSTIN */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dv_gstin">GSTIN</Label>
                            <Input
                                autoComplete="off"
                                className="font-mono uppercase"
                                id="dv_gstin"
                                placeholder="15-char GSTIN"
                                {...form.register("gstin")}
                            />
                            <FieldError message={errors.gstin?.message} />
                        </div>

                        {/* Web Site */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dv_website">Web Site</Label>
                            <Input
                                autoComplete="off"
                                id="dv_website"
                                placeholder="https://example.com"
                                type="url"
                                {...form.register("web_site")}
                            />
                        </div>
                    </div>

                    {/* Accounts Integration — visible only when post_data_to_accounts is enabled */}
                    {postDataToAccounts && (
                        <div className="flex flex-col gap-3 rounded-md border p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                Accounts Integration
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="dv_client_code">Client Code</Label>
                                    <Input
                                        autoComplete="off"
                                        id="dv_client_code"
                                        placeholder="e.g. demoAccounts"
                                        {...form.register("account_setting.clientCode")}
                                    />
                                    <FieldError message={errors.account_setting?.clientCode?.message} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="dv_bu_code">BU Code</Label>
                                    <Input
                                        autoComplete="off"
                                        id="dv_bu_code"
                                        placeholder="e.g. demounit1"
                                        {...form.register("account_setting.buCode")}
                                    />
                                    <FieldError message={errors.account_setting?.buCode?.message} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="dv_debit_acc">Receipt Debit A/c ID</Label>
                                    <Input
                                        autoComplete="off"
                                        id="dv_debit_acc"
                                        placeholder="Debit account ID"
                                        {...form.register("account_setting.receipt.debitAccountId")}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="dv_credit_acc">Receipt Credit A/c ID</Label>
                                    <Input
                                        autoComplete="off"
                                        id="dv_credit_acc"
                                        placeholder="Credit account ID"
                                        {...form.register("account_setting.receipt.creditAccountId")}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                    <DialogFooter className="pt-2 shrink-0">
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
                            Add Division
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
