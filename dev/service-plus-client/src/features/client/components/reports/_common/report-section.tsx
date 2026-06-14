import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
    children: ReactNode;
    className?: string;
};

export const ReportSection = ({ children, className }: Props) => {
    return (
        <div className={cn("flex h-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4", className)}>
            {children}
        </div>
    );
};
