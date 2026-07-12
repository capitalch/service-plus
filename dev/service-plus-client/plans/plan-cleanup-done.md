# Dead Code Removal — service-plus-client

> **Scope:** Concrete, executable steps to remove verified dead code from `src/`.
> Derived from a `knip` run (via `pnpm dlx knip`) plus manual grep verification.
> Steps are ordered so each batch leaves the build green. **This file is the plan —
> nothing here has been executed yet.**
>
> **Golden rule:** after every Step below, run the verification gate:
> ```bash
> pnpm build   # tsc -b && vite build
> pnpm lint
> ```
> If either fails, stop and inspect before the next step. Removing an export can cascade
> (a deleted file may free types/exports elsewhere), so re-run `pnpm dlx knip` after
> Batch 2 to catch newly-orphaned symbols.

---

## Workflow

```
Batch 1 (zero-risk)     Batch 2 (low-risk, cascades)      Do NOT touch
─────────────────       ────────────────────────────      ─────────────
Step 1 delete files  →  Step 4 redux dead exports      →  generated db-schema-*.ts
Step 2 remove deps   →  Step 5 orphan-tied types/exports    shadcn/ui re-exports
Step 3 dedupe exports   Step 6 re-run knip + build          cross-env / pg-to-ts deps
   ↓ build gate            ↓ build gate
```

Batch 1 is safe to do and commit on its own. Batch 2 is safe but higher-churn — do it in
one sitting with a build gate at the end.

---

## BATCH 1 — Zero-risk removals

### Step 1 — Delete 10 orphan files

Verified: none are imported anywhere in `src` (string matches exist only inside help
doc-text, not real imports). `client-dashboard-page.tsx` is not routed. From the repo
root:

```bash
git rm \
  src/components/ui/command.tsx \
  src/components/ui/input-group.tsx \
  src/features/client/components/consumption-section.tsx \
  src/features/client/components/inventory/part-finder/part-finder-stock-chart.tsx \
  src/features/client/components/jobs/accounts-posting/accounts-posting-schema.ts \
  src/features/client/components/jobs/final-a-job/change-division-modal.tsx \
  src/features/client/components/reports/_common/use-report-range.ts \
  src/features/client/pages/client-dashboard-page.tsx \
  src/features/client/types/job-invoice.ts \
  src/lib/string-utils.ts
```

> `command.tsx` → `input-group.tsx` are a dead *pair* (only `command.tsx` imported
> `input-group.tsx`); both go together.

**DO NOT delete** `src/types/db-schema-client.ts` or `src/types/db-schema-security.ts` —
knip flags them as unused files, but they are **generated** by `pnpm gen-types-client` /
`gen-types-security` (pg-to-ts) and are the authoritative type source per `claude.md`.

**Gate:** `pnpm build && pnpm lint`.

### Step 2 — Remove 3 unused dependencies

Order matters: `cmdk` is only used by `command.tsx`, so remove it *after* Step 1.

```bash
pnpm remove @base-ui/react date-fns cmdk
```

- `@base-ui/react` — zero usage in `src`.
- `date-fns` — zero usage in `src`.
- `cmdk` — only `command.tsx` used it (deleted in Step 1).

**DO NOT remove** `cross-env` or `pg-to-ts` — knip calls them unused devDeps, but both are
invoked by the `gen-types-*` scripts in `package.json`.

**Gate:** `pnpm build && pnpm lint`.

### Step 3 — Normalize 2 duplicate exports

Both symbols are imported as **default** in `src/router/index.tsx`
(`import App from '../app'`, `import LoginPage from '../features/auth/pages/login-page'`),
so drop the redundant *named* export by removing the `export` keyword from the `const`.

**`src/app.tsx`** (line 12): change
```ts
export const App = () => {
```
to
```ts
const App = () => {
```
Keep `export default App;` at the bottom.

**`src/features/auth/pages/login-page.tsx`** (line 8): change
```ts
export const LoginPage = () => {
```
to
```ts
const LoginPage = () => {
```
Keep `export default LoginPage;` at the bottom.

**Gate:** `pnpm build && pnpm lint`.

---

## BATCH 2 — Low-risk export pruning (build gate at end)

### Step 4 — Remove dead redux action-creators & selectors

Confirmed via grep that none are dispatched/selected anywhere. Delete the individual
export lines (or the whole symbol) in each slice. Redux Toolkit still generates the
reducer from the slice; only the *unused* exported members are removed.

- **`src/features/auth/store/auth-slice.ts`** — remove exports:
  `authSlice` (re-export), `setSelectedClient`, `updateUser`, `refreshTokens`,
  `selectAuthToken`, `selectAvailableBus`, `selectLastUsedBranchId`, `selectLastUsedBuId`,
  `selectRefreshToken`, `selectSelectedClientId`.
- **`src/store/context-slice.ts`** — remove exports:
  `contextSlice` (re-export), `setBuGstStateCode`, `setBuGstin`, `setCompanyName`,
  `setIsGstRegistered`, `selectBuGstStateCode`, `selectBuGstin`, `selectIsGstRegistered`.
- **`src/features/super-admin/store/super-admin-slice.ts`** — remove exports:
  `addAdminUser`, `addClient`, `setActivityLog`, `setAdminUsers`, `toggleAdminUserActive`,
  `toggleClientActive`, `selectActivityLog`, `selectAdminUsers`.

> For action creators pulled from `slice.actions`, delete the destructured name from the
> `export const { … } = slice.actions` line. For selectors, delete the exported `const`.

### Step 5 — Remove orphan-tied schemas, helpers & types

These become fully dead once Batch 1 lands (their only consumers were deleted files) or
were already never imported. Delete the export, or drop the `export` keyword if the symbol
is still used locally in its own file.

**Unused schema/helper value-exports:**
- `messages.ts`: `getMessage`, `VALIDATION_MESSAGES`, `ERROR_MESSAGES`, `SUCCESS_MESSAGES`
- `reports/_common/fiscal.ts`: `clampMonth`, `endOfDay`, `endOfMonth`, `formatShortDate`,
  `getFiscalQuarterBounds`, `getMonthlyTickList`, `getPreviousFiscalYearBounds`,
  `getRangeLabel`, `monthList`, `startOfWeek`
- `reports/_common/formatters.ts`: `formatDateIso`, `formatInrPrecise`
- `deliver-job-pdf.ts`: `buildDeliverJobPdf`, `buildMultiJobDeliveryPdf`
- `job-sheet-pdf.ts`: `downloadJobSheet`, `openJobSheetInTab`
- `job-badges.tsx`: `JOB_TYPE_COLORS`, `jobTypeColor`, `statusBadgeClass`
- Never-consumed schemas: `accountSettingSchema`, `transferLineSchema`, `loanLineSchema`,
  `openingStockLineSchema`, `purchaseLineSchema`, `getInitialPurchaseLine`,
  `batchJobRowSchema`, `deliverJobSchema`, `getDeliverJobDefaultValues`,
  `newPartUsedLineSchema`
- Misc: `searchHelpArticles`, `ROLE_SHORT_NAMES`, `receiptJobRestrictionReason`,
  `isRemembered`, `emptyTransferLine`, `emptyAdjustmentLine`, `emptyLoanLine`,
  `emptyOpeningStockLine`, `DEFAULT_FILTERS`, `stockStatusLabel`, `tables`

**Unused authored type-exports** (de-export or delete; skip generated
`db-schema-service.ts` types):
- `super-admin/types/index.ts`: `ClientWithAdminsType`, `AdminUserRoleType`,
  `ActivityActionType`, `AuditActorType`, `AuditResourceType`, `AuditActionCountType`,
  `AuditActorCountType`, `AuditOutcomeCountType`, `AuditTimeSeriesPointType`,
  `AuditLogHealthType`, `PlatformStatsType`, `ServerInfoType`, `ApplicationSettingsType`,
  `AuditLogSettingsType`, `SecuritySettingsType`, `SmtpSettingsType`,
  `SuperAdminSettingsType`
- `client/types/*`: `StockBranchTransferLineType`, `BranchTransferLineFormItem`,
  `InvoiceAccountSettingType`, `AccountSettingType`, `MappedField`, `BatchJobRow`,
  `JobBatchListRow`, `LookupMessages`, `PartFinderFiltersType`, `ReceiptFormValuesType`,
  `StockAdjustmentLineFormItem`, `StockAdjustmentLineType`, `StockAdjustmentWithLines`,
  `StockLoanLineType`, `LoanLineFormItem`, `OpeningStockLineFormItemType`,
  `OpeningStockLineType`
- deliver-job / part-used / reports: `PdfJobDetail`, `DeliverJobFormValues`, `JobPartLine`,
  `JobChargeLine`, `JobPayment`, `TransitionFields`, `JobInfoPartRow`, `JobInfoChargeRow`,
  `JobInfoFileRow`, `JobInfoPaymentRow`, `JobControlRow`, `MonthEntryType`,
  `ReportPdfMetaType`, `ReportPdfColumnType`, `ReportPdfRowType`, `ColumnAlignType`,
  `XlsxSheetType`, `PhysicalTotals`, `PurchaseLineFormItem`
- `lib`: `BuContextType`, `GenericUpdateValueType`, `XDataItemType`
- help: `ContentBlock`, `HelpFaq`

> If a type is still referenced *within its own file*, drop only the `export` keyword. If
> it is referenced nowhere, delete the declaration entirely.

### Step 6 — Re-run knip, then final gate

```bash
pnpm dlx knip --no-progress
pnpm build && pnpm lint
```

Deleting Batch 1 files and Batch 2 exports frees new orphans (e.g. types that only the
deleted files used). Clear any *newly* reported unused symbols the same way, then confirm
the build/lint gate passes.

---

## Explicitly OUT OF SCOPE (do not remove)

| Item | Why keep |
|------|----------|
| `src/types/db-schema-service.ts` (and its ~90 "unused" interfaces) | Generated by `pnpm gen-types-service`; file **is** imported; unused interfaces are expected in codegen output |
| `src/types/db-schema-client.ts`, `db-schema-security.ts` | Generated codegen artifacts, regenerated on demand |
| `cross-env`, `pg-to-ts` (devDeps) | Used by `gen-types-*` package scripts (knip false positive) |
| shadcn/ui re-exports (`buttonVariants`, `DialogClose`, `SelectGroup`, `DropdownMenuSub`, `TableCaption`, …) | Part of upstream shadcn component API; removing diverges from the library with no real benefit |

---

## Optional follow-up (separate change) — `index.ts` barrel cleanup

`claude.md` forbids re-exporting via `index.ts`. Two active barrels remain and could be
inlined in a dedicated refactor (not part of dead-code removal, since they are live):

- `src/features/client/components/shared/customer-select/index.ts` — consumers import
  `CustomerInput` from it (4 files). Inline those imports to the real module, then delete
  the barrel and its unused re-exports (`CustomerSearchModal`, `CustomerInputProps`,
  `CustomerSearchModalProps`).
- `src/features/client/components/shared/model/index.ts` — consumers import
  `AddModelDialog` / `ModelCombobox` (4 files). Inline, then delete the barrel and its
  unused re-export (`LocalCombobox`).

---

## Summary

| Step | Action | Risk |
|------|--------|------|
| 1 | Delete 10 orphan files | none |
| 2 | Remove 3 deps (`@base-ui/react`, `date-fns`, `cmdk`) | none |
| 3 | Normalize 2 duplicate exports (`App`, `LoginPage`) | none |
| 4 | Remove ~26 dead redux exports across 3 slices | low |
| 5 | De-export/delete ~35 value exports + ~66 authored types | low |
| 6 | Re-run knip, clear cascades, final build/lint | low |
