import type { ReactNode } from "react";
import { useState } from "react";

import { SuperAdminSidebar } from "./sidebar";
import { TopHeader } from "./top-header";

type SuperAdminLayoutPropsType = {
    children: ReactNode;
};

export const SuperAdminLayout = ({ children }: SuperAdminLayoutPropsType) => {
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleMobileClose = () => setMobileOpen(false);
    const handleMenuToggle = () => setMobileOpen((prev) => !prev);

    return (
        <div className="flex h-screen w-full overflow-hidden bg-slate-50">
            <SuperAdminSidebar isMobileOpen={mobileOpen} onMobileClose={handleMobileClose} />
            <div className="flex flex-1 flex-col overflow-hidden">
                <TopHeader onMenuToggle={handleMenuToggle} />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
            </div>
        </div>
    );
};
