import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
    COMPLETION_ORDER, TRANSACTION_LABEL, VENDOR_ORDER,
    type TransactionGroup, type TransactionKind,
} from "./transaction-eligibility";

type Props = {
    eligibleKinds: Set<TransactionKind>;
    checkedKinds:  Set<TransactionKind>;
    onChange:      (next: Set<TransactionKind>) => void;
};

const GROUP_OF: Record<TransactionKind, TransactionGroup> = {
    COMPLETED_OK:         "completion",
    FINAL:                "completion",
    DELIVER:              "completion",
    SEND_TO_COMPANY:      "vendor-cycle",
    RECEIVE_FROM_COMPANY: "vendor-cycle",
};

function Group({ title, kinds, eligibleKinds, checkedKinds, activeGroup, onToggle }: {
    title:         string;
    kinds:         TransactionKind[];
    eligibleKinds: Set<TransactionKind>;
    checkedKinds:  Set<TransactionKind>;
    activeGroup:   TransactionGroup | null;
    onToggle:      (kind: TransactionKind) => void;
}) {
    const group = GROUP_OF[kinds[0]];
    const blockedByOtherGroup = activeGroup !== null && activeGroup !== group;

    return (
        <div className={`space-y-2 rounded-lg border border-(--cl-border) p-3 ${blockedByOtherGroup ? "opacity-50" : ""}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-(--cl-text-muted)">{title}</p>
            <div className="flex flex-wrap gap-2">
                {kinds.map(kind => {
                    const enabled = eligibleKinds.has(kind) && !blockedByOtherGroup;
                    const checked = checkedKinds.has(kind);
                    return (
                        <label
                            key={kind}
                            className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                                !enabled
                                    ? "cursor-not-allowed border-transparent text-(--cl-text-muted) opacity-50"
                                    : checked
                                        ? "cursor-pointer border-(--cl-accent) bg-(--cl-accent)/10 font-semibold text-(--cl-accent)"
                                        : "cursor-pointer border-(--cl-border) font-medium text-(--cl-text) hover:border-(--cl-accent)/50 hover:bg-(--cl-accent)/5"
                            }`}
                            title={
                                blockedByOtherGroup
                                    ? "Uncheck the active transaction group first"
                                    : !eligibleKinds.has(kind)
                                        ? "Not applicable to one or more selected jobs"
                                        : undefined
                            }
                        >
                            <Checkbox
                                checked={checked}
                                disabled={!enabled}
                                onCheckedChange={() => onToggle(kind)}
                            />
                            {TRANSACTION_LABEL[kind]}
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

// SEND_TO_COMPANY/RECEIVE_FROM_COMPANY and COMPLETED_OK/FINAL/DELIVER are
// mutually exclusive: as soon as any checkbox in one group is checked, every
// checkbox in the other group is fully disabled (not just silently cleared
// on next click) until the active group is unchecked back to empty — makes
// it visually obvious a run can't mix a vendor-cycle step with a completion
// step. A customer with jobs in both states needs two separate batch runs.
export function TransactionPicker({ eligibleKinds, checkedKinds, onChange }: Props) {
    const activeGroup: TransactionGroup | null = checkedKinds.size > 0
        ? GROUP_OF[[...checkedKinds][0]]
        : null;

    function toggle(kind: TransactionKind) {
        const next = new Set(checkedKinds);
        if (next.has(kind)) next.delete(kind); else next.add(kind);
        onChange(next);
    }

    return (
        <div className="space-y-2">
            <Label>Transactions to Apply</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Group title="Completion" kinds={COMPLETION_ORDER} eligibleKinds={eligibleKinds} checkedKinds={checkedKinds} activeGroup={activeGroup} onToggle={toggle} />
                <Group title="Vendor Cycle" kinds={VENDOR_ORDER} eligibleKinds={eligibleKinds} checkedKinds={checkedKinds} activeGroup={activeGroup} onToggle={toggle} />
            </div>
            <p className="text-xs text-(--cl-text-muted)">
                Select either a vendor-cycle transaction or a completion transaction, not both, in the same run.
            </p>
        </div>
    );
}
