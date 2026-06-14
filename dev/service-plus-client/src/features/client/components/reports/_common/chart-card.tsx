import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    description?: string;
    title: string;
};

export const ChartCard = ({ actions, children, className, description, title }: Props) => {
    return (
        <section
            className={cn(
                "flex flex-col rounded-lg border border-(--cl-border) bg-(--cl-surface-2) shadow-sm",
                className,
            )}
        >
            <header className="flex items-start justify-between gap-2 border-b border-(--cl-border) px-4 py-3">
                <div className="min-w-0">
                    <h2 className="text-sm font-bold tracking-tight text-(--cl-text)">{title}</h2>
                    {description && (
                        <p className="mt-0.5 text-xs text-(--cl-text-muted)">{description}</p>
                    )}
                </div>
                {actions && <div className="flex items-center gap-1">{actions}</div>}
            </header>
            <div className="flex-1 p-3">{children}</div>
        </section>
    );
};
