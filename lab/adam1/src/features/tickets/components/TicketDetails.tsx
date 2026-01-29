import { useAppDispatch, useAppSelector } from "@/app/store";
import { closeTicketDetail, openTicketForm } from "../ticket.slice";
import { useDeleteTicket } from "../hooks/useTickets";
import { useRBAC } from "@/hooks/useRBAC";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, User, Wrench, Clock, AlertCircle } from "lucide-react";

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  pending: "bg-orange-100 text-orange-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-purple-100 text-purple-800",
};

export function TicketDetails() {
  const dispatch = useAppDispatch();
  const { isDetailOpen, selectedTicket } = useAppSelector((state) => state.ticket);
  const { remove, loading: deleteLoading } = useDeleteTicket();
  const { hasPermission } = useRBAC();

  const canEdit = hasPermission("tickets:write");
  const canDelete = hasPermission("tickets:delete");

  const handleClose = () => {
    dispatch(closeTicketDetail());
  };

  const handleEdit = () => {
    if (selectedTicket) {
      dispatch(closeTicketDetail());
      dispatch(openTicketForm(selectedTicket));
    }
  };

  const handleDelete = async () => {
    if (selectedTicket && confirm("Are you sure you want to delete this ticket?")) {
      await remove(selectedTicket.id);
      dispatch(closeTicketDetail());
    }
  };

  if (!selectedTicket) return null;

  return (
    <Dialog open={isDetailOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{selectedTicket.title}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Ticket #{selectedTicket.id.slice(0, 8)}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge className={statusColors[selectedTicket.status]}>
                {selectedTicket.status.replace("_", " ")}
              </Badge>
              <Badge className={priorityColors[selectedTicket.priority]}>
                {selectedTicket.priority}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Description</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {selectedTicket.description}
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Client</p>
                <p className="text-sm font-medium">{selectedTicket.clientId}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Technician</p>
                <p className="text-sm font-medium">
                  {selectedTicket.technicianId || "Unassigned"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-medium">
                  {new Date(selectedTicket.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="text-sm font-medium">
                  {new Date(selectedTicket.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {selectedTicket.dueDate && (
              <div className="flex items-center gap-2 col-span-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="text-sm font-medium">
                    {new Date(selectedTicket.dueDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {canDelete && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="text-destructive hover:text-destructive"
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          )}
          {canEdit && (
            <Button onClick={handleEdit}>Edit Ticket</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
