import { Bot, PackageSearch, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export const navItems: NavItem[] = [
  { label: "Job status", href: "/", icon: Wrench },
  { label: "Buy Genuine parts", href: "/spare-parts", icon: PackageSearch },
  { label: "AI repair help", href: "/ai-repair-help", icon: Bot, badge: "Soon" },
];
