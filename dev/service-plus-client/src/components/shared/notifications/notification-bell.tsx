import type { ComponentType } from "react";
import { Bell } from "lucide-react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// A signal shown in the bell dropdown. `count` drives both the row badge and the
// aggregate badge on the bell; rows with `count === 0` are hidden.
export type NotificationItem = {
    count:    number;
    icon:     ComponentType<{ className?: string }>;
    id:       string;
    label:    string;
    onSelect: () => void;
};

type NotificationBellProps = {
    align?:         "center" | "end" | "start";
    className?:     string;   // applied to the trigger button (theme-specific hover/layout)
    emptyLabel?:    string;
    iconClassName?: string;   // applied to the bell icon (theme-specific color)
    items:          NotificationItem[];
    title?:         string;
};

// Presentational only — it renders already-fetched counts. No data fetching here.
export function NotificationBell({
    align         = "end",
    className,
    emptyLabel    = "Nothing needs your attention",
    iconClassName,
    items,
    title         = "Notifications",
}: NotificationBellProps) {
    const visible = items.filter(item => item.count > 0);
    const total   = visible.reduce((sum, item) => sum + item.count, 0);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    title={title}
                    className={cn(
                        "relative cursor-pointer rounded p-1.5 transition-colors focus:outline-none",
                        className,
                    )}
                >
                    <Bell className={cn("h-5 w-5", iconClassName)} />
                    {total > 0 && (
                        <span className="absolute -top-0.5 right-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold leading-none text-white">
                            {total > 99 ? "99+" : total}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} className="w-72">
                <DropdownMenuLabel className="text-xs font-semibold">{title}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {visible.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">{emptyLabel}</p>
                ) : (
                    visible.map(item => {
                        const Icon = item.icon;
                        return (
                            <DropdownMenuItem key={item.id} onSelect={item.onSelect} className="gap-2 py-2">
                                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="flex-1 truncate text-sm">{item.label}</span>
                                <span className="ml-auto rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold tabular-nums text-red-600">
                                    {item.count}
                                </span>
                            </DropdownMenuItem>
                        );
                    })
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
