import { useRef, useState } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import type { AdditionalChargeMasterRow } from "./final-a-job-schema";

export function ChargeNameCombobox({ value, options, disabled, invalid, onChange, onSelect }: {
    value:     string;
    options:   AdditionalChargeMasterRow[];
    disabled?: boolean;
    invalid?:  boolean;
    onChange:  (name: string) => void;
    onSelect:  (name: string, hsnCode: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const anchorRef       = useRef<HTMLDivElement>(null);

    const filtered = options.filter(o => !value || o.name.toLowerCase().includes(value.toLowerCase()));

    return (
        <Popover open={open && filtered.length > 0} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div ref={anchorRef} className="relative inline-flex items-center">
                    <Input
                        className={`h-7 w-52 bg-white text-xs pr-6 ${invalid ? "border-red-400 focus:border-red-500" : "border-(--cl-border)"}`}
                        disabled={disabled}
                        placeholder="Charge name"
                        value={value}
                        onChange={e => { onChange(e.target.value); setOpen(true); }}
                        onFocus={() => setOpen(true)}
                        onClick={() => setOpen(true)}
                    />
                    {value && !disabled && (
                        <X
                            className="absolute right-1.5 h-3.5 w-3.5 cursor-pointer text-gray-400 hover:text-red-500"
                            onMouseDown={e => { e.preventDefault(); onChange(""); setOpen(false); }}
                        />
                    )}
                </div>
            </PopoverAnchor>
            <PopoverContent
                className="p-0 max-h-48 overflow-y-auto min-w-[220px]"
                onOpenAutoFocus={e => e.preventDefault()}
                onInteractOutside={e => {
                    // Don't close when interacting with the anchor (input / X button)
                    if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
                }}
            >
                {filtered.map(o => (
                    <button
                        key={o.id}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-blue-50 hover:text-blue-700"
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { onSelect(o.name, o.hsn_code ?? ""); setOpen(false); }}
                    >
                        <span className="font-medium">{o.name}</span>
                        {o.hsn_code && <span className="ml-auto font-mono text-[10px] text-(--cl-text-muted)">{o.hsn_code}</span>}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
}
