import { z } from "zod";

export const updateJobFormSchema = z.object({
  job_status_id: z.string().min(1, "Job status is required"),
  technician_id: z.string().optional(),
  diagnosis: z.string().optional(),
  work_done: z.string().optional(),
  amount: z.string().optional(),
  delivery_date: z.string().optional(),
  is_closed: z.boolean().default(false),
  is_final: z.boolean().default(false),
  remarks: z.string().optional(),
  transaction_notes: z.string().optional(),
});

export type UpdateJobFormValues = z.infer<typeof updateJobFormSchema>;

export const getUpdateJobDefaultValues = (): UpdateJobFormValues => ({
  job_status_id: "",
  technician_id: "",
  diagnosis: "",
  work_done: "",
  amount: "",
  delivery_date: "",
  is_closed: false,
  is_final: false,
  remarks: "",
  transaction_notes: "",
});
