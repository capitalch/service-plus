import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
    children: ReactNode;
    className?: string;
    columns?: 2 | 3 | 4;
};

const COLUMN_CLASS: Record<2 | 3 | 4, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export const KpiGrid = ({ children, className, columns = 4 }: Props) => {
    return (
        <div className={cn("grid gap-3", COLUMN_CLASS[columns], className)}>
            {children}
        </div>
    );
};
