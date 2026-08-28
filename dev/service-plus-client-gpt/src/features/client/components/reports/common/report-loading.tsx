import { cn } from "@/lib/utils";

type Props = {
    className?: string;
    lines?: number;
};

export const ReportLoading = ({ className, lines = 6 }: Props) => {
    return (
        <div className={cn("space-y-3 p-4", className)}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map(i => (
                    <div
                        key={i}
                        className="h-20 animate-pulse rounded-lg border border-(--cl-border) bg-(--cl-surface-2)"
                    />
                ))}
            </div>
            <div className="space-y-1.5 rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-3">
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className="h-3.5 animate-pulse rounded bg-(--cl-hover)"
                        style={{ width: `${100 - (i * 7) % 60}%` }}
                    />
                ))}
            </div>
        </div>
    );
};
