import { motion } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "@tanstack/react-router";
import { Menu, Sparkles, LogOut, PanelLeftClose, PanelLeft } from "lucide-react";
import { toast } from "sonner";
import type { RootState } from "@/app/store";
import {
  setSidebarMobileOpen,
  toggleSidebarCollapsed,
} from "@/stores/ui.slice";
import { logout } from "@/stores/auth.slice";
import { menuItems } from "@/config/menu-config";
import { SidebarMenuItem } from "./SidebarMenuItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 72;

export function Sidebar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { sidebarCollapsed, sidebarMobileOpen } = useSelector(
    (state: RootState) => state.ui
  );
  const user = useSelector((state: RootState) => state.auth.user);

  const handleCloseMobile = () => {
    dispatch(setSidebarMobileOpen(false));
  };

  const handleToggleSidebar = () => {
    dispatch(toggleSidebarCollapsed());
  };

  const handleLogout = () => {
    dispatch(logout());
    toast.success("Logged out successfully");
    navigate({ to: "/login" });
  };

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        }}
        transition={{ duration: 0.2 }}
        className="fixed inset-y-0 left-0 z-30 hidden flex-col bg-gradient-to-b from-slate-50 to-white shadow-[1px_0_0_0_rgba(0,0,0,0.05)] md:flex"
      >
        {/* Header */}
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-1 items-center justify-between">
              <div>
                <h1 className="font-semibold text-slate-800">Service Plus</h1>
                <p className="text-xs text-slate-400">Management Portal</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={handleToggleSidebar}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
          )}
          {sidebarCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-4 h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  onClick={handleToggleSidebar}
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          {!sidebarCollapsed && (
            <div className="mb-3 flex items-center gap-2 px-3">
              <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Menu
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-slate-200 to-transparent" />
            </div>
          )}
          <nav className="space-y-1">
            {menuItems.map((item, index) => (
              <SidebarMenuItem
                key={item.id}
                item={item}
                level={0}
                index={index}
                collapsed={sidebarCollapsed}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* User section */}
        <div className="p-3">
          {!sidebarCollapsed ? (
            <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-white">
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-medium text-white">
                    {user?.name?.slice(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {user?.name || "User"}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {user?.client || "Guest"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 hover:shadow-sm"
                  onClick={handleLogout}
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-12 w-full rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          )}
        </div>
      </motion.aside>

      {/* Mobile Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed left-4 top-4 z-40 rounded-xl bg-white shadow-lg md:hidden"
        onClick={() => dispatch(setSidebarMobileOpen(true))}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarMobileOpen} onOpenChange={handleCloseMobile}>
        <SheetContent
          side="left"
          className="w-[300px] border-none bg-gradient-to-b from-slate-50 to-white p-0"
        >
          <SheetHeader className="h-16 px-4">
            <SheetTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-semibold text-slate-800">Service Plus</span>
                <p className="text-xs font-normal text-slate-400">Management Portal</p>
              </div>
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-4rem-5rem)] px-3">
            <div className="mb-3 flex items-center gap-2 px-3">
              <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Menu
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-slate-200 to-transparent" />
            </div>
            <nav className="space-y-1">
              {menuItems.map((item, index) => (
                <SidebarMenuItem
                  key={item.id}
                  item={item}
                  level={0}
                  index={index}
                  collapsed={false}
                  onNavigate={handleCloseMobile}
                />
              ))}
            </nav>
          </ScrollArea>

          {/* Mobile User section */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent p-3 pt-6">
            <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-white">
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-medium text-white">
                    {user?.name?.slice(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {user?.name || "User"}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {user?.client || "Guest"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 hover:shadow-sm"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
