# Dashboard Improvement Plan

## Goal Description
Improve the Super Admin Dashboard and implement the backend-to-frontend workflow based on the guidelines provided in `claude.md`. The workflow involves the creation and management of Clients and Admin Users (AUs), as well as the dynamic creation of databases and schemas for each new client/BU.

## Workflow
1. **Step 1:** Define the GraphQL and SQL map constants on the frontend.
2. **Step 2:** Ensure backend python GraphQL resolvers (`genericQuery`, `genericUpdate`) are implemented to handle the nested DB creations and queries efficiently.
3. **Step 3:** Implement the UI forms (`ClientForm`, `AuForm`) using Shadcn + Zod + React Hook Form. Include animations using `framer-motion`.
4. **Step 4:** Integrate Apollo hooks in the Dashboard features to replace Redux mock data with real data fetched from the FastAPI backend.
5. **Step 5:** Write/verify tests on the backend to validate the dynamic sql schema creation properly triggers.

## Proposed Changes

### Client Side (`service-plus-client`)
- Modify `src/constants/graphql-map.ts`: Add custom mutations.
- Modify `src/constants/sql-map.ts`: Map operations.
- Modify `src/features/super-admin/store/super-admin-slice.ts`: Integrate actual backend data vs dummy data.
- Modify `src/features/super-admin/pages/super-admin-dashboard-page.tsx`: Bind fetching logic.
- Create UI Forms: Create forms adhering to instructions (`*` in red, Shadcn UI, Zod validation).

### Server Side (`service-plus-server`)
- Update `genericUpdate` logic to cleanly bootstrap new tenants on `CREATE_CLIENT` (Create Db -> run SQL for Security Schema -> insert AU).

## Verification Plan
1. Check `npm run dev` to see styling.
2. Form testing.
3. Database tenant creation verification against PostgreSQL.
