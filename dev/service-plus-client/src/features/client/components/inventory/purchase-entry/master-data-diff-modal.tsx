import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { PurchaseLineFormItem } from "@/features/client/types/purchase";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    submitting: boolean;
    masterDiffLines: PurchaseLineFormItem[];
};

function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

export const MasterDataDiffModal = ({
    isOpen,
    onClose,
    onConfirm,
    submitting,
    masterDiffLines,
}: Props) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent aria-describedby={undefined} className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Part Master Data Will Be Updated</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-[var(--cl-text-muted)]">
                    The following values differ from what is currently stored in the part master. Proceeding will overwrite the master with the entered values.
                </p>
                <div className="overflow-auto max-h-72 rounded border border-[var(--cl-border)]">
                    <table className="w-full text-sm">
                        <thead className="bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] sticky top-0">
                            <tr>
                                <th className="text-left px-3 py-2 font-medium">Part Code</th>
                                <th className="text-left px-3 py-2 font-medium">Part Name</th>
                                <th className="text-left px-3 py-2 font-medium">Field</th>
                                <th className="text-right px-3 py-2 font-medium">Master Value</th>
                                <th className="text-right px-3 py-2 font-medium">Entered Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--cl-border)]">
                            {masterDiffLines.flatMap(line => {
                                const rows = [];
                                if (line._orig_hsn_code != null && line.hsn_code.trim() !== "" && line.hsn_code.trim() !== line._orig_hsn_code) {
                                    rows.push(
                                        <tr key={`${line._key}-hsn`} className="bg-[var(--cl-surface)]">
                                            <td className="px-3 py-1.5 font-mono text-xs">{line.part_code}</td>
                                            <td className="px-3 py-1.5">{line.part_name}</td>
                                            <td className="px-3 py-1.5 text-[var(--cl-text-muted)]">HSN</td>
                                            <td className="px-3 py-1.5 text-right font-mono">{line._orig_hsn_code}</td>
                                            <td className="px-3 py-1.5 text-right font-mono text-amber-600">{line.hsn_code.trim()}</td>
                                        </tr>
                                    );
                                }
                                if (line._orig_cost_price != null && line.unit_price > 0 && line.unit_price !== line._orig_cost_price) {
                                    rows.push(
                                        <tr key={`${line._key}-price`} className="bg-[var(--cl-surface)]">
                                            <td className="px-3 py-1.5 font-mono text-xs">{line.part_code}</td>
                                            <td className="px-3 py-1.5">{line.part_name}</td>
                                            <td className="px-3 py-1.5 text-[var(--cl-text-muted)]">Price</td>
                                            <td className="px-3 py-1.5 text-right font-mono">{formatNumber(line._orig_cost_price)}</td>
                                            <td className="px-3 py-1.5 text-right font-mono text-amber-600">{formatNumber(line.unit_price)}</td>
                                        </tr>
                                    );
                                }
                                if (line._orig_gst_rate != null && line.gst_rate > 0 && line.gst_rate !== line._orig_gst_rate) {
                                    rows.push(
                                        <tr key={`${line._key}-gst`} className="bg-[var(--cl-surface)]">
                                            <td className="px-3 py-1.5 font-mono text-xs">{line.part_code}</td>
                                            <td className="px-3 py-1.5">{line.part_name}</td>
                                            <td className="px-3 py-1.5 text-[var(--cl-text-muted)]">GST Rate</td>
                                            <td className="px-3 py-1.5 text-right font-mono">{line._orig_gst_rate}%</td>
                                            <td className="px-3 py-1.5 text-right font-mono text-amber-600">{line.gst_rate}%</td>
                                        </tr>
                                    );
                                }
                                return rows;
                            })}
                        </tbody>
                    </table>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button disabled={submitting} onClick={onConfirm}>
                        {submitting ? "Saving…" : "Proceed"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
