# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope

This folder is the React client of **Service+**, a multi-tenant SaaS for electronics-repair workshop management. Stay inside this folder; never edit anything under `../../deployment/` (that is a deployed copy of the server + a built `dist`).

The FastAPI/GraphQL/PostgreSQL server lives at `../service-plus-server` — read-only reference for resolver names, SQL ids and schema dumps (`app/db/schema_dumps/`, `app/db/sql/`).

## Commands

```bash
pnpm start          # Vite dev server on port 3000 (opens browser)
pnpm build          # tsc -b && vite build
pnpm lint           # eslint .
pnpm format         # prettier --write "src/**/*.{ts,tsx}"
pnpm gen-types-all  # regenerate all three db-schema type files from live Postgres
```

Use **pnpm**, never npm. There are no unit tests in this package; verification is `pnpm lint` + `pnpm build` (or `pnpm exec tsc -b --noEmit` for a type-only check).

`gen-types-service` / `gen-types-security` / `gen-types-client` regenerate the three generated type files individually from the `SERVICE_PLUS_SERVICE` / `SERVICE_PLUS_CLIENT` connection strings in `.env`. Never hand-edit them:

| File | Source |
|---|---|
| `src/types/db-schema-service.ts` | `demo1` schema of `service_plus_service` — the BU table template |
| `src/types/db-schema-security.ts` | `security` schema of `service_plus_service` — users, roles, rights, `bu` |
| `src/types/db-schema-client.ts` | `public` schema of `service_plus_client` — the tenant registry |

Derive the TypeScript types for query results and mutation payloads from these rather than re-declaring column shapes by hand.

## Multi-tenancy model — why every call carries `db_name` and `schema`

- `service_plus_client` DB → one `client` row per tenant; its `db_name` column names that tenant's own database.
- Each tenant database has a `security` schema (users, roles, access rights, `bu` table) plus **one schema per Business Unit**, named after `bu.code` (e.g. `demo1`). BU schemas are cloned from the `demo1` template when a BU is created.
- Therefore every data call needs two coordinates: `db_name` (which tenant DB) and `schema` (which BU). They come from Redux — `selectDbName` (`features/auth/store/auth-slice`) and `selectSchema` (`store/context-slice`) — not from props.

## Data access — the generic envelope pattern

There are almost no per-entity GraphQL operations. Nearly all reads and writes go through a handful of generic operations in `constants/graphql-map.ts`, all with the same signature `($db_name: String!, $schema: String, $value: String!)`:

| Operation | Use for |
|---|---|
| `genericQuery` | a single named SQL read |
| `genericBatchQuery` | several reads in one round trip |
| `genericUpdate` | declarative master/child insert/update/delete |
| `genericUpdateScript` | a named server-side SQL script (multi-statement writes) |

`value` is a URL-encoded JSON payload built by `lib/graphql-utils.ts` — use `graphQlUtils.buildGenericQueryValue`, `buildGenericUpdateValue`, `buildGenericBatchItem`; never hand-assemble it.

**`sqlId` is a contract with the server.** `constants/sql-map.ts` (`SQL_MAP`) mirrors the constant names on the server's `SqlStore` (composed by multiple inheritance in `app/db/sql/sql_base.py` from `sql_jobs.py`, `sql_inventory.py`, `sql_sales_accounts.py`, `sql_bu_admin.py`, `sql_reports_audit.py`, `sql_shared.py`). Adding a query means adding the SQL server-side **and** the id here; the string value must match exactly.

`genericUpdate` payload (`SqlObjectType`) supports single master insert/update, `xDetails` children (dict or list, arbitrary nesting, multiple sibling child tables), FK auto-injected from the parent's `RETURNING id`, `deletedIds` for child deletion, `isIdInsert` to force an explicit id — all in one transaction. Prefer it over a bespoke script.

Reads in report/grid components should use the `useGenericQuery` hook (`features/client/components/reports/common/use-generic-query.ts`) rather than a fresh `apolloClient.query` call.

**Transport rule:** every authenticated call goes over GraphQL through Apollo, with the `Authorization: Bearer <token>` header the links add for you. Everything unauthenticated — login, token refresh, file/media upload, public endpoints — is REST via axios.

## Auth and session

- `lib/apollo-client.ts` is the whole story: `authLink` proactively refreshes a token within 5 min of expiry, `errorLink` retries once on HTTP 401 or a GraphQL `TOKEN_EXPIRED` extension and hard-logs-out when refresh is impossible. Default fetch policy is `no-cache` everywhere — the app relies on the server, not the Apollo cache.
- Subscriptions go over a separate `graphql-ws` link (`ApolloLink.split` on operation type), so error/auth links do **not** apply to them.
- Three operating modes, all behind `ProtectedRoute` (`router/protected-route.tsx`): **client** (`/client/*`, day-to-day work) and **admin** (`/admin/*`, userType `A`) are gated by `requiredSessionMode`; **super-admin** (`/super-admin/*`) is gated by user type alone.
- Per-feature permissions: `features/auth/utils/access-rights.ts`. `hasAccessRight(user, ACCESS_RIGHTS.X)` — userType `S` and `A` bypass every check. When adding a right, it must land in **four** places or it silently does nothing: the server seed, the server's `GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS` map, the `ACCESS_RIGHTS` map here, and `ACCESS_RIGHT_PREVIEW_ITEMS` in `features/super-admin/components/seed-roles-dialog.tsx` (existing tenants only receive new rights by re-running that dialog).

## Layout of `src/`

```
features/{auth,super-admin,admin,client}/   feature-sliced; client/ is the bulk
  client/components/{jobs,inventory,masters,reports,configurations,accounts-admin}/
components/ui/         shadcn primitives (generated — don't hand-tune)
components/shared/     cross-feature widgets + the help engine
constants/             graphql-map, sql-map, messages, timing, icon-colors
lib/                   apollo-client, auth-service/-storage, token-refresh, pdf/image/gstin/mobile helpers
store/                 store, typed hooks, context-slice (BU/branch/division + app settings)
types/db-schema-*.ts   generated Postgres types
```

Routing is React Router v7 (`router/`); all global state is Redux Toolkit (`store/`) — no other global store.

The folder tree under `features/client/components/` mirrors the app's menu hierarchy: one folder per top-nav item, one sub-folder per sidebar item, and one page component per top-nav item in `features/client/pages/`. New screens follow that mapping. Reuse aggressively rather than duplicating: shared pieces go in `features/client/components/shared/`, then `components/shared/` if truly cross-feature.

`store/context-slice.ts` holds the resolved BU/branch/division plus tenant app settings (GST registration, default HSN codes, markup %, print counts, job T&C, `postDataToAccounts`). Read settings from there rather than re-querying.

## In-app help system

`features/client/components/help/help-content.ts` (client) and `features/super-admin/components/help/dev-help-content.ts` (developer) are structured `HelpArticle[]` data rendered by the shared engine in `components/shared/help/`. **When a code change alters user-visible behaviour, update the corresponding help article in the same change.**

## Conventions (project-specific, enforced by review)

- **Red is reserved for errors** and for the `*` on mandatory fields. Never use red for ordinary control styling. Hard rule.
- Text longer than two words goes in `constants/messages.ts` as a key; control display text (labels, buttons, placeholders) stays hardcoded in the component.
- **Never use `index.ts` re-export barrels** — always explicit named imports, intra- and cross-feature.
- Arrow functions for components and hooks; normal `function` declarations for utilities, API helpers and inline handlers.
- `type`, not `interface`, wherever possible; type names end in `Type`.
- Sort alphabetically within a file: functions, object properties, type members, array literals, parameters, and Tailwind classes.
- `useAppDispatch` / `useAppSelector` (from `store/hooks`), never the untyped react-redux hooks. `apolloClient.query(...)` directly, never `useApolloClient()`.
- Forms: react-hook-form + `useFieldArray` + zod resolvers. Validation errors must appear immediately and disable submit while invalid.
- shadcn components + framer-motion for transitions; sonner for toasts. Designs must be responsive.
- Debounce timings come from `constants/timing.ts` (`SEARCH_DEBOUNCE_MS`, `FIELD_VALIDATION_DEBOUNCE_MS` — both 1600 ms); never inline a literal.
- Prettier config is unusual: **tabs, width 4, double quotes, semicolons, printWidth 120**. Run `pnpm format` on touched files.

## Planning protocol

When a request ends with the word "plan" (or you are in plan mode), produce a plan only — no code changes. Write it to `plans/plan.md` in this folder, overwriting any existing file, with steps labelled `Step 1`, `Step 2`, … and a **Workflow** section describing the end-to-end flow. Other `plans/*.md` files are per-feature plans and prompts; do not overwrite them unless asked.

## Files not to read

.claudeignore` excludes `.env`, `**/.env*` and `**/config.*` — secrets live there.

## Folders never to read and work upon
- All folders named as deployment and subfolders in it. These are deployment files and not to be touched.
