import { useCallback } from "react";
import { toast } from "sonner";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils, type GenericBatchQueryDataType } from "@/lib/graphql-utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import {
    selectAvailableBus,
    selectAvailableBranches,
    selectAvailableDivisions,
    selectCurrentBranch,
    selectCurrentBu,
    selectCurrentDivision,
    selectDefaultDivisionId,
    setAvailableBranches,
    setAvailableBus,
    setAvailableDivisions,
    setCurrentBranch,
    setCurrentBu,
    setCurrentDivision,
    setDefaultDivisionId,
    setIsResolvingContext,
    setNoOfJobInvoicesPerPrint,
    setNoOfJobReceiptsPerPrint,
    setNoOfJobSheetsPerPrint,
} from "@/store/context-slice";
import type { BranchContextType, BuContextType } from "@/store/context-slice";
import type { DivisionContextType } from "@/features/client/types/division";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericDivisionDataType = { genericQuery: DivisionContextType[] | null };
type AppSettingRow          = { setting_key: string; setting_value: unknown };

// ─── Settings parser (pure, no side-effects) ──────────────────────────────────

function parseAppSettings(settings: AppSettingRow[]) {
    function coerce(raw: unknown): unknown {
        if (typeof raw !== 'string') return raw;
        try { return JSON.parse(raw); } catch { return raw; }
    }

    const rawDefaultId  = settings.find(s => s.setting_key === 'default_division_id')?.setting_value;
    const rawSheets     = settings.find(s => s.setting_key === 'no_of_job_sheets_per_print')?.setting_value;
    const rawInvoices   = settings.find(s => s.setting_key === 'no_of_job_invoices_per_print')?.setting_value;
    const rawReceipts   = settings.find(s => s.setting_key === 'no_of_job_receipts_per_print')?.setting_value;

    return {
        defaultDivisionId: rawDefaultId !== undefined ? Number(coerce(rawDefaultId) ?? 1) : 1,
        jobSheets:         Math.max(1, Number(coerce(rawSheets)   ?? 1)),
        jobInvoices:       Math.max(1, Number(coerce(rawInvoices) ?? 1)),
        jobReceipts:       Math.max(1, Number(coerce(rawReceipts) ?? 1)),
    };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Shared BU/Branch/Division fetch + mutation logic used by both the compact nav
// switcher (bu-branch-switcher.tsx) and the blocking selection gate
// (bu-branch-division-gate.tsx), so there is exactly one source of truth for the
// GraphQL calls and no duplicate-fetch races between the two UIs.

export function useBuBranchDivisionActions() {
    const dispatch           = useAppDispatch();
    const dbName             = useAppSelector(selectDbName);
    const user               = useAppSelector(selectCurrentUser);
    const availableBus       = useAppSelector(selectAvailableBus);
    const availableBranches  = useAppSelector(selectAvailableBranches);
    const availableDivisions = useAppSelector(selectAvailableDivisions);
    const currentBu          = useAppSelector(selectCurrentBu);
    const currentBranch      = useAppSelector(selectCurrentBranch);
    const currentDivision    = useAppSelector(selectCurrentDivision);
    const defaultDivisionId  = useAppSelector(selectDefaultDivisionId);

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
                        xData: { id: Number(user.id), last_used_bu_id: buId, last_used_branch_id: branchId },
                    }),
                },
            });
        } catch {
            // Persist failure is non-critical — silently ignore
        }
    }, [dbName, user?.id]);

    // ── Fetch full context for a BU: branches + settings (parallel), then divisions ──
    // branches and settings both only need the BU schema, so they are fetched in
    // parallel. Divisions require the resolved branch id, so they follow sequentially.

    const fetchBuContext = useCallback(async (buCode: string, preferredBranchId?: number | null) => {
        if (!dbName) return null;
        const schema = buCode.toLowerCase();

        const batchResult = await apolloClient.query<GenericBatchQueryDataType>({
            fetchPolicy: 'cache-first',
            query: GRAPHQL_MAP.genericBatchQuery,
            variables: {
                db_name: dbName,
                items: [
                    graphQlUtils.buildGenericBatchItem({ sqlId: SQL_MAP.GET_BU_BRANCHES, schema }),
                    graphQlUtils.buildGenericBatchItem({ sqlId: SQL_MAP.GET_APP_SETTINGS, schema }),
                ],
            },
        });

        const [branches, settings] = (batchResult.data?.genericBatchQuery ?? [[], []]) as [BranchContextType[], AppSettingRow[]];

        const resolvedBranch = branches.find(b => b.id === preferredBranchId)
            ?? branches.find(b => b.is_head_office)
            ?? branches[0]
            ?? null;

        let divisions: DivisionContextType[] = [];
        if (resolvedBranch) {
            const divResult = await apolloClient.query<GenericDivisionDataType>({
                fetchPolicy: 'cache-first',
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_ACTIVE_DIVISIONS_BY_BRANCH,
                        sqlArgs: { branch_id: resolvedBranch.id },
                    }),
                },
            });
            divisions = divResult.data?.genericQuery ?? [];
        }

        return { branches, resolvedBranch, divisions, settings };
    }, [dbName]);

    // ── Dispatch parsed settings + auto-select division ───────────────────────

    const applyContext = useCallback((
        ctx: Awaited<ReturnType<typeof fetchBuContext>>,
        overrideDefaultDivisionId?: number,
    ) => {
        if (!ctx) return;
        const parsed = parseAppSettings(ctx.settings);
        const effectiveDefaultId = overrideDefaultDivisionId ?? parsed.defaultDivisionId;

        dispatch(setAvailableBranches(ctx.branches));
        dispatch(setCurrentBranch(ctx.resolvedBranch));
        dispatch(setAvailableDivisions(ctx.divisions));
        dispatch(setDefaultDivisionId(parsed.defaultDivisionId));
        dispatch(setNoOfJobSheetsPerPrint(parsed.jobSheets));
        dispatch(setNoOfJobInvoicesPerPrint(parsed.jobInvoices));
        dispatch(setNoOfJobReceiptsPerPrint(parsed.jobReceipts));

        if (ctx.divisions.length === 0) {
            dispatch(setCurrentDivision(null));
        } else if (ctx.divisions.length === 1) {
            dispatch(setCurrentDivision(ctx.divisions[0]));
        } else {
            dispatch(setCurrentDivision(ctx.divisions.find(d => d.id === effectiveDefaultId) ?? null));
        }
    }, [dispatch]);

    // ── One-time auto-init: BU → branches+settings in parallel → divisions ────
    // Callers are responsible for guarding against re-invocation (see
    // bu-branch-switcher.tsx's mount effect) — this hook does not track whether
    // it has already run, so it must only ever be invoked from one place.

    const initContext = useCallback(async () => {
        if (!user) return;

        let buses: BuContextType[];

        if (user.userType === 'A') {
            if (!dbName) return;
            const result = await apolloClient.query<{ genericQuery: BuContextType[] | null }>({
                fetchPolicy: 'network-only',
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: 'security',
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BUS_WITH_SCHEMA_STATUS }),
                },
            });
            buses = result.data?.genericQuery ?? [];
        } else {
            if (!user.availableBus?.length) return;
            buses = user.availableBus;
        }

        if (!buses.length) return;
        dispatch(setAvailableBus(buses));

        const resolvedBu = buses.find(b => b.id === user.lastUsedBuId && b.schema_exists !== false)
            ?? buses.find(b => b.schema_exists !== false)
            ?? buses[0]
            ?? null;

        if (!resolvedBu) { dispatch(setCurrentBu(null)); return; }

        const ctx = await fetchBuContext(resolvedBu.code, user.lastUsedBranchId);
        if (!ctx) return;

        dispatch(setCurrentBu(resolvedBu));
        applyContext(ctx);
    }, [user, dbName, dispatch, fetchBuContext, applyContext]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleBuChange = useCallback(async (buIdStr: string) => {
        const bu = availableBus.find(b => String(b.id) === buIdStr);
        if (!bu || bu.id === currentBu?.id) return;

        dispatch(setIsResolvingContext(true));
        dispatch(setCurrentBu(bu));
        dispatch(setAvailableBranches([]));
        dispatch(setCurrentBranch(null));
        dispatch(setAvailableDivisions([]));
        dispatch(setCurrentDivision(null));

        try {
            const ctx = await fetchBuContext(bu.code, null);
            if (!ctx) return;
            applyContext(ctx);
            await persist(bu.id, ctx.resolvedBranch?.id ?? null);
        } catch {
            toast.error(MESSAGES.ERROR_BU_SWITCH_FAILED);
        } finally {
            dispatch(setIsResolvingContext(false));
        }
    }, [availableBus, currentBu, dispatch, fetchBuContext, applyContext, persist]);

    const handleBranchChange = useCallback(async (branchIdStr: string) => {
        const branch = availableBranches.find(b => String(b.id) === branchIdStr);
        if (!branch || branch.id === currentBranch?.id) return;

        dispatch(setIsResolvingContext(true));
        dispatch(setCurrentBranch(branch));
        await persist(currentBu!.id, branch.id);

        if (!dbName || !currentBu) { dispatch(setIsResolvingContext(false)); return; }
        try {
            const divResult = await apolloClient.query<GenericDivisionDataType>({
                fetchPolicy: 'cache-first',
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: currentBu.code.toLowerCase(),
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_ACTIVE_DIVISIONS_BY_BRANCH,
                        sqlArgs: { branch_id: branch.id },
                    }),
                },
            });
            const divisions = divResult.data?.genericQuery ?? [];
            dispatch(setAvailableDivisions(divisions));
            if (divisions.length === 0) {
                dispatch(setCurrentDivision(null));
            } else if (divisions.length === 1) {
                dispatch(setCurrentDivision(divisions[0]));
            } else {
                dispatch(setCurrentDivision(divisions.find(d => d.id === defaultDivisionId) ?? null));
            }
        } catch {
            dispatch(setAvailableDivisions([]));
            dispatch(setCurrentDivision(null));
        } finally {
            dispatch(setIsResolvingContext(false));
        }
    }, [availableBranches, currentBranch, currentBu, dbName, defaultDivisionId, dispatch, persist]);

    const handleDivisionChange = useCallback((divisionIdStr: string) => {
        const divisionId = Number(divisionIdStr);
        if (divisionId === 0) {
            dispatch(setCurrentDivision(null));
        } else {
            const division = availableDivisions.find(d => d.id === divisionId) ?? null;
            dispatch(setCurrentDivision(division));
        }
    }, [availableDivisions, dispatch]);

    return {
        user,
        availableBus,
        availableBranches,
        availableDivisions,
        currentBu,
        currentBranch,
        currentDivision,
        initContext,
        handleBuChange,
        handleBranchChange,
        handleDivisionChange,
    };
}
