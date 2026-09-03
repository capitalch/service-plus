import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
    className?: string;
    disabled?: boolean;
    iconOnly?: boolean;
    loading?: boolean;
    onClick: () => void;
};

export const RefreshButton = ({
    className,
    disabled,
    iconOnly = false,
    loading,
    onClick,
}: Props) => {
    if (iconOnly) {
        return (
            <Button
                aria-label="Refresh"
                className={cn("text-(--cl-text-muted) hover:text-(--cl-accent)", className)}
                disabled={disabled || loading}
                size="icon-sm"
                variant="ghost"
                onClick={onClick}
            >
                <RefreshCw className={cn("h-3.5 w-3.5 text-blue-600", loading && "animate-spin")} />
            </Button>
        );
    }

    return (
        <Button
            className={cn("h-8 gap-1.5 px-2.5 text-xs", className)}
            disabled={disabled || loading}
            size="sm"
            variant="outline"
            onClick={onClick}
        >
            <RefreshCw className={cn("h-3.5 w-3.5 text-blue-600", loading && "animate-spin")} />
            Refresh
        </Button>
    );
};
