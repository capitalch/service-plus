import {
    AlertCircle, Briefcase, Calendar,
    Hash, Info, Printer, Smartphone, User,
    CheckCircle2, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import type { JobDetailType } from "../../../types/job";
import { Badge } from "@/components/ui/badge";

import { useAppSelector } from "@/store/hooks";
import { selectAvailableBranches } from "@/store/context-slice";

type JobViewModalPropsType = {
    isOpen: boolean;
    job: JobDetailType | null;
    onClose: () => void;
    onPrint: () => void;
};

const InfoRow = ({ label, value, icon: Icon, isMono = false, highlight = false }: { label: string; value: string | number | null | undefined; icon?: any; isMono?: boolean; highlight?: boolean }) => (
    <div className="flex flex-col gap-0.5 group min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-0.5 truncate">
            {Icon && <Icon className="h-3 w-3 shrink-0" />}
            <span className="truncate">{label}</span>
        </div>
        <div className={`text-sm break-words ${highlight ? 'font-bold text-primary' : 'font-medium text-foreground'} ${isMono ? 'font-mono' : ''} group-hover:text-primary transition-colors`}>
            {value || "—"}
        </div>
    </div>
);

const SectionCard = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
        <div className={`px-5 py-3 border-b bg-muted/30 flex items-center gap-2.5`}>
            <div className={`h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary`}>
                <Icon className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-tighter text-foreground/80">{title}</h3>
        </div>
        <div className="p-5">
            {children}
        </div>
    </div>
);

export const SingleJobViewModal = ({ isOpen, job, onClose, onPrint }: JobViewModalPropsType) => {
    const branches = useAppSelector(selectAvailableBranches);
    if (!job) return null;

    const branchCode = job.branch_code || branches.find(b => b.id === job.branch_id)?.code;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:max-w-3xl p-0 overflow-hidden bg-background border-none shadow-2xl rounded-3xl flex flex-col max-h-[90vh]">
                {/* Clear Light Header */}
                <div className="relative bg-white dark:bg-zinc-900 px-6 py-6 md:px-10 md:py-8 border-b text-foreground overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                    
                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            {/* Vivid Logo Icon - High Contrast */}
                            <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none shrink-0">
                                <Briefcase className="h-7 w-7 md:h-8 md:w-8 text-white" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-lg md:text-xl font-black tracking-tightest text-slate-900 dark:text-white uppercase">
                                        JOB <span className="text-indigo-600">#{job.job_no}</span>
                                    </h2>
                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 py-1 px-3 text-xs md:text-sm uppercase font-black tracking-wider">
                                        {job.job_status_name}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 font-bold text-xs">
                                    <span className="flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                                        {job.job_date}
                                    </span>
                                    <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                    <span className="flex items-center gap-1.5">
                                        <Hash className="h-3.5 w-3.5 text-indigo-500" />
                                        Branch: {branchCode || job.branch_id}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-start sm:items-end gap-0.5">
                            <span className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">Estimate Total</span>
                            <span className="text-2xl md:text-3xl font-black tracking-tighter text-slate-600 dark:text-slate-400 drop-shadow-sm">
                                ₹{Number(job.amount || 0).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Compact Content Area */}
                <div className="p-5 md:p-8 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-zinc-950/30">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        
                        {/* Left Column (4/12) */}
                        <div className="md:col-span-4 space-y-4">
                            <SectionCard title="Client" icon={User}>
                                <div className="space-y-4">
                                    <InfoRow label="Name" value={job.customer_name} highlight />
                                    <InfoRow label="Contact" value={job.mobile} icon={Smartphone} isMono />
                                </div>
                            </SectionCard>

                            <SectionCard title="Technician" icon={User}>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center border-2 border-indigo-500/20 shrink-0">
                                        <User className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold truncate text-foreground">{job.technician_name || "UNASSIGNED"}</p>
                                        <p className="text-[9px] uppercase font-black text-muted-foreground/60">Lead Tech</p>
                                    </div>
                                </div>
                            </SectionCard>
                        </div>

                        {/* Right Column (8/12) */}
                        <div className="md:col-span-8 space-y-4">
                            <SectionCard title="Product" icon={Smartphone}>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                    <div className="col-span-2 sm:col-span-1">
                                        <InfoRow label="Brand / Model" value={`${job.brand_name} ${job.model_name}`} highlight />
                                    </div>
                                    <InfoRow label="Category" value={job.product_name} />
                                    <InfoRow label="Serial" value={job.serial_no} isMono />
                                    <InfoRow label="Warranty" value={job.warranty_card_no} />
                                    <InfoRow label="Qty" value={job.quantity} />
                                </div>
                            </SectionCard>

                            {/* Service Details Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-3 rounded-xl bg-card border flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <InfoRow label="Type" value={job.job_type_name} />
                                </div>
                                <div className="p-3 rounded-xl bg-card border flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    <InfoRow label="Condition" value={job.job_receive_condition_name} />
                                </div>
                            </div>
                        </div>

                        {/* Problem (Full Width) */}
                        <div className="md:col-span-12">
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 relative group">
                                <div className="flex items-center gap-2 text-amber-600 mb-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <h3 className="text-[10px] font-black uppercase tracking-widest">Problem Reported</h3>
                                </div>
                                <p className="text-sm leading-relaxed text-foreground/80 font-medium italic pl-3 border-l-2 border-amber-500/40">
                                    "{job.problem_reported}"
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-muted/10 flex items-center justify-between gap-4 shrink-0">
                    <div className="hidden sm:flex items-center gap-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-50">
                        <Info className="h-3 w-3" />
                        System Job Record v1.0
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button variant="ghost" className="flex-1 sm:flex-none h-10 px-4 text-xs font-bold uppercase tracking-widest" onClick={onClose}>
                            Close
                        </Button>
                        <Button className="flex-1 sm:flex-none h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-600/20" onClick={onPrint}>
                            <Printer className="h-3.5 w-3.5 mr-2" />
                            Print Sheet
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
