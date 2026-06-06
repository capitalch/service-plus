import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { BuildingIcon, GitBranchIcon, LayoutGridIcon } from "lucide-react";

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
    setForceGstOnPartsForNonGst,
    setNoOfJobInvoicesPerPrint,
    setNoOfJobSheetsPerPrint,
} from "@/store/context-slice";
import type { BranchContextType, BuContextType } from "@/store/context-slice";
import type { DivisionContextType } from "@/features/client/types/division";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuBranchSwitcherPropsType = { variant?: 'admin' | 'client' };

type GenericDivisionDataType = { genericQuery: DivisionContextType[] | null };
type AppSettingRow          = { setting_key: string; setting_value: unknown };

// ─── Style maps ───────────────────────────────────────────────────────────────

const STYLES = {
    admin: {
        icon:      'text-teal-500',
        label:     'text-slate-600 dark:text-slate-300',
        labelSize: 'text-[10px]',
        static:    'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
        trigger:   'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
    },
    client: {
        icon:      'text-(--cl-accent-text)',
        label:     'text-(--cl-accent-text) font-semibold',
        labelSize: 'text-xs',
        static:    'border border-(--cl-border) bg-(--cl-surface-2) text-(--cl-text) font-medium',
        trigger:   'border-(--cl-border) bg-(--cl-surface-2) text-(--cl-text) font-medium hover:bg-(--cl-hover) focus:ring-1 focus:ring-(--cl-accent)',
    },
} as const;

// ─── Settings parser (pure, no side-effects) ──────────────────────────────────

function parseAppSettings(settings: AppSettingRow[]) {
    function coerce(raw: unknown): unknown {
        if (typeof raw !== 'string') return raw;
        try { return JSON.parse(raw); } catch { return raw; }
    }

    const rawDefaultId  = settings.find(s => s.setting_key === 'default_division_id')?.setting_value;
    const rawForce      = settings.find(s => s.setting_key === 'force_gst_on_parts_for_non_gst_invoices')?.setting_value;
    const rawSheets     = settings.find(s => s.setting_key === 'no_of_job_sheets_per_print')?.setting_value;
    const rawInvoices   = settings.find(s => s.setting_key === 'no_of_job_invoices_per_print')?.setting_value;

    const forceParsed   = coerce(rawForce);

    return {
        defaultDivisionId: rawDefaultId !== undefined ? Number(coerce(rawDefaultId) ?? 1) : 1,
        forceGst:          rawForce     !== undefined && (forceParsed === true || forceParsed === 'true'),
        jobSheets:         Math.max(1, Number(coerce(rawSheets)   ?? 1)),
        jobInvoices:       Math.max(1, Number(coerce(rawInvoices) ?? 1)),
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const BuBranchSwitcher = ({ variant = 'admin' }: BuBranchSwitcherPropsType) => {
    const s = STYLES[variant];
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
        dispatch(setForceGstOnPartsForNonGst(parsed.forceGst));
        dispatch(setNoOfJobSheetsPerPrint(parsed.jobSheets));
        dispatch(setNoOfJobInvoicesPerPrint(parsed.jobInvoices));

        if (ctx.divisions.length === 0) {
            dispatch(setCurrentDivision(null));
        } else if (ctx.divisions.length === 1) {
            dispatch(setCurrentDivision(ctx.divisions[0]));
        } else {
            dispatch(setCurrentDivision(ctx.divisions.find(d => d.id === effectiveDefaultId) ?? null));
        }
    }, [dispatch]);

    // ── On mount: seed full context (BU → branches+settings in parallel → divisions) ─
    // Everything is dispatched at the end of one async chain, so React batches it
    // into a single re-render. No chained useEffects — no inter-render stall.

    useEffect(() => {
        if (availableBus.length > 0) return;
        if (!user) return;

        async function init() {
            let buses: BuContextType[];

            if (user!.userType === 'A') {
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
                if (!user!.availableBus?.length) return;
                buses = user!.availableBus;
            }

            if (!buses.length) return;
            dispatch(setAvailableBus(buses));

            const resolvedBu = buses.find(b => b.id === user!.lastUsedBuId && b.schema_exists !== false)
                ?? buses.find(b => b.schema_exists !== false)
                ?? buses[0]
                ?? null;

            if (!resolvedBu) { dispatch(setCurrentBu(null)); return; }

            const ctx = await fetchBuContext(resolvedBu.code, user!.lastUsedBranchId);
            if (!ctx) return;

            dispatch(setCurrentBu(resolvedBu));
            applyContext(ctx);
        }

        init().catch(() => toast.error(MESSAGES.ERROR_BU_LOAD_FAILED));
    }, [user, dbName, availableBus.length, dispatch, fetchBuContext, applyContext]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    async function handleBuChange(buIdStr: string) {
        const bu = availableBus.find(b => String(b.id) === buIdStr);
        if (!bu || bu.id === currentBu?.id) return;

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
        }
    }

    async function handleBranchChange(branchIdStr: string) {
        const branch = availableBranches.find(b => String(b.id) === branchIdStr);
        if (!branch || branch.id === currentBranch?.id) return;
        dispatch(setCurrentBranch(branch));
        await persist(currentBu!.id, branch.id);

        if (!dbName || !currentBu) return;
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
        }
    }

    function handleDivisionChange(divisionIdStr: string) {
        const divisionId = Number(divisionIdStr);
        if (divisionId === 0) {
            dispatch(setCurrentDivision(null));
        } else {
            const division = availableDivisions.find(d => d.id === divisionId) ?? null;
            dispatch(setCurrentDivision(division));
        }
    }

    // ── Nothing to show for super-admin ──────────────────────────────────────

    if (!availableBus.length) return null;

    // ── Render ────────────────────────────────────────────────────────────────

    const isClient = variant === 'client';

    return (
        <div className={`flex items-center gap-2 ${isClient ? 'rounded-md bg-(--cl-surface-2) px-2.5 py-1' : ''}`}>
            {/* BU selector */}
            <div className={`flex items-center gap-1.5 ${isClient ? '' : 'flex-col gap-0.5 items-start'}`}>
                <span className={`flex shrink-0 items-center gap-1 font-medium ${s.labelSize} ${s.label}`}>
                    <BuildingIcon className={`h-3 w-3 shrink-0 ${s.icon}`} />
                    <span className={isClient ? 'hidden lg:inline' : 'inline'}>
                        {isClient ? 'BU' : 'Business Unit'}
                    </span>
                </span>
                {availableBus.length === 1 ? (
                    <span className={`flex h-7 items-center rounded-md border px-2.5 text-xs ${s.static}`}>
                        {currentBu?.name ?? availableBus[0].name}
                    </span>
                ) : (
                    <Select
                        value={currentBu ? String(currentBu.id) : undefined}
                        onValueChange={handleBuChange}
                    >
                        <SelectTrigger className={`h-7 gap-1 pl-2.5 pr-2 text-xs ${s.trigger}`}>
                            <SelectValue placeholder="Select BU" />
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
            </div>

            {/* Branch selector */}
            {availableBranches.length >= 1 && (
                <>
                    {isClient && <div className="h-4 w-px shrink-0 bg-(--cl-border)" />}
                    <div className={`flex items-center gap-1.5 ${isClient ? '' : 'flex-col gap-0.5 items-start'}`}>
                        <span className={`flex shrink-0 items-center gap-1 font-medium ${s.labelSize} ${s.label}`}>
                            <GitBranchIcon className={`h-3 w-3 shrink-0 ${s.icon}`} />
                            <span className={isClient ? 'hidden lg:inline' : 'inline'}>
                                Branch
                            </span>
                        </span>
                        {availableBranches.length === 1 ? (
                            <span className={`flex h-7 items-center rounded-md border px-2.5 text-xs ${s.static}`}>
                                {currentBranch?.name ?? availableBranches[0].name}
                            </span>
                        ) : (
                            <Select
                                value={currentBranch ? String(currentBranch.id) : undefined}
                                onValueChange={handleBranchChange}
                            >
                                <SelectTrigger className={`h-7 gap-1 pl-2.5 pr-2 text-xs ${s.trigger}`}>
                                    <SelectValue placeholder="Select Branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableBranches.map(branch => (
                                        <SelectItem key={branch.id} value={String(branch.id)} className="text-xs">
                                            {branch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </>
            )}

            {/* Division selector — only visible when multiple divisions exist */}
            {availableDivisions.length > 1 && (
                <>
                    {isClient && <div className="h-4 w-px shrink-0 bg-(--cl-border)" />}
                    <div className={`flex items-center gap-1.5 ${isClient ? '' : 'flex-col gap-0.5 items-start'}`}>
                        <span className={`flex shrink-0 items-center gap-1 font-medium ${s.labelSize} ${s.label}`}>
                            <LayoutGridIcon className={`h-3 w-3 shrink-0 ${s.icon}`} />
                            <span className={isClient ? 'hidden lg:inline' : 'inline'}>
                                Division
                            </span>
                        </span>
                        <Select
                            value={currentDivision ? String(currentDivision.id) : "0"}
                            onValueChange={handleDivisionChange}
                        >
                            <SelectTrigger className={`h-7 gap-1 pl-2.5 pr-2 text-xs ${s.trigger}`}>
                                <SelectValue placeholder="All Divisions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0" className="text-xs">All Divisions</SelectItem>
                                {availableDivisions.map(d => (
                                    <SelectItem key={d.id} value={String(d.id)} className="text-xs">
                                        {d.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </>
            )}
        </div>
    );
};
