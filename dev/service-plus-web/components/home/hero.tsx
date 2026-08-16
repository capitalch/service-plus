"use client";

import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, PackageSearch, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusPillClass } from "@/lib/status-colors";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_35%,transparent_75%)]" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute top-10 -right-24 h-72 w-72 rounded-full bg-[oklch(0.48_0.21_292)]/10 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-6 lg:pt-24">
        <div>
          <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show">
            <Badge variant="soft" className="gap-1.5 px-3 py-1">
              <Sparkles className="size-3" />
              Service partner, reimagined
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            initial="hidden"
            animate="show"
            className="mt-5 text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Your repair,{" "}
            <span className="text-gradient-brand">tracked end to end.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            initial="hidden"
            animate="show"
            className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            Check your device&apos;s repair status in seconds, browse genuine spare parts from
            your nearest service center, and get expert help before you visit.
          </motion.p>

          <motion.div
            variants={fadeUp}
            custom={3}
            initial="hidden"
            animate="show"
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="group">
              <Link href="/#job-status">
                Track your repair
                <ArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/spare-parts">
                <PackageSearch />
                Browse spare parts
              </Link>
            </Button>
          </motion.div>

          <motion.ul
            variants={fadeUp}
            custom={4}
            initial="hidden"
            animate="show"
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            {["No login needed", "Genuine parts", "Fast & free lookup"].map((point) => (
              <li key={point} className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" />
                {point}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* Status mock card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.6, ease: "easeOut" }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-brand opacity-15 blur-2xl" />
          <div className="relative rounded-2xl border border-border/60 bg-card/90 p-5 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Job J/01234</p>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusPillClass("IN_PROGRESS"))}>
                In service
              </span>
            </div>

            <div className="mt-5 flex items-center justify-between">
              {["Received", "In service", "Ready", "Delivered"].map((stage, i) => (
                <div key={stage} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full items-center">
                    <div className={cn("h-0.5 flex-1", i < 2 ? "bg-gradient-brand" : "bg-muted")} />
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                        i === 1 ? "bg-gradient-brand text-white shadow-md" : i < 1 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i === 1 ? <BadgeCheck className="size-3.5" /> : i + 1}
                    </span>
                    <div className={cn("h-0.5 flex-1", i < 1 ? "bg-gradient-brand" : "bg-muted")} />
                  </div>
                  <span className={cn("text-[11px]", i === 1 ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {stage}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3 border-t border-border/60 pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Device</span>
                <span className="font-medium">Pixel 8 · Pro</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Job date</span>
                <span className="font-medium">12 Aug 2026</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estimated delivery</span>
                <span className="font-medium">17 Aug 2026</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
