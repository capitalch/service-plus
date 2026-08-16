"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, SearchX } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanySelect } from "@/components/shared/company-select";
import { fetchJobStatus } from "@/lib/api";
import { ApiError, type JobStatus } from "@/lib/types";

import { JobStatusResult } from "./job-status-result";

const jobStatusSchema = z.object({
  company: z.string().min(1, "Select a company"),
  jobNo: z.string().min(1, "Enter your job number"),
  mobile: z
    .string()
    .regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
});

type JobStatusFormValues = z.infer<typeof jobStatusSchema>;

export function JobStatusForm() {
  const [result, setResult] = useState<JobStatus | null>(null);
  const [notFound, setNotFound] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<JobStatusFormValues>({
    resolver: zodResolver(jobStatusSchema),
    defaultValues: { company: "", jobNo: "", mobile: "" },
  });

  const onSubmit = async (values: JobStatusFormValues) => {
    setResult(null);
    setNotFound(false);
    try {
      const jobStatus = await fetchJobStatus(values);
      setResult(jobStatus);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setNotFound(true);
      } else {
        toast.error("Something went wrong. Please try again in a moment.");
      }
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <CompanySelect
          value={watch("company")}
          onChange={(value) => setValue("company", value, { shouldValidate: true })}
          error={errors.company?.message}
        />

        <div className="space-y-1.5">
          <Label htmlFor="jobNo">Job number</Label>
          <Input id="jobNo" placeholder="e.g. J/00001" {...register("jobNo")} />
          {errors.jobNo && (
            <p className="text-sm text-destructive">{errors.jobNo.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mobile">Mobile number</Label>
          <Input
            id="mobile"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile number"
            {...register("mobile")}
          />
          {errors.mobile && (
            <p className="text-sm text-destructive">{errors.mobile.message}</p>
          )}
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Check status
        </Button>
      </form>

      {notFound && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <SearchX className="size-4 shrink-0" />
          No job found for that job number and mobile number — please double-check both.
        </div>
      )}

      {result && (
        <div className="mt-6">
          <JobStatusResult result={result} />
        </div>
      )}
    </div>
  );
}
