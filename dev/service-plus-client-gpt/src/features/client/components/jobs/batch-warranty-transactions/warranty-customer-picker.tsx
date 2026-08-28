import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { WarrantyCustomerOption } from "@/features/client/types/job";

type Props = {
    customers: WarrantyCustomerOption[];
    value:     number | null;
    onChange:  (id: number | null) => void;
};

export function WarrantyCustomerPicker({ customers, value, onChange }: Props) {
    return (
        <SearchableCombobox<WarrantyCustomerOption>
            label="Customer"
            placeholder={customers.length === 0 ? "No customers with open warranty jobs" : "Search customer by name or mobile…"}
            items={customers}
            selectedValue={value != null ? String(value) : ""}
            getDisplayValue={c => `${c.full_name ?? "No name"} — ${c.mobile} (${c.job_count} job${c.job_count !== 1 ? "s" : ""})`}
            getFilterKey={c => `${c.full_name ?? ""} ${c.mobile}`}
            getIdentifier={c => String(c.id)}
            onSelect={c => onChange(c ? c.id : null)}
            renderItem={c => (
                <div className="grid w-full grid-cols-[1fr_88px_60px] items-center gap-3">
                    <span className="truncate font-medium">{c.full_name ?? "No name"}</span>
                    <span className="text-right font-mono text-xs text-(--cl-text-muted)">{c.mobile}</span>
                    <span className="justify-self-end whitespace-nowrap rounded-full bg-(--cl-accent)/10 px-1.5 py-0.5 text-[10px] font-semibold text-(--cl-accent)">
                        {c.job_count} job{c.job_count !== 1 ? "s" : ""}
                    </span>
                </div>
            )}
        />
    );
}
