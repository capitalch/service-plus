# Complete shadcn/ui Tutorial with Tailwind CSS and Zod (2025) - PNPM Edition

## 📚 Table of Contents
1. [Introduction](#introduction)
2. [What is shadcn/ui?](#what-is-shadcnui)
3. [Prerequisites](#prerequisites)
4. [Project Setup with PNPM](#project-setup-with-pnpm)
5. [Understanding the Architecture](#understanding-the-architecture)
6. [Your First Components](#your-first-components)
7. [Form Validation with Zod](#form-validation-with-zod)
8. [Complete Form Examples](#complete-form-examples)
9. [Best Practices](#best-practices)
10. [Common Issues & Solutions](#common-issues--solutions)

---

## 🎯 Introduction

This tutorial covers building modern React applications with **shadcn/ui**, **Tailwind CSS**, and **Zod** validation using **pnpm** as your package manager. Based on the latest 2025 documentation.

### What You'll Build
- ✅ Modern UI with shadcn/ui components
- ✅ Type-safe forms with React Hook Form + Zod
- ✅ Production-ready validation patterns
- ✅ Responsive design with Tailwind CSS

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
pnpm dlx shadcn@latest add button
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

### Step 1: Create Vite + React + TypeScript Project

```bash
# Create new project
pnpm create vite@latest my-shadcn-app --template react-ts

# Navigate to project
cd my-shadcn-app

# Install dependencies
pnpm install
```

### Step 2: Initialize shadcn/ui

```bash
# Run shadcn CLI
pnpm dlx shadcn@latest init
```

You'll be prompted with configuration questions:

```
✔ Which style would you like to use? › New York
✔ Which color would you like to use as base color? › Neutral
✔ Would you like to use CSS variables for colors? › yes
```

**Style Options:**
- **New York** - Modern, clean (recommended)
- **Default** - Classic shadcn look

**Base Colors:**
- Neutral, Gray, Zinc, Stone, Slate

### Step 3: What Gets Installed?

The CLI automatically:

1. **Installs dependencies** (using pnpm):
```json
{
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.344.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.1",
    "tailwindcss-animate": "^1.0.7"
  }
}
```

2. **Creates configuration files**:
   - `components.json` - shadcn configuration
   - `tailwind.config.js` - Tailwind setup
   - `src/lib/utils.ts` - Helper utilities

3. **Sets up folder structure**:
```
my-shadcn-app/
├── src/
│   ├── components/
│   │   └── ui/           # shadcn components go here
│   ├── lib/
│   │   └── utils.ts      # cn() utility function
│   └── styles/
│       └── globals.css   # Global styles with CSS variables
├── components.json
└── tailwind.config.js
```

### Step 4: Verify Configuration

Check `components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/styles/globals.css",
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

### Step 5: Configure Path Aliases

Update `tsconfig.json` to enable `@/` imports:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

### Step 6: Start Development Server

```bash
pnpm run dev
```

Your app should now be running at `http://localhost:5173`

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

### Component Structure Pattern

Every shadcn component follows this pattern:

```typescript
// Example: Button component
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// 1. Define variants with CVA (Class Variance Authority)
const buttonVariants = cva(
  // Base styles (always applied)
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
  {
    // Variants
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    // Default variants
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// 2. Define TypeScript interface
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

// 3. Component implementation with forwardRef
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

**Key Concepts:**
- **CVA (Class Variance Authority)** - Type-safe variant management
- **forwardRef** - Proper ref handling for parent components
- **VariantProps** - TypeScript types for variants
- **cn()** - Merge custom classes with variants

---

## 🎨 Your First Components

### Add Button Component

```bash
pnpm dlx shadcn@latest add button
```

This creates `src/components/ui/button.tsx`

**Usage in your app:**

```tsx
// src/App.tsx
import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-3xl font-bold">shadcn/ui Demo</h1>
      
      {/* Default button */}
      <Button>Default Button</Button>
      
      {/* Variants */}
      <Button variant="destructive">Delete</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      
      {/* Sizes */}
      <Button size="sm">Small</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">🔥</Button>
      
      {/* With onClick */}
      <Button onClick={() => alert('Clicked!')}>
        Click Me
      </Button>
      
      {/* Disabled state */}
      <Button disabled>Disabled</Button>
    </div>
  )
}

export default App
```

### Add Multiple Components

```bash
# Add commonly used components
pnpm dlx shadcn@latest add button input label card
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
          Manage your account preferences and settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Configure your profile information below
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

### Add Input Component

```bash
pnpm dlx shadcn@latest add input
```

```tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function InputDemo() {
  return (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input 
        id="email" 
        type="email" 
        placeholder="you@example.com" 
      />
    </div>
  )
}
```

---

## 🔒 Form Validation with Zod

### Why Zod?

✅ **Type-safe** - TypeScript types automatically inferred  
✅ **Runtime validation** - Validates at runtime, not just compile time  
✅ **Composable** - Build complex schemas from simple ones  
✅ **Great error messages** - User-friendly validation feedback  
✅ **Works perfectly with React Hook Form**

### Install Form Dependencies

```bash
pnpm add react-hook-form @hookform/resolvers zod
```

### Add Form Components

```bash
pnpm dlx shadcn@latest add form
```

This installs:
- `form.tsx` - Form wrapper components
- Dependencies for react-hook-form integration

### Basic Zod Schema

```typescript
import { z } from "zod"

// Simple schema
const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  age: z.number().min(18, "Must be 18 or older"),
})

// Infer TypeScript type from schema
type UserFormData = z.infer<typeof userSchema>
// Result: { name: string; email: string; age: number }
```

### Comprehensive Zod Validations

```typescript
import { z } from "zod"

const formSchema = z.object({
  // ========== STRING VALIDATIONS ==========
  
  // Basic string
  name: z.string(),
  
  // Required with custom message
  username: z.string().min(1, "Username is required"),
  
  // Min/max length
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long"),
  
  // Email validation
  email: z.string().email("Invalid email address"),
  
  // URL validation
  website: z.string().url("Invalid URL"),
  
  // UUID validation
  id: z.string().uuid("Invalid UUID"),
  
  // Regex pattern
  phone: z.string().regex(
    /^\+?[1-9]\d{1,14}$/,
    "Invalid phone number"
  ),
  
  // Custom validation with refine
  customUsername: z.string().refine(
    (val) => !val.includes(" "),
    { message: "Username cannot contain spaces" }
  ),
  
  // Transform value
  lowercaseEmail: z.string().email().toLowerCase(),
  
  // ========== NUMBER VALIDATIONS ==========
  
  age: z.number()
    .min(18, "Must be 18 or older")
    .max(120, "Invalid age"),
  
  price: z.number().positive("Price must be positive"),
  
  quantity: z.number().int("Must be a whole number"),
  
  // Coerce string to number
  salary: z.coerce.number().min(0),
  
  // ========== DATE VALIDATIONS ==========
  
  birthDate: z.date()
    .max(new Date(), "Birth date cannot be in future"),
  
  startDate: z.date()
    .min(new Date(), "Start date must be in future"),
  
  // ========== BOOLEAN ==========
  
  agreeToTerms: z.boolean().refine(
    (val) => val === true,
    { message: "You must agree to terms" }
  ),
  
  // ========== OPTIONAL & NULLABLE ==========
  
  bio: z.string().optional(),  // string | undefined
  middleName: z.string().nullable(),  // string | null
  nickname: z.string().nullish(),  // string | null | undefined
  
  // ========== ARRAYS ==========
  
  tags: z.array(z.string())
    .min(1, "At least one tag required")
    .max(5, "Maximum 5 tags allowed"),
  
  // ========== ENUMS ==========
  
  role: z.enum(["admin", "user", "guest"]),
  
  // ========== OBJECTS ==========
  
  address: z.object({
    street: z.string(),
    city: z.string(),
    zipCode: z.string(),
  }),
  
  // ========== UNION TYPES ==========
  
  idOrEmail: z.union([
    z.string().uuid(),
    z.string().email()
  ]),
  
  // ========== DEFAULT VALUES ==========
  
  status: z.string().default("active"),
  
  // ========== ASYNC VALIDATION ==========
  
  uniqueEmail: z.string().email().refine(
    async (email) => {
      const exists = await checkEmailExists(email)
      return !exists
    },
    { message: "Email already exists" }
  ),
})

// Type inference
type FormData = z.infer<typeof formSchema>
```

### Password Validation Example

```typescript
const passwordSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[@$!%*?&]/, "Must contain special character"),
  
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], // Error shows on confirmPassword field
})
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
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  message: z.string()
    .min(10, "Message must be at least 10 characters.")
    .max(500, "Message must not exceed 500 characters."),
})

// 2. Infer TypeScript type
type ContactFormValues = z.infer<typeof contactFormSchema>

export function ContactForm() {
  // 3. Initialize form with React Hook Form
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
  })

  // 4. Submit handler
  async function onSubmit(data: ContactFormValues) {
    try {
      console.log(data)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      alert("Message sent successfully!")
      form.reset()
    } catch (error) {
      alert("Failed to send message")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Name Field */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormDescription>
                Your full name
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email Field */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input 
                  type="email" 
                  placeholder="john@example.com" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Message Field */}
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Your message here..."
                  className="resize-none"
                  rows={5}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Sending..." : "Send Message"}
        </Button>
      </form>
    </Form>
  )
}
```

### Example 2: User Registration with Advanced Validation

First, add the necessary components:

```bash
pnpm dlx shadcn@latest add select checkbox
```

Now create the registration form:

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

// Advanced validation schema
const registrationSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  
  email: z.string()
    .email("Invalid email address")
    .toLowerCase(),
  
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      "Must contain uppercase, lowercase, number, and special character"
    ),
  
  confirmPassword: z.string(),
  
  age: z.coerce.number()
    .min(18, "You must be at least 18 years old")
    .max(120, "Please enter a valid age"),
  
  country: z.string().min(1, "Please select a country"),
  
  agreeToTerms: z.boolean().refine(
    (val) => val === true,
    { message: "You must accept the terms and conditions" }
  ),
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
    try {
      console.log(data)
      await new Promise(resolve => setTimeout(resolve, 1000))
      alert("Registration successful!")
      form.reset()
    } catch (error) {
      alert("Registration failed")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Username */}
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
                This will be your public display name
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email */}
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

        {/* Password */}
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
                Must be at least 8 characters with uppercase, lowercase, number, and special character
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Confirm Password */}
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

        {/* Age */}
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

        {/* Country */}
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
                  <SelectItem value="ca">Canada</SelectItem>
                  <SelectItem value="in">India</SelectItem>
                  <SelectItem value="au">Australia</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Terms and Conditions */}
        <FormField
          control={form.control}
          name="agreeToTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  I agree to the terms and conditions
                </FormLabel>
                <FormDescription>
                  You must agree to our terms to create an account
                </FormDescription>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Creating Account..." : "Create Account"}
        </Button>
      </form>
    </Form>
  )
}
```

### Example 3: Login Form with Loading States

```tsx
"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Loader2, Mail, Lock } from "lucide-react"

const loginSchema = z.object({
  email: z.string()
    .min(1, "Email is required")
    .email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      console.log(data)
      alert("Login successful!")
    } catch (error) {
      alert("Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold">Welcome back</h2>
        <p className="text-muted-foreground">Enter your credentials to continue</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="email" 
                      placeholder="john@example.com"
                      className="pl-10"
                      {...field} 
                    />
                  </div>
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
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="password"
                      className="pl-10"
                      {...field} 
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Form>
    </div>
  )
}
```

---

## ✨ Best Practices

### 1. Form Validation Patterns

```typescript
// ✅ GOOD: Specific, helpful error messages
z.string().min(8, "Password must be at least 8 characters")

// ❌ BAD: Generic messages
z.string().min(8, "Invalid input")
```

### 2. Default Values

```typescript
// ✅ GOOD: Always provide default values
const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: {
    email: "",
    name: "",
  },
})

// ❌ BAD: No defaults (causes uncontrolled component warnings)
const form = useForm({
  resolver: zodResolver(schema),
})
```

### 3. Loading States

```typescript
// ✅ GOOD: Disable button during submission
<Button disabled={form.formState.isSubmitting}>
  {form.formState.isSubmitting ? "Saving..." : "Save"}
</Button>

// ❌ BAD: No loading indication
<Button>Save</Button>
```

### 4. Error Handling

```typescript
async function onSubmit(data: FormValues) {
  try {
    await apiCall(data)
    toast.success("Success!")
  } catch (error) {
    toast.error("Something went wrong")
  }
}
```

### 5. Component Organization

```
src/
├── components/
│   ├── ui/              # shadcn components
│   ├── forms/           # Your custom forms
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── ContactForm.tsx
│   └── layouts/
├── lib/
│   ├── utils.ts
│   └── validations/     # Zod schemas
│       ├── auth.ts
│       └── user.ts
```

### 6. Reusable Zod Schemas

```typescript
// lib/validations/common.ts
import { z } from "zod"

export const emailSchema = z.string().email("Invalid email")

export const passwordSchema = z.string()
  .min(8, "Too short")
  .regex(/[A-Z]/, "Need uppercase")
  .regex(/[a-z]/, "Need lowercase")
  .regex(/[0-9]/, "Need number")

// Reuse in multiple schemas
const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})
```

---

## 🔧 Common Issues & Solutions

### Issue 1: Path Alias Not Working

**Error:** `Cannot find module '@/components/ui/button'`

**Solution:**
1. Check `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

2. Update `vite.config.ts`:
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

3. Restart dev server: `pnpm run dev`

### Issue 2: Tailwind Classes Not Working

**Solution:**
Check `tailwind.config.js`:
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
}
```

### Issue 3: Form Not Validating

**Solution:**
Ensure you're using `zodResolver`:
```typescript
const form = useForm({
  resolver: zodResolver(schema), // Don't forget this!
  defaultValues: {...},
})
```

### Issue 4: CSS Variables Not Applied

**Solution:**
Make sure you import `globals.css` in your `main.tsx`:
```typescript
import './styles/globals.css'
```

### Issue 5: Components Look Broken

**Solution:**
Verify Tailwind is working:
```bash
# Reinstall dependencies
pnpm install

# Clear cache
rm -rf node_modules .pnpm-store
pnpm install
```

---

## 🎓 Next Steps

### Explore More Components

```bash
# View all available components
pnpm dlx shadcn@latest search

# Add more components
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add dropdown-menu
pnpm dlx shadcn@latest add toast
pnpm dlx shadcn@latest add table
pnpm dlx shadcn@latest add tabs
```

### Add Toast Notifications

```bash
pnpm dlx shadcn@latest add sonner
```

Usage:
```tsx
import { toast } from "sonner"

toast.success("Success!")
toast.error("Error!")
toast.info("Info")
```

### Learn More

- **Official Docs**: https://ui.shadcn.com
- **Zod Documentation**: https://zod.dev
- **React Hook Form**: https://react-hook-form.com
- **Tailwind CSS**: https://tailwindcss.com

---

## 📚 Quick Reference

### Useful Commands

```bash
# Initialize shadcn/ui
pnpm dlx shadcn@latest init

# Add components
pnpm dlx shadcn@latest add button input form

# View component before installing
pnpm dlx shadcn@latest view button

# Search components
pnpm dlx shadcn@latest search

# Development server
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

### Common Zod Patterns

```typescript
// Required field
z.string().min(1, "Required")

// Email
z.string().email()

// Number range
z.number().min(0).max(100)

// Optional
z.string().optional()

// Array
z.array(z.string()).min(1)

// Enum
z.enum(["admin", "user"])

// Custom validation
z.string().refine((val) => condition, "Error message")

// Password match
z.object({
  password: z.string(),
  confirm: z.string(),
}).refine((data) => data.password === data.confirm, {
  message: "Passwords don't match",
  path: ["confirm"],
})
```

---

## 🎉 Conclusion

You now have a complete setup with:
- ✅ shadcn/ui components
- ✅ Tailwind CSS styling
- ✅ Zod validation
- ✅ React Hook Form integration
- ✅ Type-safe forms

**Remember:** shadcn/ui gives you the code - you own it, customize it, make it yours!

Happy coding! 🚀
