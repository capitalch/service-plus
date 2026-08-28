import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHelp } from "@/features/client/components/layout/client-layout";

type Props = {
    articleId: string;
    className?: string;
};

export function HelpHint({ articleId, className }: Props) {
    const { openHelp } = useHelp();

    return (
        <button
            type="button"
            onClick={() => openHelp(articleId)}
            className={cn(
                "inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-(--cl-text-muted)/50 transition-colors hover:bg-(--cl-accent)/10 hover:text-(--cl-accent)",
                className,
            )}
            title={`Help: ${articleId}`}
        >
            <HelpCircle className="h-3 w-3" />
        </button>
    );
}
