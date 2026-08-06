"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchCompanies, fetchOpenJobsByMobile } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { statusPillClass } from "@/lib/status-colors";
import { ApiError, type Company, type CustomerJobs } from "@/lib/types";

const openJobsSchema = z.object({
  company: z.string().min(1, "Select a company"),
  mobile: z
    .string()
    .regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
});

type OpenJobsFormValues = z.infer<typeof openJobsSchema>;

export function OpenJobsForm() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesError, setCompaniesError] = useState(false);
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

  useEffect(() => {
    fetchCompanies()
      .then(setCompanies)
      .catch(() => setCompaniesError(true));
  }, []);

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
        <div className="space-y-1.5">
          <Label htmlFor="open-jobs-company">Company</Label>
          <Select
            value={watch("company")}
            onValueChange={(value) => setValue("company", value, { shouldValidate: true })}
          >
            <SelectTrigger id="open-jobs-company" className="w-full">
              <SelectValue
                placeholder={companiesError ? "Couldn't load companies" : "Select a company"}
              />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.company && (
            <p className="text-sm text-destructive">{errors.company.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="open-jobs-mobile">Mobile number</Label>
          <Input
            id="open-jobs-mobile"
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
          Find my open jobs
        </Button>
      </form>

      {notFound && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <SearchX className="size-4 shrink-0" />
          No open jobs found for that mobile number — please double-check it.
        </div>
      )}

      {result && (
        <div className="mt-6">
          <p className="text-sm font-medium">
            Hi {result.customerName}, here {result.jobs.length === 1 ? "is" : "are"} your open
            job{result.jobs.length === 1 ? "" : "s"}:
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <th className="w-10 px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Job no</th>
                  <th className="px-3 py-2 text-left font-medium">Device</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Job date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.jobs.map((job, index) => (
                  <tr key={job.jobNo} className="transition-colors hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">{job.jobNo}</td>
                    <td className="max-w-[11rem] px-3 py-2.5 break-words text-muted-foreground">
                      {job.deviceDetails ?? "—"}
                      {job.serialNo && (
                        <span className="mt-0.5 block text-xs">SN: {job.serialNo}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={statusPillClass(job.statusCode)}>{job.status}</Badge>
                      {job.statusDescription && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {job.statusDescription}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(job.jobDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
