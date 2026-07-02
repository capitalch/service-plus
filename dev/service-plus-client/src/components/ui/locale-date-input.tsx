import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocaleDateInputProps {
    value:      string;
    onChange:   (iso: string) => void;
    disabled?:  boolean;
    className?: string;
}

function pad2(v: string) { return v.padStart(2, "0"); }

export function LocaleDateInput({ value, onChange, disabled, className }: LocaleDateInputProps) {
    const [dd, setDd]     = useState("");
    const [mm, setMm]     = useState("");
    const [yyyy, setYyyy] = useState("");

    const ddRef   = useRef<HTMLInputElement>(null);
    const mmRef   = useRef<HTMLInputElement>(null);
    const yyyyRef = useRef<HTMLInputElement>(null);
    const pickerRef = useRef<HTMLInputElement>(null);

    // Sync from ISO value prop
    useEffect(() => {
        if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [y, m, d] = value.split("-");
            setDd(d);
            setMm(m);
            setYyyy(y);
        } else {
            setDd(""); setMm(""); setYyyy("");
        }
    }, [value]);

    const emit = (d: string, m: string, y: string) => {
        if (d.length === 2 && m.length === 2 && y.length === 4) {
            const di = Number(d), mi = Number(m), yi = Number(y);
            if (di >= 1 && di <= 31 && mi >= 1 && mi <= 12 && yi >= 1900) {
                onChange(`${y}-${pad2(m)}-${pad2(d)}`);
            }
        }
    };

    const handleDd = (v: string) => {
        const clean = v.replace(/\D/g, "").slice(0, 2);
        setDd(clean);
        if (clean.length === 2) { mmRef.current?.focus(); mmRef.current?.select(); }
        emit(clean, mm, yyyy);
    };

    const handleMm = (v: string) => {
        const clean = v.replace(/\D/g, "").slice(0, 2);
        setMm(clean);
        if (clean.length === 2) { yyyyRef.current?.focus(); yyyyRef.current?.select(); }
        emit(dd, clean, yyyy);
    };

    const handleYyyy = (v: string) => {
        const clean = v.replace(/\D/g, "").slice(0, 4);
        setYyyy(clean);
        emit(dd, mm, clean);
    };

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        seg: "dd" | "mm" | "yyyy",
        val: string,
    ) => {
        if (e.key === "Backspace" && val === "") {
            e.preventDefault();
            if (seg === "mm")   { ddRef.current?.focus();   ddRef.current?.select(); }
            if (seg === "yyyy") { mmRef.current?.focus();   mmRef.current?.select(); }
        }
        if (e.key === "/" || e.key === "-") {
            e.preventDefault();
            if (seg === "dd")   { mmRef.current?.focus();   mmRef.current?.select(); }
            if (seg === "mm")   { yyyyRef.current?.focus(); yyyyRef.current?.select(); }
        }
    };

    return (
        <div className={cn(
            "relative flex h-8 items-center rounded border border-(--cl-border) bg-(--cl-surface) px-2 gap-0.5 focus-within:ring-1 focus-within:ring-(--cl-accent)",
            disabled && "opacity-50 pointer-events-none",
            className,
        )}>
            <input
                ref={ddRef}
                className="w-6 text-center outline-none bg-transparent text-sm text-(--cl-text) placeholder:text-(--cl-text-muted)"
                disabled={disabled}
                inputMode="numeric"
                maxLength={2}
                placeholder="dd"
                value={dd}
                onChange={e => handleDd(e.target.value)}
                onFocus={e => e.target.select()}
                onKeyDown={e => handleKeyDown(e, "dd", dd)}
            />
            <span className="text-(--cl-text-muted) text-sm select-none">/</span>
            <input
                ref={mmRef}
                className="w-6 text-center outline-none bg-transparent text-sm text-(--cl-text) placeholder:text-(--cl-text-muted)"
                disabled={disabled}
                inputMode="numeric"
                maxLength={2}
                placeholder="mm"
                value={mm}
                onChange={e => handleMm(e.target.value)}
                onFocus={e => e.target.select()}
                onKeyDown={e => handleKeyDown(e, "mm", mm)}
            />
            <span className="text-(--cl-text-muted) text-sm select-none">/</span>
            <input
                ref={yyyyRef}
                className="w-10 text-center outline-none bg-transparent text-sm text-(--cl-text) placeholder:text-(--cl-text-muted)"
                disabled={disabled}
                inputMode="numeric"
                maxLength={4}
                placeholder="yyyy"
                value={yyyy}
                onChange={e => handleYyyy(e.target.value)}
                onFocus={e => e.target.select()}
                onKeyDown={e => handleKeyDown(e, "yyyy", yyyy)}
            />
            <button
                className="ml-auto text-(--cl-text-muted) hover:text-(--cl-accent) transition-colors"
                disabled={disabled}
                tabIndex={-1}
                type="button"
                onClick={() => pickerRef.current?.showPicker()}
            >
                <Calendar className="h-3.5 w-3.5" />
            </button>

            {/* Hidden native date input for the calendar picker */}
            <input
                ref={pickerRef}
                className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                tabIndex={-1}
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    );
}
