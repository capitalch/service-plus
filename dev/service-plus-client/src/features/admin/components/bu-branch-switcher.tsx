import { useEffect } from "react";
import { toast } from "sonner";
import { BuildingIcon, GitBranchIcon, LayoutGridIcon } from "lucide-react";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MESSAGES } from "@/constants/messages";
import { useAppDispatch } from "@/store/hooks";
import { setIsResolvingContext } from "@/store/context-slice";
import { useBuBranchDivisionActions } from "@/features/admin/hooks/use-bu-branch-division-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuBranchSwitcherPropsType = { variant?: 'admin' | 'client' };

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

// ─── Component ────────────────────────────────────────────────────────────────

export const BuBranchSwitcher = ({ variant = 'admin' }: BuBranchSwitcherPropsType) => {
    const s = STYLES[variant];
    const dispatch = useAppDispatch();
    const {
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
    } = useBuBranchDivisionActions();

    // ── On mount: seed full context (BU → branches+settings in parallel → divisions) ─
    // Guarded so it only ever runs once per session — this is the single owner of
    // auto-init; the blocking selection gate reuses the same hook's state/handlers
    // but never calls initContext itself, avoiding a duplicate-fetch race.

    useEffect(() => {
        if (availableBus.length > 0) return;

        dispatch(setIsResolvingContext(true));
        initContext()
            .catch(() => toast.error(MESSAGES.ERROR_BU_LOAD_FAILED))
            .finally(() => dispatch(setIsResolvingContext(false)));
    }, [availableBus.length, initContext, dispatch]);

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
