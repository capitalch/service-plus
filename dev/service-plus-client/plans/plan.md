# Plan — One login, several Business Units through the portal

## Goal
- A person who already has a login, for example the Manager of one BU, can sign up through the portal for **another** BU, pay for it, and have it added to the **same login**. They do not get a second username.
- A rejected applicant can simply apply again.
- **Email is the only identity.** A login's email is unique, and the check ignores letter case. **Mobile is just a contact field**: two logins may share one mobile number.
- **Every** Lite / Basic / Standard applicant proves they own the email with a one-time code (OTP) sent to that email, before the request is saved. That proof is what lets a returning person attach a new BU to their existing login.
- Decisions already made:
  - The OTP goes to everyone, new or returning. The portal therefore never shows whether an email already has a login until the code has been entered correctly.
  - A person can have only one **pending** request per email at a time. Earlier approved or rejected requests do not block a new one, and mobile is never checked.
  - Each BU keeps its own plan, payment and billing. Pricing does not change.
  - Enterprise enquiries are not touched. They create a separate tenant database, so they never meet an existing login.

## Present context and current design

**Users and BUs**
- `security."user"` has `user_email_key UNIQUE (email)`. That rule is case-sensitive, although every check in the code compares `LOWER(email)`.
- It also has `user_mobile_unique_idx`, a unique index on `mobile` where present. This exists in **every** tenant database. New tenants get it from `SECURITY_SCHEMA_DDL` (`service-plus-server/app/db/sql/sql_bu_admin_ddl.py:209`).
- `security.user_bu_role` holds one row per (user, BU), each with its own role. One login can already be in many BUs, and the app has a BU switcher.
- Login is by username **or** email (`sql_bu_admin.py:1106`). Password set and reset go by an emailed link. Nothing signs in or finds a user by mobile.
- Mobile uniqueness is enforced by:
  - the index above;
  - `CHECK_BUSINESS_USER_MOBILE_EXISTS`, used in `resolve_create_business_user_helper` (`app/graphql/resolvers/bu_admin/users_roles.py:170`) and in the approve dialog's live check (`src/features/admin/components/approve-enquiry-dialog.tsx:65`).

**Portal sign-up today** (`service-plus-portal/components/pricing/sales-enquiry-form.tsx` → `POST /api/public/signup` → `submit_lt_signup` in `app/services/signups.py`)
- The request is saved straight away. There is no proof the email is real. The live rejected request was refused with the reason "email not proper".
- `CHECK_LT_SIGNUP_DUPLICATE` refuses the request if a pending or approved request has this mobile or email, or if a user has this email or mobile. Every refusal gives one message, `SIGNUP_DUPLICATE`.
- In `security.sales_enquiry` of the default customer database (`service_plus_customers`), the unique indexes `sales_enquiry_open_email_key` and `sales_enquiry_open_mobile_key` cover pending + approved requests. `sales_enquiry_open_bu_code_key` is the same kind of index for BU codes.
- These tables are created by `SignupServerSql.SALES_ENQUIRY_DDL`, run by `scripts/run_signup_billing_ddl.py`.

**Approval today** (`app/graphql/resolvers/bu_admin/signups.py`, `resolve_approve_sales_enquiry_helper`)
- It can be resumed: each finished part is recorded on the enquiry row.
- Step 7 always creates a **new** Manager user. For someone who already has a login, that fails on the unique email.

**Why the reported cases fail (checked live)**
- The rejected request shares its mobile with an earlier approved request, whose Manager login now owns that mobile. The "user has this mobile" check blocks it, with a misleading message.
- An existing Manager is blocked by the user email check and by the approved-request check.

## New design brief
- Database: mobile no longer unique, email unique ignoring case, in every tenant → Step 1
- Sign-up tables: pending-only email index, no mobile index, an OTP table, and an `existing_user_id` column → Step 2
- OTP send / verify on the server, with expiry, attempt and resend limits → Step 3
- The sign-up is saved only after the OTP is correct, and recognises new vs returning by email → Step 4
- The portal form gains an OTP step and messages that fit each case → Step 5
- Approval adds the new BU to the existing login → Step 6
- The mobile-uniqueness checks are removed from the server and the client → Step 7
- The approve dialog and the Enquiries grid show "Returning" → Step 8
- Emails: OTP, thank-you wording, "BU added to your login" → Step 9
- Both help files → Step 10

## Key constraints of new design
1. **Revealing who has a login.** An OTP sent only to existing emails, or a different first reply, would tell strangers that an account exists. *Resolution:* every applicant gets the same "We've sent a code to your email" reply, whatever the email is. New vs returning is told only after the code is verified, to someone who has just proved they own that inbox (Step 3, Step 4).
2. **Guessing the code and email flooding.** *Resolution:* a 6-digit code, stored only as an HMAC hash with its own secret (`signup_otp_secret`, never the WhatsApp one). It is valid for 10 minutes and allows 5 wrong tries. A resend is allowed after 60 seconds, and at most 5 codes per email per hour. Both endpoints are also rate-limited per IP with the existing `rate_limit` dependency (Step 3).
3. **Case-only duplicate emails.** If `Asha@x.com` and `asha@x.com` were two users, "the existing login" would be ambiguous. *Resolution:* add a unique index on `lower(email)`. The Step 1 script first reports any case-only duplicates and stops for that database if it finds any, so they can be merged by hand (Step 1, Your Part B).
4. **Dropping mobile uniqueness must reach every tenant**, or the tenants behave differently. *Resolution:* one script runs on every database in `public.client` plus the template `service_plus_service`, and `SECURITY_SCHEMA_DDL` changes so that new tenants match (Step 1).
5. **Something may later find a user by mobile.** Nothing does today. *Resolution:* the developer help states that mobile is not an identity and a lookup by it can return several users (Step 10).
6. **The login can change between sign-up and approval.** *Resolution:* `existing_user_id` saved at sign-up is for display only. Approval looks the user up again by email (Step 6).
7. **Inactive or admin logins.** *Resolution:* if the email belongs to an inactive user, approval stops with "The existing login is inactive — activate it, then approve again". Nothing is rolled back, and the next click resumes. An `is_admin` email is refused at sign-up with the generic duplicate message (Step 4, Step 6).
8. **Don't overwrite the person's other BU roles.** `resolve_set_user_bu_role_helper` (the Associate BU / role dialog) deletes all of a user's rows and writes one role for every BU. *Resolution:* approval inserts a single `user_bu_role` row (user, new BU, MANAGER) with "do nothing on conflict" and never calls that helper (Step 6).
9. **Approval must stay resumable.** *Resolution:* the "add to existing login" branch records `user_id` with the same `SET_LT_USER`, so a resumed click skips it exactly as it skips user creation today (Step 6).
10. **OTP rows must not pile up or be replayed.** *Resolution:* a row is deleted as soon as its code is used successfully, and rows older than a day are deleted whenever a new code is sent (Step 3).

## Steps

### Step 0 — Your Part ✅
- ✅ **A**: add `SIGNUP_OTP_SECRET` (a long random string) to the server env file.

### Step 1 — Mobile not unique, email unique ignoring case (every tenant) ✅
Needs: —
- Explanation: a new script, written the same way as `run_plan_limits_ddl.py`. For every database in `public.client` plus `service_plus_service` (when that database is on the server), each in its own transaction, with `--dry-run` and `--db`, it:
  1. lists users whose emails differ only in case, and skips that database if there are any;
  2. drops `user_mobile_unique_idx` and creates a plain, non-unique index `user_mobile_idx` on `mobile`;
  3. creates the unique index `user_email_lower_key` on `lower(email)`;
  4. prints the indexes before and after, the user count, and how many mobiles are shared.

  `user_email_key` stays as it is. `sql_bu_admin_ddl.py` is generated and must not be hand-edited. The template database is not on this server, so the checked-in dump was changed the same way and the extractor was re-run. Only those two index lines changed in the generated file.
- Checked: compiled, and its SELECTs run read-only on live `service_plus_capitalgroup`, `service_plus_customers` and `service_plus_demo`. None has case-only duplicate emails, and each still has `user_mobile_unique_idx`.
- Path: new `service-plus-server/scripts/run_user_identity_ddl.py`; `service-plus-server/app/db/schema_dumps/service_plus_service.sql`; `service-plus-server/app/db/sql/sql_bu_admin_ddl.py` (regenerated).

### 🧑 Your Part B — Run the identity script ✅
Needs: Step 1
- Back up the tenant databases, then run `python scripts/run_user_identity_ddl.py` from `service-plus-server/`.

### Step 2 — Sign-up tables: pending-only email index, OTP table, returning-user column ✅
Needs: —
- Explanation: in `SALES_ENQUIRY_DDL`, which is safe to run twice:
  - drop `sales_enquiry_open_mobile_key`;
  - recreate `sales_enquiry_open_email_key` on `lower(email)` covering **pending** requests only;
  - leave `sales_enquiry_open_bu_code_key` as it is;
  - add `existing_user_id bigint` (nullable) to `security.sales_enquiry`;
  - create `security.signup_otp`: `email` (lower-case, the key), `code_hash`, `payload jsonb` (the checked form), `expires_at`, `attempts`, `sent_count`, `first_sent_at`, `last_sent_at`.
- Path: `service-plus-server/app/db/sql/sql_signups.py` (`SALES_ENQUIRY_DDL`).
- Code: index and table statements only. `provisioning.py` already runs this DDL when the default database is recreated, so nothing else is needed there.
- Done: the email and mobile indexes are dropped and recreated each run, because `IF NOT EXISTS` would keep the old definition. `existing_user_id` references `security."user"` with `ON DELETE SET NULL`. `signup_otp` is keyed by lower-case email and has an index on `last_sent_at` for the purge.
- Checked: on live `service_plus_customers` there are no two pending requests with the same email in any letter case, so the new index will build.

### 🧑 Your Part C — Apply the sign-up tables ✅
Needs: Step 2
- Run `python scripts/run_signup_billing_ddl.py`, then restart the server.

### Step 3 — OTP send and verify on the server ✅
Needs: Step 2, Your Part A, Your Part C
- Explanation: a new module `app/services/signup_otp.py`, modelled on `app/whatsapp/otp.py` but with its own secret. It provides:
  - `generate()` — 6 random digits from `secrets`;
  - `hash_code()` — HMAC-SHA256 with `settings.signup_otp_secret`;
  - `send_code(payload)` — checks the limits from constraint 2, upserts the `signup_otp` row with the checked payload, deletes rows older than a day, and emails the code (Step 9);
  - `verify_code(email, code)` — fails on an expired code or after 5 tries. A wrong code adds one to `attempts`. A correct code deletes the row and returns the stored payload.

  The comparison uses `hmac.compare_digest`. The new setting is `signup_otp_secret`, and the server refuses to start without it, as it does for the WhatsApp secret.
- Path: new `service-plus-server/app/services/signup_otp.py`; `service-plus-server/app/core/settings/api_settings.py` (or the settings file that holds the other secrets); `service-plus-server/app/db/sql/sql_signups.py` (new `UPSERT_SIGNUP_OTP`, `GET_SIGNUP_OTP`, `BUMP_SIGNUP_OTP_ATTEMPTS`, `DELETE_SIGNUP_OTP`, `PURGE_SIGNUP_OTP`).
- Code: a new module and five SQL statements.
- Done:
  - `signup_otp_secret` is a required setting in `AuthSettings`, at least 16 characters, so the server will not start without it. The code hash covers email + code, so a code only works for the email it was sent to.
  - The OTP email (`otp_email` in `signup_emails.py`) and the OTP messages in `AppMessages` were built here, because `send_code` / `verify_code` need them. Refusal codes: `OTP_INVALID` (with `tries_left`), `OTP_EXPIRED`, `OTP_TOO_MANY` (resend too soon, 5 codes an hour, or 5 wrong tries) and `OTP_EMAIL_FAILED` when the email could not be sent. Step 4 maps them to HTTP statuses.
- Checked: `tests/core/test_signup_otp.py` (9 tests) passes, and the whole server suite passes (407 passed, 4 skipped). The five SQL statements were also run against live `security.signup_otp` inside one transaction that was rolled back, and they gave the expected results.
### Step 4 — Sign-up saved only after the OTP; new vs returning by email ✅
Needs: Step 3, Your Part B
- Explanation: two public endpoints replace the single `/signup` for Lite / Basic / Standard.
  - `POST /api/public/signup/otp` (rate-limited) — takes the form. It runs every current form check (plan, BU name rule, branches) and the **pending** check (`CHECK_LT_SIGNUP_PENDING`: a pending request with this email). On a pending match it refuses with the new `SIGNUP_PENDING_EXISTS`. Otherwise it calls `send_code` and replies `{status: "otp_sent"}`, the same for every email.

    That pending refusal comes before any proof of the email, so its text stays generic: "A request with this email is already under review. Check it on the sign-up status page."
  - `POST /api/public/signup` (rate-limited) — takes `{email, otp}`. It calls `verify_code`, then `submit_lt_signup` with the stored payload. The user check there changes to look up by `LOWER(email)` only (`GET_LT_SIGNUP_EXISTING_USER`: id, username, is_active, is_admin):
    - no user → new applicant, as today;
    - a non-admin user → save the request with `existing_user_id` set. The reply adds `existing_login: true` and `username`. The email is proven, so naming the username is safe;
    - an admin user → `SIGNUP_DUPLICATE`.
  - `CHECK_LT_SIGNUP_DUPLICATE` and its mobile conditions are deleted. Mobile is never compared.
  - New refusal codes and their HTTP status in `_SIGNUP_HTTP_STATUS`:
    - `OTP_INVALID` (422) — "The code is wrong. *n* tries left.";
    - `OTP_EXPIRED` (410) — "The code has expired. Ask for a new one.";
    - `OTP_TOO_MANY` (429) — "Too many codes or tries. Please wait and try again later.";
    - `SIGNUP_PENDING_EXISTS` (409).
- Path: `service-plus-server/app/routers/public/website_router.py`, `service-plus-server/app/services/signups.py`, `service-plus-server/app/db/sql/sql_signups.py`, `service-plus-server/app/core/exceptions.py` (`AppMessages`).
- Code: one new route; the existing route's body changes from the form to `{email, otp}`; the user check becomes email-only.
- Done: `check_lt_signup` (form checks + pending check) runs before the code is sent and again before saving. `/signup` is now 10/min, since a wrong code is retried. `SIGNUP_DUPLICATE` (now only for an admin email) reads "This email cannot be used for a sign-up…". `OTP_EMAIL_FAILED` maps to 502. Refusal extensions such as `tries_left` are passed along in the error detail.
- Checked: new tests in `test_signups.py` cover the pending refusal, email-only check, new vs returning, and admin refusal. Both routes are registered.

### Step 5 — Portal form: OTP step and messages that fit each case ✅
Needs: Step 4
- Explanation: in `sales-enquiry-form.tsx`, for Lite / Basic / Standard, the submit button becomes **Send code**.
  - On `otp_sent`, the form is replaced by a code step: "We've sent a 6-digit code to *email*. It is valid for 10 minutes." It has:
    - a 6-digit input;
    - a **Verify** button, disabled until 6 digits are entered;
    - a **Resend code** link with a 60-second countdown;
    - a **Change email** link that goes back to the filled form.
  - Server codes show as field errors under the input, in red as errors.
  - On success, `enquiry-success.tsx` shows the reference, and:
    - for a new applicant, today's text;
    - for a returning applicant, "This email already has a login (*username*). After approval the new BU will be added to it — sign in as usual and pick it from the BU switcher."
  - `SIGNUP_PENDING_EXISTS` shows as a form error with a link to the status page.
  - The rejected card on `signup-status-form.tsx` gets an **Apply again** button that links to the pricing form.
  - Enterprise keeps its current one-step submit.
- Path: `service-plus-portal/components/pricing/sales-enquiry-form.tsx`, `service-plus-portal/components/pricing/enquiry-success.tsx`, `service-plus-portal/components/signup/signup-status-form.tsx`, `service-plus-portal/lib/api.ts` (`sendSignupOtp`, `submitSignup(email, otp)`), `service-plus-portal/constants/messages.ts`.
- Code: a new code-entry state in the form, two API helpers, one button, and message keys.
- Done: the code step is a new component, `components/signup/signup-otp-step.tsx`. The button reads **Send code** for Basic / Standard; Lite keeps its confirm dialog, then the code step; Enterprise keeps **Send enquiry**.
- Checked: the portal type-checks (`tsc --noEmit`). eslint can't run here (the known TS 7 problem). Not tried in a browser — that is Your Part D.

### Step 6 — Approval adds the BU to the existing login ✅
Needs: Step 4
- Explanation: at the start of approval step 7 (only when `user_id` is still empty), look the applicant up again with `GET_LT_SIGNUP_EXISTING_USER`:
  - an active, non-admin user → insert one `user_bu_role (user_id, new bu_id, MANAGER role id)` with the new `INSERT_LT_USER_BU_ROLE` ("do nothing on conflict"). Record `user_id` with `SET_LT_USER`, with `login_email_sent` set from the Step 9 email. Skip `free_username` and `resolve_create_business_user_helper`;
  - an inactive user → refuse with `ENQUIRY_EXISTING_USER_INACTIVE` and release the claim. The BU and schema stay recorded;
  - an admin user → refuse with `ENQUIRY_EXISTING_USER_ADMIN`;
  - no user → create the Manager as today. With mobile no longer unique, the applicant's mobile is always accepted.

  The result adds `existing_user: true/false` and `username`.
- Path: `service-plus-server/app/graphql/resolvers/bu_admin/signups.py`, `service-plus-server/app/db/sql/sql_signups.py`, `service-plus-server/app/core/exceptions.py`.
- Code: a new branch at the top of step 7. The rest of the flow is unchanged.
- Checked: new tests in `test_signups_approval.py` cover adding the BU to an existing login, a new Manager, and refusing an inactive or admin login.

### Step 7 — Remove the mobile-uniqueness checks ✅
Needs: Step 1, Your Part B
- Explanation:
  - delete the mobile pre-check in `resolve_create_business_user_helper`, and any mobile check in the edit helper;
  - delete `CHECK_BUSINESS_USER_MOBILE_EXISTS` (and any `_EXCLUDE_ID` mobile variant) from the server SQL and from `SQL_MAP`;
  - delete the `BUSINESS_USER_MOBILE_EXISTS` message;
  - remove the `mobile` entry from the approve dialog's live checks.

  Before deleting each id, search for other users of it.
- Path: `service-plus-server/app/graphql/resolvers/bu_admin/users_roles.py`, `service-plus-server/app/db/sql/sql_bu_admin.py`, `service-plus-server/app/core/exceptions.py`, `src/constants/sql-map.ts`, `src/features/admin/components/approve-enquiry-dialog.tsx`, `src/constants/messages.ts`.
- Code: deletions only.
- Done: there was no `_EXCLUDE_ID` mobile variant. The approve dialog's mobile field stays for new applicants, with format checking only.

### Step 8 — The approver sees "Returning" ✅
Needs: Step 6, Step 7
- Explanation:
  - `GET_SALES_ENQUIRIES` also returns `existing_username`, by joining `existing_user_id` to `security."user"`.
  - The Enquiries grid shows a small neutral "Returning" chip beside the name (not red).
  - In `approve-enquiry-dialog.tsx`, when `existing_username` is set:
    - the Username and Mobile fields are hidden, and the zod schema makes them optional so submit isn't blocked;
    - one line reads "The new BU will be added to the existing login *username*.";
    - BU name and code stay editable;
    - the success toast reads "BU added to *username*'s login."
  - The inactive / admin refusals from Step 6 show as the dialog's error.
- Path: `service-plus-server/app/db/sql/sql_signups.py` (`GET_SALES_ENQUIRIES`), `src/components/shared/enquiries/enquiry-types.ts`, `src/components/shared/enquiries/enquiries-grid.tsx`, `src/features/admin/components/approve-enquiry-dialog.tsx`, `src/constants/messages.ts`.
- Code: one more selected column, one optional type field, a chip, and conditional fields in the dialog.
- Done: the "Returning" chip sits under the business name (indigo, with the username on hover). The dialog title becomes "Add BU to existing login" and the button "Add BU".
- Checked: client `tsc -b --force` is clean. `GET_SALES_ENQUIRIES` was run read-only on live data.

### Step 9 — Emails ✅
Needs: Step 3, Step 6
- Explanation: in `signup_emails.py`:
  - `otp_email` — already built in Step 3.
  - `thank_you_email` — for a returning applicant, adds "This request will be added to your existing login *username*."
  - `bu_added_email(enquiry, username, bu_name)` — sent at approval of a returning applicant instead of the credentials email: "Your new BU *name* is ready. Sign in with your existing username *username* and pick it from the BU switcher."

  The approved card on the portal status page shows "Use your existing login." when `get_lt_signup_status` returns `existing_login: true`.
- Path: `service-plus-server/app/services/signup_emails.py`, `service-plus-server/app/services/signups.py` (`get_lt_signup_status`), `service-plus-server/app/routers/public/website_router.py` (`SignupStatusOut`), `service-plus-portal/components/signup/signup-status-form.tsx`.
- Code: one new email builder, one changed builder, and one optional status field.
- Done: `bu_added_email` was built in Step 6, because approval sends it. For a returning applicant the thank-you appends `SIGNUP_EMAIL_RETURNING_NOTE`.

### 🧑 Your Part D — Test on the live portal ✅
Needs: Step 9
- **D1 (returning customer):** sign up on the Lite plan with the approved Manager's email, enter the code, approve with **Add BU**, and check the new BU appears in that Manager's BU switcher.
- **D2 (re-apply, shared mobile):** sign up on the Lite plan with the rejected applicant's email and mobile, enter the code, approve with **Create BU & Manager**, and check a new Manager login is created even though the mobile is shared.

### Step 10 — Help articles ✅
Needs: Steps 1–9
- Explanation:
  - `help-content.ts` (staff):
    - Admin → Enquiries: explain the "Returning" chip, that approval adds the BU to the existing login, and what to do on "login is inactive";
    - Business users: a mobile number may now be shared by two users, but an email may not.
  - `dev-help-content.ts`:
    - one new article, "Email OTP sign-up and multi-BU logins". It covers constraint 1's no-leak rule, the OTP limits and secret, the `signup_otp` table, the two endpoints and their refusal codes, `existing_user_id` being display-only, the email-only re-check at approval, the single `user_bu_role` insert (never `set_user_bu_role`), and "mobile is not an identity";
    - fix the stale text at about lines 5026 and 5118, which describe `CHECK_LT_SIGNUP_DUPLICATE`, `user_mobile_unique_idx` and the approve dialog's mobile live-check. Search for `MOBILE_EXISTS`, `user_mobile_unique_idx` and `SIGNUP_DUPLICATE` for other mentions.
  - Run `pnpm export-help` so `app/ai_help/*.json` matches, then `graphify update .`.
- Path: `src/features/client/components/help/help-content.ts`, `src/features/super-admin/components/help/dev-help-content.ts`.
- Code: article text only.
- Done: new developer article `dev-signup-otp-multi-bu`. Updated `dev-public-signup`, `dev-signup-approval`, the portal article, the sign-up billing map and the Manager user-management article, plus the staff "Sign-up Enquiries" and both "Managing Users" articles. `export-help` was run.
- Not done: `graphify update .` fails (`No module named 'graphify'`).

## Later (not in this plan)
- **"Add another BU" from inside the app.** A Manager who is already signed in could request a BU from Admin, with no portal form and no OTP, since the token already proves who they are. It would reuse the same enquiry row and approval.
- **Pre-filled re-apply.** The rejected card could open the form filled from the old request.
- **Per-BU onboarding.** Check that a second BU shows its own Getting started checklist and does not inherit "done" ticks from the first.

## Fix — deleting an inactive BU ✅
- Cause: `security.sales_enquiry.bu_id` points at the BU with no `ON DELETE` rule, so a BU created from a sign-up (live: `business_002` in `service_plus_customers`) could not be deleted. The server also dropped the schema **before** deleting the row, which left a BU with no schema. Once the schema was gone, the dialog switched to a plain `genericUpdate` row delete, which hit the same foreign key every time.
- Done:
  - `resolve_delete_bu_schema_helper` (`provisioning.py`) now checks the BU (`GET_BU_DELETE_CHECK`: must be inactive, and no `bu_payment` rows). It releases any sign-up (`RELEASE_SALES_ENQUIRY_BU`; a pending request also clears `bu_schema_ready_at`), deletes the row, then runs `DROP SCHEMA IF EXISTS`.
  - `delete-business-unit-dialog.tsx` always uses that path and shows the server's reason when it refuses.
  - `SALES_ENQUIRY_DDL` now declares `sales_enquiry_bu_id_fkey … ON DELETE SET NULL`; it takes effect the next time `run_signup_billing_ddl.py` is run.
  - Both help files updated.
- Checked: 4 new tests in `tests/bu_admin/test_provisioning.py`, and the full server suite passes. The live delete sequence for `business_002` was run inside one transaction that was rolled back, and the BU is still there.

## Feature — delete rejected enquiries ✅
- Done:
  - New mutations `deleteSalesEnquiry` (Admin → Enquiries; same guards as reject) and `deleteEnterpriseEnquiry` (Super Admin only). They run `DELETE_LT_ENQUIRY` / `DELETE_ENT_ENQUIRY`, which delete only a rejected row with no BU/user (Lite / Basic / Standard) or no client (Enterprise). Anything else is refused with `ENQUIRY_DELETE_NOT_ALLOWED`. The delete is audited as `DELETE_SALES_ENQUIRY`.
  - `components/shared/enquiries/delete-enquiry-button.tsx` puts a red **Delete** on rejected rows of both Enquiries pages, through `DeleteConfirmDialog` (type the reference to confirm).
  - Both help files updated.
- Checked: 2 new tests, full server suite (422 passed). Both DELETE statements were run against live data inside a transaction that was rolled back: only the rejected row matched. Client `tsc` is clean, and Vite serves the new files.

## Feature — Lite plan rules and portal upgrade ✅
- Rules (an "owner" is a login with the Manager role on a BU):
  - While the owner has a BU on Lite, they cannot sign up for any new Lite, Basic or Standard BU; they must upgrade that Lite BU first.
  - An owner of a paid BU cannot take a Lite BU.
  - Both rules are checked only after the email code, and again at approval.
- Upgrade:
  - The portal's new `/upgrade` page asks for the sign-in email and Basic / Standard, emails a code, and saves an upgrade request carrying the target plan's setup fee.
  - In Admin → Enquiries it shows "Upgrade from Lite". Record the setup payment, then **Upgrade plan** moves the BU with the existing Change plan logic and emails the owner. The first monthly payment then goes on Subscriptions.
- Server: `plan_rule_refusal`, `submit_lt_upgrade`, `_approve_upgrade`, `/api/public/upgrade/otp` and `/api/public/upgrade`. In SQL: `GET_LT_MANAGED_BUS`, `INSERT_LT_UPGRADE`, and in `SALES_ENQUIRY_DDL` the `kind` and `upgrade_bu_id` columns, with the BU-code index limited to sign-ups.
- Checked: 15 new tests, and the whole suite passes (437 passed). The DDL, the grid query and an upgrade insert were run on live data inside a transaction that was rolled back. Client and portal type-check.

### 🧑 Your Part E — Apply the sign-up table changes ✅
Needs: Feature — Lite plan rules and portal upgrade
- Run `python scripts/run_signup_billing_ddl.py` from `service-plus-server/`. Until then, Admin → Enquiries on the dev server fails, because the grid reads the new `kind` column.
- Fix: the upgrade dialog's **Upgrade plan** button stayed disabled. react-hook-form never recomputes `isValid` when no field is rendered, so upgrade mode no longer waits for it. The BU name and code rules now apply only when a BU is created. ✅
