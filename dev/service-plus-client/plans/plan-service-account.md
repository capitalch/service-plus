# Plan: Replace Trace‑Plus super‑admin with a dedicated service account for Accounts Posting

## Goal
Accounts Posting currently authenticates service‑to‑service against trace‑plus‑server using the
**superAdmin** credentials. Replace that with a **dedicated, least‑privilege service account** so the
super‑admin identity is not embedded in service‑plus for routine posting.

## Current state (as‑is)

**service‑plus‑server** — `app/graphql/resolvers/mutation_helper.py`
- `_get_trace_plus_token()` (≈ line 2018) POSTs to `{trace_plus_url}/api/login` with
  `settings.trace_plus_super_admin_uid` / `settings.trace_plus_super_admin_password`, returns `accessToken`.
- Token is reused for the whole run; each voucher is posted via `_post_tran_h_to_trace_plus()` (≈ line 2267)
  to `{trace_plus_url}/graphql/` as `mutation AccountsPosting($value)`, with `clientCode` + `buCode` in the payload.

**service‑plus‑server** — `app/config.py` (≈ lines 106‑118)
- `trace_plus_url` (default `http://localhost:8001`)
- `trace_plus_super_admin_uid` (default `superAdmin`)
- `trace_plus_super_admin_password` (default `superadmin@123`)
- Settings load from `.env` (`SettingsConfigDict(env_file=".env", case_sensitive=False)`).

**trace‑plus‑server** — `/home/sushant/projects/trace-plus/dev/trace-server`
- `/api/login` (`app/security/security_router.py`): `login_helper(clientId, username, password)`.
  - `get_super_admin_bundle()` matches superAdmin **from config, no clientId required**.
  - else `get_other_user_bundle(clientId, …)` — a **DB user** that needs `clientId` and carries
    `role`, `userSecuredControls`, `userBusinessUnits`, `isUserActive`.
- `accounts_posting_helper()` (`app/graphql/graphql_helper.py` ≈ line 492): reads `clientCode`/`buCode`
  **from the request payload**, resolves the client DB from `ClientM`, and posts. **It does not check the
  caller's role / secured controls / business‑unit membership** — it only needs a valid authenticated token.

### Key implication
Because `accounts_posting_helper` trusts the payload's `clientCode`/`buCode` and does **not** enforce
per‑user authorization, *any* valid trace‑plus token can post to *any* client. So a low‑privilege service
account works functionally today — but the privilege reduction is only real if we **also** add an authz
check on the mutation (see Option B / Hardening). Without that, "service account" mainly buys us identity
separation, credential rotation, and auditability — not true least privilege.

## Open question to verify FIRST (blocking)
Confirm the trace‑plus `/graphql/` route requires authentication and that a **non‑super‑admin** token is
accepted by `accountsPosting`. Inspect the GraphQL router/ASGI wiring (`app/graphql/graphql_router.py`,
`app/main.py`) for the auth dependency. If the route is currently super‑admin‑gated anywhere, the plan must
include relaxing that to "authenticated + authorized service account".

---

## Options

### Option A — Config‑based service identity (mirror superAdmin)
Add a second config‑level identity in trace‑plus (e.g. `SERVICE_ACCOUNT_UID` + bcrypt hash) and a
`get_service_account_bundle()` parallel to `get_super_admin_bundle()`. service‑plus logs in with it
(no clientId needed).
- **Pros:** smallest change; no clientId plumbing; no DB user lifecycle; direct drop‑in for current flow.
- **Cons:** still a global, cross‑client credential like superAdmin — not least privilege unless the
  mutation is also scoped; bypasses normal RBAC/audit of DB users.

### Option B — Real DB user with a posting‑only role (recommended)
Create a dedicated trace‑plus **DB user** (in `UserM`) under the designated trace‑plus client, with a
minimal role + only the secured control(s) needed for `accountsPosting`, and the required business units.
- **Pros:** proper RBAC, per‑client revocation, auditable, least privilege once the mutation enforces authz.
- **Cons:** login must pass `clientId`; if multiple service‑plus clients map to multiple trace clients you
  need either one cross‑client service user or one per client; requires the Hardening step to be meaningful.

**Recommendation: Option B**, paired with the Hardening step (authorization check in
`accounts_posting_helper`). Fall back to Option A only if DB‑user login with clientId proves impractical
for the deployment topology.

---

## Implementation process (Option B)

### Phase 1 — Trace‑plus: create the service account
1. Decide the **clientId/clientCode** the service user belongs to and which **business units** it must post
   to (the `buCode`s passed from service‑plus).
2. Create a **role** (e.g. `Service Posting`) granting only the secured control(s) backing `accountsPosting`.
   Verify the exact control id via `import_secured_controls` / `sql_security.py` mapping.
3. Create an **active** `UserM` user (e.g. `svc-service-plus`) with that role, a strong generated password,
   and membership in the required business units. Confirm `isUserActive = true`.
4. Record the credentials in the secret store (see Phase 4). Do **not** commit them.

### Phase 2 — Trace‑plus: harden the mutation (authorization)
5. In `accounts_posting_helper`, after auth, **verify the caller is permitted** for the requested
   `clientCode`/`buCode` (check the token user's client + business‑unit membership + secured control).
   Reject with a 403 otherwise. This is what turns "a low‑priv user" into actual least privilege.
6. Keep superAdmin working (back‑compat) so existing flows / Option‑A fallback don't break.

### Phase 3 — Service‑plus‑server: switch credentials & login
7. `app/config.py`: add new settings
   - `trace_plus_service_account_uid`
   - `trace_plus_service_account_password`
   - `trace_plus_service_account_client_id` (the trace‑plus clientId for DB‑user login)
   Keep the old `trace_plus_super_admin_*` fields temporarily for rollback.
8. `_get_trace_plus_token()`: log in with the service account, **including `clientId`** in the POST form
   (the `/api/login` `OAuth2PasswordRequestForm` reads `clientId` from the form via `form.get("clientId")`).
   Confirm the field name matches `security_router.do_login`.
9. Add resilience: clear error if login fails (so posting reports "auth failed" distinctly from
   "posting failed"); optional one‑time token refresh if a 401 occurs mid‑run.

### Phase 4 — Configuration & secrets
10. Set the new values via `.env` / deployment secrets for each environment (local, demo, prod). Never use
    the committed defaults for real credentials.
11. Plan **rotation**: document how to rotate the service password without redeploying code (env update +
    restart). Remove the password defaults from `config.py` (leave non‑secret defaults only).

### Phase 5 — Testing
12. Unit: `_get_trace_plus_token()` posts username/password/clientId and parses `accessToken`.
13. Integration (against a trace‑plus dev instance):
    - Service account can log in and obtain a token.
    - `accountsPosting` succeeds for the **permitted** client/BU.
    - After Hardening, `accountsPosting` is **rejected (403)** for a non‑permitted client/BU.
    - superAdmin path still works (back‑compat).
14. End‑to‑end via the Accounts Posting UI (`accounts-posting-section.tsx`): post money receipts /
    purchase invoices / job invoices for a branch; verify progress events, success toast, and that rows are
    marked posted (`MARK_MONEY_RECEIPT_POSTED`, etc.).
15. Negative: inactive service user, wrong password, expired token → clear, non‑silent failures.

### Phase 6 — Rollout & cleanup
16. Deploy trace‑plus changes (Phases 1‑2) first, then service‑plus (Phase 3), env per‑environment.
17. Soak using the service account; monitor logs/audit.
18. Once stable, remove `trace_plus_super_admin_uid/password` usage from `_get_trace_plus_token()` and the
    now‑unused config fields. Keep superAdmin login in trace‑plus for human admin use.

## Files to change
- `service-plus-server/app/config.py` — new `trace_plus_service_account_*` settings; drop secret defaults.
- `service-plus-server/app/graphql/resolvers/mutation_helper.py` — `_get_trace_plus_token()` (creds + clientId, error handling).
- `trace-server/app/graphql/graphql_helper.py` — `accounts_posting_helper()` authorization check (Hardening).
- `trace-server` user/role/secured‑control setup (data, via admin UI or seed) — service user + posting role.
- `.env` / deployment secret config for all environments.
- (If Option A instead) `trace-server/app/config.py` + `app/security/security_helper.py` — service identity + `get_service_account_bundle()`.

## Risks & notes
- **Authz gap:** until Phase 2 lands, the service account can post cross‑client (same as superAdmin). Treat
  Phase 2 as part of the definition of done, not optional.
- **Topology:** if service‑plus posts for multiple trace‑plus clients, decide one cross‑client service user
  vs. one per client before Phase 1.
- **Token lifetime:** a long posting run could outlive the token; add refresh‑on‑401 if runs are large.
- **Back‑compat:** keep superAdmin functional throughout; only remove service‑plus's *use* of it at the end.

