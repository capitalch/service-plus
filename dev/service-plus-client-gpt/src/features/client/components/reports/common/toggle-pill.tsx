import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Props = {
    activeClass: string;
    checked: boolean;
    label: string;
    onChange: (checked: boolean) => void;
    switchActiveClass: string;
};

export const TogglePill = ({ activeClass, checked, label, onChange, switchActiveClass }: Props) => (
    <Label
        className={cn(
            "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
            checked ? activeClass : "border-(--cl-border) bg-(--cl-surface) text-(--cl-text)",
        )}
    >
        <Switch
            checked={checked}
            className={cn("scale-110 data-unchecked:bg-slate-300 dark:data-unchecked:bg-slate-600", switchActiveClass)}
            onCheckedChange={onChange}
        />
        {label}
    </Label>
);
