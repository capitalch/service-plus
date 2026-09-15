# Service+ as a paid multi-tenant offering — strategy, pricing, and tenant model

## Goal

Answer four questions from `plans/prompt.md`: subscription strategy/pricing for outside
customers; whether small customers can share one `client` as separate BUs or need their
own; whether "one client, many customer-BUs, me as admin" is workable; confirm big
companies get their own `client`. Strategy document — no code changes.

## Present context

`service_plus_client` DB holds one `client` row per tenant (`db_name` → that tenant's own
Postgres DB). Each tenant DB has a `security` schema plus one Postgres schema per Business
Unit, cloned from `demo1`. `user_bu_role` (`user_id, bu_id, role_id`) scopes a login to
specific BUs; `user_type` `S`/`A` (Super Admin/Business Admin) bypasses every check.
`client` carries no subscription/plan/billing/usage concept today — every tenant is
provisioned identically. WhatsApp is **one shared Meta phone number and display name
("Service Support") across every tenant** — not per-tenant config, a Meta Business Manager
setting on the one number.

## Key constraint — blocks every tenant-model option equally

Traced request authorization end to end: `resolve_generic_query`/`resolve_generic_update`
take `db_name` and `schema` as plain GraphQL arguments — the client's own request, never
checked against the JWT's `context["db_name"]` or the caller's `user_bu_role` rows.
`require_access_right` only checks a right **code** against the token; it's never passed
`db_name`/`schema`. Today this is harmless — one trusted first-party client, one company.
The moment two paying, mutually-untrusting customers share this platform — under any of
the four options below, **including separate `client` DBs per company** — a logged-in user
can edit `db_name`/`schema` in a request and reach another tenant's or BU's data.

**Fix is a prerequisite for selling to outside customers under any shape, not a choice
between options.** Add `require_own_tenant`/`require_bu_access` guards
(`auth_guards.py`), wired into every `genericQuery`/`genericBatchQuery`/`genericUpdate`/
`genericUpdateScript` resolver, checking `context["db_name"] == db_name` and (bypass, or a
`user_bu_role` row for the BU named by `schema`). See Implementation.

## The four tenant-model questions

1. **Misc customers sharing one `client` as separate BUs** — technically shaped for it
   (schema-per-BU already isolates their data; `user_bu_role` scopes a login to one BU) but
   **not safe until the fix above ships**. Even then, one `client` row means no
   per-customer subscription status, invoice, or independent suspend/cancel — only sensible
   for accounts billed manually outside the app, not real subscribers.
2. **You as admin, one user per BU** — workable, same prerequisite. Schema already
   supports a small per-BU role hierarchy (multiple `user_bu_role` rows, different roles)
   with no changes, if a customer ever needs owner+staff logins.
3. **Big companies as separate `client` DBs, multi-BU each** — the right default, and the
   direction the schema already assumes. Narrows *accidental* cross-tenant exposure even
   pre-fix (the UI never constructs a foreign `db_name` on its own) though it doesn't close
   the gap on its own — a crafted request is exactly as unguarded as under option 1.
4. **Subscription strategy and pricing** — see below.

## Pricing structure for India (value-based)

**Extended Warranty is excluded from general pricing** — it's a Sony-service-program
feature, not applicable to a general repair-shop customer, so it plays no role in tier
differentiation below. It stays available as a separate line for Sony-authorized centers
specifically, priced outside this table if/when that segment is pursued.

**Unit of sale: per BU/month**, not per user — staff count is small and fluid; a BU (one
shop location) is the stable unit customers already think in, and maps directly onto the
existing schema-per-BU boundary.

| Tier | Price | Includes |
|---|---|---|
| **Starter** | ₹999/mo (₹9,999/yr) | 1 BU. Job pipeline, GST invoicing, inventory, basic reports. One WhatsApp event (Job Completion), modest send allowance. |
| **Growth** | ₹1,999/mo (₹19,999/yr) | Everything in Starter + all five WhatsApp lifecycle sends (intake, completion, delivery, receipt, invoice), audit log, full report suite. ~300 utility-category WhatsApp conversations/month included. |
| **Multi-location** | ₹1,999 (BU 1) + ₹1,499/additional BU, ₹1,199/BU from the 6th | Growth features on every BU. A 3-branch shop: ₹4,997/month. |

**Metered**: utility WhatsApp sends beyond the included allowance at ₹2–3/conversation,
passed through near Meta's actual cost rather than bundled unmetered (bundling means your
heaviest, most-likely-to-renew users are subsidized by light ones).

**One-time setup fee** (₹4,999–₹14,999, scaled by BU count) only for dedicated-`client`
onboarding (DB provisioning, migration, training) — waived for self-serve Starter/Growth.

**Trial**: 30-day full-feature trial on one real BU, no card. **Annual discount** ≈2 months
free, already reflected above. The **Misc-customers bucket** (question 1) stays a ₹0-in-
platform option billed manually, kept explicitly separate from this table.

## Competitor comparison (India)

Filtered to competitors in the same vertical — electronics/computer/mobile repair, not
automotive garage management (GaragePlug, RAMP removed) — that also have **both**
job-ticket/technician workflow **and** parts inventory management, a bar Vyapar and Zoho
Books/Inventory don't clear (generic GST/billing tools, no job-ticket workflow at all).

| | URL | Vertical | Price (India) | Customer updates |
|---|---|---|---|---|
| **RepairDesk** | [repairdesk.co](https://www.repairdesk.co/) | Mobile/computer/electronics repair | $99–149/mo (≈₹8,200–12,400) | SMS/email |
| **BytePhase** | [bytephase.com](https://bytephase.com/) | Computer/electronics repair, India | ~₹249–299/mo | Not stated (no WhatsApp mentioned) |
| **Service+ (proposed)** | — | Electronics repair, India-native | ₹999–1,999/mo single location | **WhatsApp-native** |

**The gap**: both have job-ticket + inventory, so that's not the differentiator —
price and channel are. RepairDesk sits well above Growth tier's ₹1,999 and, per search
results, updates customers by SMS/email, not WhatsApp — a materially weaker channel for
the Indian market. BytePhase undercuts Service+ on raw price; if that holds up on closer
inspection, price alone won't be the pitch against it — WhatsApp-native automation and
India-specific GST depth would need to be.

*(Both found via web search this session, not verified beyond search snippets — no
WhatsApp support surfaced for BytePhase, but that's an absence-of-evidence, not confirmed
absence. Verify directly before quoting a prospect.)*

## Marketing and promotion

This segment (small/mid electronics-repair shop owners in India) responds to trade-network
word-of-mouth and a live demo far more than broad digital ads — prioritize accordingly:

1. **Lead with a live demo of the WhatsApp automation, not a feature list.** Showing an
   owner their *own phone* receiving the "job ready for pickup" message in real time is the
   single most concrete, shareable proof of value this product has — it's the one thing
   neither competitor above does. Make it the first five minutes of every pitch.
2. **Go where repair shops already cluster.** This trade is geographically concentrated
   (electronics/mobile markets — Lamington Road, Nehru Place, SP Road, and city-equivalents)
   and tightly networked through local trade associations and WhatsApp groups. A handful of
   credible shops in one such cluster, converted and vocal, will refer more of their
   neighbors than any ad spend reaches.
3. **Referral program, not ad budget, as the primary paid-acquisition channel** — one month
   free for both referrer and referee fits the existing per-BU pricing with no new
   infrastructure, and this trade refers within itself constantly.
4. **Partner with spare-parts distributors/wholesalers** who already supply these shops —
   they have a direct incentive in their retail customers running efficiently (and ordering
   more predictably through better inventory visibility); a distributor co-referral or
   bundled offer is a warm channel, not cold outreach.
5. **Comparison SEO content against the named competitors above** — "RepairDesk/BytePhase
   alternative for Indian repair shops," pricing-comparison pages — targets people already
   searching and comparing, which is cheap, high-intent inbound now that real competitor
   names and prices are known.
6. **Sony-authorized service centers as a separate, warm enterprise channel for Extended
   Warranty specifically** — that feature's program-specific nature (kept out of general
   pricing above) is exactly what makes a direct approach to Sony's service-network program
   managers a distinct, higher-touch track from the self-serve Starter/Growth motion, not
   something to blend into the general marketing above.
7. **Every self-serve channel should point at the 30-day trial, not a sales call** — Starter
   and Growth are priced and provisioned (schema-clone BU setup) to be frictionless; making
   a prospect talk to someone before they can try it undermines that on purpose-built
   low-touch tiers.

## Implementation (Step 0 only — the prerequisite fix)

1. `auth_guards.py`: add `require_own_tenant(info, db_name)` and
   `require_bu_access(info, db_name, schema)`.
2. Wire both into every `genericQuery`/`genericBatchQuery`/`genericUpdate`/
   `genericUpdateScript` resolver — all of them, since none currently check.
3. Verify no legitimate cross-tenant/cross-BU call breaks — check Super Admin's
   provisioning/cross-tenant resolvers specifically (already `user_type='S'`, should bypass
   by design, but confirm before shipping).
4. Decide explicitly whether Business Admin (`user_type='A'`) bypasses the BU-level check
   within their own tenant (likely yes, matching `is_admin`'s existing meaning) — a
   deliberate choice, not an accident of how the guard is written.

## Testing

Scoped user (BU A only) sends `schema=B` on the same tenant → rejected. Same user,
different tenant's `db_name` → rejected. Super Admin → both still succeed. Business Admin
on their own tenant, BU with no `user_bu_role` row → confirm intended behavior explicitly.

## Flags and constraints

- Research-only session; no code changed.
- Shared WhatsApp display name is a Meta/cost decision, not fixable in code — disclose to
  prospects rather than paper over.
- Pricing is structural + a first competitor pass; rupee figures deserve a second, sharper
  pass against current published rates before use in a sales conversation.
