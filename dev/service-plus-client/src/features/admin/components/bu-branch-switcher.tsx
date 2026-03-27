import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { BuildingIcon, GitBranchIcon } from "lucide-react";

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
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import {
    selectAvailableBus,
    selectAvailableBranches,
    selectCurrentBranch,
    selectCurrentBu,
    setAvailableBranches,
    setAvailableBus,
    setCurrentBranch,
    setCurrentBu,
} from "@/store/context-slice";
import type { BranchContextType, BuContextType } from "@/store/context-slice";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericBranchDataType = { genericQuery: BranchContextType[] | null };

// ─── Component ────────────────────────────────────────────────────────────────

export const BuBranchSwitcher = () => {
    const dispatch        = useAppDispatch();
    const dbName          = useAppSelector(selectDbName);
    const user            = useAppSelector(selectCurrentUser);
    const availableBus    = useAppSelector(selectAvailableBus);
    const availableBranches = useAppSelector(selectAvailableBranches);
    const currentBu       = useAppSelector(selectCurrentBu);
    const currentBranch   = useAppSelector(selectCurrentBranch);

    // ── Fetch branches for a given BU ─────────────────────────────────────────

    const fetchBranches = useCallback(async (buCode: string) => {
        if (!dbName) return;
        try {
            const result = await apolloClient.query<GenericBranchDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: buCode.toLowerCase(),
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_BU_BRANCHES }),
                },
            });
            return result.data?.genericQuery ?? [];
        } catch {
            toast.error(MESSAGES.ERROR_BRANCHES_LOAD_FAILED);
            return [];
        }
    }, [dbName]);

    // ── Persist last-used BU and branch to DB ──────────────────────────────────

    const persist = useCallback(async (buId: number, branchId: number | null) => {
        if (!dbName || !user?.id) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "user",
                        xData: {
                            id: Number(user.id),
                            last_used_bu_id: buId,
                            last_used_branch_id: branchId,
                        },
                    }),
                },
            });
        } catch {
            // Persist failure is non-critical — silently ignore
        }
    }, [dbName, user?.id]);

    // ── On mount: re-seed context from user (needed after page refresh) ─────────

    useEffect(() => {
        if (availableBus.length > 0) return;

        if (user?.userType === 'A') {
            // Admin users have access to all BUs — fetch from DB
            if (!dbName) return;
            apolloClient.query<{ genericQuery: BuContextType[] | null }>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BUS_WITH_SCHEMA_STATUS }),
                },
            }).then(result => {
                const buses = result.data?.genericQuery ?? [];
                dispatch(setAvailableBus(buses));
                const resolved = buses.find(b => b.id === user.lastUsedBuId && b.schema_exists)
                    ?? buses.find(b => b.schema_exists)
                    ?? buses[0]
                    ?? null;
                dispatch(setCurrentBu(resolved));
            }).catch(() => {
                toast.error(MESSAGES.ERROR_BU_LOAD_FAILED);
            });
            return;
        }

        if (!user?.availableBus?.length) return;
        const buses = user.availableBus;
        dispatch(setAvailableBus(buses));
        const resolved = buses.find(b => b.id === user.lastUsedBuId) ?? buses[0] ?? null;
        dispatch(setCurrentBu(resolved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── On currentBu change: fetch branches ───────────────────────────────────

    useEffect(() => {
        if (!currentBu) return;
        fetchBranches(currentBu.code).then(branches => {
            if (!branches) return;
            dispatch(setAvailableBranches(branches));
            const lastId = user?.lastUsedBranchId;
            const resolved = branches.find(b => b.id === lastId)
                ?? branches.find(b => b.is_head_office)
                ?? branches[0]
                ?? null;
            dispatch(setCurrentBranch(resolved));
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentBu?.id]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    async function handleBuChange(buIdStr: string) {
        const bu = availableBus.find(b => String(b.id) === buIdStr);
        if (!bu || bu.id === currentBu?.id) return;
        dispatch(setCurrentBu(bu));
        dispatch(setAvailableBranches([]));
        dispatch(setCurrentBranch(null));
        try {
            const branches = await fetchBranches(bu.code);
            if (!branches) return;
            dispatch(setAvailableBranches(branches));
            const resolved = branches.find(b => b.is_head_office) ?? branches[0] ?? null;
            dispatch(setCurrentBranch(resolved));
            await persist(bu.id, resolved?.id ?? null);
        } catch {
            toast.error(MESSAGES.ERROR_BU_SWITCH_FAILED);
        }
    }

    async function handleBranchChange(branchIdStr: string) {
        const branch = availableBranches.find(b => String(b.id) === branchIdStr);
        if (!branch || branch.id === currentBranch?.id) return;
        dispatch(setCurrentBranch(branch));
        await persist(currentBu!.id, branch.id);
    }

    // ── Nothing to show for super-admin ──────────────────────────────────────

    if (!availableBus.length) return null;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex items-center gap-2">
            {/* BU selector */}
            {availableBus.length === 1 ? (
                <span className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                    <BuildingIcon className="h-3 w-3 shrink-0 text-teal-600" />
                    {currentBu?.name ?? availableBus[0].name}
                </span>
            ) : (
                <Select
                    value={currentBu ? String(currentBu.id) : undefined}
                    onValueChange={handleBuChange}
                >
                    <SelectTrigger className="h-7 gap-1.5 border-slate-200 bg-slate-50 pl-2 pr-2 text-xs text-slate-600 hover:bg-slate-100 focus:ring-0">
                        <BuildingIcon className="h-3 w-3 shrink-0 text-teal-600" />
                        <SelectValue placeholder="Business Unit" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableBus.map(bu => (
                            <SelectItem key={bu.id} value={String(bu.id)} className="text-xs">
                                {bu.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            {/* Branch selector */}
            {availableBranches.length === 1 ? (
                <span className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                    <GitBranchIcon className="h-3 w-3 shrink-0 text-teal-600" />
                    {currentBranch?.name ?? availableBranches[0].name}
                </span>
            ) : availableBranches.length > 1 ? (
                <Select
                    value={currentBranch ? String(currentBranch.id) : undefined}
                    onValueChange={handleBranchChange}
                >
                    <SelectTrigger className="h-7 gap-1.5 border-slate-200 bg-slate-50 pl-2 pr-2 text-xs text-slate-600 hover:bg-slate-100 focus:ring-0">
                        <GitBranchIcon className="h-3 w-3 shrink-0 text-teal-600" />
                        <SelectValue placeholder="Branch" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableBranches.map(branch => (
                            <SelectItem key={branch.id} value={String(branch.id)} className="text-xs">
                                {branch.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : null}
        </div>
    );
};
