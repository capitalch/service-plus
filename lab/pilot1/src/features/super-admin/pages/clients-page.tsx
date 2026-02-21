import { motion } from "framer-motion";
import {
  CheckCircle2Icon,
  MinusCircleIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
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
import { selectClients, updateClientStatus } from "../super-admin-slice";
import type { ClientType } from "../types";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    transition: { delay: i * 0.07, duration: 0.3, ease: "easeOut" as const },
    y: 0,
  }),
};

const handleEdit = (client: ClientType) => toast.info(`Editing ${client.clientName}`);
const handleView = (client: ClientType) => toast.info(`Viewing ${client.clientName}`);

export const ClientsPage = () => {
  const clients = useSelector(selectClients);
  const dispatch = useDispatch();
  const [search, setSearch] = useState("");

  const filtered = clients.filter(
    (c) =>
      c.clientName.toLowerCase().includes(search.toLowerCase()) ||
      c.clientCode.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = clients.filter((c) => c.status === "Active").length;
  const inactiveCount = clients.filter((c) => c.status === "Inactive").length;

  const handleAddClient = () => toast.info("Add Client clicked");

  const handleDisable = (client: ClientType) => {
    dispatch(updateClientStatus({ id: client.id, status: "Inactive" }));
    toast.success(`${client.clientName} has been disabled`);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);

  const statCards = [
    { icon: UsersIcon, iconClass: "text-slate-500", label: "Total Clients", value: clients.length },
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
            <h1 className="text-lg font-semibold text-slate-900">Clients</h1>
            <p className="text-sm text-slate-500">Manage all client accounts and their administrators.</p>
          </div>
          <Button onClick={handleAddClient} size="sm">
            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
            Add Client
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                custom={i}
                initial="hidden"
                animate="visible"
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
          {/* Search bar */}
          <div className="border-b px-4 py-3 sm:px-6">
            <div className="relative max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-8 text-sm"
                onChange={handleSearchChange}
                placeholder="Search by name or code…"
                value={search}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-600">Client Name</TableHead>
                  <TableHead className="hidden text-xs font-semibold text-slate-600 sm:table-cell">Client Code</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="hidden text-xs font-semibold text-slate-600 md:table-cell">Active Admins</TableHead>
                  <TableHead className="hidden text-xs font-semibold text-slate-600 md:table-cell">Inactive Admins</TableHead>
                  <TableHead className="hidden text-xs font-semibold text-slate-600 lg:table-cell">Created On</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell className="py-8 text-center text-sm text-slate-400" colSpan={7}>
                      No clients match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((client) => (
                    <TableRow className="hover:bg-slate-50/60" key={client.id}>
                      <TableCell className="font-medium text-slate-900">
                        <div>{client.clientName}</div>
                        <div className="mt-0.5 text-xs text-slate-400 sm:hidden">{client.clientCode}</div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-slate-600 sm:table-cell">{client.clientCode}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            client.status === "Active"
                              ? "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                              : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100"
                          }
                          variant="outline"
                        >
                          {client.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-sm text-slate-700 md:table-cell">{client.activeAdminCount}</TableCell>
                      <TableCell className="hidden text-sm text-slate-700 md:table-cell">{client.inactiveAdminCount}</TableCell>
                      <TableCell className="hidden text-sm text-slate-600 lg:table-cell">{client.createdDate}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button className="h-7 w-7" size="icon" variant="ghost">
                              <MoreHorizontalIcon className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => handleView(client)}>View</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(client)}>Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-slate-600"
                              disabled={client.status === "Inactive"}
                              onClick={() => handleDisable(client)}
                            >
                              Disable
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
