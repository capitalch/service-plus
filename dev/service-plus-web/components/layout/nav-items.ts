import { Bot, PackageSearch, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export const navItems: NavItem[] = [
  { label: "Track repair", href: "/", icon: Wrench },
  { label: "Buy genuine parts", href: "/spare-parts", icon: PackageSearch },
  { label: "AI repair help", href: "/ai-repair-help", icon: Bot, badge: "Soon" },
];
