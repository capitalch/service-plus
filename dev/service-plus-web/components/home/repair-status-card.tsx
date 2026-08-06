"use client";

import { Wrench } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { JobStatusForm } from "./job-status-form";
import { OpenJobsForm } from "./open-jobs-form";

export function RepairStatusCard() {
  return (
    <div id="job-status" className="mx-auto w-full max-w-2xl">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wrench className="size-5" />
            </span>
            <div>
              <CardTitle>Check your repair status</CardTitle>
              <CardDescription>
                Look up a single job, or find every open job under your mobile number.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="job-number">
            <TabsList className="w-full">
              <TabsTrigger value="job-number">By job number</TabsTrigger>
              <TabsTrigger value="mobile">By mobile number</TabsTrigger>
            </TabsList>
            <TabsContent value="job-number">
              <JobStatusForm />
            </TabsContent>
            <TabsContent value="mobile">
              <OpenJobsForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
