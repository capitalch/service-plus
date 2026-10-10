# Plan — Move Masters > Organization under Configurations

## Goal
- Branch, Financial Year and State / Province move from **Masters > Organization** to **Configurations > Organization**, next to Divisions.
- Masters keeps day-to-day data only, so it opens on **Customer** instead of Branch.
- Who can open these screens does not change. Each item is still guarded by the `MASTERS_ORGANIZATION` right, and the right is **not renamed**. Renaming it would touch 4 places, which is not worth doing.

## Present context
- Sidebar: `MastersExplorer` in `features/client/components/layout/client-explorer-panel.tsx` has an `Organization` group with 3 items, each disabled without `MASTERS_ORGANIZATION`. `ConfigurationsExplorer` is a flat list of Divisions, App Settings and Numbering / Auto Series.
- Pages: `client-masters-page.tsx` renders `BranchSection`, `FinancialYearSection` and `StateSection`. `client-configurations-page.tsx` switches on Divisions, App Settings and Numbering.
- Defaults (`client-layout.tsx`): Masters opens on `Branch` / `Organization`. Receptionists lack the right, so a rule (`MASTERS_FALLBACK`, `masters-access.ts`) moves them to Customer.
- Code lives in `components/masters/{branch,financial-year,state-province}`. `BranchType` (`masters/branch/branch.ts`) is also imported by 3 purchase-entry files.
- Built-in roles: Manager has both `CONFIG_MENU` and `MASTERS_ORGANIZATION`. Receptionist has neither. So for them nothing changes.
- Server: `GENERIC_UPDATE_TABLE_RIGHTS` (`service-plus-server/app/graphql/resolvers/inventory/mutations.py`) guards writes to `branch`, `state` and `financial_year` with `MASTERS_MENU` only. A Receptionist can therefore write these tables through the API, even though the UI blocks them. This gap exists today and is not caused by the move.

## New design brief
- 3 folders move to `components/configurations/` → Step 1
- Configurations sidebar gets `Organization` and `System` groups, and the Masters group is removed → Step 2
- The pages swap the 3 cases, with the access guard carried over → Step 3
- Masters opens on Customer → Step 4
- Help files are updated → Step 5

## Key constraints
1. A custom role with `MASTERS_ORGANIZATION` but no `CONFIG_MENU` loses these screens, because the whole Configurations tab is hidden from it. **Resolution:** accept this. No built-in role is in that state, and the help text tells admins to grant `CONFIG_MENU`.
2. Divisions has no `MASTERS_ORGANIZATION` guard today. **Resolution:** leave it ungated, so only the 3 moved items carry the per-item check.
3. Configurations opens on Divisions, which is ungated. So no fallback rule like Masters' is needed. **Resolution:** a deep link to a restricted item renders nothing, the same way Masters behaves today.

## Steps

### Step 0 — Your Part 🟢 completed
- **A** 🟢 (any time, independent): in `service-plus-server/app/graphql/resolvers/inventory/mutations.py`, change `"branch"`, `"state"` and `"financial_year"` from `"MASTERS_MENU"` to `"MASTERS_ORGANIZATION"`. This closes the API gap above, and `resolve_add_branch` picks it up automatically.

### Step 1 — Move the folders 🟢 completed
- `git mv` `src/features/client/components/masters/{branch,financial-year,state-province}` → `src/features/client/components/configurations/`.
- Fix imports of `.../masters/branch/branch` in `inventory/purchase-entry/purchase-entry-section.tsx`, `purchase-invoice-pdf-gen.ts` and `purchase-invoice-pdf-preview-dialog.tsx`.

### Step 2 — Sidebar (`layout/client-explorer-panel.tsx`) 🟢 completed
- Needs: Step 1
- `MastersExplorer`: delete the `Organization` `CollapsibleGroup` and `canOrganization` / `orgTitle`.
- `ConfigurationsExplorer`: read `currentUser`, then render:
  - `CollapsibleGroup label="Organization"`: Branch, Divisions, Financial Year, State / Province (alphabetical). The 3 moved items keep their icons and `disabled` / `title` from the old block.
  - `CollapsibleGroup label="System"`: App Settings, Numbering / Auto Series.

### Step 3 — Pages 🟢 completed
- Needs: Step 1
- `pages/client-masters-page.tsx`: remove the 3 imports and the `Branch`, `Financial Year` and `State / Province` lines.
- `pages/client-configurations-page.tsx`: add `case "Branch"`, `"Financial Year"` and `"State / Province"`. Before the switch, add: `if (ORGANIZATION_ITEMS.includes(s) && !hasAccessRight(currentUser, ACCESS_RIGHTS.MASTERS_ORGANIZATION)) return null;`
- `layout/masters-access.ts`: remove the `Branch`, `Financial Year` and `State / Province` entries from `MASTERS_ITEM_RIGHTS`.

### Step 4 — Defaults (`layout/client-layout.tsx`) 🟢 completed
- Needs: Step 3
- `SECTION_DEFAULTS.masters` `"Branch"` → `"Customer"`. `SECTION_DEFAULT_GROUPS.masters` `"Organization"` → `"Entities"`.
- Keep the `MASTERS_FALLBACK` effect, which is still needed for deep links to Service Config. Reword its comment: it no longer mentions Branch.

### Step 5 — Help and verify 🟢 completed
- Needs: Steps 1–4
- `help-content.ts`: replace "Masters → Branch / Branches / Financial Year" with "Configurations → …" (lines ~103, 2919, 2929, 2964, 3038, 3053, 4110, 4116). Update the rights table row (~4188) and the Masters-vs-Configurations FAQ (~4232).
- `dev-help-content.ts`: update the `MASTERS_ORGANIZATION` rows (~1991, 2005) and the `masters/branch/branch-section.tsx` path (~182). Add one short article covering the move, the kept right name and constraint 1.
- Run `pnpm exec tsc -b --noEmit` and `pnpm format`, then `graphify update .`.
