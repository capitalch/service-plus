import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { BranchContextType } from "@/store/context-slice";

interface BranchSelectProps {
    branches:       BranchContextType[];
    value:          string;
    onValueChange:  (value: string) => void;
    disabled?:      boolean;
    showAllOption?: boolean;   // add "All Branches" with value "0"
}

export function BranchSelect({
    branches,
    value,
    onValueChange,
    disabled = false,
    showAllOption = false,
}: BranchSelectProps) {
    return (
        <div className="flex items-center gap-1.5">
            <span className="hidden lg:inline text-[10px] font-black uppercase text-(--cl-text-muted) opacity-70 tracking-tight">
                Branch
            </span>
            <Select disabled={disabled} value={value} onValueChange={onValueChange}>
                <SelectTrigger className="h-9 w-[150px] bg-(--cl-surface-2) text-xs font-bold border-2 border-(--cl-border) focus:border-(--cl-accent) transition-all">
                    <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent className="z-50">
                    {showAllOption && (
                        <SelectItem value="0" className="text-xs font-bold">
                            All Branches
                        </SelectItem>
                    )}
                    {branches.map(b => (
                        <SelectItem key={b.id} value={String(b.id)} className="text-xs font-semibold">
                            {b.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
