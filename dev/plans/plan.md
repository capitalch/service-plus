# Plan: Intuitive Part Finder UI with Stock Display

## Overview
Design and implement a **Part Finder** feature for the Inventory module. The UI allows a workshop technician or admin to quickly locate a part using multiple search facets and see real-time stock balance and storage location at a glance.

---

## Workflow

```
User opens Part Finder
        │
        ▼
[Filter Panel] ─── text search + category + brand + model + location + stock status
        │
        ▼
[Results Grid / Card View]  ←── paginated, sortable, color-coded stock badges
        │
        ├─── click row / card
        │           │
        │           ▼
        │    [Detail Side-Panel]
        │     • Full part info
        │     • Stock by location table
        │     • Price & tax details
        │     • Location history
        │
        └─── bulk action bar (future)
```

---

## UI Layout

### 1. Page Header
- Title: "Part Finder"
- Subtitle: "Search and locate parts across your inventory"
- View toggle: **Table** | **Card** (icon buttons, framer-motion transition)

### 2. Filter Panel (collapsible top bar)
Filters are applied instantly (debounced 1200 ms for text, immediate for dropdowns):

| Filter | Control | Data Source |
|--------|---------|-------------|
| Part Code / Name | Text input with magnifier icon | free text → hits `part_code`, `part_name`, `part_description` |
| Category | Multi-select dropdown | distinct categories from `part` table |
| Brand | Multi-select dropdown | `brand` table |
| Model | Combobox / typeahead | distinct models from `part` table |
| Storage Location | Multi-select dropdown | `part_location` table |
| Stock Status | Segmented control: All / In Stock / Low Stock / Out of Stock | computed from `stock_balance` view |

- **Reset Filters** button (top-right of filter bar)
- Active filter count badge on the collapse toggle

### 3. Results Area

#### Table View (default)
Columns (sortable):

| # | Column | Notes |
|---|--------|-------|
| 1 | Part Code | monospace, click to copy |
| 2 | Part Name | truncated with tooltip |
| 3 | Brand | |
| 4 | Category | pill badge |
| 5 | Model | |
| 6 | Location | storage bin label |
| 7 | Qty | right-aligned, bold |
| 8 | UOM | |
| 9 | Stock Status | colored badge: green (In Stock), amber (Low), red (Out) |
| 10 | Actions | Eye icon → opens detail panel |

- Sticky header
- Alternating row shade
- Row click → open detail side panel
- Empty state illustration when no results

#### Card View
- 3-column responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
- Each card:
  - Top-right: Stock Status badge
  - Part Code (monospace, small, muted)
  - Part Name (bold, 2-line clamp)
  - Brand + Category row
  - Model chip
  - Large stock number with UOM
  - Location pill (bin icon + name)
  - "View Details" button at bottom
- framer-motion stagger animation on card mount

### 4. Detail Side Panel (slide-in from right)
Opens when a row/card is clicked. Stays open while browsing results.

**Sections (tabs):**

#### Tab 1 — Overview
- Part Code, Part Name, Description
- Brand, Category, Model
- UOM, HSN Code, GST Rate
- Cost Price, MRP
- Active status badge

#### Tab 2 — Stock & Locations
- Summary bar: Total Qty across all locations
- Table:
  | Location | Qty | Last Updated |
  |----------|-----|--------------|
- Mini horizontal bar chart (recharts) showing stock distribution across locations
- "Set Location" quick-action button → opens existing `SetPartLocationDialog`

#### Tab 3 — Location History
- Timeline list (date, location, ref_no, remarks)
- Reuses `PartLocationHistoryType`

---

## GraphQL Queries (using genericQuery)

### Q1 — Part Finder search query
```graphql
query PartFinder($db_name: String!, $schema: String, $value: String!) {
  genericQuery(db_name: $db_name, schema: $schema, value: $value)
}
```
`value` JSON drives:
- JOIN of `part`, `brand`, `stock_balance`, `part_location`
- WHERE clause built from active filters (text ILIKE, category/brand/model/location IN lists)
- GROUP BY part + location
- Computed `stock_status` column

### Q2 — Filter option lists
Distinct category and model values from `part` table; brand list from `brand` table; locations from `part_location`.

### Q3 — Stock by location for a single part
Returns rows from `stock_balance` joined with `part_location` for detail panel Tab 2.

### Q4 — Location history for a single part
Reuses existing history query from `set-part-location` feature.

---

## New Files

```
src/features/client/
├── components/inventory/
│   └── part-finder/
│       ├── part-finder-card.tsx          # Single card component
│       ├── part-finder-detail-panel.tsx  # Slide-in detail side panel
│       ├── part-finder-filter-bar.tsx    # All filter controls
│       ├── part-finder-page.tsx          # Main page (table + card toggle)
│       ├── part-finder-stock-chart.tsx   # Recharts bar chart for stock by location
│       └── part-finder-table.tsx         # Table view component
├── types/
│   └── part-finder.ts                    # All types for part finder
└── graphql/ (or queries/)
    └── part-finder.graphql.ts            # All queries for part finder
```

---

## Step-by-Step Execution

### Step 1 — Define types (`part-finder.ts`)
- `PartFinderResultType` — merged part + stock + location row
- `PartFinderFiltersType` — all filter fields with defaults
- `PartFinderStockByLocationType` — for detail panel Tab 2
- `StockStatusType = "all" | "in_stock" | "low_stock" | "out_of_stock"`

### Step 2 — Write GraphQL queries (`part-finder.graphql.ts`)
- `PART_FINDER_SEARCH` — main grid query using genericQuery
- `PART_FINDER_FILTER_OPTIONS` — distinct categories, models, brands, locations
- `PART_FINDER_STOCK_BY_LOCATION` — detail panel Tab 2
- `PART_FINDER_LOCATION_HISTORY` — detail panel Tab 3 (reuse if already exists)

### Step 3 — Add server-side SQL support (`sql_store.py`)
- Add raw SQL for part finder search with parameter substitution
- Add SQL for stock by location (single part)
- Expose via `genericQuery`

### Step 4 — Build Filter Bar (`part-finder-filter-bar.tsx`)
- Text input (debounced 1200 ms), magnifier icon
- Category, Brand, Model, Location multi-selects (shadcn `Popover` + `Command` for multi-select)
- Stock status segmented control (shadcn `ToggleGroup`: All / In Stock / Low Stock / Out)
- Reset button, active filter count badge
- Collapse/expand with framer-motion height animation

### Step 5 — Build Table View (`part-finder-table.tsx`)
- shadcn `Table` with sortable column headers (click to sort asc/desc)
- Stock status badge (green / amber / red)
- Part code copy-to-clipboard (small copy icon)
- Row click handler → set selected part → open detail panel
- Empty state with illustration and "No parts found" message

### Step 6 — Build Card View (`part-finder-card.tsx`)
- shadcn `Card` layout
- framer-motion stagger animation on list render
- All key fields displayed visually
- "View Details" button triggers detail panel

### Step 7 — Build Stock Chart (`part-finder-stock-chart.tsx`)
- `recharts` `BarChart` — horizontal bars, one bar per location
- Green colour for healthy stock (>5), amber for low (1-5), red for 0

### Step 8 — Build Detail Side Panel (`part-finder-detail-panel.tsx`)
- Fixed right panel (w-96 or w-[420px]), overlays content
- Slide-in via framer-motion `x` transform (from right edge)
- shadcn `Tabs`: Overview | Stock & Locations | History
- Tab 2 embeds stock chart + location table
- Tab 2 "Set Location" button opens existing `SetPartLocationDialog`
- Backdrop click or X button closes panel

### Step 9 — Build Main Page (`part-finder-page.tsx`)
- Composes: filter bar + view toggle header + table/card result area + detail panel
- Local state: filters, selectedPart, viewMode, isDetailOpen
- Apollo `apolloClient.query` for search and detail queries
- shadcn `Pagination` at bottom of results
- Framer-motion `AnimatePresence` for view mode switch

### Step 10 — Register page in router and sidebar
- Add route `/inventory/part-finder`
- Add sidebar menu item "Part Finder" under Inventory section

### Step 11 — Add messages to `messages.ts`
- All user-facing error messages, empty state text, notification strings

### Step 12 — Responsive polish and QA
- Mobile: filter panel as full-screen bottom sheet, 1-col cards
- Tablet: 2-col cards, filter panel collapsible
- Desktop: 3-col cards or table, persistent side panel
- Verify debounce, sort, pagination, detail panel all work correctly

---

## Stock Status Thresholds
- **Out of Stock**: qty = 0  → red badge
- **Low Stock**: 0 < qty ≤ 5 → amber badge  (threshold configurable via app-settings later)
- **In Stock**: qty > 5 → green badge

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Side panel instead of modal | Allows browsing results while reading part detail |
| Both table and card views | Technicians on tablets prefer cards; admins on desktop prefer tables |
| OR within facet, AND across facets | Standard faceted search UX (e.g. Brand=Samsung OR Apple, AND Category=Screen) |
| genericQuery for all reads | Consistent with project conventions |
| Local state for filters | No need for Redux; filters are ephemeral to this page |
| Recharts for stock chart | Already likely in project deps; lightweight |
| Debounce text at 1200 ms | Project default, avoids excessive API calls while typing |
