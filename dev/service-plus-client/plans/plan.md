# Customer Connect grid — consolidated WhatsApp status column

## Context

`plans/prompt1.md` asks for a redesign of how WhatsApp completion-message status is
shown in the Customer Connect grid: a single **Whatsapp** column showing success
count, fail count, last-try timestamp, and last status — "stacked in a colorful and
nice manner" — replacing today's two separate columns. It also restates the
already-implemented rule that a row starts unchecked once any send has been attempted
(success or failure), so resending is always deliberate.

This is a **pure client-side presentational change**. Every field the new column
needs — `attempt_count`, `success_count`, `fail_count`, `last_wamid`, `last_sent_at`,
`last_status`, `last_error` — already exists on `WhatsappCompletionState`
(`customer-connect-schema.ts:1-9`), is already fetched by
`GET_WHATSAPP_ELIGIBLE_JOBS_PAGED` (server), and is already kept live via the
`whatsappDeliveryStatus` subscription patch in `customer-connect-section.tsx`. No
server, SQL, GraphQL, or type changes are needed.

## What already satisfies the prompt (no change needed)

- **"One customer can be sent messages multiple times"** — already true; nothing
  blocks a resend.
- **"After each attempt, the column is updated"** — already true via the existing
  live subscription patch (`startDeliveryTracking` → `setRows`); the new column reads
  from the same `getCompletionState(row)` helper, so it inherits this for free.
- **Checkbox default-unchecked-after-any-attempt** — already implemented exactly as
  described: `customer-connect-section.tsx:122` —
  `if (isRowSelectable(row) && !hasAnyPriorAttempt(row))`. `isRowSelectable` only
  gates on a valid mobile number (whether the row is checkable at all); prior-attempt
  only affects the *default* checked state, so a user can still manually check a row
  to resend. Confirmed against `hasAnyPriorAttempt` in `customer-connect-helpers.ts:16-19`.

## The actual change: consolidate two columns into one

**Clarified with the user:** replace the current `Msgs Sent` + `Delivery` columns
(`customer-connect-grid.tsx`) with a single `Whatsapp` column, not three separate
columns — the prompt's two phrasings ("3 columns" vs "1 stacked column") described the
same intent, refined.

**File: `src/features/client/components/jobs/customer-connect/customer-connect-grid.tsx`**

1. Delete `MsgsSentBadge` (lines 41-63) and `DeliveryBadge` (lines 26-39).
2. Add one `WhatsappStatusCell` component, reusing `getCompletionState(row)` (no
   change needed to that helper) and the existing `DELIVERY_BADGE_STYLES` color map
   (lines 18-24, unchanged) for the status badge — keeps the same color language
   already established (slate/blue/emerald/red) rather than inventing a new palette.
   Stacked, top to bottom, matching the prompt's own field order:
   - Success/Failed row: two small pill badges side by side — `✓ {success_count}`
     (emerald) always shown, `✕ {fail_count}` (red) shown only when `fail_count > 0`
     (mirrors the existing "only show the failed badge when relevant" pattern from
     `MsgsSentBadge`, so the column doesn't clutter for the common all-success case).
   - `Last try: <date>` — `last_sent_at` formatted with both date **and** time
     (`toLocaleString()`, not today's date-only `toLocaleDateString()`), since the
     prompt explicitly asks for "date time".
   - Last status badge — `last_status` through the existing `DELIVERY_BADGE_STYLES`
     map, same as today's `DeliveryBadge`, `title={state.last_error}` preserved for
     the failed-hover tooltip.
   - Empty state (`!state`, i.e. never attempted): a single muted `—`, matching the
     existing empty-state convention used elsewhere in this grid.
3. Header: replace the two `<th>Msgs Sent</th><th>Delivery</th>` entries (lines
   169-170) and the loading-skeleton header array (line 138, currently 13 columns)
   with one `<th>Whatsapp</th>` — column count in the skeleton (`Array.from({length:13})`,
   line 139) drops to 12 to stay in sync.
4. Body row: replace the two `<td>` cells (lines 224-225) with one
   `<td><WhatsappStatusCell row={row} /></td>`.

No changes to `customer-connect-schema.ts`, `customer-connect-helpers.ts`,
`customer-connect-section.tsx`, or any server file.

## Verification

- `tsc --noEmit` clean.
- Visual check in the running app: a job with no prior attempt shows `—`; a job with
  only successes shows the success pill + last try + a green/emerald status badge, no
  red pill; a job with a failed attempt shows both pills and a red status badge with
  the error on hover; a live send updates the cell in place without a page refresh
  (same subscription path as today, unchanged).
