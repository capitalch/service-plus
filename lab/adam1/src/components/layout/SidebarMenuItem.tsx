import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import type { MenuItem } from "@/config/menu-config";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Multicolor palette for menu items
const menuColors = [
  { bg: "bg-violet-100", text: "text-violet-600", activeBg: "bg-violet-100" },
  { bg: "bg-blue-100", text: "text-blue-600", activeBg: "bg-blue-100" },
  { bg: "bg-emerald-100", text: "text-emerald-600", activeBg: "bg-emerald-100" },
  { bg: "bg-amber-100", text: "text-amber-600", activeBg: "bg-amber-100" },
  { bg: "bg-rose-100", text: "text-rose-600", activeBg: "bg-rose-100" },
  { bg: "bg-cyan-100", text: "text-cyan-600", activeBg: "bg-cyan-100" },
  { bg: "bg-purple-100", text: "text-purple-600", activeBg: "bg-purple-100" },
  { bg: "bg-orange-100", text: "text-orange-600", activeBg: "bg-orange-100" },
];

interface SidebarMenuItemProps {
  item: MenuItem;
  level: number;
  index?: number;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarMenuItem({
  item,
  level,
  index = 0,
  collapsed = false,
  onNavigate,
}: SidebarMenuItemProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const hasChildren = item.children && item.children.length > 0;
  const color = menuColors[index % menuColors.length];

  // Check if any child is active
  const isChildActive = hasChildren
    ? item.children!.some((child) => location.pathname === child.path)
    : false;

  const isActive = item.path
    ? location.pathname === item.path ||
      (item.path === "/dashboard" && location.pathname === "/")
    : isChildActive;

  // Auto-open when child is active
  const [isOpen, setIsOpen] = useState(isChildActive);

  // Keep menu open when navigating to child routes
  useEffect(() => {
    if (isChildActive && !isOpen) {
      setIsOpen(true);
    }
  }, [isChildActive, isOpen]);

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    } else if (item.path) {
      navigate({ to: item.path });
      onNavigate?.();
    }
  };

  const Icon = item.icon;

  // Collapsed state - show only icon with tooltip
  if (collapsed && level === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className={cn(
              "flex h-11 w-full items-center justify-center rounded-xl transition-all",
              isActive
                ? cn(color.activeBg, color.text)
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                color.bg, color.text
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Child item styling
  if (level > 0) {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "flex h-9 w-full items-center gap-3 rounded-lg pl-11 pr-3 text-sm transition-all",
          isActive
            ? "bg-slate-100 font-medium text-slate-900"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        )}
      >
        <span className="truncate">{item.label}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm transition-all",
          isActive
            ? cn(color.activeBg, "text-slate-800")
            : "text-slate-600 hover:bg-slate-50"
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            color.bg, color.text
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <span className={cn(
          "flex-1 truncate text-left",
          isActive ? "font-semibold" : "font-medium"
        )}>
          {item.label}
        </span>
        {hasChildren && (
          <ChevronRight
            className={cn(
              "h-4 w-4 text-slate-400 transition-transform",
              isOpen && "rotate-90"
            )}
          />
        )}
      </button>

      {/* Children */}
      {hasChildren && isOpen && (
        <div className="mt-1 space-y-0.5 pl-3">
          <div className="relative">
            <div className="absolute bottom-2 left-[18px] top-2 w-px bg-slate-200" />
            <div className="space-y-0.5">
              {item.children!.map((child, childIndex) => (
                <SidebarMenuItem
                  key={child.id}
                  item={child}
                  level={level + 1}
                  index={childIndex}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
