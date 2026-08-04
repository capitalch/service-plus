"use client";

import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-20 pb-16 text-center">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-4xl font-semibold tracking-tight sm:text-5xl"
      >
        Track your repair, in seconds.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground"
      >
        Service Plus keeps you posted on every repair job across our service centers —
        no calls, no waiting.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-8"
      >
        <Button size="lg" asChild>
          <a href="#job-status">
            Check your repair status
            <ArrowDown className="size-4" />
          </a>
        </Button>
      </motion.div>
    </section>
  );
}
