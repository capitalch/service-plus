# Lite sign-up from the portal is not saved in the database

## Goal

- A visitor who picks **Lite** on the portal pricing page, fills the form and confirms, gets a row in `security.sales_enquiry` of the default customer database, exactly like Basic and Standard.
- If saving fails for any reason, the visitor **sees that it failed** and keeps what they typed. Today a failure can look like nothing happened.
- Decisions already made (kept): Lite is free, Lite goes through `POST /api/public/signup` (not `/sales-enquiry`), rows live only in the default customer database, never in the control-plane table.

## Present context and current design

### Lite path, end to end

1. `service-plus-portal/components/pricing/sales-enquiry-form.tsx` — `onSubmit` sees `plan === "lite"`, stores the values in `confirmValues` and opens `LiteConfirmDialog`. No request is sent yet.
2. The visitor clicks "Confirm signup" → `handleConfirmLite` → `send(values)` → `submitSignup` (`lib/api.ts`) → `POST /api/public/signup`.
3. `send` shows the success screen on 200. On `ApiError` with a `code` it shows the message in the error summary. On any other failure (500, network, 429) it only fires a toast.
4. `handleConfirmLite` then **always** runs `setConfirmValues(null)`, so the dialog closes whether or not the request worked.
5. Server: `website_router.submit_signup` → `signups.submit_lt_signup` → `INSERT_LT_ENQUIRY` into `security.sales_enquiry`.

### What the code review found

- Lite differs from Basic/Standard only by `setup_fee_paise = 0` and `payment_status = 'not_required'` (`submit_lt_signup`). The portal sends the same body for all three (`enquiryBody` in `lib/api.ts`; `branches` is omitted and the server defaults it to 1).
- The insert, the table DDL (`SignupServerSql.SALES_ENQUIRY_DDL`), the unit tests (`tests/core/test_signups.py`) and the row constraints all accept a Lite row. So the code, read alone, **does not explain** the missing row. The cause is one of the runtime cases below, and the first job is to find which.
- Weak spot confirmed in the portal: for Lite, a server failure shows only a short-lived toast while the confirm dialog closes, so the visitor can believe it was sent.

### Candidate causes (to be separated by Step 1)

| # | Cause | What it would look like |
|---|---|---|
| A | The default customer database has no `security.sales_enquiry` table, or it is an old copy lacking `setup_fee_paise` / `payment_status` / the `not_required` rule. `scripts/run_signup_billing_ddl.py` was not run on it. | Server 500 on `INSERT_LT_ENQUIRY`; applies to Basic and Standard too, unless they were never tried. |
| B | The portal points at a server other than the one being inspected (wrong `NEXT_PUBLIC_API_BASE_URL`, or the deployed server is an older build). | No request in the server log at all. |
| C | The honeypot field `website` was auto-filled by the browser, so `onSubmit` fakes success and sends nothing. | Success screen, no request in the network tab. |
| D | A duplicate (same email or mobile already pending/approved), refused with `SIGNUP_DUPLICATE`. | Error summary on the form; a row exists from the earlier attempt. |
| E | The wrong database was checked: rows go to `DEFAULT_CUSTOMER_DB_NAME`, schema `security`, not to `service_plus_client.public.sales_enquiry`. | Row present, just not where it was looked for. |

## New design brief

- Find the real cause with a short checklist run by you (Step 0, Step 1).
- Make Lite failures impossible to miss: the failure stays on screen (Step 2).
- Log the real exception for a failed sign-up so the next report can be answered from the log (Step 3).
- Add a test and update both help files per the project rule (Step 4).

## Key constraints of new design

1. **Never show success unless the server returned a reference.** Resolution: the success screen is only set from `submitSignup`'s resolved value; the honeypot path stays the only fake success.
2. **The visitor's typed data must survive a failure.** Resolution: `reset` is not called on failure, so the form keeps its values.
3. **No new endpoint, table or column.** Resolution: Steps 2 and 3 change existing files only; if Step 1 finds cause A, the fix is running the existing DDL script.
4. **No internal detail leaks to visitors.** Resolution: the form shows `ApiError.message` for coded refusals and the generic `enquiryFailed` text otherwise; the stack trace goes to the server log only.

## Steps

### Step 0 — Your Part

- **A. Reproduce once with the browser network tab open** (before Step 1).
  Open the portal pricing page, choose Lite, confirm. In DevTools → Network find `POST /api/public/signup` and note: was a request sent, the URL host, the status code, the response body. Send me those four facts.
- **B. Check the database directly** (before Step 1).
  In the database named by `DEFAULT_CUSTOMER_DB_NAME` run
  `select reference, plan_code, status, payment_status, created_at from security.sales_enquiry order by created_at desc limit 5;`
  and `\d security.sales_enquiry`. Tell me whether the table exists and whether the `setup_fee_paise` and `payment_status` columns are listed.
- **C. Read the server log** for the minute of the attempt and send any `Traceback` or `Sign-up insert clash` lines (before Step 1).

### Step 1 — Decide the cause from Your Part

Needs: Your Part A, B, C.

- Explanation: map the facts to the table above.
  - No request in the network tab but a success screen → **C** (honeypot). Also do Step 2b.
  - Request goes to an unexpected host → **B**. Configuration fix: set `NEXT_PUBLIC_API_BASE_URL` and rebuild the portal (`out/` is a static export, so the value is baked in at build time). No code change.
  - 500 and a Postgres error about a missing table, column or constraint → **A**. Fix: from `service-plus-server` run `python scripts/run_signup_billing_ddl.py --dry-run`, then without `--dry-run`. The script is safe to run twice. No code change.
  - 409 `SIGNUP_DUPLICATE` → **D**. Working as designed.
  - Row exists in `security.sales_enquiry` of the default DB → **E**. Nothing is broken.
  - 503 `DEFAULT_DB_NOT_CONFIGURED` → `DEFAULT_CUSTOMER_DB_NAME` in the server `.env` is empty or matches no active `public.client` row. Fix the setting.
- Path: none (analysis only). Code: none.

### Step 2 — Show every failure in the form, not just a toast

Needs: Step 1 (do it whichever cause is found; it is the visitor-facing half of the bug).

- Explanation: today non-coded failures (500, network) only toast, and the Lite dialog closes regardless. Route every failure through `serverError`, which renders in the focused `ErrorSummary` above the form and stays until the next attempt. The typed values stay in the form.
- Path: `service-plus-portal/components/pricing/sales-enquiry-form.tsx`, function `send`.

Old:

```tsx
		} catch (error) {
			if (error instanceof ApiError && error.status === 429) toast.error(MESSAGES.enquiryRateLimited);
			// A refusal the visitor can act on (duplicate request, sign-ups not configured, …).
			else if (error instanceof ApiError && error.code) setServerError(error.message);
			else toast.error(MESSAGES.enquiryFailed);
		}
```

New:

```tsx
		} catch (error) {
			if (error instanceof ApiError && error.status === 429) setServerError(MESSAGES.enquiryRateLimited);
			// A refusal the visitor can act on (duplicate request, sign-ups not configured, …).
			else if (error instanceof ApiError && error.code) setServerError(error.message);
			else setServerError(MESSAGES.enquiryFailed);
		}
```

- The existing `useEffect` already focuses and scrolls to the summary when `serverError` is set. `handleConfirmLite` stays as is: closing the dialog now reveals the visible error rather than hiding a toast.
- Remove the `toast` import if nothing else in the file uses it (no dead code).

### Step 2b — Honeypot name that autofill ignores (only if Step 1 says C)

Needs: Step 1.

- Explanation: a browser auto-filling a field called `website` turns a real signup into a fake success. Rename the honeypot to `companyUrl`-style name autofill does not target, and set `autoComplete="off"` and `tabIndex={-1}` on it.
- Path: `service-plus-portal/components/pricing/sales-enquiry-form.tsx` — the `website` entry in `defaultValues`, `enquirySchema`, `onSubmit` and its `<Input>`. Behaviour of `onSubmit` is unchanged.

### Step 3 — Log the real failure of a sign-up on the server

Needs: nothing (independent).

- Explanation: an unexpected exception in `submit_signup` becomes a bare 500. Log it with the plan code only (no personal data), then re-raise so the response is unchanged.
- Path: `service-plus-server/app/routers/public/website_router.py`, function `submit_signup`.

Old:

```python
    try:
        result = await submit_lt_signup(payload.model_dump(), request.client.host if request.client else None)
    except ServicePlusException as e:
        raise _signup_http_error(e) from e
    return SalesEnquiryOut(**result)
```

New:

```python
    try:
        result = await submit_lt_signup(payload.model_dump(), request.client.host if request.client else None)
    except ServicePlusException as e:
        raise _signup_http_error(e) from e
    except Exception:
        logger.exception("Sign-up failed for plan %s", payload.plan_code)
        raise
    return SalesEnquiryOut(**result)
```

### Step 4 — Test and help files

Needs: Step 2, Step 3.

- Path: `service-plus-server/tests/core/test_signups.py` — add `test_lite_insert_failure_is_not_swallowed`: stub `exec_sql` to raise on `INSERT_LT_ENQUIRY`, assert `submit_lt_signup(LITE, None)` raises and no email is sent.
- Path: `service-plus-client/src/features/client/components/help/help-content.ts` — in the article describing the portal sign-up, state that a failed submission now shows an error above the form, nothing is sent, and the visitor can retry.
- Path: `service-plus-client/src/features/super-admin/components/help/dev-help-content.ts` — add one developer article, "Debugging a sign-up that did not save", with the Step 1 checklist (network tab, `DEFAULT_CUSTOMER_DB_NAME`, `run_signup_billing_ddl.py`, honeypot field name, the new `logger.exception` line). Grep sibling sign-up articles for statements about the Lite toast/dialog and correct them.
- Verify: `pnpm lint` and `pnpm build` in `service-plus-portal`; `pytest tests/core/test_signups.py` in `service-plus-server`.
