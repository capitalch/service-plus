import { ClientLayout } from "../components/client-layout";

export const ClientInventoryPage = () => (
    <ClientLayout>
        <div className="mb-6 flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-[#a1a1aa]">
            <span>Console</span>
            <span className="text-[#9fcaff]">/ Inventory</span>
        </div>
        <div className="flex items-center justify-center rounded-lg border border-white/5 bg-[#202020] p-20">
            <div className="text-center">
                <p className="text-sm font-semibold text-[#e5e2e1]">Inventory</p>
                <p className="mt-2 text-xs text-[#a1a1aa]">Spare parts & stock management features coming soon.</p>
            </div>
        </div>
    </ClientLayout>
);
