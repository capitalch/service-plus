import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { AdditionalChargeMasterRow } from "./final-a-job-schema";

export function ChargeNameCombobox({ value, options, disabled, onChange, onSelect }: {
    value:     string;
    options:   AdditionalChargeMasterRow[];
    disabled?: boolean;
    onChange:  (name: string) => void;
    onSelect:  (name: string, hsnCode: string) => void;
}) {
    const [open, setOpen]       = useState(false);
    const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
    const inputRef              = useRef<HTMLInputElement>(null);
    const dropdownRef           = useRef<HTMLDivElement>(null);

    const filtered = options.filter(o => !value || o.name.toLowerCase().includes(value.toLowerCase()));

    function openDropdown() {
        if (!inputRef.current) return;
        const rect = inputRef.current.getBoundingClientRect();
        setDropPos({ top: rect.bottom + window.scrollY + 2, left: rect.left + window.scrollX, width: rect.width });
        setOpen(true);
    }

    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            const t = e.target as Node;
            if (!inputRef.current?.contains(t) && !dropdownRef.current?.contains(t)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    return (
        <>
            <div className="relative inline-flex items-center">
                <Input
                    className="h-7 w-52 border-(--cl-border) bg-white text-xs pr-6"
                    disabled={disabled}
                    placeholder="Charge name"
                    ref={inputRef}
                    value={value}
                    onChange={e => { onChange(e.target.value); openDropdown(); }}
                    onFocus={openDropdown}
                    onClick={openDropdown}
                />
                {value && !disabled && (
                    <X
                        className="absolute right-1.5 h-3.5 w-3.5 cursor-pointer text-gray-400 hover:text-red-500"
                        onMouseDown={e => { e.preventDefault(); onChange(""); setOpen(false); }}
                    />
                )}
            </div>
            {open && filtered.length > 0 && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-9999 max-h-48 overflow-y-auto rounded-lg border border-(--cl-border) bg-white shadow-xl"
                    style={{ top: dropPos.top, left: dropPos.left, minWidth: Math.max(dropPos.width, 220) }}
                    onMouseDown={e => e.preventDefault()}
                >
                    {filtered.map(o => (
                        <button
                            key={o.id}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-blue-50 hover:text-blue-700"
                            type="button"
                            onClick={() => { onSelect(o.name, o.hsn_code ?? ""); setOpen(false); }}
                        >
                            <span className="font-medium">{o.name}</span>
                            {o.hsn_code && <span className="ml-auto font-mono text-[10px] text-(--cl-text-muted)">{o.hsn_code}</span>}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}
