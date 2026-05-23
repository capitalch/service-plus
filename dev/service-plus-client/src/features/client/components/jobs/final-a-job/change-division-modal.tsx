import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
    open:              boolean;
    currentDivisionId: number | null;
    divisions:         { id: number; name: string }[];
    onApply:           (id: number) => Promise<void>;
    onClose:           () => void;
};

export function ChangeDivisionModal({ open, currentDivisionId, divisions, onApply, onClose }: Props) {
    const [pending, setPending] = useState<number | null>(currentDivisionId);
    const [saving,  setSaving]  = useState(false);

    useEffect(() => {
        if (open) setPending(currentDivisionId);
    }, [open, currentDivisionId]);

    async function handleApply() {
        if (!pending) return;
        setSaving(true);
        try {
            await onApply(pending);
            onClose();
        } catch {
            // error already toasted by parent
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose(); }}>
            <DialogContent className="sm:max-w-xs">
                <DialogHeader>
                    <DialogTitle>Change Division</DialogTitle>
                </DialogHeader>
                <div className="py-2">
                    <Select
                        disabled={saving}
                        value={pending ? String(pending) : ""}
                        onValueChange={v => setPending(Number(v))}
                    >
                        <SelectTrigger className="w-full text-sm border-(--cl-border) bg-white">
                            <SelectValue placeholder="Select division" />
                        </SelectTrigger>
                        <SelectContent>
                            {divisions.map(d => (
                                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button disabled={saving} variant="outline" onClick={onClose}>Cancel</Button>
                    <Button disabled={!pending || saving} onClick={() => void handleApply()}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
