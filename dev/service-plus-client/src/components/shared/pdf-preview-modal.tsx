import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl: string | null;
    title?: string;
    filename?: string;
};

export const PdfPreviewModal = ({ isOpen, onClose, pdfUrl, title = "PDF Preview", filename = "document.pdf" }: Props) => {
    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = filename;
        link.click();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                showCloseButton={false}
                style={{ width: "90vw", maxWidth: "90vw" }}
                className="h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl"
            >
                <div className="pl-6 pr-2 py-2 border-b bg-white dark:bg-zinc-900 flex items-center shrink-0">
                    <DialogTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        {title}
                    </DialogTitle>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="ml-auto h-8 gap-2 text-[10px] font-black uppercase tracking-widest bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 border border-indigo-100 dark:border-indigo-800 transition-all"
                        onClick={handleDownload}
                    >
                        <Download className="h-3.5 w-3.5 text-indigo-600" />
                        Download Document
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-zinc-900 relative overflow-hidden">
                    {pdfUrl ? (
                        <iframe 
                            src={`${pdfUrl}#zoom=100`}
                            className="w-full h-full border-none"
                            title="PDF Preview"
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
                            <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Processing Document...</span>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
