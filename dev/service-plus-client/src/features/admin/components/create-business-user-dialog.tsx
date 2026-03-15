import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectBusinessUnits, selectRoles, setBusinessUnits, setRoles } from "@/features/admin/store/admin-slice";
import type { BusinessUnitType, RoleType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

type CreateBusinessUserDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
};

type CreateBusinessUserFormType = z.infer<typeof createBusinessUserSchema>;

type CreateBusinessUserMutationDataType = {
    createBusinessUser: { email_sent: boolean; id: number };
};

type GenericQueryDataType = {
    genericQuery: BusinessUnitType[] | RoleType[] | null;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const createBusinessUserSchema = z.object({
    email: z.string().email({ message: MESSAGES.ERROR_EMAIL_INVALID }),
    full_name: z.string().min(2, MESSAGES.ERROR_FULL_NAME_REQUIRED),
    mobile: z
        .string()
        .optional()
        .refine(
            (val) => !val || /^\+?[\d\s\-().]{7,15}$/.test(val),
            { message: MESSAGES.ERROR_MOBILE_INVALID },
        ),
    username: z
        .string()
        .min(1, MESSAGES.ERROR_ADMIN_USERNAME_REQUIRED)
        .min(5, MESSAGES.ERROR_USERNAME_MIN_LENGTH)
        .regex(/^[a-zA-Z0-9]+$/, MESSAGES.ERROR_USERNAME_INVALID_FORMAT),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return (
        <AnimatePresence>
            {message && (
                <motion.p
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-500"
                    exit={{ opacity: 0, y: -4 }}
                    initial={{ opacity: 0, y: -4 }}
                >
                    {message}
                </motion.p>
            )}
        </AnimatePresence>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CreateBusinessUserDialog = ({
    onOpenChange,
    onSuccess,
    open,
}: CreateBusinessUserDialogPropsType) => {
    const dispatch      = useAppDispatch();
    const dbName        = useAppSelector(selectDbName);
    const businessUnits = useAppSelector(selectBusinessUnits);
    const roles         = useAppSelector(selectRoles);

    const [buError, setBuError]                   = useState<string>("");
    const [checkingEmail, setCheckingEmail]       = useState(false);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [emailTaken, setEmailTaken]             = useState<boolean | null>(null);
    const [loadingDropdowns, setLoadingDropdowns] = useState(false);
    const [roleError, setRoleError]               = useState<string>("");
    const [selectedBuIds, setSelectedBuIds]       = useState<number[]>([]);
    const [selectedRoleId, setSelectedRoleId]     = useState<string>("");
    const [submitting, setSubmitting]             = useState(false);
    const [usernameTaken, setUsernameTaken]       = useState<boolean | null>(null);

    const form = useForm<CreateBusinessUserFormType>({
        defaultValues: { email: "", full_name: "", mobile: "", username: "" },
        mode: "onChange",
        resolver: zodResolver(createBusinessUserSchema),
    });

    const { formState: { errors } } = form;

    const emailValue        = useWatch({ control: form.control, name: "email" });
    const usernameValue     = useWatch({ control: form.control, name: "username" });
    const debouncedEmail    = useDebounce(emailValue, 1200);
    const debouncedUsername = useDebounce(usernameValue, 1200);

    // Load BUs and Roles on dialog open
    useEffect(() => {
        if (!open || !dbName) return;

        const needsBus   = businessUnits.length === 0;
        const needsRoles = roles.length === 0;
        if (!needsBus && !needsRoles) return;

        setLoadingDropdowns(true);
        const promises: Promise<void>[] = [];

        if (needsBus) {
            promises.push(
                apolloClient
                    .query<GenericQueryDataType>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema: "security",
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BUS }),
                        },
                    })
                    .then(({ data }) => {
                        if (data?.genericQuery) {
                            dispatch(setBusinessUnits(data.genericQuery as BusinessUnitType[]));
                        }
                    })
                    .catch(() => {}),
            );
        }

        if (needsRoles) {
            promises.push(
                apolloClient
                    .query<GenericQueryDataType>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema: "security",
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_ROLES }),
                        },
                    })
                    .then(({ data }) => {
                        if (data?.genericQuery) {
                            dispatch(setRoles(data.genericQuery as RoleType[]));
                        }
                    })
                    .catch(() => {}),
            );
        }

        Promise.all(promises).finally(() => setLoadingDropdowns(false));
    }, [open, dbName]); // eslint-disable-line react-hooks/exhaustive-deps

    // Immediately reset emailTaken when user starts typing a new email
    useEffect(() => {
        setEmailTaken(null);
    }, [emailValue]); // eslint-disable-line react-hooks/exhaustive-deps

    // Debounced email uniqueness check
    useEffect(() => {
        if (!debouncedEmail || !dbName) {
            setEmailTaken(null);
            return;
        }
        const { invalid } = form.getFieldState("email");
        if (invalid) {
            setEmailTaken(null);
            return;
        }
        setCheckingEmail(true);
        setEmailTaken(null);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { email: debouncedEmail },
                        sqlId: SQL_MAP.CHECK_BUSINESS_USER_EMAIL_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setEmailTaken(exists);
                if (exists) {
                    form.setError("email", {
                        message: MESSAGES.ERROR_BUSINESS_USER_EMAIL_EXISTS,
                        type: "manual",
                    });
                } else {
                    form.clearErrors("email");
                }
            })
            .catch(() => {
                setEmailTaken(null);
            })
            .finally(() => {
                setCheckingEmail(false);
            });
    }, [debouncedEmail]); // eslint-disable-line react-hooks/exhaustive-deps

    // Debounced username uniqueness check
    useEffect(() => {
        if (!debouncedUsername || !dbName) {
            setUsernameTaken(null);
            return;
        }
        const { invalid } = form.getFieldState("username");
        if (invalid) {
            setUsernameTaken(null);
            return;
        }
        setCheckingUsername(true);
        setUsernameTaken(null);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { username: debouncedUsername },
                        sqlId: SQL_MAP.CHECK_BUSINESS_USER_USERNAME_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setUsernameTaken(exists);
                if (exists) {
                    form.setError("username", {
                        message: MESSAGES.ERROR_BUSINESS_USER_USERNAME_EXISTS,
                        type: "manual",
                    });
                } else {
                    form.clearErrors("username");
                }
            })
            .catch(() => {
                setUsernameTaken(null);
            })
            .finally(() => {
                setCheckingUsername(false);
            });
    }, [debouncedUsername]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setBuError("");
            setCheckingEmail(false);
            setCheckingUsername(false);
            setEmailTaken(null);
            setLoadingDropdowns(false);
            setRoleError("");
            setSelectedBuIds([]);
            setSelectedRoleId("");
            setSubmitting(false);
            setUsernameTaken(null);
            form.reset({ email: "", full_name: "", mobile: "", username: "" });
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleBuToggle(buId: number) {
        setSelectedBuIds((prev) =>
            prev.includes(buId) ? prev.filter((id) => id !== buId) : [...prev, buId],
        );
        setBuError("");
    }

    async function onSubmit(data: CreateBusinessUserFormType) {
        if (!dbName) return;

        // Validate BU and Role
        if (selectedBuIds.length === 0) {
            setBuError(MESSAGES.ERROR_BUSINESS_USER_BU_REQUIRED);
            return;
        }
        if (!selectedRoleId) {
            setRoleError(MESSAGES.ERROR_BUSINESS_USER_ROLE_REQUIRED);
            return;
        }

        setSubmitting(true);
        try {
            // Step 1: Create business user
            const createResult = await apolloClient.mutate<CreateBusinessUserMutationDataType>({
                mutation: GRAPHQL_MAP.createBusinessUser,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: encodeObj({
                        email: data.email,
                        full_name: data.full_name,
                        mobile: data.mobile || null,
                        username: data.username,
                    }),
                },
            });

            if (createResult.error || !createResult.data?.createBusinessUser?.id) {
                toast.error(MESSAGES.ERROR_BUSINESS_USER_CREATE_FAILED);
                return;
            }

            const newUserId = createResult.data.createBusinessUser.id;

            // Step 2: Assign BU and Role
            try {
                const buRoleResult = await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.setUserBuRole,
                    variables: {
                        db_name: dbName,
                        schema: "security",
                        value: encodeObj({
                            bu_ids: selectedBuIds,
                            role_id: Number(selectedRoleId),
                            user_id: newUserId,
                        }),
                    },
                });

                if (buRoleResult.error) {
                    toast.warning(MESSAGES.WARN_BUSINESS_USER_BU_ROLE_ASSIGN_FAILED);
                } else {
                    toast.success(MESSAGES.SUCCESS_BUSINESS_USER_CREATED);
                }
            } catch {
                toast.warning(MESSAGES.WARN_BUSINESS_USER_BU_ROLE_ASSIGN_FAILED);
            }

            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_BUSINESS_USER_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled =
        loadingDropdowns ||
        submitting ||
        checkingEmail ||
        checkingUsername ||
        Object.keys(errors).length > 0 ||
        emailTaken !== false ||
        usernameTaken === true ||
        selectedBuIds.length === 0 ||
        !selectedRoleId;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-slate-800">
                        Add Business User
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Create a new business user account.
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="flex flex-col gap-4 pt-1"
                    onSubmit={form.handleSubmit(onSubmit)}
                >
                    {/* Full Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="full_name">
                            Full Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            autoComplete="off"
                            disabled={submitting}
                            id="full_name"
                            placeholder="e.g. John Smith"
                            {...form.register("full_name")}
                        />
                        <FieldError message={errors.full_name?.message} />
                    </div>

                    {/* Username */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="username">
                            Username <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                className="pr-8"
                                disabled={submitting}
                                id="username"
                                placeholder="e.g. johnsmith"
                                {...form.register("username")}
                            />
                            {checkingUsername && (
                                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                            )}
                            {!checkingUsername && usernameTaken === false && !errors.username && (
                                <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                            )}
                        </div>
                        <FieldError message={errors.username?.message} />
                    </div>

                    {/* Email */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="email">
                            Email <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                className="pr-8"
                                disabled={submitting}
                                id="email"
                                placeholder="user@example.com"
                                type="email"
                                {...form.register("email")}
                            />
                            {checkingEmail && (
                                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                            )}
                            {!checkingEmail && emailTaken === false && !errors.email && (
                                <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                            )}
                        </div>
                        <FieldError message={errors.email?.message} />
                    </div>

                    {/* Mobile */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="mobile">Mobile</Label>
                        <Input
                            autoComplete="off"
                            disabled={submitting}
                            id="mobile"
                            placeholder="+91 98765 43210"
                            type="tel"
                            {...form.register("mobile")}
                        />
                        <FieldError message={errors.mobile?.message} />
                    </div>

                    {/* Business Units */}
                    <div className="flex flex-col gap-2">
                        <Label>
                            Business Unit <span className="text-red-500">*</span>
                        </Label>
                        {loadingDropdowns ? (
                            <div className="flex items-center gap-2 py-2">
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                <span className="text-xs text-slate-400">Loading…</span>
                            </div>
                        ) : businessUnits.length === 0 ? (
                            <p className="text-xs text-slate-400">No business units available.</p>
                        ) : (
                            <div className="flex max-h-36 flex-col gap-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                                {businessUnits.map((bu) => (
                                    <div className="flex items-center gap-2" key={bu.id}>
                                        <Checkbox
                                            checked={selectedBuIds.includes(bu.id)}
                                            disabled={submitting || !bu.is_active}
                                            id={`create-bu-${bu.id}`}
                                            onCheckedChange={() => handleBuToggle(bu.id)}
                                        />
                                        <label
                                            className={`cursor-pointer select-none text-sm ${!bu.is_active ? "text-slate-400 line-through" : "text-slate-700"}`}
                                            htmlFor={`create-bu-${bu.id}`}
                                        >
                                            {bu.name}
                                            <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-500">
                                                {bu.code}
                                            </span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        )}
                        <FieldError message={buError} />
                    </div>

                    {/* Role */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="create_role_select">
                            Role <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            disabled={submitting || loadingDropdowns}
                            value={selectedRoleId}
                            onValueChange={(val) => { setSelectedRoleId(val); setRoleError(""); }}
                        >
                            <SelectTrigger id="create_role_select">
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map((role) => (
                                    <SelectItem key={role.id} value={String(role.id)}>
                                        {role.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FieldError message={roleError} />
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
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={submitDisabled}
                            type="submit"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                "Add User"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
