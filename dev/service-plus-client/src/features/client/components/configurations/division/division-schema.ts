import { z } from "zod";

export const divisionSchema = z.object({
    code:          z.string()
        .min(2, "Code must be at least 2 characters")
        .max(10, "Code must be at most 10 characters")
        .regex(/^[A-Z0-9_]+$/, "Only uppercase letters, digits, and underscores"),
    address_line1: z.string().min(3, "Address is required"),
    address_line2: z.string().optional(),
    city:          z.string().optional(),
    country:       z.string().optional(),
    email:         z.string().email("Invalid email").or(z.literal("")).optional(),
    gstin:         z.string()
        .regex(
            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
            "Invalid GSTIN format"
        )
        .or(z.literal(""))
        .optional(),
    is_active:     z.boolean().default(true),
    name:          z.string().min(2, "Name must be at least 2 characters"),
    phone:         z.string().optional(),
    pincode:       z.string().optional(),
    state_id:      z.coerce.number().positive("State is required"),
});

export const addDivisionSchema = divisionSchema.extend({
    id: z.coerce.number().int().positive("ID must be a positive integer"),
});

export type DivisionFormValues    = z.infer<typeof divisionSchema>;
export type AddDivisionFormValues = z.infer<typeof addDivisionSchema>;
