export function Field({ label, value, className }: { label: string; value: string | number; className?: string }) {
    return (
        <div className={className}>
            <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="font-semibold text-zinc-800">{value}</p>
        </div>
    );
}
