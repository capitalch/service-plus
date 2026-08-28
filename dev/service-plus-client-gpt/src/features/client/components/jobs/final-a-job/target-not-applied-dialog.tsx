import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Shown when the entered target amount doesn't match the current line total on
 * save (diff > ₹0.02). Hard block — the only action is to dismiss and click
 * Apply. Shared by the Final-a-Job section and the Job Control finalize dialog.
 */
export function TargetNotAppliedDialog({ msg, onClose }: { msg: string | null; onClose: () => void }) {
    return (
        <Dialog open={msg !== null} onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-md !bg-white text-(--cl-text)">
                <DialogHeader>
                    <DialogTitle className="text-amber-600">Target Amount Not Applied</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-(--cl-text) leading-relaxed">{msg}</p>
                <DialogFooter>
                    <Button className="cursor-pointer" variant="outline" onClick={onClose}>OK</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
