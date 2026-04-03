# Plan: Enhance Company Name Prominence in Client Layout

This plan outlines the steps to make the company name more prominent at the top of the application, alongside the breadcrumbs, as requested.

## Workflow
1.  **Analyze**: Verify current placement of company name in `ClientLayout`.
2.  **Refine UI**: Design a more prominent, badge-style display for the company name using existing design tokens.
3.  **Implement**: Update `client-layout.tsx` to use the new UI components and include GST registration status visualization.
4.  **Verify**: Ensure the layout remains responsive and aesthetically pleasing.

## Execution Steps

### Step 1: Update Selectors in ClientLayout
- Import `selectIsGstRegistered` and `Building2` icon in `client-layout.tsx`.
- Add `isGstRegistered` to the component state using the selector.

### Step 2: Redesign Company Name Section
- Modify the `main` header section in `client-layout.tsx` (around line 180).
- Replace the simple text paragraph with a "Premium Badge" layout:
    - Container: Flex row, rounded-full, surface background, subtle border, shadow.
    - Icon: `Building2` with accent color.
    - Text: Bold, uppercase, primary text color.
    - GST Badge: Conditional badge showing "GST" in emerald color if `isGstRegistered` is true.

### Step 3: CSS/Token Alignment
- Ensure all colors and spacing use the established `var(--cl-*)` tokens for consistent dark/light mode support.

### Step 4: Verification
- Check alignment with the breadcrumb (`displayTitle`).
- Verify that it fits well on smaller screens (the `justify-between` should handle it, but may need `hidden sm:flex` if it's too wide for mobile).
