# Plan — Per-BU features, switched on by the Super Admin

Source: chat request, 15 Oct 2026, revised the same day. Built 15 Oct 2026 (Steps 1–11 ✅); Your Parts A and B are still to do.

## Goal

The Super Admin decides which business units get which optional features. A feature that is off for a BU does not exist for that BU's users: no menu item, no screen, no help article, and the server refuses its writes. **Spare Parts Web** is the first such feature, and from now on it is off everywhere until the Super Admin switches it on for chosen BUs.

Decisions:
- **Generic, not a one-off.** One feature list, one place to switch features on, and one check used everywhere. A future selective feature is added by naming it in the list and wrapping its menu item, screen, help article and server writes in the same check.
- **Stored per BU.** "This client gets it" means switching it on for all of that client's BUs. The Super Admin screen has an "all BUs" tick per feature to do that in one click.
- **Not tied to plans.** Plans keep their limits. Features are a separate, hand-picked switch per BU.
- **Off by default.** A new BU, and every existing BU after the upgrade, starts with no features. Nothing is switched on automatically.
- **Only the Super Admin changes it.** A tenant's own Admin can see nothing about it and cannot change it, not even through the generic update call.
- **Hidden, not deleted.** Turning a feature off keeps its data. Turning it back on brings everything back as it was.
- **The public website follows the switch.** A BU with Spare Parts Web off drops out of the website's Spare Parts page, while its job-status and open-jobs lookups on the same website keep working.

## Present context

- **Per-BU settings the Super Admin controls already exist, for billing.** `security.bu` (in every tenant database) carries `plan_code`, `paid_through`, `branch_limit`, the monthly limits and more. The Super Admin edits them from the Clients page's row menu (`client-subscription-dialog.tsx`). That dialog reads `GET_BU_SUBSCRIPTIONS` with `genericQuery` on the client's database, and saves through dedicated mutations that only userType `S` may call (`require_user_type(info, {"S"})`, `bu_admin/billing.py`).
- **Those columns are already protected from tenants.** `require_generic_update_access` (`auth_guards.py`) refuses any `genericUpdate` that touches a column in `BU_BILLING_COLUMNS` on `bu`.
- **The app already re-reads a per-BU status.** `buBillingStatus` (`query.py`) returns the BU's billing summary, usage and `aiHelpEnabled`. The client reads it on BU change, on window focus and on `billingRefreshTick` (`use-billing-sync.ts`) and keeps it in `context.billing` (`BuBillingType`, `store/context-slice.ts`). The billing part comes from `get_bu_billing` (`services/bu_billing.py`), cached for 60 seconds per BU and cleared by `clear_bu_billing`. `require_bu_writable` reads the same cache on every write.
- **The existing add-on works differently.** Extended Warranty is switched on by the tenant itself in App Settings (`extended_warranty.enabled`, `custom-menu-registry.ts`). It is a tenant choice, not a Super Admin grant, and is not changed by this plan.
- **Spare Parts Web today:**
    - **Menu and screen.** Masters → *Product & Parts* → **Spare Parts Web** (`client-explorer-panel.tsx`, `MastersExplorer`), opening `SparePartWebSection` (`client-masters-page.tsx`). Everyone who can open Masters sees it.
    - **Help.** The staff article `spare-parts-web` (`help-content.ts`). `HELP_ARTICLES` feeds both the Help panel (`client-layout.tsx`) and Ask AI (`use-ask-help-ai.ts`, which sends the article text to the server).
    - **Server writes.** `genericUpdate` on table `spare_part_web` (right `MASTERS_MENU`). Photos go through four `/spare-part-web/...` routes in `routers/media/image_router.py`.
    - **Public website.** `service-plus-web`'s `/spare-parts` page uses `/api/public/companies`, `/branches`, `/company-info`, `/parts`, `/parts/{id}` and `/part-orders` (`website_router.py`). `/companies` lists every active BU of every active client (`public_directory.py`). The website's job-status and open-jobs forms use the same `/companies` list.
- **New tenant databases** get `security.bu` from `sql_bu_admin_ddl.py`. Existing databases get new columns from a one-off script, as `scripts/run_plan_limits_ddl.py` did for the monthly limits.
- **Data today** (live databases, 15 Oct 2026): only `demo1` in `service_plus_demo` has web parts (2 rows). `servicedemo`, `capitalelectronics`, `navtechnology`, `dummy` and `abc` have none.

## New design brief

- A `features` list on every `security.bu` row, plus one feature catalogue on the server and one in the client (Step 1, Step 6).
- `buBillingStatus` also returns the BU's features, and tenants cannot write the column (Step 2).
- The Super Admin reads and saves features per client and BU (Step 3, Step 7).
- The server refuses Spare Parts Web writes and hides its public pages for BUs without the feature (Step 4).
- The app hides the Spare Parts Web menu item, screen and help article for BUs without it (Step 8, Step 9).
- The public website's Spare Parts page lists only BUs that have it (Step 10).
- Help for staff and developers (Step 11).

## Key constraints

1. **The client must never be the only gate.** A hidden menu item does not stop a direct API call. Resolution: the server checks the feature on every Spare Parts Web write and public catalogue route (Step 4). The client only hides things (Steps 8–9).
2. **A tenant must not be able to switch a feature on for itself.** An Admin can run `genericUpdate` on `security.bu`. Resolution: `features` joins the protected columns that `require_generic_update_access` refuses (Step 2). Only the Super-Admin-only `setBuFeatures` mutation writes it (Step 3).
3. **The check must be cheap.** It runs on writes. Resolution: features are read with the billing row that is already cached for 60 seconds (Step 2). `setBuFeatures` clears that cache, so the change is seen at once by that server process and within a minute by any other.
4. **The app must pick up a change without logging in again.** Resolution: features ride on `buBillingStatus`, which the app already re-reads on BU change and window focus (Step 2, Step 6).
5. **Unknown names must not creep in.** A typo in a feature name would silently do nothing. Resolution: the server keeps the list of known features and refuses any other name in `setBuFeatures` (Steps 1, 3). The client list mirrors it, the same way access rights are mirrored.
6. **The website's job lookups must keep working.** `/companies` also feeds job status and open jobs. Resolution: `/companies` keeps every BU and adds a `parts_enabled` flag. Only the Spare Parts page filters on it (Steps 4, 10). The parts routes themselves refuse a BU without the feature.
7. **Help must not describe a missing feature.** Ask AI uses the same article list as the Help panel. Resolution: an article can name the feature it belongs to, and both the Help panel and Ask AI get the list already filtered for the current BU (Step 9).
8. **Existing data on the website disappears until switched on.** `demo1`'s 2 parts leave the public Spare Parts page after the upgrade. Resolution: accepted. Switch the feature on for `demo1` if they should stay (Your Part B).
9. **Super Admin in the app.** userType `S` bypasses access rights, but a feature belongs to the BU, not the user. Resolution: the client hides the feature by BU for every user. The server lets `S` through, as `require_bu_writable` already does.

## Steps

### Step 0 — Your Part

None now. Your parts come after the steps they wait for (A after Step 1, B after Step 7).

### Step 1 — The feature list and the `features` column (server) ✅

Needs: —

- **Explanation:** a server catalogue of known features, the new column for new tenant databases, and a one-off script that adds it to existing ones.
- **Path:** `service-plus-server/app/core/bu_features.py` (new)
- **Code:**

```python
"""Optional features the Super Admin switches on per BU (security.bu.features).
Mirror of service-plus-client/src/constants/bu-features.ts — add a feature to both."""

SPARE_PARTS_WEB = "spare_parts_web"

# name -> what the Super Admin sees in the Features dialog
BU_FEATURES: dict[str, str] = {
    SPARE_PARTS_WEB: "Spare Parts Web — public parts catalogue and order requests",
}
```

- **Path:** `service-plus-server/app/db/sql/sql_bu_admin_ddl.py` (the `CREATE TABLE security.bu` for new tenant databases)
- **Code:** add after `whatsapp_limit_monthly integer,`:

```sql
features text[] NOT NULL DEFAULT '{}',
```

- **Path:** `service-plus-server/scripts/run_bu_features_ddl.py` (new, modelled on `run_plan_limits_ddl.py`)
- **Explanation:** for every client database in `public.client`, plus `service_plus_service` when present, it runs `ALTER TABLE security.bu ADD COLUMN IF NOT EXISTS features text[] NOT NULL DEFAULT '{}'` in its own transaction. It then prints each BU with its features. It accepts `--dry-run` (do everything, then roll back) and `--db <name>`, and is safe to run again.
- **Path:** `service-plus-server/app/db/schema_dumps/service_plus_service.sql`: add the column to `security.bu`.

### 🧑 Your Part A — Add the column

Needs: Step 1

- Back up the tenant databases, then run `python scripts/run_bu_features_ddl.py` from `service-plus-server/`, and then `pnpm gen-types-security` in `service-plus-client/`.

### Step 2 — Features in the BU status, protected from tenants (server) ✅

Needs: Step 1, Your Part A

- **Explanation:** read `features` with the cached billing row, return it from `buBillingStatus`, and stop tenants writing it.
- **Path:** `service-plus-server/app/db/sql/sql_billing.py` (`GET_BU_BILLING_BY_CODE`)
- **Code:**

Old:
```sql
SELECT plan_code, billing_required, paid_through, billing_hold, branch_limit
```
New:
```sql
SELECT plan_code, billing_required, paid_through, billing_hold, branch_limit, features
```

- **Path:** `service-plus-server/app/services/bu_billing.py` (`billing_summary`)
- **Code:** add `"features": list(row.get("features") or []),` to the returned dict. `buBillingStatus` already spreads `get_bu_billing`, so it returns `features` with no change of its own.
- **Path:** `service-plus-server/app/graphql/resolvers/auth_guards.py`
- **Code:** add `"features"` to `BU_BILLING_COLUMNS`, and change its comment to "billing and Super-Admin-only columns".

### Step 3 — Read and save features as Super Admin (server) ✅

Needs: Step 2

- **Explanation:** one query listing a client's BUs with their features, and one mutation saving them all in one transaction.
- **Path:** `service-plus-server/app/db/sql/sql_billing.py` (`BillingSql`, part of `SqlStore`, beside `GET_BU_SUBSCRIPTIONS`). As built, it reads `features` through `to_jsonb` like the reads in Step 2.
- **Code:**

```python
GET_BU_FEATURES = """
    with "dummy" as (values(1::int))
    SELECT id, code, name, is_active, features
    FROM security.bu
    ORDER BY name
"""
```

- **Path:** `service-plus-server/app/db/sql/sql_billing.py` (`BillingServerSql`, server-only)
- **Code:**

```python
SET_BU_FEATURES = """
    UPDATE security.bu SET features = %(features)s::text[], updated_at = now()
    WHERE id = %(id)s::bigint
"""
```

- **Path:** `service-plus-server/app/graphql/resolvers/bu_admin/bu_features.py` (new): `resolve_set_bu_features_helper(db_name, value)`.
    - The value is `{ bus: [{ id, features: [...] }] }`.
    - It refuses any name not in `BU_FEATURES`, with a `ValidationException` that names the bad feature.
    - It sorts each list and removes duplicates, then updates every BU in one transaction.
    - It calls `clear_bu_billing(db_name)` and writes one audit-log entry with the action `SET_BU_FEATURES` and, per BU, its code and new list.
    - It returns `{ bus: [{ id, features }] }`.
- **Path:** `service-plus-server/app/graphql/schema.graphql` and `resolvers/mutation.py`
- **Code:**

```graphql
setBuFeatures(db_name: String!, schema: String, value: String!): Generic
```
```python
@mutation.field("setBuFeatures")
@handle_graphql_errors("Error in setBuFeatures")
async def resolve_set_bu_features(_, info, db_name="", schema="", value="") -> Any:
    """Switch optional features on or off per BU of one client. Super Admin only."""
    # pylint: disable=unused-argument
    require_user_type(info, {"S"})
    return await resolve_set_bu_features_helper(db_name, value)
```

- Add `SET_BU_FEATURES` to the `AuditAction` list.

### Step 4 — The server enforces Spare Parts Web ✅

Needs: Step 2

- **Explanation:** one guard, used by the generic update, the photo routes and the public catalogue.
- **Path:** `service-plus-server/app/graphql/resolvers/auth_guards.py`
- **Code:**

```python
# Tables that belong to an optional BU feature: writing them needs the feature on.
FEATURE_TABLES: dict[str, str] = {"spare_part_web": SPARE_PARTS_WEB}


async def require_bu_feature(info_or_claims, db_name: str | None, schema: str | None, feature: str) -> None:
    """Raise FEATURE_NOT_ENABLED unless `feature` is on for the BU. Super Admin passes."""
    # S passes; otherwise get_bu_billing(db_name, schema)["features"] must contain `feature`
```

- **Path:** `service-plus-server/app/graphql/resolvers/mutation.py` (`genericUpdate`, after `require_generic_update_access`)
- **Code:** for every node whose `tableName` is in `FEATURE_TABLES`, `await require_bu_feature(info, db_name, schema, FEATURE_TABLES[table])`.
- **Path:** `service-plus-server/app/routers/media/image_router.py`: the four `/spare-part-web/...` routes call the same check right after `_require_media_scope`.
- **Path:** `service-plus-server/app/core/exceptions.py` and messages: a new `FEATURE_NOT_ENABLED` code and the message "This feature is not enabled for this business unit."
- **Path:** `service-plus-server/app/services/public_directory.py` and `app/db/sql/sql_public.py`
    - `LIST_ACTIVE_BUS` also selects `features`, and each directory entry keeps `parts_enabled = SPARE_PARTS_WEB in features`.
    - `CompanyOut` gains `parts_enabled: bool`.
    - `parts_count` is reported as 0 when the feature is off.
- **Path:** `service-plus-server/app/routers/public/website_router.py`: `/branches`, `/parts`, `/parts/{id}` and `/part-orders` answer 404 "company not found" when the resolved company has `parts_enabled` false. `/companies`, `/company-info`, `/job-status` and `/open-jobs` are unchanged.

### Step 5 — Server tests ✅

Needs: Steps 3, 4

- **Path:** `service-plus-server/tests/core/test_bu_features.py` (new):
    - `setBuFeatures` refuses an unknown name and refuses a non-`S` caller.
    - It stores a sorted list with no duplicates.
- **Path:** `service-plus-server/tests/test_view_only_guard.py` (or a sibling):
    - `genericUpdate` on `spare_part_web` is refused without the feature and allowed with it.
    - A tenant `genericUpdate` that sets `bu.features` is refused.

### Step 6 — Client: types, feature list and BU status ✅

Needs: Step 2

- **Explanation:** regenerate the security types, mirror the feature list, and carry `features` in the BU status.
- Run `pnpm gen-types-security`, which adds `features` to `Bu` in `src/types/db-schema-security.ts`.
- **Path:** `src/constants/bu-features.ts` (new)
- **Code:**

```ts
// Optional features the Super Admin switches on per BU (security.bu.features).
// Mirror of service-plus-server/app/core/bu_features.py — add a feature to both.
export const BU_FEATURES = {
	SPARE_PARTS_WEB: "spare_parts_web",
} as const;

export type BuFeatureType = (typeof BU_FEATURES)[keyof typeof BU_FEATURES];

// Shown in the Super Admin's Features dialog, in this order.
export const BU_FEATURE_LIST: { description: string; key: BuFeatureType; label: string }[] = [
	{ description: "Public parts catalogue and order requests", key: BU_FEATURES.SPARE_PARTS_WEB, label: "Spare Parts Web" },
];
```

- **Path:** `src/store/context-slice.ts`
- **Code:** add `features?: string[];` to `BuBillingType` (with the comment "Optional features switched on by the Super Admin. Only from buBillingStatus."), and a selector:

```ts
export const selectHasBuFeature = (state: ContextRootState, feature: BuFeatureType) =>
	state.context.billing?.features?.includes(feature) ?? false;
```

- **Path:** `src/constants/graphql-map.ts`: add `setBuFeatures` with the standard `($db_name, $schema, $value)` signature. `buBillingStatus` returns a `Generic` JSON value, so `features` arrives with no change to its document. `src/constants/sql-map.ts`: add `GET_BU_FEATURES`.

### Step 7 — Super Admin: Features dialog (client) ✅

Needs: Steps 3, 6

- **Explanation:** a new **Features** item in each client's row menu on the Clients page, next to **Subscription**. It opens a dialog listing that client's BUs as rows and the features as columns, with a tick box in each cell.
    - The column header has an "All BUs" tick for "this client gets it".
    - Inactive BUs are shown greyed but can still be ticked.
    - **Save** sends every BU in one `setBuFeatures` call and is disabled until something changes.
    - A sonner toast confirms the save. The server's message shows on a refusal.
    - The layout is responsive: on a phone each BU becomes a card with one tick per feature.
- **Path:** `src/features/super-admin/components/client-features-dialog.tsx` (new). It reads `GET_BU_FEATURES` with `genericQuery` on `client.db_name`, as `client-subscription-dialog.tsx` reads `GET_BU_SUBSCRIPTIONS`.
- **Path:** `src/features/super-admin/pages/clients-page.tsx`: `featuresClient` state, the menu item, and the dialog.
- **Path:** `src/constants/messages.ts`: `SUCCESS_BU_FEATURES_SAVED`, `ERROR_BU_FEATURES_LOAD_FAILED`, `ERROR_BU_FEATURES_SAVE_FAILED`, `BU_FEATURES_DIALOG_INTRO` ("Switch optional features on for this client's business units. A feature that is off is hidden from that business unit's users.").

### 🧑 Your Part B — Choose who gets Spare Parts Web

Needs: Step 7

- In Super Admin → Clients → a client's menu → Features, tick Spare Parts Web for each BU that should have it (for example `demo1`, if its 2 parts should stay on the website).

### Step 8 — Hide Spare Parts Web in the app ✅

Needs: Step 6

- **Path:** `src/features/client/components/layout/client-explorer-panel.tsx` (`MastersExplorer`)
- **Code:**

Old:
```tsx
<TreeItem icon={Globe} iconColor="text-cyan-600" label="Spare Parts Web" />
```
New:
```tsx
{hasSparePartsWeb && <TreeItem icon={Globe} iconColor="text-cyan-600" label="Spare Parts Web" />}
```
with `const hasSparePartsWeb = useAppSelector((s) => selectHasBuFeature(s, BU_FEATURES.SPARE_PARTS_WEB));`

- **Path:** `src/features/client/pages/client-masters-page.tsx` (`MastersContent`)
- **Code:**

Old:
```tsx
if (selected === "Spare Parts Web") return <SparePartWebSection />;
```
New:
```tsx
if (selected === "Spare Parts Web" && hasSparePartsWeb) return <SparePartWebSection />;
```
With the feature off, the selection falls through to the existing "Coming soon" panel.

### Step 9 — Help articles follow the BU's features ✅

Needs: Step 6

- **Explanation:** an article can say which feature it belongs to. The Help panel and Ask AI both get the list filtered for the current BU, so neither shows nor quotes a feature the BU does not have.
- **Path:** `src/components/shared/help/help-types.ts`
- **Code:** add to `HelpArticle`:

```ts
/** Optional BU feature (constants/bu-features.ts) this article belongs to; hidden when the BU lacks it. */
feature?: string;
```

- **Path:** `src/features/client/components/help/help-content.ts`
    - Add `feature: BU_FEATURES.SPARE_PARTS_WEB` to the `spare-parts-web` article.
    - Add a helper below the list:

```ts
export function visibleHelpArticles(features: string[] | undefined): HelpArticle[] {
	return HELP_ARTICLES.filter((article) => !article.feature || (features ?? []).includes(article.feature));
}
```

- **Path:** `src/features/client/components/layout/client-layout.tsx` (the `HelpPanel` `articles` prop) and `src/features/client/components/help/use-ask-help-ai.ts`. Both pass `visibleHelpArticles(billing?.features)`, memoised on the features list, in place of `HELP_ARTICLES`.

### Step 10 — Public website: Spare Parts lists only enabled BUs ✅

Needs: Step 4

- **Path:** `service-plus-web/lib/api.ts`: `CompanyApiResponse` and `Company` gain `parts_enabled` / `partsEnabled`.
- **Path:** `service-plus-web/components/shared/company-select.tsx`: a new prop `onlyPartsEnabled`, which filters the list. `app/spare-parts/page.tsx` passes it. The job-status and open-jobs forms do not, so they keep every company.
- When the filtered list is empty, the Spare Parts page shows "No parts catalogues are available right now."

### Step 11 — Help ✅

Needs: Steps 1–10

- **Staff help** (`help-content.ts`): one line at the top of the `spare-parts-web` article: "Spare Parts Web is an optional feature. It appears only when Service+ has switched it on for your business unit — contact us to have it enabled." Nothing else changes, because the article itself is hidden where the feature is off.
- **Developer help** (`dev-help-content.ts`): one new article, "BU features (Super Admin)". It covers:
    - the column and the two catalogues that must match;
    - `setBuFeatures` (S only, audit `SET_BU_FEATURES`) and `GET_BU_FEATURES`;
    - why `features` is in `BU_BILLING_COLUMNS`;
    - the 60-second cache and `clear_bu_billing`;
    - `require_bu_feature`, `FEATURE_TABLES` and the public `parts_enabled` flag;
    - the help `feature` field and `visibleHelpArticles`;
    - a checklist for adding the next feature: the server list, the client list, the menu item, the screen guard, the help article, and `FEATURE_TABLES` or route checks.
- **Re-check stale developer articles:**
    - `dev-spare-parts-web` gets a "Gated by the spare_parts_web BU feature" paragraph.
    - The billing article's `BU_BILLING_COLUMNS` list and the `buBillingStatus` field list gain `features`.
    - The public-website article's `/companies` row gains `parts_enabled`.

### As built — differences from the steps above

- **Reads work before Your Part A.** Every read of the new column goes through `to_jsonb(b) -> 'features'`: `GET_BU_BILLING_BY_CODE`, `GET_USER_BUS`, `GET_BU_FEATURES` and `LIST_ACTIVE_BUS`. A database without the column then reads as "no features" and doesn't fail. Without this, deploying the server before the script would have broken every login and every write. Only saving in the Features dialog needs the column.
- **The website follows straight away.** `setBuFeatures` also rebuilds the server's public company directory (`public_directory.invalidate()`), so the website follows at once on that server process. Other processes catch up within the directory's 5-minute cache.
- **The dialog doesn't wait for regenerated types.** It types its rows as `Pick<Bu, …> & { features: string[] }`, so it works before `gen-types-security` adds `features` to `Bu`.
- **One hook feeds all help.** The Help panel and Ask AI share `useVisibleHelpArticles()` (`features/client/components/help/use-visible-help-articles.ts`). It re-filters only when the BU's features change.
- **The website hides more than the plan said** (follow-up, 15 Oct 2026):
    - Every spare-parts entry point is hidden while no company has the feature: the "Buy genuine parts" menu item (header and footer), the hero button, the hero text and the "Genuine parts" bullet.
    - A direct visit to `/spare-parts` shows "Spare parts aren't available yet".
    - A company counts only when `parts_enabled` is exactly `true`. A server without this feature therefore shows no spare parts at all.
    - The code: `service-plus-web/lib/companies.ts` (`loadCompanies`, `usePartsAvailable`) and `nav-items.ts` (`needsParts`, `useNavItems`).
    - Checked against the local server with Capital Electronics enabled, and against production, which has the old code and so shows none.
- **The Features dialog was redesigned** (follow-up): large teal tick boxes on On/Off tiles, an "On for N of M" count, and an unsaved-change counter.
- **Checked so far:**
    - Server: 384 tests pass, including 17 new ones in `tests/core/test_bu_features.py`.
    - Client: `tsc -b` and `pnpm build` pass.
    - Website: `tsc` and `pnpm build` pass.
    - The new reads were run on the live `service_plus_demo` database, where the column doesn't exist yet.
    - The running server rejects `setBuFeatures` from a caller who isn't `S`.
    - The browser checks in Step 12 still need Your Part A.

### Step 12 — Verify

Needs: Steps 1–11, Your Part A

- Server: `pytest` for the new and changed tests. Client: `pnpm exec tsc -b --noEmit`, `pnpm format` on touched files. Website: `pnpm build`.
- **With the feature off for a BU:**
    - As a normal user and as an Admin, Masters → Product & Parts has no Spare Parts Web.
    - A Help search finds no article, and Ask AI does not describe it.
    - A `genericUpdate` on `spare_part_web` sent by hand is refused with `FEATURE_NOT_ENABLED`.
    - The website's Spare Parts page does not list the BU, but its job-status form still does.
- **Switch it on in the Features dialog:**
    - The menu item, screen and article appear after switching the BU or refocusing the window, with no new login.
    - Saving works, and the website lists the BU.
- As a tenant Admin, a `genericUpdate` setting `bu.features` is refused.
- Run `graphify update .` if a graph exists.

## Later, if wanted

- **Default features per plan.** Stamp a starting feature list when a plan is set, alongside the monthly limits.
- **Client-wide default.** New BUs of a client inherit that client's features automatically.
- **Show features to the tenant.** List the BU's features (read-only) on the tenant's own subscription page.
