# Implementation Plan: Batch Jobs UI Refactor (Card Layout)

This plan focuses on refactoring the "Jobs in Batch" section from a tabular format to a modern, responsive card-based layout in `NewBatchJobForm`.

## Workflow
1.  **Job Entry**: Instead of a table row, each job in the batch is represented as a discrete `Card`.
2.  **Responsive Adaptation**: Cards will stack vertically on mobile and can be arranged in a grid or single-column stack on desktop depending on screen width.
3.  **Integrated Controls**: Image uploads and detail fields are always visible or easily accessible within the card, avoiding the "expanded row" complexity.

---

## Step-by-Step Execution

### Step 1: Component Restructuring
*   **Target File**: `src/features/client/components/jobs/batch-job/new-batch-job-form.tsx`
*   **Action**: Remove the `<table>`, `<thead>`, and `<tbody>` structure. Replace it with a `div` container and a map over `rows` that renders a `BatchJobCard` (or similar inline structure).

### Step 2: Implement Batch Job Card Layout
*   **Structure**: Use a `Card` component for each job entry.
*   **Header**:
    *   Display "Job #{index + 1}" and the generated `Job No`.
    *   Include the `Trash2` (Remove) button in the top-right corner.
*   **Field Grid**: Use a responsive grid (e.g., `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`) inside `CardContent`.
    *   **Field 1**: Product / Model (Searchable Select).
    *   **Field 2**: Qty & Serial No.
    *   **Field 3**: Receive Condition & Warranty Card No.
    *   **Full Width**: Problem Reported & Remarks (Textareas).
*   **Image Section**: Place the `JobImageUpload` section at the bottom of the card or in a dedicated section within the card, ensuring it's clearly associated with that specific job.

### Step 3: Polish & Animations
*   **Action**: Wrap the cards in an `AnimatePresence` and use `motion.div` for each card.
*   **Transition**: Use a "pop-in" or "slide-down" effect when adding a new job.
*   **Visual Styling**:
    *   Add a subtle hover shadow to the active card.
    *   Use a distinct background color or border for the "Job No" to make it stand out.
    *   Ensure proper spacing (`gap-4`) between cards.

### Step 4: Refine "Add Job" Action
*   **Action**: Move the "Add Job" button to be more prominent at the bottom of the card list, possibly using a ghost card placeholder or a large centered button.

---

## UI Strategy
*   **Desktop**: Each card feels like a mini-form, providing better focus on the specific product being logged.
*   **Mobile**: High-quality mobile experience where each job is a full-width card, eliminating horizontal scrolling issues inherent in tables.
*   **Consistency**: The field order and styling should match the `NewSingleJobForm` for a unified user experience.
