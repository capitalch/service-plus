import { motion } from "framer-motion";
import {
  CheckCircle2Icon,
  MinusCircleIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
} from "lucide-react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { SuperAdminLayout } from "../components/super-admin-layout";
import { selectAdminUsers, updateAdminUserStatus } from "../super-admin-slice";
import type { AdminUserRoleType, AdminUserType } from "../types";

const roleStyles: Record<AdminUserRoleType, string> = {
  ClientAdmin: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50",
  SuperAdmin: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50",
  Viewer: "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    transition: { delay: i * 0.07, duration: 0.3, ease: "easeOut" as const },
    y: 0,
  }),
};

const handleEdit = (user: AdminUserType) => toast.info(`Editing ${user.name}`);
const handleView = (user: AdminUserType) => toast.info(`Viewing ${user.name}`);

export const AdminsPage = () => {
  const adminUsers = useSelector(selectAdminUsers);
  const dispatch = useDispatch();
  const [search, setSearch] = useState("");

  const activeCount = adminUsers.filter((u) => u.status === "Active").length;
  const inactiveCount = adminUsers.filter((u) => u.status === "Inactive").length;

  const filtered = adminUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.clientName.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddAdmin = () => toast.info("Add Admin clicked");

  const handleDeactivate = (user: AdminUserType) => {
    dispatch(updateAdminUserStatus({ id: user.id, status: "Inactive" }));
    toast.success(`${user.name} has been deactivated`);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);

  const statCards = [
    { icon: ShieldIcon, iconClass: "text-slate-500", label: "Total Admins", value: adminUsers.length },
    { icon: CheckCircle2Icon, iconClass: "text-emerald-500", label: "Active", value: activeCount },
    { icon: MinusCircleIcon, iconClass: "text-slate-400", label: "Inactive", value: inactiveCount },
  ];

  return (
    <SuperAdminLayout>
      <motion.div
        animate={{ opacity: 1 }}
        className="flex flex-col gap-6"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Admins</h1>
            <p className="text-sm text-slate-500">Manage administrator accounts, roles, and permissions.</p>
          </div>
          <Button onClick={handleAddAdmin} size="sm">
            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
            Add Admin
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                animate="visible"
                custom={i}
                initial="hidden"
                key={card.label}
                variants={cardVariants}
              >
                <Card className="border shadow-sm">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-500">{card.label}</p>
                      <Icon className={`h-4 w-4 ${card.iconClass}`} />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Table card */}
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border bg-white shadow-sm"
          initial={{ opacity: 0, y: 12 }}
          transition={{ delay: 0.15, duration: 0.3, ease: "easeOut" }}
        >
          <div className="border-b px-4 py-3 sm:px-6">
            <div className="relative max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-8 text-sm"
                onChange={handleSearchChange}
                placeholder="Search by name, email, client…"
                value={search}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-600">Name</TableHead>
                  <TableHead className="hidden text-xs font-semibold text-slate-600 sm:table-cell">Email</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Role</TableHead>
                  <TableHead className="hidden text-xs font-semibold text-slate-600 md:table-cell">Client</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="hidden text-xs font-semibold text-slate-600 lg:table-cell">Last Login</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell className="py-8 text-center text-sm text-slate-400" colSpan={7}>
                      No admins match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user) => (
                    <TableRow className="hover:bg-slate-50/60" key={user.id}>
                      <TableCell className="font-medium text-slate-900">
                        <div>{user.name}</div>
                        <div className="mt-0.5 text-xs text-slate-400 sm:hidden">{user.email}</div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-slate-600 sm:table-cell">{user.email}</TableCell>
                      <TableCell>
                        <Badge className={roleStyles[user.role]} variant="outline">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-sm text-slate-600 md:table-cell">{user.clientName}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            user.status === "Active"
                              ? "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                              : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100"
                          }
                          variant="outline"
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-sm text-slate-600 lg:table-cell">{user.lastLoginDate}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button className="h-7 w-7" size="icon" variant="ghost">
                              <MoreHorizontalIcon className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => handleView(user)}>View</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(user)}>Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-slate-600"
                              disabled={user.status === "Inactive"}
                              onClick={() => handleDeactivate(user)}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      </motion.div>
    </SuperAdminLayout>
  );
};
