# Complete shadcn/ui Tutorial with Tailwind CSS v4 and Zod (2025) - PNPM Edition
## ✅ Based on Official Documentation via Context7

## 📚 Table of Contents
1. [Introduction](#introduction)
2. [What's New in Tailwind v4?](#whats-new-in-tailwind-v4)
3. [What is shadcn/ui?](#what-is-shadcnui)
4. [Prerequisites](#prerequisites)
5. [Project Setup with PNPM](#project-setup-with-pnpm)
6. [Understanding the Architecture](#understanding-the-architecture)
7. [Your First Components](#your-first-components)
8. [Form Validation with Zod](#form-validation-with-zod)
9. [Complete Form Examples](#complete-form-examples)
10. [Best Practices](#best-practices)
11. [Common Issues & Solutions](#common-issues--solutions)

---

## 🎯 Introduction

This tutorial covers building modern React applications with **shadcn/ui**, **Tailwind CSS v4** (the latest version released January 2025), and **Zod** validation using **pnpm** as your package manager.

### What You'll Build
- ✅ Modern UI with shadcn/ui components
- ✅ Tailwind CSS v4 with new `@theme` directive
- ✅ Type-safe forms with React Hook Form + Zod
- ✅ Production-ready validation patterns
- ✅ Zero-configuration setup

---

## 🚀 What's New in Tailwind v4?

Tailwind CSS v4.0 (released January 22, 2025) brings major improvements:

### Key Changes

1. **🔥 5x Faster Full Builds** - New high-performance engine
2. **⚡ 100x Faster Incremental Builds** - Measured in microseconds
3. **🎨 No Configuration Required** - Zero config setup
4. **📦 Simplified Installation** - Just one line in your CSS file
5. **🎯 Automatic Content Detection** - No more `content` array!
6. **🔧 New @theme Directive** - Replace the old config file
7. **🌈 Modern CSS Features** - Cascade layers, `@property`, `color-mix()`
8. **⚛️ First-Party Vite Plugin** - Seamless integration

### Migration from v3

**Tailwind v3:**
```javascript
// tailwind.config.js (old way)
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'], // Manual configuration
  theme: {
    extend: {
      colors: {
        primary: '#3490dc',
      }
    }
  }
}
```

**Tailwind v4:**
```css
/* Just one line in your CSS file! */
@import "tailwindcss";

/* Add custom theme using @theme directive */
@theme {
  --color-primary: #3490dc;
}
```

No config file needed! 🎉

---

## 🤔 What is shadcn/ui?

**shadcn/ui is NOT a traditional component library!**

### The Key Difference

**Traditional Library:**
```bash
npm install some-ui-library
import { Button } from 'some-ui-library'
```
❌ Locked into library's API  
❌ Hard to customize deeply  
❌ Bundle includes unused code  

**shadcn/ui Approach:**
```bash
pnpm dlx shadcn@canary add button
```
✅ **Copies component source code to your project**  
✅ **Full ownership and control**  
✅ **Only include what you need**  
✅ **Customize anything**  

### Core Principles

1. **Open Code** - You get the actual component source code
2. **Composition** - Every component uses a consistent interface
3. **Distribution** - CLI tool for easy installation
4. **Beautiful Defaults** - Professional design out-of-the-box
5. **AI-Ready** - Open code that AI tools can understand

---

## 📋 Prerequisites

**⚠️ CRITICAL: Tailwind v4 Requires shadcn@canary**

Before starting, you MUST understand this:
- `pnpm dlx shadcn@latest` → Does NOT support Tailwind v4 (looks for config file)
- `pnpm dlx shadcn@canary` → Required for Tailwind v4 support

**Always use `@canary` throughout this tutorial!**

Before starting, ensure you have:

- **Node.js** v18 or higher
- **pnpm** installed globally
- Basic knowledge of:
  - React
  - TypeScript
  - Tailwind CSS

### Install pnpm (if not installed)

```bash
# Windows (PowerShell)
iwr https://get.pnpm.io/install.ps1 -useb | iex

# macOS/Linux
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Using npm (cross-platform)
npm install -g pnpm

# Verify installation
pnpm --version
```

---

## 🚀 Project Setup with PNPM

### Quick Start Checklist

Here's the complete setup process for Tailwind v4:

```bash
# 1. Create Vite project
pnpm create vite@latest my-app --template react-ts
cd my-app

# 2. Install base dependencies
pnpm install

# 3. Install Tailwind CSS v4 with Vite plugin
pnpm add -D tailwindcss @tailwindcss/vite

# 4. Install shadcn/ui dependencies
pnpm add class-variance-authority clsx tailwind-merge lucide-react

# 5. Configure manually (see detailed steps below)
# - Create components.json manually
# - Configure tsconfig.json
# - Update vite.config.ts
# - Update src/index.css
# - Create src/lib/utils.ts

# 6. Add components
pnpm dlx shadcn@latest add button

# 7. Start development
pnpm run dev
```

**⚠️ Important Note for Tailwind v4:**

The automatic `pnpm dlx shadcn@latest init` command has issues with Tailwind v4 because it expects a `tailwind.config.js` file that doesn't exist in v4. 

**Solution:** Manually create the configuration files following the steps below.

Now let's go through each step in detail:

### Step 1: Create Vite + React + TypeScript Project

```bash
# Create new project
pnpm create vite@latest my-shadcn-app --template react-ts

# Navigate to project
cd my-shadcn-app

# Install dependencies
pnpm install
```

### Step 2: Install Tailwind CSS v4

**Important:** Tailwind v4 has a completely different installation process than v3!

```bash
# Install Tailwind v4 with Vite plugin
pnpm add -D tailwindcss @tailwindcss/vite
```

**What's Different in v4:**
- ❌ No `postcss` required
- ❌ No `autoprefixer` required
- ❌ No `tailwind.config.js` needed
- ✅ Just install and import!

### Step 3: Configure Path Aliases

**You must configure path aliases for the `@/` import syntax to work.**

Update `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Update `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    
    // Add these lines for path alias
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    
    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    
    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

### Step 4: Update Vite Config

Update `vite.config.ts` to include the Tailwind plugin AND path alias:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Tailwind v4 Vite plugin
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

### Step 5: Add Tailwind Import to CSS

**This is the magic of v4 - just one line!**

Update `src/index.css`:

```css
@import "tailwindcss";
```

That's it! No `@tailwind base`, `@tailwind components`, `@tailwind utilities` needed.

### Step 6: Verify Tailwind v4 Installation (Optional)

Update `src/App.tsx` to test:

```tsx
function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Tailwind v4 is working! 🎉
        </h1>
        <p className="text-gray-600">
          Zero configuration, blazingly fast, and ready for shadcn/ui!
        </p>
      </div>
    </div>
  )
}

export default App
```

Start your dev server:

```bash
pnpm run dev
```

You should see beautiful styled content! If yes, Tailwind v4 is working perfectly! ⚡

### Step 7: Install shadcn/ui Dependencies

```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react
```

These packages are required for shadcn/ui components to work.

### Step 8: Create `components.json` Manually

**⚠️ CRITICAL:** Since automatic init doesn't work with Tailwind v4, create this file manually.

Create `components.json` in your project root:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**Key Points:**
- `"config": ""` - Empty string tells shadcn you're using Tailwind v4 (no config file)
- `"css": "src/index.css"` - Path to your CSS file
- `"cssVariables": true` - Use CSS variables for theming

### Step 9: Create `src/lib/utils.ts`

Create the directory and file:

```bash
mkdir -p src/lib
```

Create `src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Step 10: Update `src/index.css` with Theme Variables

Replace `src/index.css` content with:

```css
@import "tailwindcss";

@theme inline {
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(9% 0.01 286);
  --color-card: oklch(100% 0 0);
  --color-card-foreground: oklch(9% 0.01 286);
  --color-popover: oklch(100% 0 0);
  --color-popover-foreground: oklch(9% 0.01 286);
  --color-primary: oklch(9% 0.01 286);
  --color-primary-foreground: oklch(98% 0 0);
  --color-secondary: oklch(96% 0 0);
  --color-secondary-foreground: oklch(9% 0.01 286);
  --color-muted: oklch(96% 0 0);
  --color-muted-foreground: oklch(46% 0.006 286);
  --color-accent: oklch(96% 0 0);
  --color-accent-foreground: oklch(9% 0.01 286);
  --color-destructive: oklch(58% 0.23 25);
  --color-destructive-foreground: oklch(98% 0 0);
  --color-border: oklch(91% 0.004 286);
  --color-input: oklch(91% 0.004 286);
  --color-ring: oklch(9% 0.01 286);
  --radius: 0.5rem;
}

.dark {
  color-scheme: dark;
}

@theme inline {
  .dark {
    --color-background: oklch(9% 0.01 286);
    --color-foreground: oklch(98% 0 0);
    --color-card: oklch(9% 0.01 286);
    --color-card-foreground: oklch(98% 0 0);
    --color-popover: oklch(9% 0.01 286);
    --color-popover-foreground: oklch(98% 0 0);
    --color-primary: oklch(98% 0 0);
    --color-primary-foreground: oklch(9% 0.01 286);
    --color-secondary: oklch(18% 0.008 286);
    --color-secondary-foreground: oklch(98% 0 0);
    --color-muted: oklch(18% 0.008 286);
    --color-muted-foreground: oklch(65% 0.013 286);
    --color-accent: oklch(18% 0.008 286);
    --color-accent-foreground: oklch(98% 0 0);
    --color-destructive: oklch(58% 0.23 25);
    --color-destructive-foreground: oklch(98% 0 0);
    --color-border: oklch(18% 0.008 286);
    --color-input: oklch(18% 0.008 286);
    --color-ring: oklch(84% 0.01 286);
  }
}
```

**What's This?**
- Uses `@theme inline` (Tailwind v4 feature)
- OKLCH color space (modern, perceptually uniform)
- CSS variables for all theme colors
- Built-in dark mode support

### Step 11: Now Add shadcn/ui Components!

Now that everything is configured, you can add components:

```bash
# Add your first component
pnpm dlx shadcn@latest add button

# Add multiple components
pnpm dlx shadcn@latest add button input label card
```

**That's it!** Components will be installed to `src/components/ui/`

### Folder Structure

Your project should now look like this:

```
my-shadcn-app/
├── src/
│   ├── components/
│   │   └── ui/           # shadcn components go here
│   ├── lib/
│   │   └── utils.ts      # cn() utility function
│   ├── index.css         # Tailwind v4 + theme variables
│   ├── App.tsx
│   └── main.tsx
├── components.json       # shadcn configuration
├── vite.config.ts        # Vite + Tailwind v4 plugin
├── tsconfig.json         # Path aliases
└── package.json
```
└── vite.config.ts
```

### Understanding Tailwind v4 Setup

**No Config File!**

In Tailwind v3, you needed `tailwind.config.js`. In v4, everything is in your CSS:

```css
/* src/index.css */
@import "tailwindcss";

/* Custom theme configuration */
@theme {
  --font-sans: "Inter", system-ui, sans-serif;
### Understanding Tailwind v4 Setup

**No Config File!**

In Tailwind v3, you needed `tailwind.config.js`. In v4, everything is in your CSS using the `@theme` directive.

**Automatic Content Detection:**

Tailwind v4 automatically finds your files:
- ✅ Ignores `.gitignore` files
- ✅ Ignores `node_modules`
- ✅ Ignores binary files (images, videos, etc.)
- ✅ No manual `content` array needed!

**If you need to explicitly add sources:**

```css
@import "tailwindcss";
@source "../../packages/ui/src";
```

### Step 12: Start Development Server

```bash
pnpm run dev
```

Your app should now be running at `http://localhost:5173` with Tailwind v4 and shadcn/ui configured! 🚀

---

## 🏗️ Understanding the Architecture

### The `cn()` Utility Function

Located at `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**What it does:**
1. **clsx** - Handles conditional classes
2. **twMerge** - Intelligently merges Tailwind classes

**Examples:**

```typescript
// Basic usage
cn("px-4", "py-2", "bg-blue-500")
// Result: "px-4 py-2 bg-blue-500"

// Conditional classes
cn("px-4", isActive && "bg-blue-500")
// Result: "px-4 bg-blue-500" (if isActive is true)

// Handling conflicts (twMerge)
cn("px-4", "px-6")
// Result: "px-6" (last one wins, conflict resolved)

// Complex conditionals
cn("base-class", {
  "active-class": isActive,
  "disabled-class": isDisabled,
})
```

### Tailwind v4 Theme Variables

**New @theme Directive:**

```css
@theme {
  /* Colors */
  --color-primary: oklch(60% 0.2 260);
  --color-secondary: oklch(70% 0.15 320);
  
  /* Spacing */
  --spacing-xs: 0.5rem;
  --spacing-sm: 1rem;
  
  /* Typography */
  --font-display: "Playfair Display", serif;
  --font-body: "Inter", sans-serif;
  
  /* Breakpoints */
  --breakpoint-3xl: 1920px;
}
```

**Using Theme Variables:**

```tsx
// Use in Tailwind classes
<div className="bg-primary text-primary-foreground">
  Content with theme colors
</div>

// In custom CSS
.my-element {
  color: var(--color-primary);
  font-family: var(--font-display);
}
```

### Component Structure Pattern

Every shadcn component follows this pattern:

```typescript
// Example: Button component
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// 1. Define variants with CVA
const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// 2. Component implementation
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

export { Button, buttonVariants }
```

---

## 🎨 Your First Components

### Add Button Component

```bash
# Use @canary for Tailwind v4 compatible components
pnpm dlx shadcn@canary add button
```

This creates `src/components/ui/button.tsx`

**Usage in your app:**

```tsx
// src/App.tsx
import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-3xl font-bold">shadcn/ui + Tailwind v4</h1>
      
      {/* Default button */}
      <Button>Click me</Button>
      
      {/* Variants */}
      <Button variant="destructive">Delete</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      
      {/* Sizes */}
      <Button size="sm">Small</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">🔥</Button>
      
      {/* With onClick */}
      <Button onClick={() => alert('Clicked!')}>
        Click Me
      </Button>
    </div>
  )
}
```

### Add Multiple Components

```bash
# Add commonly used components (use @canary for v4)
pnpm dlx shadcn@canary add button input label card
```

### Using Card Component

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

function ProfileCard() {
  return (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Manage your account preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Configure your profile information
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button>Save Changes</Button>
      </CardFooter>
    </Card>
  )
}
```

---

## 🔒 Form Validation with Zod

### Why Zod?

✅ **Type-safe** - TypeScript types automatically inferred  
✅ **Runtime validation** - Validates at runtime  
✅ **Composable** - Build complex schemas  
✅ **Great error messages** - User-friendly feedback  

### Install Form Dependencies

```bash
pnpm add react-hook-form @hookform/resolvers zod
```

### Add Form Components

```bash
pnpm dlx shadcn@canary add form input textarea
```

### Basic Zod Schema

```typescript
import { z } from "zod"

// Simple schema
const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  age: z.number().min(18, "Must be 18 or older"),
})

// Infer TypeScript type
type UserFormData = z.infer<typeof userSchema>
```

### Comprehensive Zod Validations

```typescript
import { z } from "zod"

const formSchema = z.object({
  // STRING VALIDATIONS
  username: z.string()
    .min(3, "Too short")
    .max(20, "Too long")
    .regex(/^[a-zA-Z0-9_]+$/, "Invalid characters"),
  
  email: z.string().email().toLowerCase(),
  
  password: z.string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Invalid password"),
  
  // NUMBER VALIDATIONS
  age: z.coerce.number().min(18).max(120),
  
  // DATE VALIDATIONS
  birthDate: z.date().max(new Date()),
  
  // BOOLEAN
  agreeToTerms: z.boolean().refine(val => val === true),
  
  // OPTIONAL
  bio: z.string().optional(),
  
  // ARRAYS
  tags: z.array(z.string()).min(1).max(5),
  
  // ENUMS
  role: z.enum(["admin", "user", "guest"]),
})

type FormData = z.infer<typeof formSchema>
```

---

## 📝 Complete Form Examples

### Example 1: Simple Contact Form

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// 1. Define validation schema
const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  message: z.string().min(10).max(500),
})

type ContactFormValues = z.infer<typeof contactFormSchema>

export function ContactForm() {
  // 2. Initialize form
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
  })

  // 3. Submit handler
  async function onSubmit(data: ContactFormValues) {
    console.log(data)
    alert("Message sent!")
    form.reset()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormDescription>Your full name</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="john@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Your message..."
                  rows={5}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Sending..." : "Send Message"}
        </Button>
      </form>
    </Form>
  )
}
```

### Example 2: Registration Form with Advanced Validation

First, add necessary components:

```bash
pnpm dlx shadcn@canary add select checkbox
```

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Advanced validation
const registrationSchema = z.object({
  username: z.string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/),
  
  email: z.string().email().toLowerCase(),
  
  password: z.string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  
  confirmPassword: z.string(),
  
  age: z.coerce.number().min(18).max(120),
  
  country: z.string().min(1),
  
  agreeToTerms: z.boolean().refine(val => val === true),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type RegistrationFormValues = z.infer<typeof registrationSchema>

export function RegistrationForm() {
  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      age: undefined,
      country: "",
      agreeToTerms: false,
    },
  })

  async function onSubmit(data: RegistrationFormValues) {
    console.log(data)
    alert("Registration successful!")
    form.reset()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="johndoe" {...field} />
              </FormControl>
              <FormDescription>
                Your public display name
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="john@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormDescription>
                Min 8 chars, uppercase, lowercase, number, special character
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Age</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="uk">United Kingdom</SelectItem>
                  <SelectItem value="in">India</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="agreeToTerms"
          render={({ field }) => (
            <FormItem className="flex items-start space-x-3">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>I agree to terms and conditions</FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating..." : "Create Account"}
        </Button>
      </form>
    </Form>
  )
}
```

---

## ✨ Best Practices

### 1. Tailwind v4 Specific

```css
/* ✅ GOOD: Use @theme for customization */
@theme {
  --color-brand: oklch(60% 0.2 260);
  --font-display: "Playfair Display", serif;
}

/* ❌ BAD: Don't try to use old config file */
// tailwind.config.js no longer needed!
```

### 2. Form Validation

```typescript
// ✅ GOOD: Specific error messages
z.string().min(8, "Password must be at least 8 characters")

// ❌ BAD: Generic messages
z.string().min(8, "Invalid")
```

### 3. Default Values

```typescript
// ✅ GOOD: Always provide defaults
const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: {
    email: "",
    name: "",
  },
})
```

---

## 🔧 Common Issues & Solutions

### Issue 1: Tailwind v4 Not Working

**Error:** Classes not being applied

**Solution:**
1. Verify Vite plugin is installed:
```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

2. Check `vite.config.ts`:
```typescript
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Must be here
  ],
})
```

3. Check `src/index.css`:
```css
@import "tailwindcss";
```

### Issue 2: Path Alias Not Working

Update `vite.config.ts`:
```typescript
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

### Issue 3: Dark Mode Not Working

Ensure you have dark mode class:

```tsx
<html className="dark">
  {/* Your app */}
</html>
```

Or use system preference:

```tsx
<html className={systemTheme}>
  {/* Your app */}
</html>
```

---

## 🎓 Next Steps

### Explore More Components

```bash
# View all available components
pnpm dlx shadcn@canary search

# Add more components
pnpm dlx shadcn@canary add dialog dropdown-menu toast table tabs
```

### Add Toast Notifications

```bash
pnpm dlx shadcn@canary add sonner
```

Usage:
```tsx
import { toast } from "sonner"

toast.success("Success!")
toast.error("Error!")
```

---

## 📚 Quick Reference

### Useful Commands

```bash
# Initialize shadcn/ui
pnpm dlx shadcn@canary init

# Add components
pnpm dlx shadcn@canary add button input form

# View component
pnpm dlx shadcn@canary view button

# Search components
pnpm dlx shadcn@canary search

# Development
pnpm run dev

# Build
pnpm run build
```

### Tailwind v4 Quick Tips

```css
/* Custom theme */
@theme {
  --color-primary: oklch(60% 0.2 260);
  --font-heading: "Inter", sans-serif;
}

/* Explicit source detection */
@source "../packages/ui";

/* Import other CSS */
@import "tailwindcss";
@import "./custom.css";
```

---

## 🎉 Conclusion

You now have:
- ✅ Tailwind CSS v4 (5x faster!)
- ✅ shadcn/ui components
- ✅ Zod validation
- ✅ React Hook Form
- ✅ Type-safe forms
- ✅ Zero configuration

**Tailwind v4 Benefits:**
- 🚀 5x faster builds
- ⚡ No config file needed
- 🎯 Automatic content detection
- 🎨 Modern @theme directive

Happy coding with the latest tools! 🚀
