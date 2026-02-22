import { AnimatePresence, motion } from "framer-motion";
import { BuildingIcon, CheckIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { addClient } from "@/features/super-admin/super-admin-slice";
import { SuperAdminLayoutV3 } from "../components/super-admin-layout";

type Step1Type = { code: string; is_active: boolean; name: string };
type Step2Type = { maxAdmins: string; notes: string };

const STEPS = ["Basic Info", "Settings", "Review & Save"];

const StepIndicator = ({ current }: { current: number }) => (
    <div className="flex items-center gap-3 mb-8">
        {STEPS.map((label, i) => {
            const done = i < current;
            const active = i === current;
            return (
                <div className="flex items-center gap-3" key={label}>
                    <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${done ? "bg-violet-500 text-white" : active ? "bg-violet-500 text-white ring-4 ring-violet-100" : "bg-slate-100 text-slate-400"
                            }`}>
                            {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
                        </div>
                        <span className={`text-sm font-medium ${active ? "text-slate-900" : done ? "text-violet-600" : "text-slate-400"}`}>
                            {label}
                        </span>
                    </div>
                    {i < STEPS.length - 1 && (
                        <div className={`h-px w-12 flex-shrink-0 ${i < current ? "bg-violet-400" : "bg-slate-200"}`} />
                    )}
                </div>
            );
        })}
    </div>
);

const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * 32 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir * -32 }),
};

export const AddClientPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [dir, setDir] = useState(1);

    const [step1, setStep1] = useState<Step1Type>({ code: "", is_active: true, name: "" });
    const [step2, setStep2] = useState<Step2Type>({ maxAdmins: "10", notes: "" });

    const goNext = () => { setDir(1); setStep((s) => s + 1); };
    const goBack = () => { setDir(-1); setStep((s) => s - 1); };

    const handleSubmit = () => {
        dispatch(addClient({ code: step1.code.toUpperCase(), is_active: step1.is_active, name: step1.name }));
        toast.success(`Business unit "${step1.name}" created!`, { description: `Code: ${step1.code.toUpperCase()}` });
        navigate("/super-admin-v3/clients");
    };

    const isStep1Valid = step1.name.trim() && step1.code.trim();

    return (
        <SuperAdminLayoutV3>
            <div className="mx-auto max-w-2xl">
                <div className="mb-6">
                    <h1 className="text-xl font-bold text-slate-900">Add Business Unit</h1>
                    <p className="mt-1 text-sm text-slate-500">Register a new client in 3 simple steps.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                    <StepIndicator current={step} />

                    <AnimatePresence custom={dir} initial={false} mode="wait">
                        {step === 0 && (
                            <motion.div
                                animate="center" custom={dir} exit="exit" initial="enter" key="step0"
                                transition={{ duration: 0.25, ease: "easeInOut" }} variants={slideVariants}
                            >
                                <h2 className="mb-5 text-base font-semibold text-slate-800">Basic Information</h2>
                                <div className="flex flex-col gap-5">
                                    <div>
                                        <Label className="mb-1.5 block text-sm font-medium text-slate-700">Business Unit Name *</Label>
                                        <Input
                                            className="h-11 focus:border-violet-400 focus:ring-violet-100"
                                            onChange={(e) => setStep1((p) => ({ ...p, name: e.target.value }))}
                                            placeholder="e.g. Alpha Corporation"
                                            value={step1.name}
                                        />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-sm font-medium text-slate-700">Business Unit Code *</Label>
                                        <Input
                                            className="h-11 font-mono uppercase focus:border-violet-400 focus:ring-violet-100"
                                            maxLength={10}
                                            onChange={(e) => setStep1((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                                            placeholder="e.g. ALPHA"
                                            value={step1.code}
                                        />
                                        <p className="mt-1 text-xs text-slate-400">Uppercase letters only. Max 10 characters.</p>
                                    </div>
                                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">Active Status</p>
                                            <p className="text-xs text-slate-400">Enable this business unit immediately</p>
                                        </div>
                                        <button
                                            className={`relative h-6 w-11 rounded-full transition-colors ${step1.is_active ? "bg-violet-500" : "bg-slate-300"}`}
                                            onClick={() => setStep1((p) => ({ ...p, is_active: !p.is_active }))}
                                            type="button"
                                        >
                                            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${step1.is_active ? "left-5.5 translate-x-0.5" : "left-0.5"}`} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 1 && (
                            <motion.div
                                animate="center" custom={dir} exit="exit" initial="enter" key="step1"
                                transition={{ duration: 0.25, ease: "easeInOut" }} variants={slideVariants}
                            >
                                <h2 className="mb-5 text-base font-semibold text-slate-800">Settings</h2>
                                <div className="flex flex-col gap-5">
                                    <div>
                                        <Label className="mb-1.5 block text-sm font-medium text-slate-700">Max Administrators</Label>
                                        <Input
                                            className="h-11 focus:border-violet-400 focus:ring-violet-100"
                                            min={1}
                                            onChange={(e) => setStep2((p) => ({ ...p, maxAdmins: e.target.value }))}
                                            type="number"
                                            value={step2.maxAdmins}
                                        />
                                        <p className="mt-1 text-xs text-slate-400">Maximum number of admin users allowed for this unit.</p>
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-sm font-medium text-slate-700">Notes (optional)</Label>
                                        <textarea
                                            className="h-24 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
                                            onChange={(e) => setStep2((p) => ({ ...p, notes: e.target.value }))}
                                            placeholder="Any notes about this business unit..."
                                            value={step2.notes}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                animate="center" custom={dir} exit="exit" initial="enter" key="step2"
                                transition={{ duration: 0.25, ease: "easeInOut" }} variants={slideVariants}
                            >
                                <h2 className="mb-5 text-base font-semibold text-slate-800">Review & Confirm</h2>
                                <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                                            <BuildingIcon className="h-5 w-5 text-violet-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">{step1.name || "—"}</p>
                                            <p className="font-mono text-sm text-slate-400">{step1.code.toUpperCase() || "—"}</p>
                                        </div>
                                        <Badge className={step1.is_active ? "ml-auto border-emerald-200 bg-emerald-50 text-emerald-700" : "ml-auto border-slate-200 bg-slate-100 text-slate-500"} variant="outline">
                                            {step1.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>
                                    <Separator className="my-3" />
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="text-slate-500">Max Administrators</div>
                                        <div className="font-medium text-slate-900">{step2.maxAdmins}</div>
                                        {step2.notes && <>
                                            <div className="text-slate-500">Notes</div>
                                            <div className="font-medium text-slate-900">{step2.notes}</div>
                                        </>}
                                    </div>
                                </div>
                                <p className="mt-4 text-xs text-slate-400">Clicking "Create Client" will add this business unit to the system immediately.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Footer */}
                    <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
                        <Button disabled={step === 0} onClick={goBack} variant="outline">
                            ← Back
                        </Button>
                        {step < 2 ? (
                            <Button className="bg-violet-500 text-white hover:bg-violet-600" disabled={step === 0 && !isStep1Valid} onClick={goNext}>
                                Next <ChevronRightIcon className="ml-1.5 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button className="bg-violet-500 px-6 text-white hover:bg-violet-600" onClick={handleSubmit}>
                                <CheckIcon className="mr-1.5 h-4 w-4" />
                                Create Client
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </SuperAdminLayoutV3>
    );
};
