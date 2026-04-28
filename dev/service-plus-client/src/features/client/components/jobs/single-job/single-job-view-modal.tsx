import {
    AlertCircle, Briefcase, Calendar,
    Hash, Info, Printer, Smartphone, User, MapPin,
    CheckCircle2, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    // DialogDescription,
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
    <div className="flex flex-col gap-0 min-w-0">
        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5 truncate">
            {Icon && <Icon className="h-2.5 w-2.5 shrink-0 text-indigo-500/70" />}
            <span className="truncate">{label}</span>
        </div>
        <div className={`text-xs break-words leading-tight ${highlight ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-300'} ${isMono ? 'font-mono' : ''} group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors`}>
            {value || "—"}
        </div>
    </div>
);

const SectionCard = ({ title, icon: Icon, children, className = "" }: { title: string; icon: any; children: React.ReactNode; className?: string }) => (
    <div className={`bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group/card ${className}`}>
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover/card:scale-110 transition-transform">
                    <Icon className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</h3>
            </div>
        </div>
        <div className="p-4">
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
            <DialogContent aria-describedby={undefined} className="w-[95vw] sm:max-w-4xl p-0 overflow-hidden bg-background border-none shadow-2xl rounded-[1.5rem] flex flex-col max-h-[92vh]">
                <DialogTitle className="sr-only">Job Details: #{job.job_no}</DialogTitle>
                {/* Compact Premium Header */}
                <div className="relative bg-white dark:bg-zinc-950 px-6 py-5 md:px-8 md:py-6 border-b text-foreground overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-[80px] pointer-events-none" />
                    
                    <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            {/* Vivid Logo Icon - Compact */}
                            <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none shrink-0 transition-transform">
                                <Briefcase className="h-6 w-6 md:h-7 md:w-7 text-white" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <h2 className="text-base md:text-lg font-black tracking-tightest text-slate-900 dark:text-white uppercase leading-none">
                                        JOB <span className="text-indigo-600">#{job.job_no}</span>
                                    </h2>
                                    <Badge className="bg-emerald-500 text-white dark:bg-emerald-600/30 dark:text-emerald-400 border-none py-0.5 px-3 text-[9px] uppercase font-black tracking-widest rounded-full">
                                        {job.job_status_name}
                                    </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-slate-400 font-bold text-[10px]">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3 text-indigo-500" />
                                        {job.job_date}
                                    </span>
                                    <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                                    <span className="flex items-center gap-1">
                                        <Hash className="h-3 w-3 text-indigo-500" />
                                        Branch: <span className="text-slate-600 dark:text-slate-300">{branchCode || job.branch_id}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-start md:items-end gap-0.5">
                            <span className="text-[9px] uppercase font-black tracking-[0.2em] text-slate-400">Estimate Total</span>
                            <span className="text-xl md:text-2xl font-black tracking-tightest text-slate-800 dark:text-white drop-shadow-sm flex items-center gap-0.5">
                                <span className="text-indigo-500 text-lg md:text-xl">₹</span>
                                {Number(job.amount || 0).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Compact Content Grid */}
                <div className="p-4 md:p-6 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/50">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        
                        {/* Section: Client & Service (8/12) */}
                        <div className="md:col-span-8 flex flex-col gap-4">
                            <SectionCard title="Client Info" icon={User}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                    <InfoRow label="Name" value={job.customer_name} highlight icon={User} />
                                    <InfoRow label="Contact" value={job.mobile} icon={Smartphone} isMono />
                                    <div className="sm:col-span-2">
                                        <InfoRow label="Address" value={job.address_snapshot} icon={MapPin} />
                                    </div>
                                </div>
                            </SectionCard>

                            <SectionCard title="Service Parameters" icon={Clock}>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100/50 dark:border-blue-500/10 flex items-center gap-3">
                                            <div className="h-7 w-7 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0">
                                                <Clock className="h-3.5 w-3.5" />
                                            </div>
                                            <InfoRow label="Job Type" value={job.job_type_name} />
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100/50 dark:border-indigo-500/10 flex items-center gap-3">
                                            <div className="h-7 w-7 rounded-lg bg-indigo-500 text-white flex items-center justify-center shrink-0">
                                                <Info className="h-3.5 w-3.5" />
                                            </div>
                                            <InfoRow label="Manner" value={job.job_receive_manner_name} />
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100/50 dark:border-emerald-500/10 flex items-center gap-3">
                                            <div className="h-7 w-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                            </div>
                                            <InfoRow label="Condition" value={job.job_receive_condition_name} />
                                        </div>
                                    </div>
                                    <InfoRow label="Remarks" value={job.remarks} icon={AlertCircle} />
                                </div>
                            </SectionCard>
                        </div>

                        {/* Section: Product (4/12) */}
                        <div className="md:col-span-4 flex flex-col gap-4">
                            <SectionCard title="Device Details" icon={Smartphone} className="flex-1">
                                <div className="space-y-4">
                                    <InfoRow label="Brand / Model" value={`${job.brand_name} ${job.model_name}`} highlight />
                                    <div className="grid grid-cols-2 gap-2">
                                        <InfoRow label="Category" value={job.product_name} />
                                        <InfoRow label="Qty" value={job.quantity} />
                                    </div>
                                    <InfoRow label="Serial Number" value={job.serial_no} isMono />
                                    <InfoRow label="Warranty Info" value={job.warranty_card_no} />
                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <InfoRow 
                                            label="Problem Reported" 
                                            value={job.problem_reported} 
                                            icon={AlertCircle}
                                            highlight
                                        />
                                    </div>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>

                {/* Compact Footer */}
                <div className="px-6 py-4 border-t bg-white dark:bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        System Job Record v1.2
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button 
                            variant="ghost" 
                            className="flex-1 sm:flex-none h-9 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 rounded-lg" 
                            onClick={onClose}
                        >
                            Close
                        </Button>
                        <Button 
                            className="flex-1 sm:flex-none h-9 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-600/20 rounded-lg flex items-center gap-2" 
                            onClick={onPrint}
                        >
                            <Printer className="h-3.5 w-3.5" />
                            Print Sheet
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
