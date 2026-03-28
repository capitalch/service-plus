# Plan: Data Grid Upgrade for Masters Lookup Tables

## Goal
Upgrade `LookupSection` so all Masters data tables display in a grid with:
- **Max available height** with sticky header and built-in vertical scroll
- **Search** — client-side text filter across visible columns
- **Sort** — clickable column headers toggle asc/desc order

No new npm dependencies are needed; everything is implemented in React with existing Tailwind utilities and Lucide icons.

---

## Files to Change

| File | Change |
|------|--------|
| `service-plus-client/src/features/client/components/lookup-section.tsx` | All UI and logic changes |

---

## Implementation Steps

### 1. Imports
Add `useMemo`, `useState` (already imported) for search/sort state.
Add Lucide icons: `ArrowUpDownIcon`, `ArrowUpIcon`, `ArrowDownIcon`, `SearchIcon`.
Add `Input` from `@/components/ui/input`.

### 2. State
```ts
const [search,   setSearch]   = useState("");
const [sortCol,  setSortCol]  = useState<string | null>(null);
const [sortDir,  setSortDir]  = useState<"asc" | "desc">("asc");
```

### 3. Derived Data (useMemo)
- **Filter**: Compare `search` (lowercased) against `code`, `name`, `description`, `prefix` of each record (only fields present in the config).
- **Sort**: If `sortCol` is set, sort the filtered list by that field. Strings use `localeCompare`; numbers compare directly. Toggle `sortDir` when the same column header is clicked again; reset to `asc` when a different column is clicked.

```ts
const displayRecords = useMemo(() => {
    let rows = records.filter(r => isAdmin || !r.is_system);
    if (search.trim()) {
        const q = search.toLowerCase();
        rows = rows.filter(r =>
            r.code.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q) ||
            (r.description?.toLowerCase().includes(q) ?? false) ||
            (r.prefix?.toLowerCase().includes(q) ?? false)
        );
    }
    if (sortCol) {
        rows = [...rows].sort((a, b) => {
            const av = (a as Record<string, unknown>)[sortCol];
            const bv = (b as Record<string, unknown>)[sortCol];
            if (av == null) return 1;
            if (bv == null) return -1;
            const cmp = typeof av === "number"
                ? av - (bv as number)
                : String(av).localeCompare(String(bv));
            return sortDir === "asc" ? cmp : -cmp;
        });
    }
    return rows;
}, [records, isAdmin, search, sortCol, sortDir]);
```

### 4. Sort Helper
```ts
function handleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
}
function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ArrowUpDownIcon className="ml-1 h-3 w-3 opacity-40" />;
    return sortDir === "asc"
        ? <ArrowUpIcon   className="ml-1 h-3 w-3" />
        : <ArrowDownIcon className="ml-1 h-3 w-3" />;
}
```

### 5. Search Bar
Add below the page header, above the table:
```tsx
<div className="relative">
    <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
    <Input
        className="h-8 pl-8 text-sm"
        placeholder={`Search ${config.sectionTitle.toLowerCase()}…`}
        value={search}
        onChange={e => setSearch(e.target.value)}
    />
</div>
```

Show a "No results match your search" message when `displayRecords.length === 0` but `records.length > 0`.

### 6. Max-Height Scrollable Table
Wrap the `<div className="overflow-x-auto">` container with:
```tsx
<div className="flex flex-col overflow-hidden rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] shadow-sm"
     style={{ maxHeight: "calc(100vh - 14rem)" }}>
    <div className="overflow-auto">
        <Table> ... </Table>
    </div>
</div>
```
- `maxHeight: calc(100vh - 14rem)` accounts for the top nav bar, page header, search bar, and bottom padding.
- `overflow-auto` gives both x and y scrolling.
- `<TableHeader>` row gets `sticky top-0 z-10` so it stays visible while scrolling.

### 7. Sortable Column Headers
Replace plain `<TableHead>` text with clickable buttons:
```tsx
<TableHead onClick={() => handleSort("code")} className="cursor-pointer select-none">
    <span className="flex items-center">Code <SortIcon col="code" /></span>
</TableHead>
```
Apply to: `code`, `name`, `prefix` (if hasPrefix), `description` (if hasDescription), `display_order` (if hasDisplayOrder).
`Status` and `System` columns are not sortable (badges, not text values worth sorting by).

### 8. Record Counter
Add a small record count below the search bar or in the header area:
```tsx
<p className="text-xs text-[var(--cl-text-muted)]">
    {displayRecords.length} of {records.filter(r => isAdmin || !r.is_system).length} records
</p>
```

### 9. Row Index
Keep row index (`idx + 1`) but base it on the filtered+sorted `displayRecords` array.

---

## Behaviour Summary

| Scenario | Result |
|----------|--------|
| User types in search box | Table instantly filters rows client-side |
| User clicks column header | Rows sort asc; click again → desc; click different column → new sort |
| Table has many rows | Table scrolls vertically inside its container; header stays fixed |
| No search matches | "No results match your search" message with clear-search hint |
| Data still loading | Skeleton rows shown; search/sort disabled visually |
| Readonly config | Same grid/search/sort behaviour; Add/Actions columns still hidden |
