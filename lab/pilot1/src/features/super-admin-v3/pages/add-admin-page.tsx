import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, ChevronRightIcon, EyeIcon, EyeOffIcon, ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { addAdminUser, selectClients } from "@/features/super-admin/super-admin-slice";
import type { AdminUserRoleType } from "@/features/super-admin/types";
import { SuperAdminLayoutV3 } from "../components/super-admin-layout";

type Step1Type = { email: string; full_name: string; mobile: string; password: string; username: string };
type Step2Type = { bu_id: number | null; is_active: boolean; role: AdminUserRoleType };

const STEPS = ["Personal Info", "Role & Access", "Review & Save"];

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
                    {i < STEPS.length - 1 && <div className={`h-px w-12 flex-shrink-0 ${i < current ? "bg-violet-400" : "bg-slate-200"}`} />}
                </div>
            );
        })}
    </div>
);

function passwordStrength(pwd: string): { label: string; pct: number; color: string } {
    if (!pwd) return { color: "bg-slate-200", label: "", pct: 0 };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const map = [
        { color: "bg-red-400", label: "Weak", pct: 25 },
        { color: "bg-orange-400", label: "Fair", pct: 50 },
        { color: "bg-yellow-400", label: "Good", pct: 75 },
        { color: "bg-emerald-500", label: "Strong", pct: 100 },
    ];
    return map[score - 1] ?? map[0];
}

const slideVariants = {
    center: { opacity: 1, x: 0 },
    enter: (dir: number) => ({ opacity: 0, x: dir * 32 }),
    exit: (dir: number) => ({ opacity: 0, x: dir * -32 }),
};

const ROLES: AdminUserRoleType[] = ["ClientAdmin", "SuperAdmin", "Viewer"];
const roleDescriptions: Record<AdminUserRoleType, string> = {
    ClientAdmin: "Can manage their own business unit",
    SuperAdmin: "Full platform access",
    Viewer: "Read-only access",
};

export const AddAdminPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const clients = useSelector(selectClients);

    const [step, setStep] = useState(0);
    const [dir, setDir] = useState(1);
    const [showPwd, setShowPwd] = useState(false);

    const [step1, setStep1] = useState<Step1Type>({ email: "", full_name: "", mobile: "", password: "", username: "" });
    const [step2, setStep2] = useState<Step2Type>({ bu_id: clients[0]?.id ?? null, is_active: true, role: "ClientAdmin" });

    const goNext = () => { setDir(1); setStep((s) => s + 1); };
    const goBack = () => { setDir(-1); setStep((s) => s - 1); };

    const strength = passwordStrength(step1.password);
    const isStep1Valid = step1.full_name.trim() && step1.username.trim() && step1.email.trim() && step1.password.length >= 6;
    const isStep2Valid = step2.bu_id !== null;

    const selectedClient = clients.find((c) => c.id === step2.bu_id);

    const handleSubmit = () => {
        if (!step2.bu_id) return;
        dispatch(
            addAdminUser({
                bu_id: step2.bu_id,
                bu_name: selectedClient?.name ?? "",
                email: step1.email,
                full_name: step1.full_name,
                is_active: step2.is_active,
                is_admin: true,
                mobile: step1.mobile || null,
                role: step2.role,
                username: step1.username,
            })
        );
        toast.success(`Admin "${step1.full_name}" created!`, { description: `Role: ${step2.role}` });
        navigate("/super-admin-v3/admins");
    };

    return (
        <SuperAdminLayoutV3>
            <div className="mx-auto max-w-2xl">
                <div className="mb-6">
                    <h1 className="text-xl font-bold text-slate-900">Add Admin User</h1>
                    <p className="mt-1 text-sm text-slate-500">Create a new administrator account in 3 steps.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                    <StepIndicator current={step} />

                    <AnimatePresence custom={dir} initial={false} mode="wait">
                        {/* Step 1: Personal Info */}
                        {step === 0 && (
                            <motion.div
                                animate="center" custom={dir} exit="exit" initial="enter" key="s0"
                                transition={{ duration: 0.25, ease: "easeInOut" }} variants={slideVariants}
                            >
                                <h2 className="mb-5 text-base font-semibold text-slate-800">Personal Information</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 sm:col-span-1">
                                        <Label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name *</Label>
                                        <Input className="h-11 focus:border-violet-400 focus:ring-violet-100" onChange={(e) => setStep1((p) => ({ ...p, full_name: e.target.value }))} placeholder="John Doe" value={step1.full_name} />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <Label className="mb-1.5 block text-sm font-medium text-slate-700">Username *</Label>
                                        <Input className="h-11 focus:border-violet-400 focus:ring-violet-100" onChange={(e) => setStep1((p) => ({ ...p, username: e.target.value }))} placeholder="johndoe" value={step1.username} />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <Label className="mb-1.5 block text-sm font-medium text-slate-700">Email *</Label>
                                        <Input className="h-11 focus:border-violet-400 focus:ring-violet-100" onChange={(e) => setStep1((p) => ({ ...p, email: e.target.value }))} placeholder="john@company.com" type="email" value={step1.email} />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <Label className="mb-1.5 block text-sm font-medium text-slate-700">Mobile</Label>
                                        <Input className="h-11 focus:border-violet-400 focus:ring-violet-100" onChange={(e) => setStep1((p) => ({ ...p, mobile: e.target.value }))} placeholder="+91 9876543210" type="tel" value={step1.mobile} />
                                    </div>
                                    <div className="col-span-2">
                                        <Label className="mb-1.5 block text-sm font-medium text-slate-700">Password *</Label>
                                        <div className="relative">
                                            <Input
                                                className="h-11 pr-10 focus:border-violet-400 focus:ring-violet-100"
                                                onChange={(e) => setStep1((p) => ({ ...p, password: e.target.value }))}
                                                placeholder="Min. 6 characters"
                                                type={showPwd ? "text" : "password"}
                                                value={step1.password}
                                            />
                                            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPwd((p) => !p)} type="button">
                                                {showPwd ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {step1.password && (
                                            <div className="mt-2 space-y-1">
                                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                                    <motion.div animate={{ width: `${strength.pct}%` }} className={`h-full rounded-full ${strength.color}`} initial={{ width: 0 }} transition={{ duration: 0.4 }} />
                                                </div>
                                                <p className={`text-xs font-medium`} style={{ color: strength.color.replace("bg-", "").includes("red") ? "#f87171" : strength.pct === 100 ? "#10b981" : strength.pct === 75 ? "#eab308" : "#fb923c" }}>
                                                    {strength.label}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: Role & Access */}
                        {step === 1 && (
                            <motion.div
                                animate="center" custom={dir} exit="exit" initial="enter" key="s1"
                                transition={{ duration: 0.25, ease: "easeInOut" }} variants={slideVariants}
                            >
                                <h2 className="mb-5 text-base font-semibold text-slate-800">Role & Access</h2>
                                <div className="flex flex-col gap-5">
                                    <div>
                                        <Label className="mb-1.5 block text-sm font-medium text-slate-700">Business Unit *</Label>
                                        <select
                                            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
                                            onChange={(e) => setStep2((p) => ({ ...p, bu_id: Number(e.target.value) }))}
                                            value={step2.bu_id ?? ""}
                                        >
                                            {clients.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <Label className="mb-3 block text-sm font-medium text-slate-700">Role *</Label>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                            {ROLES.map((role) => (
                                                <button
                                                    className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all ${step2.role === role
                                                            ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                                                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                                        }`}
                                                    key={role}
                                                    onClick={() => setStep2((p) => ({ ...p, role }))}
                                                    type="button"
                                                >
                                                    <span className="text-sm font-semibold text-slate-900">{role}</span>
                                                    <span className="text-xs text-slate-400">{roleDescriptions[role]}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">Active on Creation</p>
                                            <p className="text-xs text-slate-400">User can log in immediately</p>
                                        </div>
                                        <button
                                            className={`relative h-6 w-11 rounded-full transition-colors ${step2.is_active ? "bg-violet-500" : "bg-slate-300"}`}
                                            onClick={() => setStep2((p) => ({ ...p, is_active: !p.is_active }))}
                                            type="button"
                                        >
                                            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${step2.is_active ? "translate-x-5" : "translate-x-0.5"}`} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 3: Review */}
                        {step === 2 && (
                            <motion.div
                                animate="center" custom={dir} exit="exit" initial="enter" key="s2"
                                transition={{ duration: 0.25, ease: "easeInOut" }} variants={slideVariants}
                            >
                                <h2 className="mb-5 text-base font-semibold text-slate-800">Review & Confirm</h2>

                                <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-sm font-bold text-slate-700">
                                            {step1.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">{step1.full_name || "—"}</p>
                                            <p className="text-sm text-slate-400">@{step1.username || "—"}</p>
                                        </div>
                                        <Badge className={step2.is_active ? "ml-auto border-emerald-200 bg-emerald-50 text-emerald-700" : "ml-auto border-slate-200 bg-slate-100 text-slate-500"} variant="outline">
                                            {step2.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>
                                    <Separator className="my-3" />
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="text-slate-500">Email</div>
                                        <div className="font-medium text-slate-900 truncate">{step1.email || "—"}</div>
                                        <div className="text-slate-500">Mobile</div>
                                        <div className="font-medium text-slate-900">{step1.mobile || "—"}</div>
                                        <div className="text-slate-500">Business Unit</div>
                                        <div className="font-medium text-slate-900">{selectedClient?.name || "—"}</div>
                                        <div className="text-slate-500">Role</div>
                                        <div className="font-medium">
                                            <Badge className="border-violet-200 bg-violet-50 text-violet-700" variant="outline">
                                                <ShieldCheckIcon className="mr-1 h-3 w-3" />
                                                {step2.role}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <p className="mt-4 text-xs text-slate-400">Clicking "Create Admin" adds the user to the system. They'll receive an invite email (demo only).</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Footer */}
                    <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
                        <Button disabled={step === 0} onClick={goBack} variant="outline">← Back</Button>
                        {step < 2 ? (
                            <Button
                                className="bg-violet-500 text-white hover:bg-violet-600"
                                disabled={(step === 0 && !isStep1Valid) || (step === 1 && !isStep2Valid)}
                                onClick={goNext}
                            >
                                Next <ChevronRightIcon className="ml-1.5 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button className="bg-violet-500 px-6 text-white hover:bg-violet-600" onClick={handleSubmit}>
                                <CheckIcon className="mr-1.5 h-4 w-4" />
                                Create Admin
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </SuperAdminLayoutV3>
    );
};
