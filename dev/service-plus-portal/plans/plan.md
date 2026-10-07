# Service+ subscription plans and marketing strategy

## Goal

- Decide what Service+ should charge, what each plan includes, and how to sell it, based on a review of today's offer and the Indian repair-software market as of October 2026.
- Outcome: Lite stays the free way in, Basic becomes an easy first payment, Standard stays the plan most customers should end up on, Enterprise is for groups and brand service centres.
- **Easy to implement is a hard requirement.** Every change below is either an `.env` value, portal text, or a small change that copies a pattern already in the code. Nothing needs a new table, a new screen or a payment gateway.
- Decisions already made (kept): the four plan names and codes (`lite`, `basic`, `standard`, `enterprise`), Lite is free, prices live in the server `.env` and the portal reads them live, bank-transfer payment, view-only when a month goes unpaid, fees stamped on the business unit at approval.

## Present context and current design

### Today's offer (`content/pricing.ts`, `service-plus-server/app/core/plan_prices.py`)

- **Lite** — free, 1 user, 50 jobs a month, head office only, no inventory, no WhatsApp.
- **Basic** — ₹2,999 a month + ₹2,000 setup, 1 user, 100 jobs, head office only, no inventory, 100 WhatsApp messages.
- **Standard** ("Most popular") — ₹5,999 a month + ₹2,000 setup, multiple users, 500 jobs, unlimited branches, inventory, 500 WhatsApp messages.
- **Enterprise** — ₹10,999 a month + ₹5,000 setup, 5 business units on a dedicated database (₹3,000 a month each extra), unlimited jobs, 2,000 WhatsApp messages.
- Payment: monthly in advance, up to 5 years ahead, **no discount for paying ahead** — the server refuses any amount below fee × months (`_check_amount` in `app/graphql/resolvers/bu_admin/billing.py`).

### What the product actually enforces

- Only the **branch limit** (`app/graphql/resolvers/masters/branches.py`, `BRANCH_LIMIT_REACHED`).
- Users, jobs per month, inventory and the WhatsApp quota are website promises only; nothing checks them.

### The market (October 2026)

- **Indian small-shop repair tools are cheap:** RepairSoft ₹599/month (tickets, invoices, purchases, WhatsApp, 30-day trial); RepairWorks ₹999/month (500 jobs, inventory, GST, WhatsApp); CRMJIO ₹249/user; Repairing Shop Manager from ₹99/month; Smart Repair Desk free tier, about $10/month Pro.
- **GST billing apps shops already know:** Vyapar about ₹3,400–4,000 a year, myBillBook ₹399–3,990 a year.
- **International repair software is far higher:** RepairDesk $99–149 per store a month (≈ ₹8,300–12,500), RepairShopr $70–150 a month — aimed at multi-technician, multi-store businesses.
- **WhatsApp costs us very little:** ₹0.145 per delivered utility message in India (charged inside the 24-hour window too since 1 October 2026). 500 messages ≈ ₹73.
- Market norms: a free tier or trial, WhatsApp and inventory included even at the cheapest paid tier, yearly plans at a discount.

### Diagnosis

1. **Basic is the weak point.** ₹2,999 is 3–5× local tools that include inventory and WhatsApp, yet Basic has no inventory and one user. A shop outgrowing Lite has no reason to pick it.
2. **Standard is fairly priced for the right buyer** — about half of RepairDesk, with branch stock, warranty batch intake, scorecards and roles. It should not chase the one-counter mobile shop.
3. **Setup fees on Basic/Standard** add friction where competitors charge none.
4. **No yearly discount** — the easiest lever for cash up front and lower churn is missing.
5. **Allowances are stingy** for something that costs us paise.
6. **Unenforced limits** mean the only real reason to upgrade today is a second branch.

## New design brief

- Position Service+ as software for **service centres with a team**; Lite stays the free door for small shops → Step 5.
- New prices: Basic ₹1,499, Standard ₹4,999, Enterprise ₹9,999; no setup fee on Basic and Standard; Basic gets 2 users and inventory; bigger job and WhatsApp allowances → Step 1, Your Part D.
- Yearly: pay 10 months, get 12 → Step 2.
- Founding-customer offer that needs no code → Step 3.
- Enforce just the two limits that drive upgrades: users and inventory → Step 4.
- Go-to-market plan → Step 5. Review after 8 weeks → Step 6.
- Left for later, only if numbers say so: job-count warnings, WhatsApp quota enforcement and top-up packs.

## Key constraints of new design

1. **Must be easy to build.** Resolution: prices are `.env` values; plan contents are portal text; the yearly discount is one rule in an existing check; the user limit copies the branch-limit pattern; inventory gating reads the `planCode` already in the client store. Starter-vs-full inventory, usage meters and top-up packs were dropped for this reason.
2. **No willingness-to-pay data yet.** Resolution: Your Part A talks to 10–15 owners before launch; Step 6 reviews after 8 weeks. Prices are `.env` keys, so changing them needs only a restart.
3. **Existing customers are on old prices** (fee stamped on `security.bu`). Resolution: Your Part E moves Basic customers to ₹1,499 at once using the existing change-plan screen; Standard customers move to ₹4,999 at renewal. Nobody pays more.
4. **The JSON-LD and pre-built HTML use the fallback prices in `content/pricing.ts`.** Resolution: Step 1 updates them in the same release as Your Part D.
5. **Basic is head office only**, so giving it inventory needs no "starter inventory" version — its stock is naturally one location. Resolution: Basic simply gets `inventory: true`.
6. **Turning on limits could disrupt a shop.** Resolution: Step 4 only blocks deliberate admin actions (adding a user, opening inventory on Lite); job intake is never blocked. Existing customers already over a limit keep what they have; only new additions are refused.
7. **Red is reserved for errors.** Resolution: the yearly-saving and founding badges use primary/success colours.

## Steps

### Step 0 — Your Part

- **A. Check the prices with real owners (before Your Part D).** Talk to 5 single-counter mobile shops, 5 multi-technician workshops and 3–5 authorised service centres: what they use and pay, jobs a month, staff, branches, stock. Show them the new ladder. If most multi-technician workshops balk at ₹4,999, use ₹3,999 for Standard instead.
- **B. Replace the placeholders in `content/site-config.ts`** (address, phone, WhatsApp, bank details) before any marketing in Step 5.
- **C. Run the channels in Step 5.**

### Step 1 — New plan ladder (portal text and server defaults)

Needs: Your Part A.

- **Explanation:** change the plan list and wording to the new ladder. No logic changes.

  | | Lite | Basic | Standard | Enterprise |
  |---|---|---|---|---|
  | Monthly | Free | ₹1,499 | ₹4,999 | ₹9,999 |
  | Yearly (10 months' price) | — | ₹14,990 | ₹49,990 | ₹99,990 |
  | Setup fee | — | none | none | ₹5,000 (includes data import) |
  | Users | 1 | 2 | 15 | unlimited |
  | Jobs a month | 50 | 300 | 1,500 | unlimited |
  | WhatsApp messages a month | 30 | 300 | 1,500 | 5,000 |
  | Spare-parts inventory | — | ✓ (head office) | ✓ (by branch) | ✓ |
  | Branches | Head office | Head office | Unlimited | Unlimited |
  | Business units | 1 | 1 | 1 | 5 included, ₹2,500/month each extra |

- Why these numbers:
  - Basic ₹1,499 is above the ₹599–999 local tools, justified by GST invoicing, warranty handling and reports, but low enough to be an easy first payment. 2 users removes the "I just hired someone" blocker; inventory answers the most common reason to leave Lite.
  - Standard ₹4,999 is under half of RepairDesk and a clear 3× step over Basic, earned by branches, branch stock, roles and team size.
  - Lite gets 30 WhatsApp messages so free users see it work with real customers — the cheapest upgrade hook (≈ ₹4 a month to us).
  - No setup fee on Basic/Standard removes the main sign-up objection; yearly cash (Step 2) covers onboarding.
- **Path:**
  - `content/pricing.ts` — the plan values; replace `users: "multi" | "single"` with `usersLimit: number | null`; update `usersLabel()`; `extraBuMonthlyFee = 2500`.
  - `components/pricing/plan-comparison-table.tsx` — Users row reads `usersLimit` ("Unlimited" when null); add a "Yearly price" row (10 × monthly, "—" for Lite).
  - `components/pricing/plan-card.tsx` — a line under the price: "or ₹14,990 a year — 2 months free".
  - `components/pricing/plan-recommender.tsx` — use `usersLimit` where it reads `users`.
  - `content/faq.ts` — "What does 1 user mean?", "Can I pay in advance?" (now: 12 months for the price of 10), "Do I need to pay to try?" (no setup fee except Enterprise).
  - `service-plus-server/app/core/plan_prices.py` — the new default prices.
  - Text over two words goes in `constants/messages.ts`.
- **Code (`content/pricing.ts`, Basic):**
  - Old: `inventory: false, jobsPerMonth: 100, monthlyPrice: 2999, setupFee: 2000, users: "single", whatsappPerMonth: 100`
  - New: `inventory: true, jobsPerMonth: 300, monthlyPrice: 1499, setupFee: 0, usersLimit: 2, whatsappPerMonth: 300`
  - The other plans follow the table. Run `pnpm format` on touched files.

### Your Part D and E — after Step 1

- **D. Set the new prices in the server `.env`.** `PRICE_BASIC_MONTHLY=1499`, `PRICE_BASIC_SETUP=0`, `PRICE_STANDARD_MONTHLY=4999`, `PRICE_STANDARD_SETUP=0`, `PRICE_ENTERPRISE_MONTHLY=9999`, `PRICE_ENTERPRISE_SETUP=5000`, `PRICE_EXTRA_BU_MONTHLY=2500`. Restart the server.
- **E. Move existing customers (after Your Part D).** Existing Basic customers to ₹1,499 now via the admin change-plan screen; note Standard customers' renewal dates.

### Step 2 — Yearly price: 12 months for the price of 10

Needs: Step 1.

- **Explanation:** today `_check_amount` requires at least fee × months. Change how the amount due is worked out: each full 12 months costs 10 × the monthly fee; leftover months cost the normal fee. So 12 months = 10× fee, 24 months = 20× fee, 15 months = 13× fee. Everything else in the payment flow (receipt, `paid_through`, 5-year cap, rebase on plan change) stays as it is. The billing screen in the client already shows the amount due from the server, so no client change beyond the hint text.
- **Path:** `service-plus-server/app/graphql/resolvers/bu_admin/billing.py` (where `due_paise` is computed before `_check_amount`), its test file under `service-plus-server/tests/`, and the FAQ from Step 1.
- **Code:**
  - Old: due = monthly fee × months.
  - New: due = monthly fee × (10 × (months ÷ 12, whole years) + months left over after whole years).

### Step 3 — Founding-customer offer (no code)

Needs: Step 1.

- **Explanation:** the first 50 paying customers get **today's price for as long as they stay subscribed** and **free data import** from their old software or Excel. The price lock already happens on its own — fees are stamped on the business unit at approval, so a later `.env` change never touches them. The only build work is a badge on the Basic and Standard cards and a line in the FAQ, switched off by one constant. You track the count (Your Part F).
- **Path:** `content/pricing.ts` (`export const foundingOfferOpen = true;`), `components/pricing/plan-card.tsx` (badge "Founding price" when open), `content/faq.ts`, `constants/messages.ts`.

### Your Part F — after Step 3

- **F. Keep the founding-customer count.** Note each founding customer; when the 50th pays, set `foundingOfferOpen` to `false` (Step 3).

### Step 4 — Enforce users and inventory

Needs: Step 1.

- **Explanation:** make the two limits that drive upgrades real; leave jobs and WhatsApp as stated allowances for now.
  - **Users:** keep a small map of user limits by plan next to the prices (`lite` 1, `basic` 2, `standard` 15, `enterprise` none). In the resolver that creates a business user, count the BU's active users and refuse when the limit is reached, with code `USER_LIMIT_REACHED` and the limit in `extensions` — the same shape as `BRANCH_LIMIT_REACHED`. The client shows the message as it already does for the branch limit.
  - **Inventory on Lite:** the client already holds `planCode` in `src/store/context-slice.ts`. When it is `lite`, the inventory menu items open a short card ("Spare-parts inventory comes with Basic and above") with a link to the pricing page instead of the screens. No server change; this is a nudge, not security.
  - Existing over-limit customers keep their users; only new additions are refused (constraint 6).
- **Path:** server — `app/core/plan_prices.py` (user-limit map), the business-user create resolver under `app/graphql/resolvers/`, `app/core/exceptions.py` / messages for `USER_LIMIT_REACHED`; client — the inventory menu entries and a small upgrade card component; messages in `constants/messages.ts` / the client's messages file.

### Step 5 — Marketing strategy

Needs: Step 1; Your Part B. Run by Your Part C.

- **Positioning line:** "Run your service centre, not your notebook." Lead with what cheap tools do not solve: which technician has which job, where stock went, warranty claims, branch-wise numbers, a GST summary the accountant uses as is.
- **Three buyers, three messages:**
  - *Single-counter mobile shop* → Lite, then Basic: "Free for your first 50 jobs a month; your customers get WhatsApp updates."
  - *Multi-technician workshop / small chain* → Standard (main revenue): scorecards, stock by branch, job ageing, roles.
  - *Authorised service centres and groups* → Enterprise: batch warranty intake, a business unit per brand, dedicated database.
- **Channels, in order of expected return (all need no product work):**
  1. **Kolkata electronics and mobile markets first:** walk-in demos on a tablet, a printed one-page plan sheet, Lite sign-up on the spot. Then 2–3 nearby cities.
  2. **Spare-parts distributors** who visit hundreds of shops: one month's subscription as a referral fee for each paid customer.
  3. **Brand service networks:** pitch a pilot to regional service-centre coordinators of 2–3 brands.
  4. **Customer referral:** both shops get one month free when the referred shop pays (recorded as a normal payment with a note).
  5. **Search and listings:** small Google Ads budget on "mobile repair shop software", "service centre software", "job card software" in Kolkata and metros; free listings on Capterra India, IndiaMART, Justdial, Google Business Profile.
  6. **Short videos in Hindi and Bengali** (YouTube, Instagram): a job from intake to the WhatsApp "ready" message in 60 seconds; technician scorecard; GST summary.
  7. **Repair-trade WhatsApp and Facebook groups:** share the videos and the founding offer.
- **Proof:** after 10 paying customers, add 2–3 short case stories with real numbers to `content/testimonials.ts`; until then `content/proof.ts` stays free of claims we cannot back.
- **Path (portal text only):** `components/home/hero.tsx`, `components/home/cta-band.tsx` (positioning line, founding offer), `app/pricing/page.tsx` (referral note).

### Step 6 — Review after 8 weeks

Needs: Steps 1–4.

- **Explanation:** no new dashboard. Each week, note from the existing enquiries and subscriptions screens: enquiries, Lite sign-ups, Lite → paid, plan chosen, yearly vs monthly, cancellations, and objections heard.
- **Decision rules:**
  - Lite → paid under 5%: tighten Lite (40 jobs, no WhatsApp) rather than cut prices.
  - Basic far ahead of Standard: try Standard at ₹3,999.
  - Most new customers pick Standard: Basic can go to ₹1,999.
  - Owners complain about running out of jobs or WhatsApp, or our WhatsApp bill grows: then build the later items (usage warnings, quota enforcement, top-up packs at ₹299 per 1,000 messages).

## Sources

- RepairSoft — https://www.repairsoft.app/
- RepairWorks — https://repairworks.in/
- CRMJIO — https://crmjio.com/marketplace/repair-shop-management-software
- Repairing Shop Manager — https://repairingshopmanager.com/
- Smart Repair Desk — https://smartrepairdesk.com/
- RepairDesk vs RepairShopr 2026 — https://blog.repairdesk.co/2026/06/12/repairdesk-vs-repairshopr-in-2026-whats-changed-and-what-hasnt/
- RepairShopr pricing 2026 — https://costbench.com/software/automotive-shop-software/repairshopr/
- Vyapar vs myBillBook — https://accountune.com/vyapar-vs-accountune-vs-mybillbook
- WhatsApp API pricing India 2026 — https://m.aisensy.com/blog/whatsapp-api-new-pricing/ and https://m.aisensy.com/blog/whatsapp-pricing-update-october-2026/
