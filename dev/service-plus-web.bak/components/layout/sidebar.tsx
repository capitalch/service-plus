"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { navItems } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden shrink-0 border-r border-border/60 lg:block lg:w-64">
        <nav className="sticky top-18 flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border-l-2 py-2 pr-3 pl-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <Badge variant="outline" className="ml-auto shrink-0">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="sticky top-18 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md lg:hidden">
        <nav className="flex items-center gap-1 overflow-x-auto px-3 py-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
                {item.badge && (
                  <Badge variant="outline" className="ml-1">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
