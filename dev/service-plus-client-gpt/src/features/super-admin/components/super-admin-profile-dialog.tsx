import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { getRoleDisplayName } from "@/features/auth/utils/access-rights";
import { selectCurrentUser } from "@/features/auth/store/auth-slice";
import { useAppSelector } from "@/store/hooks";

// ─── Types ────────────────────────────────────────────────────────────────────

type SuperAdminProfileDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    open: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-500">{label}</span>
            <span className="text-sm text-slate-800">{value || <span className="text-slate-400">—</span>}</span>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SuperAdminProfileDialog = ({ onOpenChange, open }: SuperAdminProfileDialogPropsType) => {
    const user = useAppSelector(selectCurrentUser);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Profile</DialogTitle>
                </DialogHeader>

                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-4 py-1"
                    initial={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                >
                    <div className="grid grid-cols-2 gap-3">
                        <FieldRow label="Full Name" value={user?.fullName} />
                        <FieldRow label="Username" value={user?.username} />
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-3">
                        <FieldRow label="Email" value={user?.email} />
                        <FieldRow label="Mobile" value={user?.mobile} />
                    </div>

                    <Separator />

                    <FieldRow label="Role" value={getRoleDisplayName(user ?? null, false) ?? "Super Admin"} />
                </motion.div>

                <DialogFooter>
                    <Button
                        className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
