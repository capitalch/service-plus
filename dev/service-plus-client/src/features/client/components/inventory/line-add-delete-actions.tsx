import { PlusCircle, XCircle } from "lucide-react";

interface LineAddDeleteActionsProps {
    onAdd: () => void;
    onDelete: () => void;
    disableDelete: boolean;
}

export function LineAddDeleteActions({ onAdd, onDelete, disableDelete }: LineAddDeleteActionsProps) {
    return (
        <>
            <button
                type="button"
                className="cursor-pointer text-[var(--cl-accent)] hover:bg-[var(--cl-accent)]/10 hover:scale-110 active:scale-95 transition-all p-1.5 rounded-full"
                onClick={onAdd}
                title="Add row below"
            >
                <PlusCircle className="h-7 w-7" strokeWidth={2.5} />
            </button>
            <button
                type="button"
                className="cursor-pointer text-red-500 hover:text-red-600 hover:bg-red-500/10 hover:scale-110 active:scale-95 transition-all p-1.5 rounded-full disabled:opacity-20 disabled:cursor-not-allowed disabled:scale-100 disabled:bg-transparent"
                disabled={disableDelete}
                onClick={onDelete}
                title="Remove line"
            >
                <XCircle className="h-7 w-7" strokeWidth={2.5} />
            </button>
        </>
    );
}
