# Plan: VS Code-Style UI Redesign

## Objective
Redesign the application layout to mimic VS Code's space-efficient UI with an Activity Bar, collapsible Sidebar, Top Menu Bar, and Status Bar.

---

## VS Code UI Structure Reference

```
┌─────────────────────────────────────────────────────────────┐
│  Top Menu Bar (File, Edit, View, Help)          [- □ X]    │  <- 30px height
├────┬────────────────┬───────────────────────────────────────┤
│    │                │                                       │
│ A  │    Sidebar     │         Main Content Area             │
│ c  │   (expandable) │                                       │
│ t  │                │                                       │
│ i  │  - Menu items  │                                       │
│ v  │  - Submenus    │                                       │
│ i  │                │                                       │
│ t  │                │                                       │
│ y  │                │                                       │
│    │                │                                       │
│ B  │                │                                       │
│ a  │                │                                       │
│ r  │                │                                       │
│    │                │                                       │
├────┴────────────────┴───────────────────────────────────────┤
│  Status Bar (user info, notifications, status)              │  <- 24px height
└─────────────────────────────────────────────────────────────┘
   48px    200px                    flex-1
```

---

## Step 1: Create Activity Bar Component
**File:** `src/components/layout/ActivityBar.tsx`

### Design Specs
- Width: 48px fixed
- Background: `bg-zinc-900` (dark theme) or `bg-slate-100` (light)
- Position: Fixed left, full height
- Icons only, no text

### Features
- Vertical icon buttons for main navigation categories
- Active indicator (left border accent or background highlight)
- Tooltip on hover showing label
- Bottom section for settings/user icon
- Icons: Dashboard, Tickets, Components, Forms, Portal

### Structure
```tsx
<aside className="fixed left-0 top-[30px] bottom-[24px] w-12 bg-zinc-900 flex flex-col">
  <nav className="flex-1 flex flex-col items-center py-2 gap-1">
    {/* Activity icons */}
  </nav>
  <div className="flex flex-col items-center py-2 gap-1 border-t border-zinc-700">
    {/* Settings, User icons */}
  </div>
</aside>
```

---

## Step 2: Redesign Sidebar Component
**File:** `src/components/layout/Sidebar.tsx`

### Design Specs
- Width: 200px (expanded) / 0px (collapsed)
- Position: Fixed, left of Activity Bar (left: 48px)
- Background: `bg-zinc-800` (dark) or `bg-slate-50` (light)
- Collapsible via Activity Bar click

### Features
- Header showing current section name (e.g., "EXPLORER", "TICKETS")
- Compact menu items (height: 28-32px)
- Tree-style navigation for nested items
- Smaller font size (text-sm, 13px)
- No icons in menu items (icons are in Activity Bar)
- Subtle hover states

### Structure
```tsx
<aside className="fixed left-12 top-[30px] bottom-[24px] w-[200px] bg-zinc-800 border-r border-zinc-700">
  <div className="h-8 px-4 flex items-center text-xs font-semibold text-zinc-400 uppercase">
    Section Name
  </div>
  <ScrollArea>
    {/* Menu items */}
  </ScrollArea>
</aside>
```

---

## Step 3: Create Top Menu Bar Component
**File:** `src/components/layout/MenuBar.tsx`

### Design Specs
- Height: 30px fixed
- Position: Fixed top, full width
- Background: `bg-zinc-900` (dark) or `bg-slate-100` (light)
- Font size: 13px

### Menu Items
- **File**: New, Open Recent, Save, Export, Exit
- **Edit**: Undo, Redo, Cut, Copy, Paste, Find
- **View**: Toggle Sidebar, Toggle Activity Bar, Zoom In/Out
- **Help**: Documentation, Keyboard Shortcuts, About

### Features
- Dropdown menus using shadcn DropdownMenu
- Keyboard shortcut hints (Ctrl+S, Ctrl+Z, etc.)
- Subtle hover state
- App title/logo on the left
- Window controls placeholder on the right (minimize, maximize, close)

### Structure
```tsx
<header className="fixed top-0 left-0 right-0 h-[30px] bg-zinc-900 flex items-center px-2 z-50">
  <div className="flex items-center gap-1">
    <Logo />
    <MenuDropdown label="File" items={fileMenuItems} />
    <MenuDropdown label="Edit" items={editMenuItems} />
    <MenuDropdown label="View" items={viewMenuItems} />
    <MenuDropdown label="Help" items={helpMenuItems} />
  </div>
  <div className="flex-1 text-center text-xs text-zinc-400">
    Service Plus
  </div>
  <div className="flex items-center gap-1">
    {/* Window controls or search */}
  </div>
</header>
```

---

## Step 4: Create Status Bar Component
**File:** `src/components/layout/StatusBar.tsx`

### Design Specs
- Height: 24px fixed
- Position: Fixed bottom, full width
- Background: `bg-blue-600` (VS Code style) or `bg-zinc-800`
- Font size: 12px

### Content (Left to Right)
- **Left**: Current branch/status, sync status
- **Center**: Breadcrumb or current page
- **Right**: User name, notification count, bell icon

### Structure
```tsx
<footer className="fixed bottom-0 left-0 right-0 h-6 bg-blue-600 flex items-center px-2 text-white text-xs z-50">
  <div className="flex items-center gap-3">
    {/* Left items */}
  </div>
  <div className="flex-1" />
  <div className="flex items-center gap-3">
    {/* Right items */}
  </div>
</footer>
```

---

## Step 5: Update MainLayout Component
**File:** `src/components/layout/MainLayout.tsx`

### Changes
- Remove current TopNav
- Add MenuBar at top (30px)
- Add StatusBar at bottom (24px)
- Add ActivityBar on left (48px)
- Adjust Sidebar position (left: 48px)
- Main content padding: top: 30px, bottom: 24px, left: 48px + sidebar width

### Structure
```tsx
<div className="min-h-screen bg-zinc-950">
  <MenuBar />
  <ActivityBar />
  <Sidebar />
  <main className="pt-[30px] pb-6 pl-[248px] transition-all">
    <Outlet />
  </main>
  <StatusBar />
  <CommandPalette />
</div>
```

---

## Step 6: Update Menu Configuration
**File:** `src/config/menu-config.ts`

### Changes
- Simplify icons (use more minimal Lucide icons)
- Remove color properties (VS Code uses monochrome)
- Add `activityIcon` for Activity Bar display
- Keep `children` for sidebar tree structure

---

## Step 7: Create Compact SidebarMenuItem
**File:** `src/components/layout/SidebarMenuItem.tsx`

### Design Changes
- Reduce height to 28px
- Remove icon backgrounds
- Smaller font (text-sm)
- Indent for nested items (pl-4 per level)
- Simple chevron for expandable items
- Subtle active state (no bold colors)

### Styling
```tsx
<button className="w-full h-7 px-3 flex items-center gap-2 text-sm text-zinc-300 hover:bg-zinc-700/50 rounded">
  {hasChildren && <ChevronRight className="h-3 w-3" />}
  <span className="truncate">{item.label}</span>
</button>
```

---

## Step 8: Update Redux UI Slice
**File:** `src/stores/ui.slice.ts`

### New State
- `activeActivity: string | null` - Currently selected activity
- `sidebarVisible: boolean` - Show/hide sidebar
- `activityBarVisible: boolean` - Show/hide activity bar (View menu toggle)

### New Actions
- `setActiveActivity(id: string | null)`
- `toggleSidebarVisible()`
- `toggleActivityBarVisible()`

---

## Step 9: Create Menu Configuration
**File:** `src/config/menubar-config.ts`

### Structure
```ts
export const menuBarItems = {
  file: [
    { label: "New Window", shortcut: "Ctrl+Shift+N", action: "newWindow" },
    { type: "separator" },
    { label: "Save", shortcut: "Ctrl+S", action: "save" },
    { label: "Export...", action: "export" },
    { type: "separator" },
    { label: "Exit", action: "exit" },
  ],
  edit: [...],
  view: [...],
  help: [...],
};
```

---

## Step 10: Update Styling/Theme
**Files:** `src/index.css`, component files

### Color Palette (Dark Theme - VS Code style)
- Background: `#1e1e1e` (zinc-900)
- Sidebar: `#252526` (zinc-800)
- Activity Bar: `#333333` (zinc-700)
- Borders: `#3c3c3c` (zinc-600)
- Text: `#cccccc` (zinc-300)
- Active/Accent: `#007acc` (blue-600)

### Typography
- Menu Bar: 13px
- Sidebar items: 13px
- Status Bar: 12px
- Reduce overall padding/margins

---

## Step 11: Mobile Responsiveness

### Breakpoints
- **Desktop (md+)**: Full VS Code layout
- **Mobile (<md)**:
  - Hide Activity Bar
  - Full-screen Sheet for sidebar
  - Simplified menu bar (hamburger menu)
  - Keep status bar

---

## Step 12: Keyboard Shortcuts
**File:** `src/hooks/useKeyboardShortcuts.ts`

### Shortcuts
- `Ctrl+B`: Toggle sidebar
- `Ctrl+Shift+E`: Focus Explorer/Dashboard
- `Ctrl+Shift+F`: Focus Search
- `Ctrl+K Ctrl+S`: Open Keyboard Shortcuts
- `Ctrl+,`: Open Settings

---

## Files Summary

### New Files
- `src/components/layout/ActivityBar.tsx`
- `src/components/layout/MenuBar.tsx`
- `src/components/layout/StatusBar.tsx`
- `src/config/menubar-config.ts`
- `src/hooks/useKeyboardShortcuts.ts`

### Modified Files
- `src/components/layout/Sidebar.tsx` (major redesign)
- `src/components/layout/SidebarMenuItem.tsx` (compact style)
- `src/components/layout/MainLayout.tsx` (new structure)
- `src/config/menu-config.ts` (simplify)
- `src/stores/ui.slice.ts` (new state)
- `src/index.css` (dark theme colors)

### Deleted Files
- `src/components/layout/TopNav.tsx` (replaced by MenuBar + StatusBar)

---

## Visual Comparison

### Before (Current)
```
┌────────────────────────────────────────────┐
│         Top Nav (64px)                     │
├──────────────┬─────────────────────────────┤
│   Sidebar    │                             │
│   (256px)    │      Content                │
│              │                             │
└──────────────┴─────────────────────────────┘
```

### After (VS Code Style)
```
┌────────────────────────────────────────────┐
│  Menu Bar (30px)                           │
├────┬─────────┬─────────────────────────────┤
│ 48 │  200px  │                             │
│ px │ Sidebar │      Content                │
│    │         │                             │
├────┴─────────┴─────────────────────────────┤
│  Status Bar (24px)                         │
└────────────────────────────────────────────┘
```

**Space Saved**: ~30px vertical (64 → 30+24=54), more efficient horizontal layout
