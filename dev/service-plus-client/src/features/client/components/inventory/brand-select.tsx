import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { BrandOption } from "@/features/client/types/model";

interface BrandSelectProps {
    brands:        BrandOption[];
    value:         string;
    onValueChange: (value: string) => void;
    disabled?:     boolean;
    highlightEmpty?: boolean;   // show red border when no brand is selected
}

export function BrandSelect({
    brands,
    value,
    onValueChange,
    disabled = false,
    highlightEmpty = false,
}: BrandSelectProps) {
    return (
        <div className="flex items-center gap-1.5">
            <span className="hidden lg:inline text-[10px] font-black uppercase text-[var(--cl-text-muted)] opacity-70 tracking-tight">
                Brand
            </span>
            <Select disabled={disabled} value={value} onValueChange={onValueChange}>
                <SelectTrigger
                    className={`h-9 w-[130px] bg-[var(--cl-surface-2)] text-xs font-bold border-2 transition-all ${
                        highlightEmpty && !value
                            ? "border-red-500"
                            : "border-[var(--cl-border)] focus:border-[var(--cl-accent)]"
                    }`}
                >
                    <SelectValue placeholder="Brand" />
                </SelectTrigger>
                <SelectContent className="z-50">
                    {brands.map(b => (
                        <SelectItem key={b.id} value={String(b.id)} className="text-xs font-semibold">
                            {b.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
