import { motion } from "framer-motion";
import { ArrowLeftIcon, LogOutIcon, MenuIcon, UserCircleIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

const PAGE_TITLES: Record<string, string> = {
  "/super-admin": "Dashboard",
  "/super-admin/admins": "Admins",
  "/super-admin/audit": "Audit Logs",
  "/super-admin/clients": "Clients",
  "/super-admin/settings": "System Settings",
  "/super-admin/usage": "Usage & Health",
};

type TopHeaderPropsType = {
  onMenuToggle: () => void;
};

export const TopHeader = ({ onMenuToggle }: TopHeaderPropsType) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/");
  };

  const pageTitle = PAGE_TITLES[location.pathname] ?? "SuperAdmin";

  return (
    <motion.header
      animate={{ opacity: 1, y: 0 }}
      className="flex h-14 items-center justify-between border-b bg-white px-4 sm:px-6"
      initial={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <Button
          className="md:hidden"
          onClick={onMenuToggle}
          size="icon"
          variant="ghost"
        >
          <MenuIcon className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>

        {/* Back to Home */}
        <Button
          className="hidden items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 md:flex"
          onClick={() => navigate("/")}
          size="sm"
          variant="ghost"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Home
        </Button>
        <div className="hidden h-4 w-px bg-slate-200 md:block" />

        <h1 className="text-sm font-semibold text-slate-900 sm:text-base">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 text-sm text-slate-600 sm:flex">
          <UserCircleIcon className="h-6 w-6 text-slate-400" />
          <span className="font-medium">Admin</span>
        </div>
        <Button onClick={handleLogout} size="sm" variant="outline">
          <LogOutIcon className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </motion.header>
  );
};
