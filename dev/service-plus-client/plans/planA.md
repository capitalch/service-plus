# Plan: Remove obsolete `.graphql` files

The `generic.graphql` files are no longer required because the `graphql-codegen` setup has been completely removed from the project. Queries and subscriptions are now manually defined directly within the application code utilizing the `gql` tag (as seen in `super-admin-dashboard-page.tsx`). Therefore, standalone `.graphql` files are now unused and can be safely deleted.

## Workflow
1. **Identify unused files:** Locate the obsolete `.graphql` files in the `src/graphql` directory configuration (queries and subscriptions).
2. **Remove files & folders:** Delete the unnecessary `.graphql` files and their parent directories to keep the codebase clean.

## Steps of Execution

* **Step 1:** Delete the file `src/graphql/queries/generic.graphql`.
* **Step 2:** Delete the file `src/graphql/subscriptions/generic.graphql`.
* **Step 3:** Remove the now-empty `src/graphql` directory and its subdirectories (`queries`, `subscriptions`).
