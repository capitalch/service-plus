import { Bot, PackageSearch, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { usePartsAvailable } from "@/lib/companies";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Shown only while some company has Spare Parts Web switched on (lib/companies.ts). */
  needsParts?: boolean;
};

export const navItems: NavItem[] = [
  { label: "Track repair", href: "/", icon: Wrench },
  { label: "Buy genuine parts", href: "/spare-parts", icon: PackageSearch, needsParts: true },
  { label: "AI repair help", href: "/ai-repair-help", icon: Bot, badge: "Soon" },
];

/** The menu for the header and footer: spare parts only when some company offers them. */
export function useNavItems(): NavItem[] {
  const partsAvailable = usePartsAvailable() === true;
  return navItems.filter((item) => !item.needsParts || partsAvailable);
}
