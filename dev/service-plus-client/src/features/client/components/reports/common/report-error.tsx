import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";

type Props = {
    className?: string;
    message?: string;
    onRetry?: () => void;
};

export const ReportError = ({ className, message, onRetry }: Props) => {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border border-amber-300/40 bg-amber-50/30 px-6 py-10 text-center dark:bg-amber-900/10",
                className,
            )}
        >
            <AlertCircle className="h-7 w-7 text-amber-500" />
            <p className="text-sm font-medium text-(--cl-text)">
                {message ?? MESSAGES.ERROR_REPORTS_FETCH_FAILED}
            </p>
            {onRetry && (
                <Button onClick={onRetry} size="sm" variant="outline">
                    Retry
                </Button>
            )}
        </div>
    );
};
