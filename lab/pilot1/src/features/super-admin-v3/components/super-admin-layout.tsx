import { useState } from "react";
import { SidebarV3 } from "./sidebar";
import { TopHeaderV3 } from "./top-header";

export const SuperAdminLayoutV3 = ({ children }: { children: React.ReactNode }) => {
    const [mobileOpen, setMobileOpen] = useState(false);
    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <SidebarV3 isMobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
            <div className="flex flex-1 flex-col overflow-hidden">
                <TopHeaderV3 onMenuToggle={() => setMobileOpen((p) => !p)} />
                <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
        </div>
    );
};
