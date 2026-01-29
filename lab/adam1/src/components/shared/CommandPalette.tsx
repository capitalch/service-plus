import { useEffect } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { setCommandPaletteOpen } from "@/stores/ui.slice";
import {
  LayoutDashboard,
  Component,
  FileText,
  Users,
  Ticket,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

export function CommandPalette() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.ui.commandPaletteOpen);
  const { logout } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        dispatch(setCommandPaletteOpen(!open));
      }
      if (e.key === "Escape") {
        dispatch(setCommandPaletteOpen(false));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, open]);

  const handleSelect = (callback: () => void) => {
    callback();
    dispatch(setCommandPaletteOpen(false));
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => dispatch(setCommandPaletteOpen(false))}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/4 z-50 w-full max-w-lg -translate-x-1/2"
          >
            <Command className="bg-background rounded-lg border shadow-lg">
              <Command.Input
                placeholder="Type a command or search..."
                className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none"
              />
              <Command.List className="max-h-80 overflow-y-auto p-2">
                <Command.Empty className="text-muted-foreground py-6 text-center text-sm">
                  No results found.
                </Command.Empty>

                <Command.Group
                  heading="Navigation"
                  className="text-muted-foreground px-2 py-1.5 text-xs"
                >
                  <Command.Item
                    onSelect={() =>
                      handleSelect(() => navigate({ to: "/dashboard" }))
                    }
                    className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-2"
                  >
                    <LayoutDashboard className="h-4 w-4 text-blue-600" />
                    Dashboard
                  </Command.Item>
                  <Command.Item
                    onSelect={() =>
                      handleSelect(() => navigate({ to: "/tickets" }))
                    }
                    className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-2"
                  >
                    <Ticket className="h-4 w-4 text-rose-600" />
                    Tickets
                  </Command.Item>
                  <Command.Item
                    onSelect={() =>
                      handleSelect(() => navigate({ to: "/components" }))
                    }
                    className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-2"
                  >
                    <Component className="h-4 w-4 text-violet-600" />
                    Shadcn Components
                  </Command.Item>
                  <Command.Item
                    onSelect={() =>
                      handleSelect(() => navigate({ to: "/example-form" }))
                    }
                    className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-2"
                  >
                    <FileText className="h-4 w-4 text-emerald-500" />
                    Example Form
                  </Command.Item>
                  <Command.Item
                    onSelect={() =>
                      handleSelect(() => navigate({ to: "/customer-portal" }))
                    }
                    className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-2"
                  >
                    <Users className="h-4 w-4 text-amber-500" />
                    Customer Portal
                  </Command.Item>
                </Command.Group>

                <Command.Separator className="bg-border my-2 h-px" />

                <Command.Group
                  heading="Actions"
                  className="text-muted-foreground px-2 py-1.5 text-xs"
                >
                  <Command.Item
                    onSelect={() => handleSelect(() => console.log("Settings"))}
                    className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-2"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelect(logout)}
                    className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
