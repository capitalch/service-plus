# Service+ go-to-market plan

**Prepared:** 13 October 2026  
**Scope:** Market launch, positioning, plan design, pricing, domain and brand, sales, launch operations, and a 90-day execution sequence.  
**Source request:** `plans/prompt.md`. This is a recommendation and execution plan; no prices, domains, or production systems have been changed.

## Executive recommendation

Launch Service+ as **repair workshop management software for Indian mobile, electronics, and appliance repair businesses**, initially selling in Kolkata and West Bengal. Lead with the practical outcomes: job tracking, customer updates, parts control, billing, and visibility of technician work. Two internal production deployments are valuable proof of use, but obtain permission and measured customer results before publishing claims or testimonials.

Keep the **Service+** name for this launch, paired consistently with the descriptor **“Repair workshop software”**. Use **`myserviceplus.in`** as the preferred public website and `app.myserviceplus.in` for the application, subject to a fresh registrar check and working DNS/SSL setup. The inventory in `notes/Marketting.md` lists `myserviceplus.in` and `repairplus.in` as available at ₹549/year; that is a note, not a live availability guarantee. Keep `repairplus.in` as an optional redirect/defensive purchase only after checking both availability and naming rights.

Do not launch the current ₹2,999 / ₹5,999 entry tiers unchanged to small independent shops. Test **Basic at ₹799/month and Standard at ₹1,499/month, with setup waived for the first 50 paying shops**. Keep Lite free with a deliberately useful but bounded allowance. Treat Enterprise as a discovery-led quote until onboarding and support costs are known; ₹10,999/month is a reasonable starting anchor for a dedicated database and multi-unit operations, not a proven market price. Show whether GST is included/excluded only after confirming the seller’s GST status and invoice treatment with an accountant.

The primary launch risk is distribution and onboarding capacity, not feature quantity. Begin with assisted onboarding and a demo, prove activation and paid retention, then invest in automation and broader promotion. The 90-day objective should be a measurable funnel and 10–20 retained paid customers, not a large top-of-funnel vanity count.

## What I reviewed and what the product currently supports

Reviewed the client, server, and portal source, especially `service-plus-server/app/core/plan_prices.py`, `service-plus-server/.env.example`, `service-plus-portal/content/pricing.ts`, the pricing/sign-up flows, billing services, client billing/limit UI, `plans/plan.md`, `plans/plan-workflow.md`, and `/home/sushant/projects/service-plus/notes/Marketting.md`.

The code and notes show a repair-operations product with job intake/status workflows, technicians, parts and inventory, billing/invoices, reports, WhatsApp notifications, extended-warranty lead handling, roles, and in-app help. The portal supports plan selection, Lite/Basic/Standard sign-up, an Enterprise enquiry, and a public price list. The server reads prices and allowances from `.env`, stamps them onto a customer when the plan is approved, and enforces billing/usage rules. Payment recording is currently admin-mediated; non-payment can make a paid account read-only. The two internal deployments are meaningful operational evidence, but do not yet establish market demand, low support cost, or reliable conversion.

### Current published/default plan structure

| Plan | Monthly price | Setup | Users | Jobs/month | WhatsApp/month | Branch/business-unit shape |
|---|---:|---:|---:|---:|---:|---|
| Lite | Free | Free | 1 | 75 | 20 | 1 head-office branch, 1 BU |
| Basic | ₹2,999 | ₹2,000 | 1 | 150 | 150 | 1 head-office branch, 1 BU |
| Standard | ₹5,999 | ₹2,000 | Multiple | 400 | 300 | 1 head-office branch, 1 BU |
| Enterprise | ₹10,999 | ₹5,000 | Multiple | Unlimited | 2,000 | 5 BUs included; extra-BU price is configured separately |

The server defaults and example environment values are ₹3,000 per extra Enterprise BU; the portal fallback in `content/pricing.ts` currently says ₹3,000 too. Confirm the live production `.env` and actual portal-rendered values before quoting customers. The earlier `plans/plan.md` contains suggestions that are not yet implemented; it is not the live price source. Price/limit changes must stay aligned between server configuration, portal fallback/SEO content, signup and existing-customer terms.

A documented product inconsistency needs resolution before a free-plan campaign: `plans/plan-workflow.md` says the 20-message and one-user Lite limits are not currently enforced, and notes a past portal change to 100 jobs while current server defaults and portal pricing source both show 75 jobs. Inspect the deployed version and verify each promise end-to-end. Do not advertise a limit that the server does not enforce, or enforce a materially different limit than the pricing page promises.

## Market, target buyer, and positioning

### Beachhead

Start with owner-operated mobile-phone repair shops and small electronics service centres with one location, approximately 1–5 staff, and recurring repair volume. Prioritize businesses still using paper job cards, spreadsheets, and manual customer calls. Sell first in a compact geographic area where onboarding visits and referrals are practical. Expand to appliance/TV service centres after the mobile-repair onboarding story is repeatable; approach multi-location chains later.

This focus matches current product strengths while avoiding an early attempt to serve every service business. The buyer is usually the owner, who cares about fewer lost jobs, fewer “is it ready?” calls, parts accountability, quicker billing, and knowing what each technician has in progress. Demonstrations should start with that day-to-day pain, not a long feature tour.

### Positioning and message

Suggested one-line message: **“Track every repair, keep customers updated, and know where your parts go — from one workshop dashboard.”**

Use evidence from the live workshops to replace generic claims: jobs handled, time spent on status calls, repeat visits, parts variance, or time to create an invoice. Establish a baseline and ask customer permission before publishing any result. Do not claim guaranteed savings, data security certifications, uptime, or automated backups until those statements are verified and supportable.

### Competition and price context

A current scan of public competitor pages (13 October 2026) found a wide low-price range: INOMS advertises a Basic plan around ₹399/month; MyRepairShop lists ₹499/month Starter and ₹999/month Professional; Kiwikit lists ₹1,499 per quarter and ₹4,999/year; StoreAxis Pro lists tiers from ₹599/month and a setup fee; Tazk ReCare describes a free plan and paid annual tiers. RepairDesk publishes international starting prices of US$99/month, aimed at a different willingness-to-pay segment. These are advertised prices and feature bundles, not a controlled comparison; validate inclusions, taxes, service levels, and actual customer fit directly.

This evidence makes ₹2,999 Basic hard to justify as a mass-market entry offer. It does not prove Service+ should match the cheapest competitors: breadth of back-office workflows, setup assistance, extended-warranty handling, and support may justify a premium if customers value them. The ₹799 / ₹1,499 test keeps a premium over many low-price offers while bringing the entry decision closer to local budgets. Run interviews and paid trials before making it a permanent price.

## Recommended offers and commercial rules

### Proposed launch price test

| Offer | Recommended test | Purpose / guardrail |
|---|---:|---|
| Lite | Free; 1 user; 1 branch; 75 jobs/month; 20 WhatsApp messages/month | Self-serve evaluation and referral entry. Keep a clearly bounded support level. Verify enforcement before promotion. |
| Basic | ₹799/month; waive setup for first 50 paying shops | Single-user owner-operated shop. Cap remains 150 jobs and 150 WhatsApp/month unless interviews show it blocks the target workflow. |
| Standard | ₹1,499/month; waive setup for first 50 paying shops | Multiple named users; 400 jobs and 300 WhatsApp/month. Make this the recommended plan for a team. |
| Enterprise | From ₹10,999/month, setup from ₹5,000; quote after discovery | Dedicated database, up to 5 BUs and higher-touch onboarding. Validate support/hosting costs and extra-BU charge before publishing a firm promise. |

Prices are hypotheses for a launch experiment, not a final valuation. Keep current customer fees unchanged unless they explicitly agree to a change. Document launch-price eligibility, duration, renewal price, plan limits, cancellation/data export, and tax treatment in plain language. Avoid “price forever” claims unless the business is prepared to honor them for the customer’s full tenure.

Do not introduce several discounts at once. First test the monthly price and waived setup. Once payment and revenue processes are reliable, test a 10-month annual price for 12 months (about 16.7% discount) against monthly billing. Before advertising annual billing, implement an accurate server-side amount-due calculation, clear receipts, refund/cancellation treatment, and consistent customer-facing terms. Referral credits also require an auditable billing workflow; until implemented, use a manually approved, written credit process with records.

### Packaging decisions to settle before taking money

1. Confirm whether Lite truly allows one user and whether its WhatsApp cap is enforced. Enforce on the server and test with real accounts before publishing the limits.
2. Check plan labels against actual access control: branches, staff-user creation, job/WhatsApp limits, enterprise database provisioning, and included BUs.
3. Decide whether WhatsApp messages mean attempted sends or successful deliveries, which templates count, and when counters reset. Explain central-number/sender identity clearly if one central WhatsApp number is shared.
4. Define onboarding included in each plan, response hours, supported languages, backup/restore procedure, retention/export, and data ownership. These materially affect both price and support cost.
5. Verify any tax statement with the seller’s GST registration and invoicing position. Have an Indian accountant advise what to display; do not assume every offer should automatically say “+18% GST.”
6. Confirm the real payment channels, due dates, late-payment process, receipt format, refunds, and what read-only mode permits. Tell customers before signup.

## Brand, domain, and code changes

### Brand decision

Keep “Service+” for launch because it is already used in the product and known by the two internal deployments. Pair it with a descriptive phrase in the logo, page titles, social profiles, and directory listings. The name is relatively descriptive and may be difficult to own exclusively; run an Indian trademark search and professional clearance in relevant software/service classes before spending substantially on brand advertising. Do not represent a preliminary search as legal clearance.

If clearance or customer testing shows the name is too weak/confusable, choose a distinctive replacement before broad paid promotion. `RepairPlus` is only a candidate, not a cleared name; it may also be crowded. Search relevant trademarks, domain/social handles, and competing products before a rename decision.

### Domain recommendation

Preferred: **`myserviceplus.in`** for the portal, with **`app.myserviceplus.in`** for the application. It preserves existing recognition and is present in the supplied availability inventory. Reconfirm availability, renewal price, registrant ownership, DNS control, and SSL before purchase. If available and affordable, buy `repairplus.in` defensively and redirect it to the canonical site; do not split brand traffic between domains. Do not use `repairtrack` because the notes list an existing similarly named competitor, and avoid “MakeMyService” because the notes flag a potential association with MakeMyTrip.

Keep one canonical site URL and redirect alternate hosts. Configure HTTPS, DNS, email SPF/DKIM/DMARC, app deep links, sitemap/canonical metadata, analytics, and Search Console. Preserve the existing `serviceplus.cloudjiffy.net` host during transition: the notes say Meta WhatsApp template buttons point there. Change template destinations only after confirming whether templates can be updated/re-approved and after the new host has been tested. Update portal build-time environment settings and server-generated portal links deliberately; the portal docs state public URL values are baked into the static build.

### Code/config work required

A domain-only move should primarily be DNS, hosting bindings, SSL, and environment configuration, but it still requires a full link inventory and verification. The client/server/portal each contain brand, URLs, message templates, and email copy. Centralize canonical URLs and high-visibility brand text where practical, but do not undertake a large rename before validating the brand decision. If changing prices, update the server defaults/configuration, portal fallback and structured/SEO output, plan content, and any help or email text that quotes amounts. Ensure existing accounts retain their agreed price.

## Go-to-market channels and sales motion

Prioritize founder-led, demonstration-driven acquisition first:

1. **Two live deployments:** interview owners, document concrete before/after measures, request permission for a case study, and ask each for two introductions. Never invent or imply endorsement.
2. **Local shop visits and referrals:** demonstrate a real workflow on a phone/tablet in repair markets around Kolkata. Offer to import a small sample of data and complete first-job setup during onboarding.
3. **Wholesalers and training institutes:** offer a tracked referral arrangement only after unit economics and credit rules are clear. Do not promise recurring commissions or free plans informally.
4. **WhatsApp/Facebook technician communities:** share useful short demonstrations and answer questions; respect group rules and avoid unsolicited bulk messaging.
5. **Short video:** publish Hindi/Bengali/English clips based on actual workflows: intake-to-ready updates, parts usage, technician workload, and GST invoice creation. Use captions and a single trial/demo call to action.
6. **Organic search:** build focused pages for mobile repair, electronics service centres, and multi-location repair operations. Each page needs real screenshots, specific workflow copy, FAQs, and truthful plan details. Avoid thin duplicate SEO pages.
7. **Paid acquisition:** defer broad ads until a landing page converts and onboarding/retention are measured. Then test small geo-targeted search/social budgets with a defined maximum cost per activated and retained shop.

Recommended funnel: contact → short discovery → 15-minute role-specific demo → assisted Lite setup or time-limited guided trial → first 10 real jobs → check-in on day 3 and day 10 → paid conversion → referral ask after a successful outcome. Lite is a product-led entry point but should not be the only path; a small workshop may need guided setup and a transparent paid-plan trial to experience multi-user capabilities.

## 90-day execution plan

### Days 1–14: readiness and customer evidence

- Interview the two production customers and 8–12 target repair-shop owners. Record workflow, current alternatives, objections, willingness-to-pay ranges, and desired onboarding.
- Audit the live portal and server values; reconcile plan copy with enforcement, including Lite jobs/users/WhatsApp and extra-BU price.
- Check backups and perform a restore drill; document incidents, support contact, data export, privacy policy, terms, cancellation, and billing/read-only behavior.
- Confirm domain and brand clearance process, contact details, WhatsApp sender/template implications, and tax treatment.
- Prepare one demo tenant with non-sensitive sample data and a reset procedure. If a public demo account is unsafe or expensive to maintain, use a live guided demo instead.
- Create a two-page sales sheet, demo script, onboarding checklist, and simple CRM/spreadsheet fields for source, stage, activation, plan, revenue, and support time.

### Days 15–30: controlled pilot

- Recruit 10–15 pilot shops from introductions and local visits. Agree what “pilot” means and gather feedback weekly.
- Test proposed prices with real purchase intent, not just survey approval. Offer two clearly stated price choices to comparable prospects; record reasons for rejection.
- Measure setup time, first job creation, weekly active use, WhatsApp delivery, support requests, and willingness to pay.
- Fix blockers that stop activation or trust. Do not prioritize cosmetic features over onboarding, mobile usability, data safety, or essential workflow gaps.

### Days 31–60: paid local launch

- Publish the validated pricing/feature matrix, truthful case study, demo CTA, contact route, privacy/terms, and one segment page.
- Start a weekly cadence of 20–25 qualified shop conversations, 5 demos, and follow-up within one business day. Adjust to actual founder capacity.
- Ask satisfied active users for one introduction. Trial a single wholesaler/training partner with written attribution and payout/credit terms.
- Publish two short educational videos per week and respond to community questions without spam.
- Review activations, paid conversion, churn, support burden, and acquisition source every week.

### Days 61–90: repeat what works

- Extend the highest-performing segment and referral channel; stop channels producing unqualified leads.
- Add the next segment page only when its product fit and case evidence are credible.
- Decide whether to implement annual billing, self-serve provisioning, or online payments based on observed friction and support hours. Prioritize payment automation if manual collection is consuming meaningful time or delaying renewals.
- Revisit pricing only from customer evidence: conversions, churn, support cost, and lost-deal interviews.
- At day 90, decide whether to stay founder-led in one region, hire/contract local sales support, or pause expansion to improve product/onboarding.

## Metrics and decision thresholds

Track weekly by acquisition source and plan:

- Qualified conversations, demos booked/completed, signup starts/completions.
- Activation: first 10 real jobs entered within 7 days; time from signup to first completed workflow.
- Paid conversion within 30 days; Lite-to-paid conversion; reasons for no purchase.
- 30/60/90-day active customer retention and monthly recurring revenue (MRR).
- Payment collection delay, failed renewals, refunds, and account read-only events.
- Support minutes per account, onboarding hours, WhatsApp delivery failures, incidents, and restore-test results.
- Referral leads and their activation/retention.

Initial operating gates (review after the first 15–20 accounts; these are targets, not industry benchmarks):

- If fewer than half of assisted signups enter 10 real jobs in the first week, fix onboarding and product fit before spending on traffic.
- If activated shops will not pay even at the tested entry price, interview churn/no-purchase cases and revisit segment/value/packaging before simply discounting.
- If support/onboarding time makes Basic unprofitable, raise the price, narrow included service, or simplify setup; do not scale an unsustainable tier.
- If customers use WhatsApp as the main value but the shared sender creates trust or delivery issues, address sender ownership/branding before expanding.
- Do not scale paid ads until at least one source yields repeatable activated customers and contribution margin can cover acquisition cost.

## Success potential and limits

There is a credible opportunity to build a sustainable small vertical SaaS business: repair shops have recurring operational work and the product already operates in two internal production deployments. That is evidence of feasibility, not proof of market size or product-market fit. Low-priced competitors, existing informal processes, customer price sensitivity, local-language support needs, and manual onboarding/payment collection will constrain growth.

Use scenarios as planning arithmetic, not forecasts. At a blended realized subscription of ₹1,200/month, 25 paying shops produce ₹30,000 MRR; 100 produce ₹1.2 lakh MRR; 250 produce ₹3 lakh MRR, before GST, payment costs, hosting, support, taxes, churn, discounts, and founder compensation. Reaching 100 customers requires repeatable acquisition and low enough service effort; 250 likely needs dedicated sales/onboarding and operational automation. The reachable outcome depends on retention and founder time as much as the number of Indian repair shops.

A sensible 12-month objective is **50–100 retained paying shops only if** the first 90 days demonstrate activation, willingness to pay, and support economics. A smaller 20–30 customer base can still be a useful proof point; a larger signup count with poor retention is not success. Establish actual cohort retention and margin before estimating a valuation or claiming the business can reach a particular scale.

## Launch checklist and owners

| Workstream | Concrete output | Gate |
|---|---|---|
| Product/pricing truth | One approved plan matrix aligned to server enforcement and portal fallback/SEO | No conflicting prices or unenforced limits |
| Customer proof | Two permissioned case studies or a documented customer quote plus measurable baseline | No fabricated/unapproved claims |
| Trust/operations | Privacy/terms, backup restore evidence, support process, export/cancellation and payment terms | Founder can explain what happens to data and overdue accounts |
| Brand/domain | Registrar check, trademark search/advice, canonical DNS/SSL and working email | Do not advertise new URL until app and links work |
| Sales | Demo tenant/script, lead tracker, onboarding checklist, follow-up cadence | Every lead has an owner and next action |
| Commercial | Price-test rules, GST/accounting confirmation, receipt and refund process | Quote total payable clearly |
| Growth | One evidence-backed segment page, useful videos, referral tracking | Expand channel only after activation is measurable |

## Reference links and source notes

Competitor pages were checked on 13 October 2026; advertised prices may change and are not directly comparable:

- [INOMS pricing](https://inoms.in/)
- [MyRepairShop pricing](https://myrepairshop.in/)
- [Kiwikit pricing](https://www.kiwikit.in/)
- [StoreAxis Pro](https://www.storeaxispro.com/)
- [Tazk ReCare](https://tazk.in/repair-service-management-software)
- [RepairDesk pricing](https://www.repairdesk.co/pricing/)
- [IP India trademark resources](https://ipindia.gov.in/)

Domain availability and listed ₹549/year prices come from `/home/sushant/projects/service-plus/notes/Marketting.md` and have not been verified with a registrar. The domain note identifies `myserviceplus` and `repairplus.in` as available candidates, and flags `serviceplus` as unavailable. Check fresh availability and ownership before acting.
