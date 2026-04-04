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
import type { BranchOption } from "@/features/client/types/technician";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddTechnicianDialogPropsType = {
    branches:     BranchOption[];
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type AddTechnicianFormType = z.infer<typeof addTechnicianSchema>;

type CheckQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const addTechnicianSchema = z.object({
    branch_id:      z.coerce.number().positive("Branch is required"),
    code:           z.string()
                      .min(1, "Code is required")
                      .max(20, "Code must be 20 characters or fewer")
                      .regex(/^[A-Za-z0-9_]+$/, "Only letters, numbers and underscores")
                      .transform((v) => v.toUpperCase()),
    name:           z.string().min(2, "Name must be at least 2 characters"),
    phone:          z.string().optional(),
    email:          z.string().email("Invalid email address").or(z.literal("")).optional(),
    specialization: z.string().optional(),
    leaving_date:   z.string().optional(),
});

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddTechnicianDialog = ({
    branches,
    onOpenChange,
    onSuccess,
    open,
}: AddTechnicianDialogPropsType) => {
    const [checkingCode, setCheckingCode] = useState(false);
    const [codeTaken,    setCodeTaken]    = useState<boolean | null>(null);
    const [submitting,   setSubmitting]   = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useForm<AddTechnicianFormType>({
        defaultValues: {
            branch_id:      0,
            code:           "",
            email:          "",
            leaving_date:   "",
            name:           "",
            phone:          "",
            specialization: "",
        },
        mode:     "onChange",
        resolver: zodResolver(addTechnicianSchema) as any,
    });

    const { formState: { errors } } = form;
    const codeValue      = useWatch({ control: form.control, name: "code" });
    const branchIdValue  = useWatch({ control: form.control, name: "branch_id" });
    const debouncedCode  = useDebounce(codeValue, 1200);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setCheckingCode(false);
            setCodeTaken(null);
            setSubmitting(false);
            form.reset();
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Code uniqueness check (scoped to branch)
    useEffect(() => {
        if (!debouncedCode || !branchIdValue || branchIdValue <= 0 || !dbName || !schema) {
            setCodeTaken(null);
            return;
        }
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
                        sqlArgs: { branch_id: branchIdValue, code: debouncedCode.toUpperCase() },
                        sqlId:   SQL_MAP.CHECK_TECHNICIAN_CODE_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setCodeTaken(exists);
                if (exists) form.setError("code", { message: MESSAGES.ERROR_TECHNICIAN_CODE_EXISTS, type: "manual" });
                else form.clearErrors("code");
            })
            .catch(() => setCodeTaken(null))
            .finally(() => setCheckingCode(false));
    }, [debouncedCode, branchIdValue]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: AddTechnicianFormType) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "technician",
                        xData: {
                            branch_id:      data.branch_id,
                            code:           data.code,
                            name:           data.name,
                            phone:          data.phone || null,
                            email:          data.email || null,
                            specialization: data.specialization || null,
                            leaving_date:   data.leaving_date || null,
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_TECHNICIAN_CREATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_TECHNICIAN_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled = checkingCode || codeTaken === true || Object.keys(errors).length > 0 || submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Add Technician
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Branch */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="at_branch">
                            Branch <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            onValueChange={(v) => {
                                form.setValue("branch_id", Number(v), { shouldValidate: true });
                                setCodeTaken(null);
                            }}
                        >
                            <SelectTrigger id="at_branch">
                                <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                            <SelectContent>
                                {branches.map((b) => (
                                    <SelectItem key={b.id} value={String(b.id)}>
                                        {b.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FieldError message={errors.branch_id?.message} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Code */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="at_code">
                                Code <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    autoComplete="off"
                                    className="pr-8 font-mono uppercase"
                                    id="at_code"
                                    placeholder="e.g. TECH01"
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
                            <Label htmlFor="at_name">
                                Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                autoComplete="off"
                                id="at_name"
                                placeholder="Full name"
                                {...form.register("name")}
                            />
                            <FieldError message={errors.name?.message} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Phone */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="at_phone">Phone</Label>
                            <Input
                                autoComplete="off"
                                id="at_phone"
                                placeholder="Phone number"
                                {...form.register("phone")}
                            />
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="at_email">Email</Label>
                            <Input
                                autoComplete="off"
                                id="at_email"
                                placeholder="tech@example.com"
                                type="email"
                                {...form.register("email")}
                            />
                            <FieldError message={errors.email?.message} />
                        </div>
                    </div>

                    {/* Specialization */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="at_spec">Specialization</Label>
                        <Input
                            autoComplete="off"
                            id="at_spec"
                            placeholder="e.g. Mobile repair, AC service"
                            {...form.register("specialization")}
                        />
                    </div>

                    {/* Leaving Date */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="at_leaving">Leaving Date</Label>
                        <Input
                            id="at_leaving"
                            type="date"
                            {...form.register("leaving_date")}
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
                            Add Technician
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
