import { Inbox } from "lucide-react";

import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";

type Props = {
    className?: string;
    message?: string;
};

export const ReportEmpty = ({ className, message }: Props) => {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-(--cl-border) bg-(--cl-surface-2) px-6 py-12 text-center",
                className,
            )}
        >
            <Inbox className="h-8 w-8 text-(--cl-text-muted)" />
            <p className="text-xs text-(--cl-text-muted)">
                {message ?? MESSAGES.INFO_REPORTS_NO_DATA}
            </p>
        </div>
    );
};
