import { z } from "zod";

// ============================================
// ENUMS for Select/Radio fields
// ============================================

export enum Category {
  Technology = "technology",
  Finance = "finance",
  Healthcare = "healthcare",
  Education = "education",
  Other = "other",
}

export const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;
export const EMPLOYMENT_STATUS = ["employed", "self-employed", "unemployed", "student"] as const;
export const COUNTRIES = ["US", "CA", "UK", "DE", "FR", "AU", "JP"] as const;
export const RELATIONSHIP_TYPES = ["parent", "spouse", "sibling", "friend", "other"] as const;

// ============================================
// CUSTOM VALIDATION HELPERS
// ============================================

// Luhn algorithm for credit card validation
const isValidLuhn = (value: string): boolean => {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
};

// ============================================
// NESTED OBJECT SCHEMAS
// ============================================

export const addressSchema = z.object({
  street: z
    .string()
    .min(5, "Street address must be at least 5 characters")
    .max(100, "Street address must be less than 100 characters"),
  city: z
    .string()
    .min(2, "City must be at least 2 characters")
    .max(50, "City must be less than 50 characters"),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format (e.g., 12345 or 12345-6789)"),
});

export const emergencyContactSchema = z.object({
  name: z
    .string()
    .min(2, "Contact name must be at least 2 characters")
    .max(100, "Contact name must be less than 100 characters"),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]{10,20}$/, "Invalid phone number format"),
  relationship: z.enum(RELATIONSHIP_TYPES, {
    errorMap: () => ({ message: "Please select a relationship type" }),
  }),
});

// ============================================
// MAIN ZOD DEMO SCHEMA
// ============================================

export const zodDemoSchema = z
  .object({
    // ============================================
    // STRING VALIDATIONS
    // ============================================
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be at most 20 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),

    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address"),

    website: z
      .string()
      .url("Please enter a valid URL (include https://)")
      .optional()
      .or(z.literal("")),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),

    confirmPassword: z.string().min(1, "Please confirm your password"),

    // ============================================
    // NUMBER VALIDATIONS
    // ============================================
    age: z
      .number({
        required_error: "Age is required",
        invalid_type_error: "Age must be a number",
      })
      .int("Age must be a whole number")
      .min(18, "You must be at least 18 years old")
      .max(120, "Please enter a valid age"),

    salary: z
      .number({
        required_error: "Salary is required",
        invalid_type_error: "Salary must be a number",
      })
      .positive("Salary must be a positive number")
      .multipleOf(0.01, "Salary can have at most 2 decimal places"),

    quantity: z
      .number({
        required_error: "Quantity is required",
        invalid_type_error: "Quantity must be a number",
      })
      .int("Quantity must be a whole number")
      .nonnegative("Quantity cannot be negative"),

    // ============================================
    // DATE VALIDATIONS
    // ============================================
    birthDate: z
      .date({
        required_error: "Birth date is required",
        invalid_type_error: "Please enter a valid date",
      })
      .max(new Date(), "Birth date cannot be in the future"),

    appointmentDate: z
      .date({
        required_error: "Appointment date is required",
        invalid_type_error: "Please enter a valid date",
      })
      .min(new Date(), "Appointment date must be in the future"),

    // ============================================
    // BOOLEAN VALIDATIONS
    // ============================================
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms and conditions" }),
    }),

    newsletterOptIn: z.boolean().optional().default(false),

    // ============================================
    // ENUM/SELECT VALIDATIONS
    // ============================================
    priority: z.enum(PRIORITY_OPTIONS, {
      errorMap: () => ({ message: "Please select a priority level" }),
    }),

    category: z.nativeEnum(Category, {
      errorMap: () => ({ message: "Please select a category" }),
    }),

    country: z.enum(COUNTRIES, {
      errorMap: () => ({ message: "Please select a country" }),
    }),

    // ============================================
    // ARRAY VALIDATIONS
    // ============================================
    tags: z
      .array(z.string().min(1, "Tag cannot be empty"))
      .min(1, "Please add at least one tag")
      .max(5, "You can add at most 5 tags"),

    skills: z
      .array(z.string())
      .min(1, "Please select at least one skill")
      .refine(
        (items) => new Set(items).size === items.length,
        "Skills must be unique"
      ),

    // ============================================
    // NESTED OBJECT VALIDATIONS
    // ============================================
    address: addressSchema,

    emergencyContact: emergencyContactSchema,

    // ============================================
    // CONDITIONAL VALIDATIONS
    // ============================================
    employmentStatus: z.enum(EMPLOYMENT_STATUS, {
      errorMap: () => ({ message: "Please select your employment status" }),
    }),

    companyName: z.string().optional(),

    studentId: z.string().optional(),

    // ============================================
    // CUSTOM VALIDATIONS
    // ============================================
    creditCard: z
      .string()
      .min(1, "Credit card number is required")
      .refine(isValidLuhn, "Please enter a valid credit card number"),

    phoneNumber: z
      .string()
      .min(1, "Phone number is required")
      .regex(/^\+?[\d\s\-()]{10,20}$/, "Invalid phone number format")
      .transform((val) => val.replace(/[\s\-()]/g, "")),
  })
  // ============================================
  // CROSS-FIELD VALIDATIONS (superRefine)
  // ============================================
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .superRefine((data, ctx) => {
    // Company name required if employed or self-employed
    if (
      (data.employmentStatus === "employed" || data.employmentStatus === "self-employed") &&
      (!data.companyName || data.companyName.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Company name is required for employed/self-employed individuals",
        path: ["companyName"],
      });
    }

    // Student ID required if student
    if (
      data.employmentStatus === "student" &&
      (!data.studentId || data.studentId.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Student ID is required for students",
        path: ["studentId"],
      });
    }
  });

// ============================================
// INFERRED TYPES
// ============================================
export type ZodDemoFormData = z.infer<typeof zodDemoSchema>;
export type AddressData = z.infer<typeof addressSchema>;
export type EmergencyContactData = z.infer<typeof emergencyContactSchema>;

// ============================================
// DEFAULT VALUES
// ============================================
export const zodDemoDefaultValues: Partial<ZodDemoFormData> = {
  username: "",
  email: "",
  website: "",
  password: "",
  confirmPassword: "",
  age: undefined,
  salary: undefined,
  quantity: 0,
  birthDate: undefined,
  appointmentDate: undefined,
  termsAccepted: undefined as unknown as true,
  newsletterOptIn: false,
  priority: undefined,
  category: undefined,
  country: undefined,
  tags: [],
  skills: [],
  address: {
    street: "",
    city: "",
    zipCode: "",
  },
  emergencyContact: {
    name: "",
    phone: "",
    relationship: undefined,
  },
  employmentStatus: undefined,
  companyName: "",
  studentId: "",
  creditCard: "",
  phoneNumber: "",
};

// ============================================
// SKILLS OPTIONS (for multi-select)
// ============================================
export const SKILL_OPTIONS = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "react", label: "React" },
  { value: "nodejs", label: "Node.js" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "sql", label: "SQL" },
  { value: "graphql", label: "GraphQL" },
  { value: "docker", label: "Docker" },
] as const;

// ============================================
// COUNTRY OPTIONS (for select)
// ============================================
export const COUNTRY_OPTIONS = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "UK", label: "United Kingdom" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "AU", label: "Australia" },
  { value: "JP", label: "Japan" },
] as const;
