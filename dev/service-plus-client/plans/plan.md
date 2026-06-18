# Plan: Division Dialog — Trace+ Accounts Integration Tab

Extends `account_setting` with `purchaseInvoice` (+ `salesInvoice` / `jobInvoice` later).
Converts the division dialog to a two-tab layout; adds Purchase Invoice section inside the Accounts tab.

---

## Step 1 — `division.ts`: extend `AccountSettingType`

**File:** `src/features/client/types/division.ts`

Add `purchaseInvoice` (optional — not mandatory on save):

```ts
export type InvoiceAccountSettingType = {
    debitAccountId:    string;
    creditAccountId:   string;
    productCode:       string;
    defaultProductHsn: string;
    defaultGstRate:    string;
};

export type AccountSettingType = {
    clientCode:       string;
    buCode:           string;
    branchId:         number;
    receipt: {
        debitAccountId:  string;
        creditAccountId: string;
    };
    purchaseInvoice?: InvoiceAccountSettingType;
};
```

---

## Step 2 — `division-schema.ts`: extend `accountSettingSchema`

**File:** `src/features/client/components/configurations/division/division-schema.ts`

Add `invoiceSubSchema` helper and `purchaseInvoice` field:

```ts
const invoiceSubSchema = z.object({
    debitAccountId:    z.string(),
    creditAccountId:   z.string(),
    productCode:       z.string(),
    defaultProductHsn: z.string(),
    defaultGstRate:    z.string(),
});

export const accountSettingSchema = z.object({
    clientCode:      z.string().min(1, "Client code is required"),
    buCode:          z.string().min(1, "BU code is required"),
    branchId:        z.coerce.number().int().positive("Branch ID must be a positive integer"),
    receipt: z.object({
        debitAccountId:  z.string(),
        creditAccountId: z.string(),
    }),
    purchaseInvoice: invoiceSubSchema.optional(),
});
```

No changes to `divisionSchema` — `account_setting` remains `accountSettingSchema.nullable().optional()`.

---

## Step 3 — Add `tabs.tsx` UI primitive

**File:** `src/components/ui/tabs.tsx`

The project does not have a Tabs component. Add a minimal custom one (no shadcn install needed):

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextType = { active: string; setActive: (v: string) => void };
const TabsCtx = React.createContext<TabsContextType>({ active: "", setActive: () => {} });

export function Tabs({ defaultValue, children, className }: {
    defaultValue: string; children: React.ReactNode; className?: string;
}) {
    const [active, setActive] = React.useState(defaultValue);
    return <TabsCtx.Provider value={{ active, setActive }}><div className={cn("flex flex-col", className)}>{children}</div></TabsCtx.Provider>;
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn("flex border-b border-(--cl-border) mb-3", className)}>{children}</div>;
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
    const { active, setActive } = React.useContext(TabsCtx);
    return (
        <button
            type="button"
            className={cn(
                "px-4 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                active === value
                    ? "border-(--cl-accent) text-(--cl-accent)"
                    : "border-transparent text-(--cl-text-muted) hover:text-(--cl-text)"
            )}
            onClick={() => setActive(value)}
        >
            {children}
        </button>
    );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
    const { active } = React.useContext(TabsCtx);
    return active === value ? <>{children}</> : null;
}
```

---

## Step 4 — `add-division-dialog.tsx`: tab layout + purchase invoice

**File:** `src/features/client/components/configurations/division/add-division-dialog.tsx`

### 4a — non-closeable on outside click
Add `onInteractOutside={(e) => e.preventDefault()}` to `<DialogContent>`.

### 4b — import Tabs
```ts
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
```

### 4c — form `defaultValues`: add `purchaseInvoice`
```ts
account_setting: null,
// (schema already handles purchaseInvoice as optional)
```
No change needed — `purchaseInvoice` is optional in the schema so `null` / `undefined` is fine as a starting point.

When `postDataToAccounts` is true and user fills in Client Code, prefill `purchaseInvoice` defaults:
```ts
account_setting: {
    clientCode: "", buCode: "", branchId: 0,
    receipt: { debitAccountId: "", creditAccountId: "" },
    purchaseInvoice: { debitAccountId: "", creditAccountId: "", productCode: "*****", defaultProductHsn: "", defaultGstRate: "18" },
},
```
Set this via `form.setValue` in the `useEffect` when `postDataToAccounts` is true and the dialog opens.

### 4d — `onSubmit`: include `purchaseInvoice` in `accountSettingValue`
```ts
const accountSettingValue = (postDataToAccounts && as?.clientCode)
    ? {
        clientCode:  as.clientCode,
        buCode:      as.buCode,
        branchId:    as.branchId,
        receipt: {
            debitAccountId:  as.receipt?.debitAccountId  ?? "",
            creditAccountId: as.receipt?.creditAccountId ?? "",
        },
        ...(as.purchaseInvoice ? { purchaseInvoice: as.purchaseInvoice } : {}),
      }
    : null;
```

### 4e — dialog layout: two tabs
Replace the current single-scroll form body with `<Tabs defaultValue="details">`:

```tsx
<Tabs defaultValue="details">
    <TabsList>
        <TabsTrigger value="details">Details</TabsTrigger>
        {postDataToAccounts && (
            <TabsTrigger value="accounts">Trace+ Accounts Integration</TabsTrigger>
        )}
    </TabsList>

    <TabsContent value="details">
        {/* — all existing fields: ID, Code, Name, Address, State, City, … — */}
    </TabsContent>

    {postDataToAccounts && (
        <TabsContent value="accounts">
            {/* Section: Money Receipt */}
            <p className="section-label">Money Receipt</p>
            {/* Client Code / BU Code / Branch ID (3-col grid) */}
            {/* Debit A/c ID / Credit A/c ID (2-col grid) */}

            {/* Section: Purchase Invoice */}
            <p className="section-label">Purchase Invoice</p>
            {/* Debit A/c ID / Credit A/c ID (2-col grid) */}
            {/* Product Code / Default Product HSN / Default GST Rate (3-col grid) */}
        </TabsContent>
    )}
</Tabs>
```

**Purchase Invoice fields** (register paths under `account_setting.purchaseInvoice.*`):
| Label | Field | Placeholder |
|---|---|---|
| Debit A/c ID | `account_setting.purchaseInvoice.debitAccountId` | Debit account ID |
| Credit A/c ID | `account_setting.purchaseInvoice.creditAccountId` | Credit account ID |
| Product Code | `account_setting.purchaseInvoice.productCode` | e.g. `*****` |
| Default Product HSN | `account_setting.purchaseInvoice.defaultProductHsn` | HSN code |
| Default GST Rate | `account_setting.purchaseInvoice.defaultGstRate` | e.g. 18 |

---

## Step 5 — `edit-division-dialog.tsx`: same changes as Step 4

**File:** `src/features/client/components/configurations/division/edit-division-dialog.tsx`

### 5a — non-closeable: add `onInteractOutside={(e) => e.preventDefault()}`

### 5b — import `Tabs` (same as Step 4b)

### 5c — prefill `purchaseInvoice` in `defaultValues` and `form.reset()`:
```ts
purchaseInvoice: division.account_setting?.purchaseInvoice
    ? { ...division.account_setting.purchaseInvoice }
    : { debitAccountId: "", creditAccountId: "", productCode: "*****", defaultProductHsn: "", defaultGstRate: "18" },
```

### 5d — `onSubmit`: same `purchaseInvoice` spread as Step 4d

### 5e — same two-tab layout as Step 4e

---

## Step 6 — Verify

- Open Add Division with `postDataToAccounts = true` → "Trace+ Accounts Integration" tab visible; outside click does not close.
- Open Add Division with `postDataToAccounts = false` → only "Details" tab; no Accounts tab.
- Fill in Money Receipt + Purchase Invoice → save → re-open in Edit → all fields pre-filled.
- `account_setting` JSON in DB contains `purchaseInvoice` object.

---

## Notes

- `salesInvoice` and `jobInvoice` sections are deferred — the schema and type can be extended later by adding the same `invoiceSubSchema` to both.
- `postDataToAccounts` is read from Redux `selectPostDataToAccounts` — already imported in both dialogs.
