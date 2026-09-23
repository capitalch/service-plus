# Service+ UI Improvement Audit

## Summary

This code-based review covers the routed authentication, client operations, client admin, super-admin, and shared UI surfaces. It focuses on usability, accessibility, responsive behavior, and visual consistency. The recommendations are ranked by their likely effect on daily work and ability to block users.

The review is based on source inspection, not rendered screenshots, user interviews, or assistive-technology testing. Treat contrast and layout observations as items to confirm in a browser before implementation.

## Prioritized Recommendations

### 1. High — Restore mobile navigation in Admin Panel

**Observation:** The Admin Panel sidebar is hidden below the `lg` breakpoint. Its mobile header has a Client Mode action but no menu or links to Dashboard, Business Users, Business Units, Roles, or Audit Logs. Admin users on smaller screens can be stranded on the page they entered.

**Suggestion:** Add a compact mobile navigation drawer or menu that exposes the same destinations as the desktop sidebar, shows the current destination, and closes after navigation. Keep the Client Mode action separate and easy to distinguish.

**Success check:** At 320–767px wide, an admin can reach every admin destination from the visible UI without typing a URL; the menu is keyboard-operable and identifies the active page.

**Evidence:** `src/features/admin/components/admin-layout.tsx` (sidebar breakpoint and mobile header).

### 2. High — Make custom navigation and table interactions accessible

**Observation:** Client explorer items are clickable `div` elements; sortable table headers in the shared report table and multiple master lists attach click handlers directly to table headers. These interactions do not provide standard keyboard behavior or announce their state. Several icon-only actions rely on a `title` attribute, and the login password visibility control is removed from the tab order.

**Suggestion:** Use semantic links or buttons for navigation and sorting, expose expanded/current/sort state to assistive technology, give icon-only actions accessible names, and retain visible keyboard focus. Apply the shared behavior to report, inventory, and master tables rather than fixing only one screen.

**Success check:** Keyboard-only users can navigate menus, expand groups, sort data, and activate icon controls. Screen readers receive useful names and current/sort state. Verify with keyboard testing and a screen reader on representative client and auth flows.

**Evidence:** `src/features/client/components/layout/client-explorer-panel.tsx`, `src/features/client/components/reports/common/report-table.tsx`, and `src/features/auth/components/login-form.tsx`.

### 3. High — Establish a consistent visual system across workspaces

**Observation:** The global shadcn tokens are neutral, while the client workspace defines a separate light/dark token system and client admin, super-admin, and authentication surfaces use additional teal, emerald, navy, and indigo treatments. Shared controls and actions therefore vary in accent color, spacing, and hierarchy between modes.

**Suggestion:** Define shared semantic tokens for primary actions, surfaces, borders, status colors, typography, spacing, and focus states. Keep intentional workspace identity and the client light/dark themes, but make buttons, fields, dialogs, page headers, and status treatments follow the same rules. Review contrast in both client themes and on admin/auth screens.

**Success check:** Common controls have consistent sizing and hierarchy across all workspaces; status meaning does not depend on color alone; text and focus indicators meet WCAG 2.2 AA contrast expectations.

**Evidence:** `src/index.css` contains the global and client token layers; workspace components apply additional local palettes.

### 4. Medium — Improve readability and touch usability in dense screens

**Observation:** Dense operational screens frequently use 9–12px labels, captions, and metadata, including the client header, status details, job quick information, and table headings. Some icon controls use small visual bounds even when their clickable area is not apparent.

**Suggestion:** Reserve very small text for decorative or secondary metadata. Set readable minimums for task-critical labels, table content, and control text; enlarge pointer targets for frequently used actions; and check zoom/reflow behavior before reducing information density.

**Success check:** Important fields and actions remain comfortably readable at browser zoom 100–200%, and common controls have clear, usable hit areas without clipping or obscuring adjacent data.

### 5. Medium — Give long operational forms a clearer responsive structure

**Observation:** Job intake places many fields in one responsive grid. Purchase and sales invoice entry use line-item tables with minimum widths of 860px and 920px inside horizontal scrolling containers. This preserves columns but makes editing on a phone dependent on horizontal scrolling.

**Suggestion:** Group job intake into meaningful steps or sections (customer/device, intake details, and notes), make conditional fields easier to scan, and keep the primary save action and validation summary easy to find. For narrow invoice layouts, provide a focused row/card editing pattern or another clear way to edit line items without losing row context; keep totals and essential actions visible.

**Success check:** At 320–767px wide, users can complete job intake and add/edit invoice lines without page-level horizontal overflow, losing their place, or missing validation feedback. Desktop table entry remains efficient.

**Evidence:** `src/features/client/components/jobs/single-job/new-single-job-form.tsx`, `src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx`, and `src/features/client/components/inventory/sales-entry/new-sales-invoice.tsx`.

### 6. Medium — Standardize data-list behavior across the app

**Observation:** Customer, branch, technician, parts, and report screens repeat local search, sorting, loading, empty-state, and action patterns. Some lists use cards while others use tables; the available row actions and result counts are not presented consistently.

**Suggestion:** Define a shared data-list pattern with a clear title/action area, labeled search and filters, result count, keyboard-accessible sorting, consistent row actions, and reusable loading/empty/error states. Choose a mobile table-to-card or prioritized-column behavior per data type, and preserve horizontal scrolling only where the full table is necessary.

**Success check:** Users can find, sort, and act on records using the same interaction model across master, inventory, and report lists; narrow layouts expose key fields and actions without hiding essential information.

### 7. Later — Clarify unavailable destinations

**Observation:** Several menu destinations render generic “Coming soon” placeholders in jobs, inventory, masters, configurations, custom add-ons, and reports. The placeholder text does not distinguish planned functionality from access restrictions or explain what users can do instead.

**Suggestion:** Mark unavailable destinations clearly in the menu and use a consistent placeholder that says the feature is not available yet. Where a menu item is not intended for current users, keep it out of the active navigation rather than presenting an apparently usable destination.

**Success check:** Users can distinguish available, restricted, and not-yet-available destinations before opening them; placeholder screens use consistent language and offer a sensible return path.

## Suggested Order

1. Fix mobile Admin Panel navigation and the keyboard/accessibility gaps in shared navigation and table controls.
2. Define the shared visual and readability rules, then apply them to common controls and page chrome.
3. Improve the job and invoice entry layouts for narrow screens and high-frequency use.
4. Consolidate data-list patterns and clarify unavailable destinations.

## Validation for Future UI Work

- Review login/reset-password, client jobs, inventory, masters, reports, Admin Panel, and Super Admin at 320px, 375px, 768px, 1024px, and a wide desktop viewport.
- Complete representative tasks with keyboard only: open and use navigation, search/filter a list, sort a table, edit a record, and submit a form with validation errors.
- Check focus visibility, accessible names, expanded/current/sort announcements, color contrast, text resizing, and non-color status cues.
- Compare loading, empty, error, and success states across a master list, report, and transactional form.

No application implementation or test execution is included in this audit.
