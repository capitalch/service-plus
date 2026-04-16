import { Eye, Pencil, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "new" | "view";

interface ViewModeToggleProps {
    mode:         ViewMode;
    isEditing:    boolean;       // true when an existing record is loaded for edit
    onNewClick:   () => void;
    onViewClick:  () => void;
    disableNew?:  boolean;       // optional: prevent clicking New while editing
}

export function ViewModeToggle({
    mode,
    isEditing,
    onNewClick,
    onViewClick,
    disableNew = false,
}: ViewModeToggleProps) {
    return (
        <div className="flex shrink-0 items-center gap-2 rounded-xl border-2 border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-1 shadow-md">
            <Button
                className={`h-9 gap-2 px-4 text-sm transition-transform duration-200 rounded-lg border-0 ${
                    mode === "new" && isEditing
                    ? "bg-amber-500 text-white font-bold shadow-lg scale-105 hover:brightness-110"
                    : mode === "new"
                    ? "bg-emerald-600 text-white font-bold shadow-lg scale-105 hover:brightness-110"
                    : "bg-transparent text-[var(--cl-text-muted)] hover:text-white hover:bg-emerald-600 hover:scale-105 font-semibold"
                }`}
                size="sm"
                disabled={disableNew}
                onClick={onNewClick}
            >
                {mode === "new" && isEditing ? <Pencil className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                {mode === "new" && isEditing ? "Edit" : "New"}
            </Button>
            <Button
                className={`h-9 gap-2 px-4 text-sm transition-transform duration-200 rounded-lg border-0 ${
                    mode === "view"
                    ? "bg-sky-600 text-white font-bold shadow-lg scale-105 hover:brightness-110"
                    : "bg-transparent text-[var(--cl-text-muted)] hover:text-white hover:bg-sky-600 hover:scale-105 font-semibold"
                }`}
                size="sm"
                onClick={onViewClick}
            >
                <Eye className="h-4 w-4" />
                View
            </Button>
        </div>
    );
}
