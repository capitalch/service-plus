import { AnimatePresence, motion } from "framer-motion";
import {
  ActivityIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";

type NavItemType = {
  href: string;
  icon: React.ElementType;
  label: string;
};

type SuperAdminSidebarPropsType = {
  isMobileOpen: boolean;
  onMobileClose: () => void;
};

const navItems: NavItemType[] = [
  { href: "/super-admin", icon: LayoutDashboardIcon, label: "Dashboard" },
  { href: "/super-admin/clients", icon: UsersIcon, label: "Clients" },
  { href: "/super-admin/admins", icon: ShieldIcon, label: "Admins" },
  { href: "/super-admin/usage", icon: ActivityIcon, label: "Usage & Health" },
  {
    href: "/super-admin/audit",
    icon: ClipboardListIcon,
    label: "Audit Logs",
  },
  {
    href: "/super-admin/settings",
    icon: SettingsIcon,
    label: "System Settings",
  },
];

const SidebarContent = ({
  collapsed,
  isMobile,
  onNavClick,
  onToggleCollapse,
}: {
  collapsed: boolean;
  isMobile: boolean;
  onNavClick: (href: string) => void;
  onToggleCollapse?: () => void;
}) => {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-slate-900">
          <ShieldIcon className="h-4 w-4 text-white" />
        </div>
        {(!collapsed || isMobile) && (
          <motion.span
            animate={{ opacity: 1 }}
            className="truncate text-sm font-semibold text-slate-900"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            SuperAdmin
          </motion.span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
              key={item.href}
              onClick={() => onNavClick(item.href)}
              title={collapsed && !isMobile ? item.label : undefined}
              type="button"
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {(!collapsed || isMobile) && (
                <motion.span
                  animate={{ opacity: 1 }}
                  className="truncate"
                  initial={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {item.label}
                </motion.span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle — desktop only */}
      {!isMobile && onToggleCollapse && (
        <button
          className="flex items-center justify-center border-t p-3 text-slate-500 hover:text-slate-900"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.25 }}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M15 19l-7-7 7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </motion.div>
        </button>
      )}
    </div>
  );
};

export const SuperAdminSidebar = ({ isMobileOpen, onMobileClose }: SuperAdminSidebarPropsType) => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleNavClick = (href: string) => {
    navigate(href);
    onMobileClose();
  };

  const handleToggleCollapse = () => {
    setCollapsed((prev) => !prev);
  };

  return (
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        className="relative hidden h-full flex-shrink-0 flex-col border-r bg-white md:flex"
        initial={{ width: 220 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        <SidebarContent
          collapsed={collapsed}
          isMobile={false}
          onNavClick={handleNavClick}
          onToggleCollapse={handleToggleCollapse}
        />
      </motion.aside>

      {/* ── Mobile drawer overlay (< md) ── */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={onMobileClose}
              transition={{ duration: 0.2 }}
            />

            {/* Drawer */}
            <motion.aside
              animate={{ x: 0 }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white shadow-xl md:hidden"
              exit={{ x: "-100%" }}
              initial={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {/* Close button */}
              <button
                className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:text-slate-900"
                onClick={onMobileClose}
                type="button"
              >
                <XIcon className="h-4 w-4" />
              </button>

              <SidebarContent
                collapsed={false}
                isMobile={true}
                onNavClick={handleNavClick}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
