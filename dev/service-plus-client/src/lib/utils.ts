import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function for merging Tailwind CSS classes with proper precedence
 * Used by shadcn components
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as a currency string.
 */
export function formatCurrency(amount: number, currency: string = "INR", locale: string = "en-IN") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
  }).format(amount);
}

/**
 * Returns the current date range for the financial year (April 1st to March 31st).
 */
export function currentFinancialYearRange() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed, 3 is April

  let startYear, endYear;
  if (currentMonth >= 3) {
      startYear = currentYear;
      endYear = currentYear + 1;
  } else {
      startYear = currentYear - 1;
      endYear = currentYear;
  }

  return {
      from: `${startYear}-04-01`,
      to:   `${endYear}-03-31`,
  };
}
