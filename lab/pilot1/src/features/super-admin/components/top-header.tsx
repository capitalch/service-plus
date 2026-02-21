import { motion } from "framer-motion";
import { LogOutIcon, MenuIcon, UserCircleIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

type TopHeaderPropsType = {
  onMenuToggle: () => void;
};

export const TopHeader = ({ onMenuToggle }: TopHeaderPropsType) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/");
  };

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

        <h1 className="text-sm font-semibold text-slate-900 sm:text-base">
          SuperAdmin Dashboard
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
