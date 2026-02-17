import { motion } from 'framer-motion';

/**
 * Example component demonstrating project conventions
 * - Arrow function for components (as per claude.md)
 * - Framer Motion for animations
 */
export const ComponentExample = () => {
  return (
    // <motion.div
    //   initial={{ opacity: 0, y: 20 }}
    //   animate={{ opacity: 1, y: 0 }}
    //   transition={{ duration: 0.5 }}
    //   className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 p-4"
    // >
      <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-lg">
        <h1 className="mb-4 text-3xl font-bold text-neutral-900">
          Service Plus Client
        </h1>
        <p className="mb-6 text-neutral-600">
          Modern React application with TypeScript, Redux, Apollo GraphQL, and more.
        </p>

        <div className="space-y-4">
          <div className="rounded-md bg-neutral-50 p-4">
            <h2 className="mb-2 text-lg font-semibold text-neutral-900">Tech Stack</h2>
            <ul className="list-inside list-disc space-y-1 text-sm text-neutral-600">
              <li>React 19 + TypeScript</li>
              <li>Redux Toolkit + RTK Query</li>
              <li>Apollo Client + GraphQL</li>
              <li>React Router v7</li>
              <li>React Hook Form + Zod</li>
              <li>shadcn/ui + Tailwind CSS</li>
              <li>Framer Motion</li>
            </ul>
          </div>

          <div className="rounded-md border border-neutral-200 bg-white p-4">
            <h2 className="mb-2 text-lg font-semibold text-neutral-900">Development Guidelines</h2>
            <ul className="list-inside list-disc space-y-1 text-sm text-neutral-600">
              <li>Arrow functions for components and hooks</li>
              <li>Normal functions for utilities and API helpers</li>
              <li>Centralized messages in constants</li>
              <li>Red color only for errors and required field indicators</li>
              <li>GraphQL with auth headers for protected routes</li>
            </ul>
          </div>
        </div>
      </div>
    // </motion.div>
  );
};
