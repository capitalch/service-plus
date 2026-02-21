import { motion } from "framer-motion";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { selectClients, updateClientStatus } from "../super-admin-slice";
import type { ClientType } from "../types";

const handleEdit = (client: ClientType) => {
  toast.info(`Editing ${client.clientName}`);
};

const handleView = (client: ClientType) => {
  toast.info(`Viewing ${client.clientName}`);
};

export const ClientOverviewTable = () => {
  const clients = useSelector(selectClients);
  const dispatch = useDispatch();

  const handleAddClient = () => {
    toast.info("Add Client clicked");
  };

  const handleDisable = (client: ClientType) => {
    dispatch(updateClientStatus({ id: client.id, status: "Inactive" }));
    toast.success(`${client.clientName} has been disabled`);
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border bg-white shadow-sm"
      initial={{ opacity: 0, y: 12 }}
      transition={{ delay: 0.2, duration: 0.35, ease: "easeOut" }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Client Overview
        </h2>
        <Button onClick={handleAddClient} size="sm">
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          Add Client
        </Button>
      </div>

      {/* Scrollable table wrapper */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              {/* Always visible */}
              <TableHead className="text-xs font-semibold text-slate-600">
                Client Name
              </TableHead>
              {/* Hidden on xs, visible sm+ */}
              <TableHead className="hidden text-xs font-semibold text-slate-600 sm:table-cell">
                Client Code
              </TableHead>
              {/* Always visible */}
              <TableHead className="text-xs font-semibold text-slate-600">
                Status
              </TableHead>
              {/* Hidden on xs/sm, visible md+ */}
              <TableHead className="hidden text-xs font-semibold text-slate-600 md:table-cell">
                Active Admins
              </TableHead>
              {/* Hidden on xs/sm, visible md+ */}
              <TableHead className="hidden text-xs font-semibold text-slate-600 md:table-cell">
                Inactive Admins
              </TableHead>
              {/* Hidden on xs/sm/md, visible lg+ */}
              <TableHead className="hidden text-xs font-semibold text-slate-600 lg:table-cell">
                Created On
              </TableHead>
              {/* Always visible */}
              <TableHead className="text-xs font-semibold text-slate-600">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow className="hover:bg-slate-50/60" key={client.id}>
                {/* Always visible */}
                <TableCell className="font-medium text-slate-900">
                  <div>{client.clientName}</div>
                  {/* Show code inline on xs only */}
                  <div className="mt-0.5 text-xs text-slate-400 sm:hidden">
                    {client.clientCode}
                  </div>
                </TableCell>

                {/* Hidden on xs */}
                <TableCell className="hidden text-sm text-slate-600 sm:table-cell">
                  {client.clientCode}
                </TableCell>

                {/* Always visible */}
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

                {/* Hidden on xs/sm */}
                <TableCell className="hidden text-sm text-slate-700 md:table-cell">
                  {client.activeAdminCount}
                </TableCell>

                {/* Hidden on xs/sm */}
                <TableCell className="hidden text-sm text-slate-700 md:table-cell">
                  {client.inactiveAdminCount}
                </TableCell>

                {/* Hidden on xs/sm/md */}
                <TableCell className="hidden text-sm text-slate-600 lg:table-cell">
                  {client.createdDate}
                </TableCell>

                {/* Always visible */}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="h-7 w-7" size="icon" variant="ghost">
                        <MoreHorizontalIcon className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => handleView(client)}>
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(client)}>
                        Edit
                      </DropdownMenuItem>
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
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
};
