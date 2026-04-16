# Logic for IGST setting in purchase-invoice-new.tsx
- When BuBranchSwitcher selects a bu and branch, gstin and state code for both are stored in global redux storage
- In nenw purchase entry, when vendor is selected, its state code should be available. Change server sql if required.
- If vendor state code is different from bu branch state code, then isIgst should be true, else false. branch is given priority over bu.
- give a plan in plan.md.
