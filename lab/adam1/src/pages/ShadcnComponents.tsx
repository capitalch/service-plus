import { motion } from "framer-motion";
import { ComponentExample } from "@/components/component-example";

export function ShadcnComponents() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Shadcn Components</h1>
        <p className="text-muted-foreground mt-2">
          A showcase of available UI components built with shadcn/ui.
        </p>
      </div>

      <ComponentExample />
    </motion.div>
  );
}
