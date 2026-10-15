# Plan — Go to market: prices, domain, brand and marketing

Source: `plans/prompt.md`. Plan only; nothing is built yet.

## Goal

Turn Service+ from "working in two internal workshops" into a product that repair workshops find, try, buy and keep paying for.

- Prices that small Indian repair shops will accept, and that still pay for our time.
- One proper domain for the portal and the app, chosen from the available `.in` names in `notes/Marketting.md`.
- A clear decision on the brand: keep "Service+" or change, and what that means for the code.
- A marketing plan with concrete channels, a 90-day launch timeline and numbers to watch.
- An honest view of how far this can go.

Decisions already made (from earlier plans, unchanged here):
- Four plans: Lite (free), Basic, Standard, Enterprise. Prices live in the server `.env` and are shown live on the portal.
- Payment is by bank transfer, recorded by our admin; an unpaid month makes a paid plan view-only.
- Monthly job and WhatsApp allowances are enforced; branches are Enterprise-only; staff users are Standard and Enterprise only.

## Present context

**Product.** Job sheets, technicians, spare-parts stock, GST and non-GST invoicing, WhatsApp updates to customers (one central WhatsApp number for all shops), extended-warranty leads, reports, role-based access, Ask AI help. Running in two internal production workshops.

**Prices today** (server `.env`, shown on the portal):

| Plan | Monthly | Setup | Users | Jobs / month | WhatsApp / month | Business units |
|---|---|---|---|---|---|---|
| Lite | Free | — | 1 | 75 | 20 | 1 |
| Basic | ₹2,999 | ₹1,999 | 1 | 150 | 150 | 1 |
| Standard | ₹5,999 | ₹1,999 | Multiple | 400 | 300 | 1 |
| Enterprise | ₹10,999 | ₹4,999 | Multiple | Unlimited | 2,000 | 5, then ₹5,000 each |

The portal's built-in fallback prices (`service-plus-portal/content/pricing.ts`) still say ₹2,000 setup and ₹3,000 per extra BU; they are only seen if the price call fails.

**What competitors charge** (searched 13 Oct 2026):
- Indian GST billing apps for small shops: myBillBook about ₹217–₹250 a month; Vyapar about ₹3,400–₹4,000 a year.
- Indian mobile-repair billing tools: about ₹799 a month (Techduple); RepairTrack advertises job tracking and WhatsApp updates for repair shops.
- RepairDesk (US, repair-specific): $99–$149 a month per store (about ₹8,000–₹12,500).

**Payments.** Bank transfer, then our admin records it. The server insists on at least fee × months, so there is no way to give an annual discount or a free month today (except Enterprise, which has "extend paid-through").

**Domain and brand today.**
- The app runs at `serviceplus.cloudjiffy.net`. The WhatsApp template buttons registered with Meta point at that host.
- The portal reads its site URL, phone, email and address from build-time `.env` values. No real portal address is set up yet. The server's `PORTAL_URL_PRODUCTION` (used in sign-up email links) only has a placeholder default in code, `https://myserviceplus.in`, a domain we do not own yet; unless `.env` sets it, those links lead nowhere.
- "Service+" / "Service Plus" appears about 260 times across the client, portal and server: page text, emails, receipts, WhatsApp-related text and the Ask AI prompts.
- `serviceplus.com`, `serviceplus.in` and most "service…" names are taken. `myserviceplus` and `repairplus.in` are available at ₹549 a year.

## New design brief

- Lower prices to fit the Indian repair market, with a launch offer and an annual deal → Your Part A, Steps 1–3.
- Use `myserviceplus.in` for the portal and `app.myserviceplus.in` for the app; keep the old CloudJiffy address working → Your Part B, Step 4.
- Keep the "Service+" name for now, protect `repairplus.in` as the fallback brand, check the trademark → Your Part B.
- Let a visitor see the product without signing up (a demo workshop) → Step 5.
- Turn the "limit reached" moment into an upgrade moment → Step 6.
- Referral credit: one free month for each workshop a customer brings → Step 7.
- Pages that bring in visitors from Google for each kind of workshop → Step 8.
- Marketing runs as a 90-day plan, mostly your work, measured every week → sections below and the Your Parts.

## Key constraints

1. **Prices are 4–10 times the local alternatives.** A one-person mobile shop compares us with ₹200–₹800 a month billing apps. We do much more (job tracking, technicians, WhatsApp, warranty leads), which earns a premium, but not ten times.
   Resolution: new prices in Step 1 sit at the top of the local range, not above it. Lite stays free as the way in.

2. **The setup fee stops small shops at the door.** Paying ₹1,999 before trying a paid plan is hard to justify, and Lite already lets them try.
   Resolution: setup fee waived for Basic and Standard during the launch (set to 0 in `.env`). Enterprise keeps a setup fee because it really costs us a database and onboarding time.

3. **The server refuses any payment below fee × months.** So an annual deal or a free referral month cannot be recorded today.
   Resolution: Step 3 adds a "free months per year" setting; Step 7 lets the admin add free months to one business unit, copying the Enterprise "extend paid-through" that already exists.

4. **Changing the app's address breaks WhatsApp buttons.** Meta templates store the button address; a template cannot be edited without re-approval.
   Resolution: keep `serviceplus.cloudjiffy.net` bound and working alongside `app.myserviceplus.in`. Move the templates to the new host only when a template is next revised.

5. **"Service Plus" is a generic, widely used name.** Many businesses use it, so a trademark may be refused and the `.com` is gone.
   Resolution: keep "Service+" for selling now (it is what the two live workshops know), run a trademark search in Your Part B, and hold `repairplus.in` as the fallback brand. A full rename is not worth doing before there are paying customers.

6. **Everything is manual: onboarding, payment recording, follow-up.** With 50+ customers this becomes your full-time job.
   Resolution: add a UPI ID and QR so customers pay without bank details (the portal already supports `NEXT_PUBLIC_BANK_UPI_ID`). Online payment (Razorpay) goes in "Later, if numbers say so".

7. **Ask AI runs on the Gemini free tier.** Free-tier limits are shared by all customers together, and Google may use free-tier prompts to improve its products.
   Resolution: fine for launch (30 questions a day per business unit, numbers and emails removed). Move to the paid Gemini tier when the daily total gets close to the free limit; the cost is small.

8. **Our numbers on the portal must stay true.** The portal promises daily backups and "set up by our team".
   Resolution: Your Part A confirms backups are really scheduled before the launch.

## Price evaluation and suggestion

**What we offer that cheap billing apps don't:** job sheets with status tracking, technician output, spare-parts control (anti-pilferage), WhatsApp updates sent for the shop, extended-warranty leads, multi-user roles. These are worth paying for, but a small shop judges by the monthly amount first.

**Our costs per customer are low.** WhatsApp utility messages cost us roughly ₹0.12–₹0.15 each in India (marketing messages cost more), so a Standard customer's 300 messages cost about ₹45 a month. Hosting is shared. The real cost is your time on onboarding and support.

**Suggested prices** (all `.env` values, no new features):

| Plan | Monthly | Setup | Change |
|---|---|---|---|
| Lite | Free | — | Unchanged: 75 jobs, 20 WhatsApp, 1 user |
| Basic | ₹799 | ₹0 (launch), later ₹999 | From ₹2,999. Matches what local repair tools charge, with more features |
| Standard | ₹1,499 | ₹0 (launch), later ₹1,999 | From ₹5,999. Multi-user is the main reason to upgrade; still about one fifth of RepairDesk |
| Enterprise | ₹3,999 | ₹4,999 | From ₹10,999. Five business units; extra unit ₹799 (from ₹5,000) |

- **Annual deal:** pay 10 months, get 12. Basic ₹7,990 a year, Standard ₹14,990 a year.
- **Launch offer:** the first 50 paying workshops keep the launch price for as long as they stay.
- **Say "+18% GST" next to prices** if Kush Infotech charges GST (Your Part A); it avoids a dispute at the first invoice.
- If you would rather not drop this far, the smallest sensible move is Basic ₹1,499, Standard ₹2,999, Enterprise ₹6,999, setup waived. Above that, expect most shops to stay on Lite.

## Domain and brand

**Domain:** buy **`myserviceplus.in`** (₹549 a year).
- It keeps the brand, it matches the placeholder already in the server code, and "my" reads naturally for a shop owner ("my service plus").
- Portal at `myserviceplus.in`, app at `app.myserviceplus.in`, mail from `info@myserviceplus.in` or keep `info@kushinfotech.in`.

**Also buy `repairplus.in`** (₹549 a year) and point it at the portal.
- It says "repair", it is close to "Service+", and it is the fallback brand if the trademark search fails.
- Avoid `repairtrack` (an Indian competitor already uses RepairTrack) and `makemyservice` (too close to MakeMyTrip).

**Brand:** keep "Service+", and always pair it with what it does: **"Service+ — repair workshop software"**. Do not rename now.

**Code changes for the brand:** none needed to launch. The domain move is `.env` values plus a DNS change (Step 4). A future rename to RepairPlus would touch about 260 text mentions, emails and the Ask AI prompts. At that point, first gather the name into one setting per app, then switch.

## Marketing strategy

**Who to sell to first:** independent mobile-phone repair shops and small electronics service centres (TV, AC, appliances) in and around Kolkata. Then West Bengal, then other cities through online channels. Multi-outlet service chains and authorised service centres are the Enterprise targets.

**What to say** (one line, everywhere): "Every repair job tracked, every customer updated on WhatsApp, every spare part accounted for. Free to start."

**Channels, in order of value for money:**
1. **The two live workshops.** Short video testimonials, a one-page story with real before/after numbers (jobs per month, time saved, parts leakage stopped). Ask each for two introductions.
2. **Spare-parts wholesalers and distributors.** Every repair shop buys from them. Offer the wholesaler a commission (one month's fee for each paying shop) or a free Standard plan.
3. **Walk-in visits and WhatsApp outreach** in repair markets (for example Chandni Chowk in Kolkata). Show the demo workshop on a phone and sign them up for Lite on the spot.
4. **Facebook and WhatsApp groups of repair technicians**, and repair training institutes (their students open new shops).
5. **YouTube and Instagram shorts in Hindi and Bengali:** "How to send a job-ready WhatsApp automatically", "Stop spare-parts theft in your shop". Every video links to the portal.
6. **Google:** a Google Business Profile for Kush Infotech, the segment pages from Step 8, and a listing on software directories (Capterra India, SoftwareSuggest).
7. **Inside the product:** the Lite limits (75 jobs, 20 WhatsApp) are the sales person. Step 6 makes the "limit reached" message an upgrade offer.

**Referral:** each paying customer who brings a paying workshop gets one free month, and so does the new workshop (Step 7).

## 90-day launch timeline

- **Weeks 1–2:** Your Parts A and B, Steps 1–4 and the demo workshop (Step 5). Testimonials from the two live workshops.
- **Weeks 3–6:** 100 shop visits or WhatsApp conversations; 2 wholesaler partners; 8 short videos; Step 6.
- **Weeks 7–12:** referral programme live (Step 7); segment pages (Step 8); first directory listings; review prices against the numbers below.

**Numbers to watch every week:**
- Lite sign-ups.
- Activated shops: 10 or more jobs in the first 7 days.
- Lite → paid conversions.
- Paid customers and monthly revenue.
- Months left unpaid.
- Support hours.

## How far it can go

These are estimates, not forecasts; they depend mostly on how many shops you reach each week.

| After 12 months | Paying shops | Average fee | Monthly revenue |
|---|---|---|---|
| Slow | 30 | ₹1,100 | about ₹33,000 |
| Steady | 100 | ₹1,200 | about ₹1,20,000 |
| Strong | 250 | ₹1,300 | about ₹3,25,000 |

- The market is large: there are a great many repair shops in India, and most still run on paper and phone calls. The product is ahead of the cheap billing apps on repair-specific work.
- The limits are reach and time: selling to small shops is face-to-face and slow, and every customer needs onboarding and support in Hindi or Bengali. Plan for 1 paying shop for every 10–20 shops contacted, and for some shops leaving each month.
- At the current prices (₹2,999 and up), expect the slow row or below. At the suggested prices with the free setup, the steady row is realistic with consistent effort. The strong row needs a second person on sales and online payment.

## Steps

### Step 0 — Your Part

- **A.** Decide the new prices (the table above, the smaller move, or your own), whether to show "+18% GST", and confirm daily backups are actually scheduled.
- **B.** Buy `myserviceplus.in` and `repairplus.in`. Run a trademark search for "Service Plus" in classes 9 and 42.
- **C.** Record 2 testimonial videos at the live workshops; ask each for two introductions.
- **D.** Create a Google Business Profile for Kush Infotech; set a UPI ID for payments.

### Step 1 — New prices

Needs: Your Part A.
- Explanation: the live prices come from the server `.env`; the portal also has fallback prices for when the price call fails, and those are what search engines see.
- Paths:
    - server `.env` (you edit it, Your Part E);
    - `service-plus-portal/content/pricing.ts` (fallback monthly and setup fees, `extraBuMonthlyFee`);
    - `service-plus-server/app/core/plan_prices.py` (defaults);
    - `service-plus-server/.env.example`.
- Code: replace the old figures with the chosen ones in all three files, so the defaults, the fallback and the live list agree.
- Help: the client help and developer help articles that quote prices or defaults are updated with the new figures.

#### 🧑 Your Part E — Set the new prices in the server `.env`

Needs: Step 1.

### Step 2 — "+18% GST" and the launch offer on the portal

Needs: Your Part A.
- Explanation: price cards say "+ GST" under the monthly amount if Kush Infotech charges GST. The pricing page gets one line about the launch offer (setup waived, launch price kept for the first 50 workshops), and the FAQ "How do I pay?" mentions UPI.
- Path: `service-plus-portal/components/pricing/plan-card.tsx`, `service-plus-portal/constants/messages.ts`, `service-plus-portal/content/faq.ts`.
- Code: one small text line on each card; the offer text and the FAQ wording in `messages.ts` / `faq.ts`.

### Step 3 — Annual deal: pay 10 months, get 12

Needs: Your Part A.
- Explanation: today a payment must be at least fee × months. A new `.env` setting gives a number of free months for each full year paid. The admin records 12 months for the price of 10, and the receipt email states it.
- Paths:
    - `service-plus-server/app/core/plan_prices.py` (new setting, default 0 = off);
    - `service-plus-server/app/graphql/resolvers/bu_admin/billing.py` (the "amount due" check for one business unit and for an Enterprise client);
    - `service-plus-portal/content/faq.ts` ("Can I pay in advance?" currently says there is no discount);
    - the admin's record-payment dialog, which shows the amount due.
- Code: amount due = fee × (months − free months for each full 12 months). Nothing else in billing changes.
- Help: client help on recording a payment; a developer article on the new setting.

### Step 4 — Move to `myserviceplus.in`

Needs: Your Part B.
- Explanation: the portal is built with its address in `.env`, and the server builds sign-up email links from `PORTAL_URL_PRODUCTION`, which has no real value yet. Until it is set, sign-up emails link to a domain we do not own. The app gets `app.myserviceplus.in` through a CNAME and a CloudJiffy domain binding (the steps are in the developer help article "Pointing a subdomain at a CloudJiffy environment"). The old `serviceplus.cloudjiffy.net` stays bound, so the WhatsApp buttons keep working.
- Paths: no code. `.env` values only:
    - portal `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL`;
    - server `PORTAL_URL_PRODUCTION`.
- `repairplus.in` redirects to the portal.

#### 🧑 Your Part F — DNS, CloudJiffy binding, SSL and the `.env` values above; rebuild the portal

Needs: Step 4.

### Step 5 — "See the demo" workshop

Needs: Your Part G.
- Explanation: a visitor should see the real product without signing up. A demo business unit holds sample data and has a billing hold, so it is view-only: the existing unpaid-month behaviour lets people look at everything but change nothing. The portal gets a "See the demo" button that opens the app login with the demo username filled in and the password shown beside it.
- Paths:
    - `service-plus-portal/components/home/hero.tsx` and `service-plus-portal/app/pricing/page.tsx` (the button);
    - `service-plus-portal/content/site-config.ts` (demo username and password from `.env`);
    - the client login page (accepts a username in the address).
- Code: copy of the existing hero buttons; one optional URL parameter on the login form.

#### 🧑 Your Part G — Create the demo business unit, sample data and demo user; put it on billing hold

Before Step 5.

### Step 6 — The limit message becomes an upgrade offer

Needs: Step 1.
- Explanation: when a Lite or Basic shop reaches its job or WhatsApp limit, the dialog it already shows also names the next plan, its price and what it adds. It offers "Upgrade on WhatsApp", which opens a chat with us with the shop name filled in.
- Paths: the client's limit/billing dialog (`read-only-dialog.tsx` and the job/WhatsApp limit messages in `src/constants/messages.ts`); `buBillingStatus` already sends the plan code.
- Help: client help article on limits; developer help on the dialog.

### Step 7 — Referral credit: free months for one business unit

Needs: Step 3.
- Explanation: Enterprise already has "extend paid-through with a note". Copy it for a single Lite/Basic/Standard business unit, so the admin can add one free month for a referral (the note says who referred whom). It is logged and emailed like a payment receipt.
- Paths:
    - `service-plus-server/app/graphql/resolvers/bu_admin/billing.py` (new resolver copying `resolve_extend_client_paid_through_helper`);
    - schema and resolver map;
    - the admin billing screen (a "Give free months" action next to "Record payment").
- Help: client help (admin); a developer article for the new resolver and its guard.

### Step 8 — Segment pages for Google

Needs: Step 1.
- Explanation: one page each for "Mobile repair shop software", "TV and appliance service centre software" and "Service chain software". Each page carries that segment's words, two screenshots, the matching plan and an FAQ. They are added to the sitemap.
- Paths: `service-plus-portal/app/` (one route per segment, copying the features page pattern), `service-plus-portal/content/` (the text), `service-plus-portal/app/sitemap.ts`.

### Step 9 — Review after 90 days

Needs: Steps 1–8.
- Compare the weekly numbers with the "Steady" row. If conversions from Lite are below 1 in 20, revisit the Lite limits first (75 jobs may be enough for a small shop to never upgrade), then the prices.

## Later, if numbers say so

- Online payment (Razorpay) with automatic recording of the month: needed at about 50 paying shops.
- Gemini paid tier for Ask AI once daily questions near the free limit.
- Hindi and Bengali text in the app.
- Rename to RepairPlus, only if the trademark search blocks "Service Plus".

Sources for competitor prices: [myBillBook mobile shop](https://mybillbook.in/s/bill-format/mobile-shop/), [Techduple on IndiaMART](https://m.indiamart.com/techduple-technologies/software-development-service.html), [RepairTrack](https://gauravmali.flexifunnels.com/repairtrack), [Vyapar pricing (itforsme)](https://www.itforsme.in/pricing/vyapar-india), [RepairDesk pricing](https://www.repairdesk.co/pricing).
