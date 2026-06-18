import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, Loader2, Receipt, ShoppingCart, Tag, Wrench } from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectPostDataToAccounts, selectSchema } from "@/store/context-slice";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

function SectionLabel({ icon, children, iconClass }: { icon: React.ReactNode; children: React.ReactNode; iconClass?: string }) {
    return (
        <div className="flex items-center gap-2 mb-1">
            <span className={`flex h-6 w-6 items-center justify-center rounded ${iconClass ?? "bg-(--cl-accent)/10 text-(--cl-accent)"}`}>
                {icon}
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-(--cl-text)">
                {children}
            </p>
        </div>
    );
}

const DEFAULT_INVOICE = {
    debitAccountId: 0, creditAccountId: 0,
    productId: 0, defaultProductHsn: 0, defaultGstRate: 18,
};

function buildAccountSetting(division: DivisionType) {
    const as = division.account_setting;
    if (!as) return null;
    return {
        clientCode: as.clientCode ?? "",
        buCode:     as.buCode ?? "",
        branchId:   as.branchId ?? 0,
        receipt: {
            debitAccountId:  as.receipt?.debitAccountId  ?? 0,
            creditAccountId: as.receipt?.creditAccountId ?? 0,
        },
        purchaseInvoice: as.purchaseInvoice ? { ...as.purchaseInvoice } : { ...DEFAULT_INVOICE },
        salesInvoice:    as.salesInvoice    ? { ...as.salesInvoice }    : { ...DEFAULT_INVOICE },
        jobInvoice:      as.jobInvoice      ? { ...as.jobInvoice }      : { ...DEFAULT_INVOICE },
    };
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
    const [checkingCode, setCheckingCode] = useState(false);
    const [codeTaken,    setCodeTaken]    = useState<boolean | null>(null);
    const [states,       setStates]       = useState<StateType[]>([]);
    const dbName             = useAppSelector(selectDbName);
    const schema             = useAppSelector(selectSchema);
    const currentBranch      = useAppSelector(selectCurrentBranch);
    const postDataToAccounts = useAppSelector(selectPostDataToAccounts);

    const form = useForm<DivisionFormValues>({
        defaultValues: {
            code:            division.code,
            address_line1:   division.address_line1,
            address_line2:   division.address_line2 ?? "",
            city:            division.city ?? "",
            country:         division.country ?? "",
            email:           division.email ?? "",
            gstin:           division.gstin ?? "",
            is_active:       division.is_active,
            name:            division.name,
            phone:           division.phone ?? "",
            pincode:         division.pincode ?? "",
            state_id:        division.state_id,
            web_site:        division.web_site ?? "",
            account_setting: buildAccountSetting(division),
        },
        mode:     "onChange",
        resolver: zodResolver(divisionSchema) as any,
    });

    const { formState: { errors } } = form;
    const nameValue     = useWatch({ control: form.control, name: "name" });
    const debouncedName = useDebounce(nameValue, 1200);
    const codeValue     = useWatch({ control: form.control, name: "code" });
    const debouncedCode = useDebounce(codeValue, 1200);

    // Pre-fill and fetch states on open
    useEffect(() => {
        if (!open) return;
        form.reset({
            code:            division.code,
            address_line1:   division.address_line1,
            address_line2:   division.address_line2 ?? "",
            city:            division.city ?? "",
            country:         division.country ?? "",
            email:           division.email ?? "",
            gstin:           division.gstin ?? "",
            is_active:       division.is_active,
            name:            division.name,
            phone:           division.phone ?? "",
            pincode:         division.pincode ?? "",
            state_id:        division.state_id,
            web_site:        division.web_site ?? "",
            account_setting: buildAccountSetting(division),
        });
        setNameTaken(null);
        setCodeTaken(null);
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

    // Name uniqueness check (exclude own)
    useEffect(() => {
        if (!debouncedName || !dbName || !schema || !currentBranch) { setNameTaken(null); return; }
        if (form.getFieldState("name").invalid) { setNameTaken(null); return; }
        if (debouncedName === division.name) { setNameTaken(false); return; }
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

    // Code uniqueness check (exclude own)
    useEffect(() => {
        if (!debouncedCode || !dbName || !schema || !currentBranch) { setCodeTaken(null); return; }
        if (form.getFieldState("code").invalid) { setCodeTaken(null); return; }
        if (debouncedCode.toUpperCase() === division.code.toUpperCase()) { setCodeTaken(false); return; }
        setCheckingCode(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { branch_id: division.branch_id, code: debouncedCode, id: division.id },
                        sqlId:   SQL_MAP.CHECK_DIVISION_CODE_EXISTS_EXCLUDE_ID,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setCodeTaken(exists);
                if (exists) form.setError("code", { message: MESSAGES.ERROR_DIVISION_CODE_EXISTS_EDIT, type: "manual" });
                else form.clearErrors("code");
            })
            .catch(() => setCodeTaken(null))
            .finally(() => setCheckingCode(false));
    }, [debouncedCode]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: DivisionFormValues) {
        if (!dbName || !schema) return;
        const as = data.account_setting;
        const accountSettingValue = (postDataToAccounts && as?.clientCode)
            ? {
                clientCode: as.clientCode,
                buCode:     as.buCode,
                branchId:   as.branchId,
                receipt: {
                    debitAccountId:  as.receipt?.debitAccountId  ?? 0,
                    creditAccountId: as.receipt?.creditAccountId ?? 0,
                },
                ...(as.purchaseInvoice ? { purchaseInvoice: as.purchaseInvoice } : {}),
                ...(as.salesInvoice    ? { salesInvoice:    as.salesInvoice }    : {}),
                ...(as.jobInvoice      ? { jobInvoice:      as.jobInvoice }      : {}),
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
                            address_line1:   data.address_line1,
                            address_line2:   data.address_line2 || null,
                            city:            data.city || null,
                            code:            data.code,
                            country:         data.country || null,
                            email:           data.email || null,
                            gstin:           data.gstin || null,
                            id:              division.id,
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
            toast.success(MESSAGES.SUCCESS_DIVISION_UPDATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_DIVISION_UPDATE_FAILED);
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
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-lg flex flex-col h-[85vh]"
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader className="shrink-0">
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Edit Division
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col min-h-0 flex-1" onSubmit={form.handleSubmit(onSubmit)}>
                    <Tabs defaultValue="details" className="flex flex-col min-h-0 flex-1">
                        <TabsList className="shrink-0">
                            <TabsTrigger value="details">Details</TabsTrigger>
                            {postDataToAccounts && (
                                <TabsTrigger value="accounts">Trace+ Accounts Integration</TabsTrigger>
                            )}
                        </TabsList>

                        <TabsContent value="details">
                            <div className="flex flex-col gap-3 pt-1 overflow-y-auto min-h-0 flex-1 pr-1">

                                {/* ── Identity ── */}
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                                    <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-amber-600">Identity</p>
                                    <div className="flex flex-col gap-3">
                                        {/* Code */}
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="edv_code">
                                                Code <span className="text-red-500">*</span>
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    autoComplete="off"
                                                    className="pr-8 font-mono uppercase"
                                                    id="edv_code"
                                                    placeholder="e.g. MAIN (2–10 uppercase letters/digits/underscores)"
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
                                    </div>
                                </div>

                                {/* ── Address ── */}
                                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                                    <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-blue-600">Address</p>
                                    <div className="flex flex-col gap-3">
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

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="edv_addr2">Address Line 2</Label>
                                            <Input
                                                autoComplete="off"
                                                id="edv_addr2"
                                                placeholder="Apartment, suite, etc."
                                                {...form.register("address_line2")}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
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

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_country">Country</Label>
                                                <Input
                                                    autoComplete="off"
                                                    id="edv_country"
                                                    placeholder="Country"
                                                    {...form.register("country")}
                                                />
                                            </div>

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
                                    </div>
                                </div>

                                {/* ── Contact & Legal ── */}
                                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                                    <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-rose-600">Contact & Legal</p>
                                    <div className="flex flex-col gap-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_phone">Phone</Label>
                                                <Input
                                                    autoComplete="off"
                                                    id="edv_phone"
                                                    placeholder="Phone number"
                                                    {...form.register("phone")}
                                                />
                                            </div>

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

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_gstin">GSTIN</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="font-mono uppercase"
                                                    id="edv_gstin"
                                                    placeholder="15-character GSTIN"
                                                    {...form.register("gstin")}
                                                />
                                                <FieldError message={errors.gstin?.message} />
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_website">Web Site</Label>
                                                <Input
                                                    autoComplete="off"
                                                    id="edv_website"
                                                    placeholder="https://example.com"
                                                    type="url"
                                                    {...form.register("web_site")}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </TabsContent>

                        {postDataToAccounts && (
                            <TabsContent value="accounts">
                                <div className="flex flex-col gap-4 pt-1 overflow-y-auto min-h-0 flex-1 pr-1">
                                    {/* ── Common ── */}
                                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
                                        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-sky-600">
                                            Common
                                        </p>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_client_code" className="text-xs">Client Code</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm"
                                                    id="edv_client_code"
                                                    placeholder="e.g. demoAccounts"
                                                    {...form.register("account_setting.clientCode")}
                                                />
                                                <FieldError message={errors.account_setting?.clientCode?.message} />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_bu_code" className="text-xs">BU Code</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm"
                                                    id="edv_bu_code"
                                                    placeholder="e.g. demounit1"
                                                    {...form.register("account_setting.buCode")}
                                                />
                                                <FieldError message={errors.account_setting?.buCode?.message} />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_branch_id" className="text-xs">Branch ID</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm"
                                                    id="edv_branch_id"
                                                    placeholder="e.g. 1"
                                                    type="number"
                                                    {...form.register("account_setting.branchId")}
                                                />
                                                <FieldError message={errors.account_setting?.branchId?.message} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Money Receipt ── */}
                                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
                                        <SectionLabel icon={<Receipt className="h-3.5 w-3.5" />} iconClass="bg-emerald-100 text-emerald-600">Money Receipt</SectionLabel>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_r_debit" className="text-xs">Debit A/c ID</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm font-mono"
                                                    id="edv_r_debit"
                                                    placeholder="Debit account ID"
                                                    type="number"
                                                    {...form.register("account_setting.receipt.debitAccountId")}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_r_credit" className="text-xs">Credit A/c ID</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm font-mono"
                                                    id="edv_r_credit"
                                                    placeholder="Credit account ID"
                                                    type="number"
                                                    {...form.register("account_setting.receipt.creditAccountId")}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Purchase Invoice ── */}
                                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 shadow-sm">
                                        <SectionLabel icon={<ShoppingCart className="h-3.5 w-3.5" />} iconClass="bg-violet-100 text-violet-600">Purchase Invoice</SectionLabel>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_pi_debit" className="text-xs">Debit A/c ID</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm font-mono"
                                                    id="edv_pi_debit"
                                                    placeholder="Debit account ID"
                                                    type="number"
                                                    {...form.register("account_setting.purchaseInvoice.debitAccountId")}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_pi_credit" className="text-xs">Credit A/c ID</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm font-mono"
                                                    id="edv_pi_credit"
                                                    placeholder="Credit account ID"
                                                    type="number"
                                                    {...form.register("account_setting.purchaseInvoice.creditAccountId")}
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_pi_prod" className="text-xs">Product Id</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm font-mono"
                                                    id="edv_pi_prod"
                                                    placeholder="e.g. 278"
                                                    type="number"
                                                    {...form.register("account_setting.purchaseInvoice.productId")}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_pi_hsn" className="text-xs">Default HSN</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm"
                                                    id="edv_pi_hsn"
                                                    placeholder="HSN code"
                                                    type="number"
                                                    {...form.register("account_setting.purchaseInvoice.defaultProductHsn")}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_pi_gst" className="text-xs">GST Rate %</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm"
                                                    id="edv_pi_gst"
                                                    placeholder="e.g. 18"
                                                    type="number"
                                                    {...form.register("account_setting.purchaseInvoice.defaultGstRate")}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Sales Invoice ── */}
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
                                        <SectionLabel icon={<Tag className="h-3.5 w-3.5" />} iconClass="bg-amber-100 text-amber-600">Sales Invoice</SectionLabel>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_si_debit" className="text-xs">Debit A/c ID</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm font-mono"
                                                    id="edv_si_debit"
                                                    placeholder="Debit account ID"
                                                    type="number"
                                                    {...form.register("account_setting.salesInvoice.debitAccountId")}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_si_credit" className="text-xs">Credit A/c ID</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm font-mono"
                                                    id="edv_si_credit"
                                                    placeholder="Credit account ID"
                                                    type="number"
                                                    {...form.register("account_setting.salesInvoice.creditAccountId")}
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_si_prod" className="text-xs">Product Id</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm font-mono"
                                                    id="edv_si_prod"
                                                    placeholder="e.g. 278"
                                                    type="number"
                                                    {...form.register("account_setting.salesInvoice.productId")}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_si_hsn" className="text-xs">Default HSN</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm"
                                                    id="edv_si_hsn"
                                                    placeholder="HSN code"
                                                    type="number"
                                                    {...form.register("account_setting.salesInvoice.defaultProductHsn")}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_si_gst" className="text-xs">GST Rate %</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm"
                                                    id="edv_si_gst"
                                                    placeholder="e.g. 18"
                                                    type="number"
                                                    {...form.register("account_setting.salesInvoice.defaultGstRate")}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Job Invoice ── */}
                                    <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 shadow-sm">
                                        <SectionLabel icon={<Wrench className="h-3.5 w-3.5" />} iconClass="bg-teal-100 text-teal-600">Job Invoice</SectionLabel>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_ji_debit" className="text-xs">Debit A/c ID</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm font-mono"
                                                    id="edv_ji_debit"
                                                    placeholder="Debit account ID"
                                                    type="number"
                                                    {...form.register("account_setting.jobInvoice.debitAccountId")}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_ji_credit" className="text-xs">Credit A/c ID</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm font-mono"
                                                    id="edv_ji_credit"
                                                    placeholder="Credit account ID"
                                                    type="number"
                                                    {...form.register("account_setting.jobInvoice.creditAccountId")}
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_ji_prod" className="text-xs">Product Id</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm font-mono"
                                                    id="edv_ji_prod"
                                                    placeholder="e.g. 278"
                                                    type="number"
                                                    {...form.register("account_setting.jobInvoice.productId")}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_ji_hsn" className="text-xs">Default HSN</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm"
                                                    id="edv_ji_hsn"
                                                    placeholder="HSN code"
                                                    type="number"
                                                    {...form.register("account_setting.jobInvoice.defaultProductHsn")}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edv_ji_gst" className="text-xs">GST Rate %</Label>
                                                <Input
                                                    autoComplete="off"
                                                    className="h-8 text-sm"
                                                    id="edv_ji_gst"
                                                    placeholder="e.g. 18"
                                                    type="number"
                                                    {...form.register("account_setting.jobInvoice.defaultGstRate")}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        )}
                    </Tabs>

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
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
