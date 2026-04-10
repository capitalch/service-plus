# Plan: Fix Side Menu Functionality on Mobile Devices

## Problem Analysis

The current mobile navigation has two overlapping/broken concerns:

1. **Broken flow**: The hamburger `<Menu>` button in `client-top-nav.tsx` opens a `Sheet` (Radix Dialog-based drawer) that shows only the top-level section links (Jobs, Dashboard, Inventory, etc.). Clicking a section navigates and closes the Sheet — but it **does NOT open the Explorer Panel**. So the user lands on a section with no way to pick a sub-item (e.g., "Purchase Entry" inside Inventory).

2. **Dead explorer toggle on mobile**: The `PanelLeft` toggle button is `hidden md:block` — invisible on mobile. There is no button on mobile to open the `ClientExplorerPanel` (which contains the full sub-item tree). The hamburger button currently bypasses the explorer entirely.

3. **Duplicate mobile nav**: `ClientExplorerPanel` already contains a 3-column mobile section-nav grid (`MOBILE_NAV_ITEMS`) shown via `md:hidden`. This is a second, redundant way to switch sections — but it is never reachable because the explorer panel can't be opened on mobile.

4. **Missing close on section switch inside explorer**: The mobile section nav links inside `ClientExplorerPanel` do not call `toggleExplorer` on click, so the panel stays open after the user switches sections.

5. **Unused Sheet component**: `src/components/ui/sheet.tsx` is a newly added untracked file used only in `client-top-nav.tsx`. Once the Sheet is removed from top-nav, this file becomes unused and should be deleted.

## Solution

Replace the Sheet-based hamburger menu with a direct call to `toggleExplorer`. The `ClientExplorerPanel` already contains a mobile section-nav grid, making it a complete mobile menu. The hamburger button on mobile should simply open/close that explorer panel.

## Workflow

```
User taps hamburger (mobile)
    → toggleExplorer() opens ClientExplorerPanel
    → Top of panel shows 3x2 section grid (already exists, md:hidden)
    → Below that shows sub-item tree for active section
    → Tapping a section grid item → navigate + close explorer
    → Tapping a sub-item (TreeItem) → select + close explorer (already works via onSelect)
    → Tapping backdrop (black/50 overlay) → close explorer (already works)
```

## Execution Steps

### Step 1: Modify `client-top-nav.tsx`
- Remove `isMobileMenuOpen` state.
- Remove the `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle` imports and their JSX.
- Change the hamburger `<Menu>` button `onClick` to call `toggleExplorer()` (already available via `useLayout()`).
- Keep the button `md:hidden` as before.
- Remove now-unused `Button` import if not used elsewhere in the file.

### Step 2: Modify `client-explorer-panel.tsx`
- In the mobile section nav grid (the `md:hidden` div with `MOBILE_NAV_ITEMS`), add `onClick={toggleExplorer}` to each `NavLink` so the panel closes after the user taps a section.
- This ensures tap-section → navigate → panel closes, giving a clean UX.

### Step 3: Delete `src/components/ui/sheet.tsx`
- The file was newly added (untracked) and will have no remaining imports after Step 1.
- Delete it to avoid dead code.

### Step 4: Verify `client-layout.tsx` (no change needed)
- Confirm the black backdrop `fixed inset-0 z-20 bg-black/50 lg:hidden` already calls `toggleExplorer` on click — it does (line 185). No change needed.
- Confirm `onSelect` already calls `setExplorerOpen(false)` on mobile when a sub-item is picked — it does (line 159). No change needed.
- Confirm initial state: `explorerOpen` starts as `false` when `window.innerWidth < 1024` — correct (line 97). No change needed.

## Files to Change

| File | Action |
|------|--------|
| `src/features/client/components/client-top-nav.tsx` | Remove Sheet, wire hamburger to `toggleExplorer` |
| `src/features/client/components/client-explorer-panel.tsx` | Add `onClick={toggleExplorer}` to MOBILE_NAV_ITEMS links |
| `src/components/ui/sheet.tsx` | Delete (unused after change) |
