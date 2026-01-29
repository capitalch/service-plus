import { useSelector } from "react-redux";
import { Outlet } from "@tanstack/react-router";
import type { RootState } from "@/app/store";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "@/components/shared/CommandPalette";

const SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 72;

export function MainLayout() {
  const { sidebarCollapsed } = useSelector((state: RootState) => state.ui);

  const sidebarWidth = sidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_WIDTH;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Command Palette */}
      <CommandPalette />

      {/* Main Content */}
      <main
        className="min-h-screen transition-[margin-left] duration-200 ease-in-out"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        {/* Desktop content */}
        <div className="hidden p-6 md:block">
          <Outlet />
        </div>
        {/* Mobile content - no sidebar margin, add top padding for menu button */}
        <div className="block p-6 pt-16 md:hidden" style={{ marginLeft: `-${sidebarWidth}px` }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
