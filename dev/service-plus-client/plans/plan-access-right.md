# Observation: Current Access Management / Access-Right System

## Purpose

A snapshot of how authentication and authorization work in the codebase today
(client: `service-plus-client`, server: `service-plus-server`), and where the
gaps are. This is an assessment, not yet an implementation plan.

## Summary (one line)

A complete RBAC **schema** exists and login computes each user's access-right
codes, but enforcement today is only **authentication + coarse user-type gating
in the client UI**. The granular `access_rights` are loaded but never checked,
and the **GraphQL API is unauthenticated on the server**.

## Data model — RBAC tables (tenant `security` schema)

Defined in `src/types/db-schema-security.ts` (auto-generated from the DB):

- **`user`** — `username`, `email`, `password_hash`, `is_active`, `is_admin`,
  `last_used_bu_id`, `last_used_branch_id`.
- **`bu`** — business units (`code`, `name`, `is_active`).
- **`role`** — roles (`code`, `name`, `is_system`).
- **`access_right`** — granular permissions (`code`, `name`, `module`, `description`).
- **`role_access_right`** — role → access rights (M:N).
- **`user_bu_role`** — user gets a role **per business unit** (the core mapping;
  `is_active` flag).

Intended chain: **user → (per BU) role → access rights.**

Management UIs already exist:
- `src/features/admin/pages/roles-page.tsx`, `business-users-page.tsx`,
  `components/associate-bu-role-dialog.tsx`, `create-business-user-dialog.tsx`.
- `src/features/super-admin/components/seed-roles-dialog.tsx`,
  `constants/seed-data.ts`, `initialize-client-dialog.tsx`.

## Authentication (implemented and enforced)

- **Login is REST**: `POST /api/auth/login` → `app/routers/auth_router_helper.py::login_helper`.
  - Looks up user via `SqlStore.GET_USER_BY_IDENTITY`, which aggregates the user's
    access-right codes across `user_bu_role → role → role_access_right → access_right`
    into `access_rights: string[]`, plus `role_name`.
  - Issues a **JWT** (`create_access_token`) with claims `sub`, `user_type`,
    `client_id`, `db_name`, plus a refresh token.
  - `user_type` = `"A"` if `is_admin` else `"B"`; super-admin = `"S"` (synthetic,
    no DB row — see `app/core/dependencies.py::get_current_user`).
- **Client storage**: `src/features/auth/store/auth-slice.ts` keeps token + user
  (incl. `accessRights`, `availableBus`, `roleName`, `userType`) in Redux +
  `localStorage`.
- **Token transport**: `src/lib/apollo-client.ts` attaches
  `Authorization: Bearer <token>` to every GraphQL call, with auto-refresh on expiry.
- **Server validation**: `app/core/dependencies.py::get_current_user` decodes/validates
  the JWT and loads the user (or returns the synthetic super-admin).

## Authorization (coarse, with a server-side gap)

**Client-side gating — by `userType` (A/B/S) and `sessionMode` (admin/client) only:**
- `src/router/protected-route.tsx` — `requiredUserType` and `requiredSessionMode`
  guards; otherwise redirects.
- `src/router/index.tsx` — routes tagged with those guards.
- Scattered ad-hoc checks: `user.userType === 'A' | 'S'` in
  `client-activity-bar.tsx`, `client-top-nav.tsx`, `client-explorer-panel.tsx`,
  `lookup-section.tsx`, `admin/components/bu-branch-switcher.tsx`, `app.tsx`.

**Server-side enforcement:**
- `Depends(get_current_user)` is applied **only to the REST `image_router`**
  endpoints (`app/routers/image_router.py`).
- The **GraphQL endpoint** (`/graphql`, mounted in `app/main.py`) — through which
  **all** business queries/mutations run (including `accountsPosting`) — is mounted
  with **no auth middleware and no `context_value`** (only `CORSMiddleware`). The
  client sends the Bearer token, but the server does **not** verify it on GraphQL
  calls, and no resolver checks access rights.

## Gaps / risks

1. **GraphQL API is unauthenticated server-side.** Any caller who can reach
   `/graphql` can run queries/mutations without a valid token. This is the most
   significant gap.
2. **Granular `access_rights` are computed and shipped to the client but never
   enforced** — there is no `hasPermission(code)` helper, no per-feature gating,
   and no resolver-level permission check. Authorization is effectively just the
   3-value `userType` + `sessionMode`.
3. **RBAC management UI exists without a matching enforcement layer** — admins can
   define roles/rights and assign them per BU, but those assignments do not yet
   change what a user can do or see.

## Possible next steps (if we decide to close the gaps)

- **Server GraphQL auth**: add a `context_value`/middleware on the mounted GraphQL
  app that runs the same JWT validation as `get_current_user`, rejecting
  unauthenticated requests; thread the user (and access rights) into resolver
  context.
- **Resolver-level authorization**: enforce required access-right codes per
  mutation/query (e.g. a decorator or a check against the user's `access_rights`).
- **Client gating utility**: a `useHasAccess(code)` / `<RequireAccess code=...>`
  helper backed by `auth-slice` `accessRights`, used to hide/disable features and
  guard routes beyond the coarse `userType` check.
- Decide the source of truth for a user's effective rights when multiple BUs/roles
  apply (currently `GET_USER_BY_IDENTITY` aggregates across all active
  `user_bu_role` rows, not scoped to the currently selected BU).

## Key files referenced

- Client: `src/types/db-schema-security.ts`, `src/features/auth/store/auth-slice.ts`,
  `src/lib/auth-service.ts`, `src/lib/apollo-client.ts`,
  `src/router/protected-route.tsx`, `src/router/index.tsx`.
- Server: `app/routers/auth_router_helper.py`, `app/core/dependencies.py`,
  `app/core/security.py`, `app/db/sql_store.py` (`GET_USER_BY_IDENTITY`,
  `GET_USER_BUS`), `app/graphql/schema.py`, `app/main.py`,
  `app/routers/image_router.py`.
