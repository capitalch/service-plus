"use client";

import { motion } from "framer-motion";
import { Bot, Mail, MessageSquareText, Sparkles } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AiRepairHelpPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      <div className="pointer-events-none absolute top-10 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center"
      >
        <div className="relative">
          <motion.span
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-xl shadow-primary/30"
          >
            <Bot className="size-8" />
          </motion.span>
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-card shadow">
            <Sparkles className="size-3 text-primary" />
          </span>
        </div>

        <h1 className="mt-6 flex items-center justify-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          AI repair help
          <Badge variant="soft">Coming soon</Badge>
        </h1>

        <p className="mt-4 max-w-md text-muted-foreground">
          Describe a fault and get an instant estimate before you visit a center. We&apos;re
          building this now — check back soon.
        </p>

        <div className="mt-8 grid w-full max-w-md gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm">
            <MessageSquareText className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Describe a fault</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tell us what&apos;s wrong in plain language.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Instant estimate</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Know the likely fix and cost up front.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="outline">
            <Link href="/">
              <Mail className="size-4" />
              Back to tracking
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
