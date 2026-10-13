# Portal contact details come from env, not code

## Goal

- Phone, WhatsApp, email, business hours, site URL and bank details for the portal are set in `.env.local`, not typed into source files. Changing a number means editing one env line and rebuilding, with no code change or commit.
- A build with a missing required value fails loudly. It must never ship a site with empty `tel:` or `mailto:` links or the `98765 43210` placeholder.
- A committed `.env.example` lists every key, so a fresh checkout knows what to fill in.
- Decisions already made: keep `.env.local` as the source of values (as the user asked), and keep `content/site-config.ts` as the one object that components read. Components do not change.

## Present context and current design

- **Contacts are already in one place, but hardcoded.** `content/site-config.ts` holds `phone: "+91 98765 43210"`, `phoneE164: "+919876543210"`, `whatsapp: "919876543210"`, `email: "info@kushinfotech.in"`, `businessHours`, `url: "https://myserviceplus.in"`, `bank: null` and an `address` block. The phone and WhatsApp numbers are placeholders, and the file is marked `TODO(real)`.
- **The same number is written three times** (display, E.164, wa.me digits), so a change has to touch all three and they can drift apart.
- **Who reads it:** `site-header`, `site-footer`, `mobile-action-bar`, `hero`, `cta-band`, `workflow-cta`, `contact-cards`, `enquiry-success`, `legal-document`, plus `app/layout.tsx`, `app/pricing/page.tsx`, `robots.ts` and `sitemap.ts` (for `url`). All of them go through `siteConfig`, so nothing else has the values hardcoded.
- **One duplicate:** `content/legal.ts` has its own `const COMPANY = "Kush Infotech"`.
- **`address` is rendered** on the contact page and in the footer (destructured as `const { address } = siteConfig`). It holds placeholder lines.
- **`bank` is `null`.** `enquiry-success.tsx` then says the details will be shared by phone.
- **Env is already used** for `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_WEBSITE_KEY` (`lib/api.ts`) and `NEXT_PUBLIC_APP_URL` (`site-config.ts`), and these are documented in `deploy/README.md` step 4.
- **The site is a static export** (`output: "export"`). `deploy/build-and-deploy-milesweb.sh` runs `pnpm build` on this machine and uploads `out/`. Next.js loads `.env.local` during `next build` too, so values get baked into the HTML and JS at build time. There is no runtime server to read env later.
- `.gitignore` has `**/.env*`, so an `.env.example` would be ignored unless it is excepted explicitly.

## New design brief

- `site-config.ts` reads each contact from a `NEXT_PUBLIC_*` variable and fails the build if a required one is missing → Step 1, Step 2
- Phone is entered once. The E.164 and wa.me forms are derived from it, and WhatsApp defaults to the phone → Step 2
- Bank details are optional env values. When the account number or IFSC is missing, `bank` stays `null` → Step 2
- `legal.ts` reuses `siteConfig.company`. The address comes from optional `NEXT_PUBLIC_ADDRESS_*` values → Step 3
- A committed `.env.example` and the deploy README document the keys → Step 4

## Key constraints of new design

1. **`NEXT_PUBLIC_*` is inlined only when written literally.** Next replaces `process.env.NEXT_PUBLIC_X` text at build time. A dynamic `process.env[name]` stays `undefined` in client components such as `mobile-action-bar`. Resolution: every variable is read with a literal `process.env.NEXT_PUBLIC_…` expression, and the helper receives the value plus its name.
2. **Values are fixed at build time.** Editing `.env.local` does nothing until the next `pnpm build` / deploy, and `pnpm dev` needs a restart. Resolution: state this in `.env.example` and the README. It is acceptable because the deploy script always rebuilds.
3. **A missing value must not ship silently.** Resolution: `requireEnv` throws during `next build` (and in dev) with the variable name. A broken build is better than a dead "Call now" button.
4. **These values are public, not secrets.** They end up in the HTML anyway. Resolution: the `NEXT_PUBLIC_` prefix is correct. Do not put the server's real secrets in these keys. `NEXT_PUBLIC_WEBSITE_KEY` is already public by design.
5. **Phone formats must not drift.** Resolution: `NEXT_PUBLIC_CONTACT_PHONE` is the display form (`+91 98765 43210`). `phoneE164` = `+` plus its digits, and `whatsapp` = its digits. `NEXT_PUBLIC_CONTACT_WHATSAPP` is optional and is set only when the WhatsApp number differs.
6. **`.env.example` is gitignored by `**/.env*`.** Resolution: add `!.env.example` after that line.

## Steps

### Step 0 — Your Part 🟢 Completed

- **A** (do now, before Step 1): add these lines to `service-plus-portal/.env.local` with the real values (bank lines only if you want them shown):
  ```
  NEXT_PUBLIC_SITE_URL=https://myserviceplus.in
  NEXT_PUBLIC_CONTACT_EMAIL=info@kushinfotech.in
  NEXT_PUBLIC_CONTACT_PHONE=+91 XXXXX XXXXX
  NEXT_PUBLIC_CONTACT_WHATSAPP=
  NEXT_PUBLIC_BUSINESS_HOURS=Mon–Sat, 10:00 AM – 7:00 PM IST
  NEXT_PUBLIC_BANK_ACCOUNT_NAME=
  NEXT_PUBLIC_BANK_ACCOUNT_NUMBER=
  NEXT_PUBLIC_BANK_BRANCH=
  NEXT_PUBLIC_BANK_IFSC=
  NEXT_PUBLIC_BANK_NAME=
  NEXT_PUBLIC_BANK_UPI_ID=
  ```

### Step 1 — Error message for a missing env value 🟢 Completed

- Needs: none
- Explanation: the build-failure text is longer than two words, so it goes in `constants/messages.ts` as a key (convention).
- Path: `service-plus-portal/constants/messages.ts`
- Code: add a key, placed alphabetically among the existing ones:
  ```ts
  ENV_VALUE_MISSING: "Missing env value. Add it to .env.local (see .env.example) and rebuild:",
  ```

### Step 2 — `site-config.ts` reads env 🟢 Completed

- Needs: Step 1, Your Part A
- Explanation: add two small utilities and replace the hardcoded contact fields. Every read is a literal `process.env.NEXT_PUBLIC_…` (constraint 1). `requireEnv` trims the value and throws with the variable's name when it is empty (constraint 3). `optionalEnv` returns `undefined` for blank values. `bank` is built only when the account number and IFSC are both present. `company`, `description` and `name` stay in code because they are brand copy, not contacts.
- Path: `service-plus-portal/content/site-config.ts`
- Old code:
  ```ts
  // TODO(real): replace every placeholder below with the real business details before going live.
  export const siteConfig = {
  	address: { ... },
  	appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://serviceplus.cloudjiffy.net",
  	bank: null as BankDetailsType | null,
  	businessHours: "Mon–Sat, 10:00 AM – 7:00 PM IST",
  	...
  	email: "info@kushinfotech.in",
  	...
  	phone: "+91 98765 43210",
  	phoneE164: "+919876543210",
  	url: "https://myserviceplus.in",
  	whatsapp: "919876543210",
  };
  ```
- New code:
  ```ts
  import { MESSAGES } from "@/constants/messages";

  function optionalEnv(value: string | undefined): string | undefined {
  	const trimmed = value?.trim();
  	return trimmed ? trimmed : undefined;
  }

  function requireEnv(value: string | undefined, name: string): string {
  	const trimmed = optionalEnv(value);
  	if (!trimmed) throw new Error(`${MESSAGES.ENV_VALUE_MISSING} ${name}`);
  	return trimmed;
  }

  function toDigits(value: string): string {
  	return value.replace(/\D/g, "");
  }

  const phone = requireEnv(process.env.NEXT_PUBLIC_CONTACT_PHONE, "NEXT_PUBLIC_CONTACT_PHONE");
  const whatsappSource = optionalEnv(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP) ?? phone;
  const bankAccountNumber = optionalEnv(process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER);
  const bankIfsc = optionalEnv(process.env.NEXT_PUBLIC_BANK_IFSC);

  export const siteConfig = {
  	appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://serviceplus.cloudjiffy.net",
  	// null unless account number and IFSC are set; the enquiry success card then says details come by phone.
  	bank: (bankAccountNumber && bankIfsc
  		? {
  				accountName: optionalEnv(process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME) ?? "",
  				accountNumber: bankAccountNumber,
  				bankName: optionalEnv(process.env.NEXT_PUBLIC_BANK_NAME) ?? "",
  				branch: optionalEnv(process.env.NEXT_PUBLIC_BANK_BRANCH) ?? "",
  				ifsc: bankIfsc,
  				upiId: optionalEnv(process.env.NEXT_PUBLIC_BANK_UPI_ID),
  			}
  		: null) as BankDetailsType | null,
  	businessHours: optionalEnv(process.env.NEXT_PUBLIC_BUSINESS_HOURS) ?? "Mon–Sat, 10:00 AM – 7:00 PM IST",
  	company: "Kush Infotech",
  	description: "...unchanged...",
  	email: requireEnv(process.env.NEXT_PUBLIC_CONTACT_EMAIL, "NEXT_PUBLIC_CONTACT_EMAIL"),
  	name: "Service+",
  	phone,
  	/** E.164 for tel: links and structured data. */
  	phoneE164: `+${toDigits(phone)}`,
  	url: requireEnv(process.env.NEXT_PUBLIC_SITE_URL, "NEXT_PUBLIC_SITE_URL"),
  	/** Digits only, country code first, for wa.me links. */
  	whatsapp: toDigits(whatsappSource),
  };
  ```
- Field names and types stay the same, so none of the 13 consuming files change.

### Step 3 — Remove the duplicate company name; address moves to env 🟢 Completed

- Needs: Step 2
- Explanation: `legal.ts` should not keep its own copy of the company name. The `address` block is a placeholder that nothing renders, so delete it. Add it back through env when a page actually shows an address.
- Path: `service-plus-portal/content/legal.ts`
- Code: replace `const COMPANY = "Kush Infotech";` with `const COMPANY = siteConfig.company;` and add `import { siteConfig } from "@/content/site-config";`.
- Path: `service-plus-portal/content/site-config.ts`
- Change during execution: `address` turned out to be rendered, so it was not deleted. It now reads optional `NEXT_PUBLIC_ADDRESS_CITY`, `_COUNTRY`, `_LINE1`, `_LINE2`, `_MAP_URL`, `_PINCODE` and `_STATE`. City, state and country default to Kolkata, West Bengal, India. The map URL defaults to a Google Maps search for the address.
- Path: `service-plus-portal/components/contact/contact-cards.tsx`
- Code: the address card drops blank lines with `.filter(Boolean)`. The WhatsApp card shows the new `siteConfig.whatsappDisplay` instead of `siteConfig.phone`, so a separate WhatsApp number is displayed correctly.

### Step 4 — `.env.example`, gitignore exception, README 🟢 Completed

- Needs: Step 2
- Explanation: give a fresh checkout a template, and document the new keys next to the existing ones.
- Path: `service-plus-portal/.env.example` (new, committed). It has every key from Your Part A plus the three existing ones (`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WEBSITE_KEY`) with empty or sample values. A header comment says the values are baked in at build time, so you rebuild after editing, and that the required keys are `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_PHONE` and `NEXT_PUBLIC_SITE_URL`.
- Path: repo-root `.gitignore`
- Code: none needed. `!**/.env.example` is already there.
- Path: `service-plus-portal/deploy/README.md`, step 4 table
- Code: add rows for `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_PHONE`, `NEXT_PUBLIC_CONTACT_WHATSAPP` (optional, defaults to phone), `NEXT_PUBLIC_BUSINESS_HOURS` (optional) and `NEXT_PUBLIC_BANK_*` (optional, shown only with account number and IFSC). Add one sentence: "values are baked in at build; rebuild after changing them".

### Step 5 — Verify 🟢 Completed

- Needs: Steps 1–4
- Run `pnpm format` on the touched files and `pnpm exec tsc --noEmit`.
- Run `pnpm build`, then `grep -r "98765" out/`. It must find nothing, and grepping for the real number must find it in the header, footer, contact page and mobile action bar.
- Temporarily blank `NEXT_PUBLIC_CONTACT_PHONE` and run `pnpm build`. It must fail with the `ENV_VALUE_MISSING` message naming that variable. Then restore the value.
- Run `pnpm dev` and open `/contact`. "Call now" should open `tel:+91…`, "Open WhatsApp" should open `wa.me/91…`, and "Send email" should open the real address.
