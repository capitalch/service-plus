# Plan: Apply `tran.md` — full `account_setting` structure (receipt + 3 invoice types)

## Context

`tran.md` finalizes the JSON shape of the `division.account_setting` field after user
input. The field must hold a `receipt` block plus three invoice blocks —
`purchaseInvoice`, `salesInvoice`, `jobInvoice` — each with the same five fields,
where the product field is **`productId`** (numeric) and **all account / product /
HSN / GST values are numbers**:

```jsonc
{
  "buCode": "demounit1",
  "branchId": 1,
  "receipt":         { "debitAccountId": 118, "creditAccountId": 389 },
  "purchaseInvoice": { "debitAccountId": 0, "creditAccountId": 0, "productId": 278, "defaultProductHsn": 0, "defaultGstRate": 18 },
  "salesInvoice":    { "debitAccountId": 0, "creditAccountId": 0, "productId": 278, "defaultProductHsn": 0, "defaultGstRate": 18 },
  "jobInvoice":      { "debitAccountId": 0, "creditAccountId": 0, "productId": 278, "defaultProductHsn": 0, "defaultGstRate": 18 },
  "clientCode": "demoAccounts"
}
```

### Current state (already in the codebase)

The division dialogs already support a two-tab layout ("Details" + "Trace+ Accounts
Integration") with `Common`, `Money Receipt`, and a single `Purchase Invoice`
section. But the current model diverges from `tran.md`:

- Invoice product field is named `productCode` (string `"*****"`) — must become `productId` (number).
- All values (`debitAccountId`, `creditAccountId`, HSN, GST, receipt IDs) are **strings** — must become **numbers**.
- `salesInvoice` and `jobInvoice` do not exist yet — must be added.

### Decisions (confirmed with user)

1. **Rename** `productCode` → `productId` everywhere.
2. **Use numbers** for all account / product / HSN / GST values (and receipt IDs).
3. This document is **plan only** — no code changes yet.

### Key fact about the posting flow

`account_setting` is **write-only on the client**: only `add-division-dialog.tsx` and
`edit-division-dialog.tsx` build and persist it (via `genericUpdate`, `JSON.stringify`).
The `accountsPosting` mutation in `accounts-posting-section.tsx` only sends
`{ divisionCode }` — the **backend** reads `account_setting` from the DB to post receipts.
No client code reads `receipt.debitAccountId` directly. So "receipt flow works as before"
= preserve the `receipt` JSON key shape. The only behavioral change is string → number
for the receipt IDs (intended, matches `tran.md`). **This is the main thing to verify
end-to-end.**

---

## Files to change

| # | File | Change |
|---|------|--------|
| 1 | `src/features/client/types/division.ts` | Types → numbers + `productId` + 3 invoice keys |
| 2 | `src/features/client/components/configurations/division/division-schema.ts` | Schema → `z.coerce.number()` + 3 invoice keys |
| 3 | `src/features/client/components/configurations/division/add-division-dialog.tsx` | Defaults, `onSubmit`, UI sections |
| 4 | `src/features/client/components/configurations/division/edit-division-dialog.tsx` | `buildAccountSetting`, defaults, `onSubmit`, UI sections |

No change to `src/types/db-schema-service.ts` (`account_setting` stays `Json`).
No change to `accounts-posting-section.tsx` or any grid.

---

## Step 1 — `division.ts`: types

Replace `InvoiceAccountSettingType` and `AccountSettingType`:

```ts
export type InvoiceAccountSettingType = {
    debitAccountId:    number;
    creditAccountId:   number;
    productId:         number;
    defaultProductHsn: number;
    defaultGstRate:    number;
};

export type AccountSettingType = {
    clientCode: string;
    buCode:     string;
    branchId:   number;
    receipt: {
        debitAccountId:  number;
        creditAccountId: number;
    };
    purchaseInvoice?: InvoiceAccountSettingType;
    salesInvoice?:    InvoiceAccountSettingType;
    jobInvoice?:      InvoiceAccountSettingType;
};
```

---

## Step 2 — `division-schema.ts`: zod schema

Use `z.coerce.number()` so the text/number `<input>`s coerce to numbers on submit
(`branchId` already follows this pattern). Empty inputs coerce to `0`, which matches the
`tran.md` defaults.

```ts
const invoiceSubSchema = z.object({
    debitAccountId:    z.coerce.number().int().min(0),
    creditAccountId:   z.coerce.number().int().min(0),
    productId:         z.coerce.number().int().min(0),
    defaultProductHsn: z.coerce.number().int().min(0),
    defaultGstRate:    z.coerce.number().min(0),
});

export const accountSettingSchema = z.object({
    clientCode: z.string().min(1, "Client code is required"),
    buCode:     z.string().min(1, "BU code is required"),
    branchId:   z.coerce.number().int().positive("Branch ID must be a positive integer"),
    receipt: z.object({
        debitAccountId:  z.coerce.number().int().min(0),
        creditAccountId: z.coerce.number().int().min(0),
    }),
    purchaseInvoice: invoiceSubSchema.optional(),
    salesInvoice:    invoiceSubSchema.optional(),
    jobInvoice:      invoiceSubSchema.optional(),
});
```

`divisionSchema.account_setting` stays `accountSettingSchema.nullable().optional()`.

---

## Step 3 — `add-division-dialog.tsx`

**3a. Default values** (the `if (postDataToAccounts)` block, currently ~line 154).
Replace the single `purchaseInvoice` with all three, numeric, `productId`:

```ts
const DEFAULT_INVOICE = { debitAccountId: 0, creditAccountId: 0, productId: 0, defaultProductHsn: 0, defaultGstRate: 18 };
// ...
form.setValue("account_setting", {
    clientCode: "", buCode: "", branchId: 0,
    receipt: { debitAccountId: 0, creditAccountId: 0 },
    purchaseInvoice: { ...DEFAULT_INVOICE },
    salesInvoice:    { ...DEFAULT_INVOICE },
    jobInvoice:      { ...DEFAULT_INVOICE },
});
```

**3b. `onSubmit`** (~line 234). Receipt IDs become numeric defaults; spread all three
invoices (they're always present once defaults are set, so an unconditional spread is fine):

```ts
const accountSettingValue = (postDataToAccounts && as?.clientCode)
    ? {
        clientCode: as.clientCode,
        buCode:     as.buCode,
        branchId:   as.branchId,
        receipt: {
            debitAccountId:  as.receipt?.debitAccountId  ?? 0,
            creditAccountId: as.receipt?.creditAccountId ?? 0,
        },
        ...(as.purchaseInvoice ? { purchaseInvoice: as.purchaseInvoice } : {}),
        ...(as.salesInvoice    ? { salesInvoice:    as.salesInvoice }    : {}),
        ...(as.jobInvoice      ? { jobInvoice:      as.jobInvoice }      : {}),
      }
    : null;
```

**3c. UI (Accounts tab).**
- Receipt inputs → `type="number"`.
- Existing Purchase Invoice section: rename label **"Product Code" → "Product Id"**, change
  register path `account_setting.purchaseInvoice.productCode` → `...productId`, set numeric
  inputs to `type="number"`, drop the `*****` placeholder (use e.g. `"e.g. 278"`).
- **Add two new sections** mirroring Purchase Invoice — `Sales Invoice` and `Job Invoice` —
  registering under `account_setting.salesInvoice.*` and `account_setting.jobInvoice.*`.
  Reuse the existing `SectionLabel` helper; give each a distinct lucide icon (e.g.
  `ShoppingCart` purchase, `Tag` sales, `Wrench` job — add the new imports).

Each invoice section has 5 fields:

| Label | Register path suffix | Input |
|---|---|---|
| Debit A/c ID | `.debitAccountId` | `type="number"` |
| Credit A/c ID | `.creditAccountId` | `type="number"` |
| Product Id | `.productId` | `type="number"` |
| Default HSN | `.defaultProductHsn` | `type="number"` |
| GST Rate % | `.defaultGstRate` | `type="number"` |

---

## Step 4 — `edit-division-dialog.tsx`

**4a. `DEFAULT_PURCHASE_INVOICE` → `DEFAULT_INVOICE`** (~line 80): numeric, `productId`:

```ts
const DEFAULT_INVOICE = { debitAccountId: 0, creditAccountId: 0, productId: 0, defaultProductHsn: 0, defaultGstRate: 18 };
```

**4b. `buildAccountSetting`** (~line 85): numeric receipt fallbacks + prefill all three
invoices from the stored `account_setting`, falling back to `DEFAULT_INVOICE`:

```ts
receipt: {
    debitAccountId:  as.receipt?.debitAccountId  ?? 0,
    creditAccountId: as.receipt?.creditAccountId ?? 0,
},
purchaseInvoice: as.purchaseInvoice ? { ...as.purchaseInvoice } : { ...DEFAULT_INVOICE },
salesInvoice:    as.salesInvoice    ? { ...as.salesInvoice }    : { ...DEFAULT_INVOICE },
jobInvoice:      as.jobInvoice      ? { ...as.jobInvoice }      : { ...DEFAULT_INVOICE },
```

**4c. `onSubmit`** (~line 244): same numeric receipt + three-invoice spread as Step 3b.

**4d. UI:** identical edits to Step 3c (rename Product Code→Product Id + `productId`,
`type="number"` inputs, add Sales Invoice + Job Invoice sections). Use the `edv_`-prefixed
ids already in use in this file.

---

## Step 5 — Verify

1. **Typecheck / build:** `pnpm tsc -b` (or `pnpm build`) — confirms the `productCode`→`productId`
   rename and number types are consistent; the grep below should return nothing:
   `rg -n "productCode" src` (should be empty after the change).
2. **Add Division** with `postDataToAccounts = true`: the "Trace+ Accounts Integration" tab
   shows Common, Money Receipt, Purchase Invoice, Sales Invoice, Job Invoice. Fill values,
   save, then inspect the persisted `division.account_setting` JSON — it must contain
   `receipt` + all three invoice objects with **numeric** values and a `productId` key
   (matching the `tran.md` shape).
3. **Edit Division**: reopen the saved division → every field (receipt + 3 invoices) is
   pre-filled from the stored JSON.
4. **Receipt posting regression (critical):** with a division whose `account_setting.receipt`
   holds valid numeric `debitAccountId`/`creditAccountId`, run **Accounts Posting** from the
   Accounts Posting section and confirm receipts post successfully — i.e. the backend accepts
   the numeric receipt IDs. If the backend rejects numbers, reconsider keeping receipt IDs as
   strings (see Context note).

---

## Notes / risks

- The string→number switch changes the persisted JSON for **existing** divisions only when
  they are next re-saved; old rows keep their string values until edited. Backend should
  tolerate both, or a data migration may be needed — confirm during Step 5.4.
- `productId` default is `0` for a fresh form (the old `"*****"` wildcard no longer applies).
  `tran.md`'s `278` is illustrative of a populated value, not a default.
- `salesInvoice` / `jobInvoice` are schema-`.optional()` but always written because defaults
  populate them; this matches `tran.md` (all three present).
