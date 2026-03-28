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
import type { BranchOption, TechnicianType } from "@/features/client/types/technician";

// ─── Types ────────────────────────────────────────────────────────────────────

type EditTechnicianDialogPropsType = {
    branches:     BranchOption[];
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    technician:   TechnicianType;
};

type EditTechnicianFormType = z.infer<typeof editTechnicianSchema>;

type CheckQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const editTechnicianSchema = z.object({
    branch_id:      z.coerce.number({ required_error: "Branch is required" }).positive("Branch is required"),
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

export const EditTechnicianDialog = ({
    branches,
    onOpenChange,
    onSuccess,
    open,
    technician,
}: EditTechnicianDialogPropsType) => {
    const [checkingCode, setCheckingCode] = useState(false);
    const [codeTaken,    setCodeTaken]    = useState<boolean | null>(null);
    const [submitting,   setSubmitting]   = useState(false);

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useForm<EditTechnicianFormType>({
        mode:     "onChange",
        resolver: zodResolver(editTechnicianSchema),
    });

    const { formState: { errors } } = form;
    const codeValue     = useWatch({ control: form.control, name: "code" });
    const branchIdValue = useWatch({ control: form.control, name: "branch_id" });
    const debouncedCode = useDebounce(codeValue, 1200);

    // Pre-fill form on open
    useEffect(() => {
        if (!open) return;
        form.reset({
            branch_id:      technician.branch_id,
            code:           technician.code,
            name:           technician.name,
            phone:          technician.phone ?? "",
            email:          technician.email ?? "",
            specialization: technician.specialization ?? "",
            leaving_date:   technician.leaving_date ?? "",
        });
        setCodeTaken(null);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Code uniqueness check (scoped to branch, exclude current technician)
    useEffect(() => {
        if (!debouncedCode || !branchIdValue || branchIdValue <= 0 || !dbName || !schema) {
            setCodeTaken(null);
            return;
        }
        if (form.getFieldState("code").invalid) { setCodeTaken(null); return; }
        const upperCode = debouncedCode.toUpperCase();
        if (upperCode === technician.code && branchIdValue === technician.branch_id) {
            setCodeTaken(false);
            return;
        }
        setCheckingCode(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { branch_id: branchIdValue, code: upperCode, id: technician.id },
                        sqlId:   SQL_MAP.CHECK_TECHNICIAN_CODE_EXISTS_EXCLUDE_ID,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setCodeTaken(exists);
                if (exists) form.setError("code", { message: MESSAGES.ERROR_TECHNICIAN_CODE_EXISTS_EDIT, type: "manual" });
                else form.clearErrors("code");
            })
            .catch(() => setCodeTaken(null))
            .finally(() => setCheckingCode(false));
    }, [debouncedCode, branchIdValue]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: EditTechnicianFormType) {
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
                            id:             technician.id,
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
            toast.success(MESSAGES.SUCCESS_TECHNICIAN_UPDATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_TECHNICIAN_UPDATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled = checkingCode || codeTaken === true || Object.keys(errors).length > 0 || submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Edit Technician
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Branch */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="et_branch">
                            Branch <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            defaultValue={String(technician.branch_id)}
                            onValueChange={(v) => {
                                form.setValue("branch_id", Number(v), { shouldValidate: true });
                                setCodeTaken(null);
                            }}
                        >
                            <SelectTrigger id="et_branch">
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
                            <Label htmlFor="et_code">
                                Code <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    autoComplete="off"
                                    className="pr-8 font-mono uppercase"
                                    id="et_code"
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
                            <Label htmlFor="et_name">
                                Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                autoComplete="off"
                                id="et_name"
                                placeholder="Full name"
                                {...form.register("name")}
                            />
                            <FieldError message={errors.name?.message} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Phone */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="et_phone">Phone</Label>
                            <Input
                                autoComplete="off"
                                id="et_phone"
                                placeholder="Phone number"
                                {...form.register("phone")}
                            />
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="et_email">Email</Label>
                            <Input
                                autoComplete="off"
                                id="et_email"
                                placeholder="tech@example.com"
                                type="email"
                                {...form.register("email")}
                            />
                            <FieldError message={errors.email?.message} />
                        </div>
                    </div>

                    {/* Specialization */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="et_spec">Specialization</Label>
                        <Input
                            autoComplete="off"
                            id="et_spec"
                            placeholder="e.g. Mobile repair, AC service"
                            {...form.register("specialization")}
                        />
                    </div>

                    {/* Leaving Date */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="et_leaving">Leaving Date</Label>
                        <Input
                            id="et_leaving"
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
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
