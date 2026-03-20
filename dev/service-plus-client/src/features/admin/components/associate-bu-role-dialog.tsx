import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

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
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectBusinessUnits, selectRoles, setBusinessUnits, setRoles } from "@/features/admin/store/admin-slice";
import type { BusinessUnitType, BusinessUserType, RoleType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type AssociateBuRoleDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
    user: BusinessUserType | null;
};

type GenericQueryDataType = {
    genericQuery: BusinessUnitType[] | RoleType[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const AssociateBuRoleDialog = ({
    onOpenChange,
    onSuccess,
    open,
    user,
}: AssociateBuRoleDialogPropsType) => {
    const dispatch       = useAppDispatch();
    const dbName         = useAppSelector(selectDbName);
    const businessUnits  = useAppSelector(selectBusinessUnits);
    const roles          = useAppSelector(selectRoles);

    const [loadingData, setLoadingData]     = useState(false);
    const [selectedBuIds, setSelectedBuIds] = useState<number[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string>("");
    const [submitting, setSubmitting]        = useState(false);

    // Load BUs and roles on open
    useEffect(() => {
        if (!open || !dbName) return;

        const needsBus   = businessUnits.length === 0;
        const needsRoles = roles.length === 0;

        if (!needsBus && !needsRoles) {
            // Pre-fill selections from user
            if (user) {
                setSelectedBuIds(user.bu_ids ?? []);
                setSelectedRoleId(user.role_id ? String(user.role_id) : "");
            }
            return;
        }

        setLoadingData(true);
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
                            value: graphQlUtils.buildGenericQueryValue({
                                sqlId: SQL_MAP.GET_ALL_BUS,
                            }),
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
                            value: graphQlUtils.buildGenericQueryValue({
                                sqlId: SQL_MAP.GET_ALL_ROLES,
                            }),
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

        Promise.all(promises).finally(() => {
            setLoadingData(false);
            if (user) {
                setSelectedBuIds(user.bu_ids ?? []);
                setSelectedRoleId(user.role_id ? String(user.role_id) : "");
            }
        });
    }, [open, dbName]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset selections when dialog closes
    useEffect(() => {
        if (!open) {
            setSelectedBuIds([]);
            setSelectedRoleId("");
        }
    }, [open]);

    if (!user) return null;

    function handleBuToggle(buId: number) {
        setSelectedBuIds((prev) =>
            prev.includes(buId) ? prev.filter((id) => id !== buId) : [...prev, buId],
        );
    }

    async function handleSubmit() {
        if (!user || !dbName) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.setUserBuRole,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: encodeObj({
                        bu_ids: selectedBuIds,
                        role_id: selectedRoleId ? Number(selectedRoleId) : null,
                        user_id: user.id,
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_BU_ROLE_ASSOCIATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_UNKNOWN);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled =
        submitting ||
        loadingData ||
        (selectedBuIds.length > 0 && !selectedRoleId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Associate BU &amp; Role</DialogTitle>
                    <DialogDescription>
                        Assign business units and role for{" "}
                        <span className="font-semibold text-slate-800">{user.full_name}</span>.
                    </DialogDescription>
                </DialogHeader>

                {loadingData ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2Icon className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        {/* Business Units */}
                        <div className="flex flex-col gap-2">
                            <Label className="text-sm font-medium text-slate-700">
                                Business Units
                            </Label>
                            {businessUnits.length === 0 ? (
                                <p className="text-xs text-slate-400">No business units available.</p>
                            ) : (
                                <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                                    {businessUnits.map((bu) => (
                                        <div className="flex items-center gap-2" key={bu.id}>
                                            <Checkbox
                                                checked={selectedBuIds.includes(bu.id)}
                                                disabled={submitting || !bu.is_active}
                                                id={`bu-${bu.id}`}
                                                onCheckedChange={() => handleBuToggle(bu.id)}
                                            />
                                            <label
                                                className={`cursor-pointer select-none text-sm ${!bu.is_active ? "text-slate-400 line-through" : "text-slate-700"}`}
                                                htmlFor={`bu-${bu.id}`}
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
                        </div>

                        {/* Role */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="role_select">
                                Role{selectedBuIds.length > 0 && <span className="text-red-500"> *</span>}
                            </Label>
                            <Select
                                disabled={submitting}
                                value={selectedRoleId}
                                onValueChange={setSelectedRoleId}
                            >
                                <SelectTrigger id="role_select">
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
                            {selectedBuIds.length > 0 && !selectedRoleId && (
                                <p className="text-xs text-red-500">Role is required when BUs are selected.</p>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter>
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
                        type="button"
                        onClick={handleSubmit}
                    >
                        {submitting ? (
                            <>
                                <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
