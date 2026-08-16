"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const checkoutSchema = z.object({
  customerName: z.string().min(1, "Enter your name"),
  mobile: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  remarks: z.string().optional(),
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;

type Props = {
  submitting: boolean;
  onSubmit: (values: CheckoutFormValues) => void;
};

export function CheckoutForm({ submitting, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { customerName: "", mobile: "", email: "", remarks: "" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="checkout-name">Your name</Label>
        <Input id="checkout-name" autoComplete="name" {...register("customerName")} />
        {errors.customerName && (
          <p className="text-sm text-destructive">{errors.customerName.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="checkout-mobile">Mobile number</Label>
        <Input
          id="checkout-mobile"
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit mobile number"
          autoComplete="tel"
          {...register("mobile")}
        />
        {errors.mobile && <p className="text-sm text-destructive">{errors.mobile.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="checkout-email">Email (optional)</Label>
        <Input id="checkout-email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="checkout-remarks">Remarks (optional)</Label>
        <Textarea
          id="checkout-remarks"
          placeholder="Anything we should know?"
          {...register("remarks")}
        />
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        No online payment. No return or replacement once shipped. Our team will contact you to
        arrange delivery and billing.
      </div>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Place order request
      </Button>
    </form>
  );
}
