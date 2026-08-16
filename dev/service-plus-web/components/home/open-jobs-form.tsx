"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { CalendarClock, Loader2, SearchX, Smartphone } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanySelect } from "@/components/shared/company-select";
import { fetchOpenJobsByMobile } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { statusPillClass } from "@/lib/status-colors";
import { ApiError, type CustomerJobs } from "@/lib/types";
import { cn } from "@/lib/utils";

const openJobsSchema = z.object({
  company: z.string().min(1, "Select a company"),
  mobile: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
});

type OpenJobsFormValues = z.infer<typeof openJobsSchema>;

export function OpenJobsForm() {
  const [result, setResult] = useState<CustomerJobs | null>(null);
  const [notFound, setNotFound] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OpenJobsFormValues>({
    resolver: zodResolver(openJobsSchema),
    defaultValues: { company: "", mobile: "" },
  });

  const onSubmit = async (values: OpenJobsFormValues) => {
    setResult(null);
    setNotFound(false);
    try {
      const customerJobs = await fetchOpenJobsByMobile(values);
      setResult(customerJobs);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setNotFound(true);
      } else {
        toast.error("Something went wrong. Please try again in a moment.");
      }
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="mx-auto w-full max-w-sm space-y-4">
        <CompanySelect
          id="open-jobs-company"
          value={watch("company")}
          onChange={(value) => setValue("company", value, { shouldValidate: true })}
          error={errors.company?.message}
        />

        <div className="space-y-1.5">
          <Label htmlFor="open-jobs-mobile">Mobile number</Label>
          <Input
            id="open-jobs-mobile"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile number"
            autoComplete="off"
            {...register("mobile")}
          />
          {errors.mobile && <p className="text-sm text-destructive">{errors.mobile.message}</p>}
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Find my open jobs
        </Button>
      </form>

      {notFound && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          <SearchX className="size-4 shrink-0" />
          No open jobs found for that mobile number — please double-check it.
        </motion.div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <p className="text-sm font-medium">
            Hi {result.customerName}, here {result.jobs.length === 1 ? "is" : "are"} your open
            job{result.jobs.length === 1 ? "" : "s"}:
          </p>

          {/* Desktop table */}
          <div className="mt-3 hidden overflow-hidden rounded-xl border border-border/70 sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/50 text-xs text-muted-foreground">
                  <th className="w-10 px-4 py-2.5 text-left font-medium">#</th>
                  <th className="px-3 py-2.5 text-left font-medium">Job no</th>
                  <th className="px-3 py-2.5 text-left font-medium">Device</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Job date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {result.jobs.map((job, index) => (
                  <tr key={job.jobNo} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-3 font-medium whitespace-nowrap">{job.jobNo}</td>
                    <td className="max-w-[11rem] px-3 py-3 break-words text-muted-foreground">
                      {job.deviceDetails ?? "—"}
                      {job.serialNo && (
                        <span className="mt-0.5 block text-xs">SN: {job.serialNo}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge className={statusPillClass(job.statusCode)}>{job.status}</Badge>
                      {job.statusDescription && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {job.statusDescription}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(job.jobDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-3 space-y-3 sm:hidden">
            {result.jobs.map((job, index) => (
              <div
                key={job.jobNo}
                className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">
                    <span className="mr-1 text-muted-foreground">#{index + 1}</span>
                    {job.jobNo}
                  </p>
                  <Badge className={statusPillClass(job.statusCode)}>{job.status}</Badge>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <Smartphone className="mt-0.5 size-4 shrink-0" />
                    {job.deviceDetails ?? "—"}
                    {job.serialNo && <span className="block text-xs">SN: {job.serialNo}</span>}
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <CalendarClock className="size-4 shrink-0" />
                    {formatDate(job.jobDate)}
                  </p>
                  {job.statusDescription && (
                    <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {job.statusDescription}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
