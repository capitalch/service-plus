import {
  LayoutDashboard,
  Component,
  FileText,
  Users,
  Ticket,
  ClipboardList,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  children?: MenuItem[];
}

export const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    id: "tickets",
    label: "Tickets",
    icon: Ticket,
    path: "/tickets",
  },
  {
    id: "components",
    label: "Shadcn Components",
    icon: Component,
    path: "/components",
  },
  {
    id: "example-forms",
    label: "Example Forms",
    icon: FileText,
    children: [
      {
        id: "customer-details",
        label: "Customer Details",
        icon: ClipboardList,
        path: "/example-forms/customer-details",
      },
      {
        id: "zod-form",
        label: "Zod Form",
        icon: FlaskConical,
        path: "/example-forms/zod-form",
      },
    ],
  },
  {
    id: "customer-portal",
    label: "Customer Portal",
    icon: Users,
    path: "/customer-portal",
  },
];
