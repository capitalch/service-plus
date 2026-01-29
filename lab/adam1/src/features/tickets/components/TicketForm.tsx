import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { closeTicketForm } from "../ticket.slice";
import { useCreateTicket, useUpdateTicket } from "../hooks/useTickets";
import { createTicketSchema, type CreateTicketFormData } from "../schemas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function TicketForm() {
  const dispatch = useAppDispatch();
  const { isFormOpen, selectedTicket } = useAppSelector((state) => state.ticket);
  const { create, loading: createLoading } = useCreateTicket();
  const { update, loading: updateLoading } = useUpdateTicket();

  const isEditing = !!selectedTicket;
  const isLoading = createLoading || updateLoading;

  const form = useForm<CreateTicketFormData>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      clientId: "",
      technicianId: "",
      dueDate: "",
    },
  });

  useEffect(() => {
    if (selectedTicket) {
      form.reset({
        title: selectedTicket.title,
        description: selectedTicket.description,
        priority: selectedTicket.priority,
        clientId: selectedTicket.clientId,
        technicianId: selectedTicket.technicianId || "",
        dueDate: selectedTicket.dueDate || "",
      });
    } else {
      form.reset({
        title: "",
        description: "",
        priority: "medium",
        clientId: "",
        technicianId: "",
        dueDate: "",
      });
    }
  }, [selectedTicket, form]);

  const onSubmit = async (data: CreateTicketFormData) => {
    if (isEditing && selectedTicket) {
      await update({ id: selectedTicket.id, ...data });
    } else {
      await create(data);
    }
    dispatch(closeTicketForm());
  };

  const handleClose = () => {
    dispatch(closeTicketForm());
    form.reset();
  };

  return (
    <Dialog open={isFormOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Ticket" : "Create New Ticket"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter ticket title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the issue..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <FormControl>
                    <Input placeholder="Select client" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="technicianId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign Technician (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Select technician" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    {isEditing ? "Updating..." : "Creating..."}
                  </span>
                ) : isEditing ? (
                  "Update Ticket"
                ) : (
                  "Create Ticket"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
