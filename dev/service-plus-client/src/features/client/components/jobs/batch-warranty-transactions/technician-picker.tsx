import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TechnicianRow } from "@/features/client/types/job";

type Props = {
    technicians: TechnicianRow[];
    value:       number | null;
    required:    boolean;
    onChange:    (id: number | null) => void;
};

// Same fetch-array-and-render-inline-<Select> idiom used everywhere else a
// technician is picked (e.g. status-transition-modal.tsx) — there is no
// dedicated reusable technician widget elsewhere in the codebase to extend.
export function TechnicianPicker({ technicians, value, required, onChange }: Props) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor="batch-technician">
                Service Engineer {required && <span className="text-red-500">*</span>}
            </Label>
            <Select
                value={value ? String(value) : ""}
                onValueChange={v => onChange(v ? Number(v) : null)}
            >
                <SelectTrigger id="batch-technician" className="h-9 w-56">
                    <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                    {technicians.map(t => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
