"use client";

import { motion } from "framer-motion";
import { Wrench } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { JobStatusForm } from "./job-status-form";
import { OpenJobsForm } from "./open-jobs-form";

export function RepairStatusCard() {
  return (
    <div id="job-status" className="mx-auto w-full max-w-2xl scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-md shadow-primary/25">
                <Wrench className="size-5" />
              </span>
              <div>
                <CardTitle className="text-lg">Check your repair status</CardTitle>
                <CardDescription>
                  Look up a single job, or find every open job under your mobile number.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="job-number">
              <TabsList className="w-full">
                <TabsTrigger value="job-number" className="flex-1">
                  By job number
                </TabsTrigger>
                <TabsTrigger value="mobile" className="flex-1">
                  By mobile number
                </TabsTrigger>
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
      </motion.div>
    </div>
  );
}
