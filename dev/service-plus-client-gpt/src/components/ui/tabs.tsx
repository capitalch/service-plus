import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextType = { active: string; setActive: (v: string) => void };
const TabsCtx = React.createContext<TabsContextType>({ active: "", setActive: () => {} });

type TabsPropsType =
    | { defaultValue: string; value?: undefined; onValueChange?: undefined; children: React.ReactNode; className?: string }
    | { defaultValue?: undefined; value: string; onValueChange: (v: string) => void; children: React.ReactNode; className?: string };

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsPropsType) {
    const [uncontrolledActive, setUncontrolledActive] = React.useState(defaultValue ?? value ?? "");
    const active = value ?? uncontrolledActive;
    const setActive = onValueChange ?? setUncontrolledActive;
    return (
        <TabsCtx.Provider value={{ active, setActive }}>
            <div className={cn("flex flex-col", className)}>{children}</div>
        </TabsCtx.Provider>
    );
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("flex gap-1.5 p-1 rounded-lg bg-(--cl-surface-2) mb-4", className)}>
            {children}
        </div>
    );
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
    const { active, setActive } = React.useContext(TabsCtx);
    const isActive = active === value;
    return (
        <button
            type="button"
            className={cn(
                "flex items-center justify-center whitespace-nowrap px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150 cursor-pointer",
                isActive
                    ? "bg-(--cl-accent) text-white shadow-md"
                    : "text-(--cl-text-muted) hover:text-(--cl-text) hover:bg-(--cl-surface)/60",
                className
            )}
            onClick={() => setActive(value)}
        >
            {children}
        </button>
    );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
    const { active } = React.useContext(TabsCtx);
    return active === value ? <>{children}</> : null;
}
