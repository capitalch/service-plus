import type { CategoryStyleType, HelpArticle } from "@/components/shared/help/help-types";

// ─── Developer Help Center content ─────────────────────────────────────────────
// Audience: developers/maintainers, surfaced only inside Super Admin (userType 'S',
// already gated by ProtectedRoute in src/router/protected-route.tsx). Rendered by
// the same shared engine as the end-user Help Center
// (src/components/shared/help/help-panel.tsx) — this file only supplies data.
//
// Facts below are grounded in direct inspection of this repo, notes/*.md,
// dev/service-plus-client/claude.md, dev/service-plus-server/claude.md, and
// plans/plan-access-control.md as of 2026-07-11. File paths and line numbers will
// drift as the codebase changes — re-verify before relying on exact citations.

export const DEV_HELP_ARTICLES: HelpArticle[] = [

    // ── Category 1: Architecture ─────────────────────────────────────────────

    {
        id: "dev-system-overview",
        category: "Architecture",
        title: "System Overview",
        summary: "The three repos, the SaaS tenant model, and the end-to-end request flow.",
        tags: ["architecture", "overview", "repos", "saas", "tenants", "request flow", "microservice"],
        content: [
            { type: "para", text: "Service+ is split across three independently deployed repos. Understanding the boundary between them is the first thing to internalize before touching any of them." },
            { type: "table", headers: ["Repo", "Role", "Stack"], rows: [
                ["service-plus-client", "The React SPA — Client Mode, Admin Mode, Super Admin", "React + TypeScript (strict) + Vite + Tailwind + shadcn/ui"],
                ["service-plus-server", "The API — auth, GraphQL, REST, DB access, scheduling", "FastAPI + Ariadne GraphQL + psycopg + Pydantic"],
                ["service-plus-file-server", "Standalone microservice for file/image uploads", "FastAPI + Pillow, its own container/port (9000)"],
            ]},
            { type: "heading", text: "SaaS tenant tiers" },
            { type: "para", text: "Free tier: one Business Unit, capped at 1000 transactions. Pro tier: one Business Unit, unlimited transactions. Enterprise tier: up to 10 Business Units, unlimited transactions. See the Multi-Tenancy category for how a Business Unit is actually provisioned." },
            { type: "heading", text: "Request flow" },
            { type: "steps", items: [
                "Browser → Apollo Client (src/lib/apollo-client.ts) attaches Authorization: Bearer <token> to every GraphQL call.",
                "→ POST /graphql, handled by Ariadne's GraphQL app (app/graphql/schema.py).",
                "→ context_value / get_graphql_context() decodes the JWT and injects user_id, user_type, role_code, access_rights, client_id, db_name into every resolver call.",
                "→ Resolvers (app/graphql/resolvers/{query,mutation,subscription}.py) run business logic, calling SQL from app/db/sql_store.py.",
                "→ psycopg_driver.py / pool_manager.py execute against the correct tenant database (selected by db_name from the JWT).",
                "→ Response flows back through Apollo Client into Redux / component state.",
            ]},
            { type: "note", text: "Non-GraphQL calls (login, image upload, health check) go through plain FastAPI routers instead (app/routers/*), per the house rule 'GraphQL for all secured/authenticated data calls, REST via FastAPI Routers otherwise.'" },
        ],
        faqs: [
            { q: "Why three separate repos instead of one monorepo?", a: "Each is deployed independently to its own container (see Deployment & Infrastructure). The file-server in particular is intentionally decoupled so image/upload traffic doesn't compete with the API server." },
            { q: "Where does a GraphQL request actually get authenticated?", a: "In app/graphql/schema.py's context_value / get_graphql_context(), which reads the Authorization header and decodes the JWT before any resolver runs. See 'RBAC Data Model & Login Flow' and 'Known Gaps' for what is and isn't actually enforced from there." },
            { q: "How does the server know which tenant database to use?", a: "db_name is embedded in the JWT at login (see 'RBAC Data Model & Login Flow') and threaded through the GraphQL context and every genericQuery/genericUpdate call." },
        ],
    },

    {
        id: "dev-generic-query-update-pattern",
        category: "Architecture",
        title: "The Generic Query/Update Pattern",
        summary: "Why almost every mutation in this codebase is genericUpdate, not a bespoke resolver.",
        tags: ["generic query", "generic update", "genericUpdate", "genericQuery", "xData", "fkeyName", "sqlObject", "pattern"],
        content: [
            { type: "para", text: "The dominant data-access idiom in this codebase, on both client and server, is three generic GraphQL operations rather than one bespoke mutation per table: genericQuery, genericUpdate, and genericUpdateScript." },
            { type: "heading", text: "Shape" },
            { type: "para", text: "A generic update call takes a tableName plus an xData payload. Nested child rows are expressed via fkeyName + xDetails, recursively — one call can insert/update/delete a parent row and all its child rows in a single round trip." },
            { type: "table", headers: ["TS type", "Fields"], rows: [
                ["SqlObject", "tableName?, fkeyName?, deletedIds?: (number|string)[], xData?: XData | XData[]"],
                ["XData", "id?, isIdInsert?, xDetails?: SqlObject | SqlObject[], plus arbitrary column-name keys"],
            ]},
            { type: "note", text: "These two types are the backbone of nearly every form-save in the client — see notes/knowledgebase.md for the original definition, reproduced here verbatim." },
            { type: "heading", text: "Why this exists" },
            { type: "bullets", items: [
                "One generic resolver replaces dozens of table-specific CRUD mutations — huge reduction in server boilerplate as the schema (53+ tables) grew.",
                "genericQuery additionally takes a sqlId referencing a named, parameterized query in sql_store.py — so reads stay centralized and reviewable even though they're dispatched generically.",
            ]},
            { type: "warning", text: "The trade-off: genericUpdate/genericUpdateScript/genericQuery can, by construction, write to or read from almost any table by name, with no per-table authorization check by default. This is the single biggest authorization gap in the codebase today — see 'Known Gaps' in Access Control & Security before assuming a table is protected just because the app has a login screen." },
        ],
        faqs: [
            { q: "When should I add a bespoke resolver instead of using genericUpdate?", a: "When the operation needs server-side business logic beyond a straight column write (e.g. accountsPosting, seedSecurityData, createJobPayment) — genericUpdate is for direct table writes only." },
            { q: "Where do I see a real example of nested xDetails?", a: "Any multi-line form save — e.g. a job with parts and charges, or a purchase invoice with line items — sends one genericUpdate call with the parent xData and child rows nested under xDetails." },
            { q: "Is genericUpdate authorization-checked at all?", a: "Partially. mutation.py has a GENERIC_UPDATE_TABLE_RIGHTS allow-list covering the ~20 Masters/Configurations tables gated by MASTERS_MENU/CONFIG_MENU rights. Tables shared with unrestricted flows (job, job_payment, purchase_invoice, sales_invoice, job_invoice) are deliberately left unscoped — see 'Known Gaps'." },
        ],
    },

    {
        id: "dev-realtime-updates",
        category: "Architecture",
        title: "Real-Time Updates (GraphQL Subscriptions)",
        summary: "How pubsub.py and subscription.py deliver live updates to the client.",
        tags: ["subscriptions", "pubsub", "websocket", "realtime", "graphql"],
        content: [
            { type: "para", text: "Service+ uses GraphQL subscriptions over WebSockets for real-time updates, layered on top of Ariadne's subscription support." },
            { type: "table", headers: ["Piece", "Location"], rows: [
                ["Pub/sub broker", "app/graphql/pubsub.py"],
                ["Subscription resolvers", "app/graphql/resolvers/subscription.py"],
                ["Nginx WebSocket upgrade", "location /graphql/ in the deployed nginx config — see Deployment & Infrastructure"],
            ]},
            { type: "note", text: "The client's Apollo Client setup (src/lib/apollo-client.ts) is configured for subscription support per the house rule 'Use GraphQL with subscription support for authenticated query. Use apollo for GraphQL.'" },
        ],
        faqs: [
            { q: "Do subscriptions go through the same auth context as queries/mutations?", a: "They go through the same Ariadne GraphQL app and context_value wiring described in 'GraphQL Layer' — verify current behavior in schema.py before assuming parity, since subscriptions are a separate transport (WebSocket) from queries/mutations." },
            { q: "What breaks subscriptions in production if misconfigured?", a: "Missing the WebSocket upgrade headers (Upgrade/Connection) on the /graphql/ nginx location — see 'Hosting Model & Nginx Configuration'." },
        ],
    },

    {
        id: "dev-operating-modes",
        category: "Architecture",
        title: "Three Operating Modes & Routing",
        summary: "Client Mode, Admin Mode, and Super Admin — what gates each, and where the code lives.",
        tags: ["client mode", "admin mode", "super admin", "userType", "sessionMode", "protected route", "routing"],
        content: [
            { type: "table", headers: ["Mode", "userType", "Code location", "Purpose"], rows: [
                ["Client Mode", "A, B, or S (day-to-day ops for any authenticated user)", "src/features/client/", "Jobs, Inventory, Masters, Configurations, Reports — the operational app"],
                ["Admin Mode", "A only (Business Admin)", "src/features/admin/", "Business Units, Business Users, Roles CRUD for one client company"],
                ["Super Admin", "S only (platform operator)", "src/features/super-admin/", "Client onboarding, DB/schema provisioning, platform-level seeding — this help center lives here"],
            ]},
            { type: "heading", text: "How gating actually works" },
            { type: "para", text: "src/router/protected-route.tsx's ProtectedRoute component takes optional requiredUserType ('A' | 'B' | 'S') and requiredSessionMode ('admin' | 'client') props. If the current user's userType or sessionMode doesn't match, it redirects to ROUTES.home rather than rendering the route's Outlet — this is a client-side redirect only, not a security boundary by itself (the server must independently enforce anything sensitive, per Access Control & Security)." },
            { type: "note", text: "Because Super Admin routes are gated by requiredUserType=\"S\", any UI mounted only inside the Super Admin layout — including this developer help center — is reachable only by Super Admin users, with no additional gating code needed." },
        ],
        faqs: [
            { q: "Can a userType 'A' user reach Super Admin?", a: "No — ProtectedRoute checks userType strictly, and Super Admin routes require exactly 'S'." },
            { q: "Is Admin Mode role-gated the way Client Mode is?", a: "No — per plan-access-control.md's Decision section, Admin Mode is explicitly out of scope for the granular access-right system. It's reachable only by userType 'A', who face no further restrictions there." },
            { q: "Where's the switch between Client Mode and Admin Mode?", a: "The ShieldCheck icon at the bottom of the left-hand activity bar in Client Mode, visible only to userType 'A' users." },
        ],
    },

    // ── Category 2: Database & Schema ────────────────────────────────────────

    {
        id: "dev-db-topology",
        category: "Database & Schema",
        title: "Database Topology: Registry vs Tenant DBs",
        summary: "One registry database vs one database per tenant — how they relate.",
        tags: ["database", "topology", "registry", "tenant", "public.client", "multi-tenant", "demo1", "security schema"],
        content: [
            { type: "para", text: "There are two distinct kinds of Postgres database in this system — don't confuse them." },
            { type: "heading", text: "1. The registry database (service_plus_client)" },
            { type: "para", text: "A single platform-wide database whose schema is db/service_plus_client.sql. It holds exactly one table, public.client — the list of tenants: client_code, db_name, name, email, phone, gstin, is_active, plus unique constraints on code/db_name/email/name. This is what Super Admin's client list is reading from." },
            { type: "heading", text: "2. Per-tenant databases (pattern: service_plus_demo)" },
            { type: "para", text: "Each tenant gets its own dedicated Postgres database (schema pattern in db/service_plus_demo.sql), created when Super Admin runs 'Initialize Client'. Inside that one database live two Postgres schemas together:" },
            { type: "table", headers: ["Schema", "Contents"], rows: [
                ["demo1 (business schema)", "47 tables — jobs, inventory, purchase/sales, masters, configuration. Naming pattern 'demo1' is per-BU; see 'Multi-Tenancy & Business-Unit Provisioning'."],
                ["security", "6 tables — user, bu, role, access_right, role_access_right, user_bu_role. The RBAC schema, see Access Control & Security."],
            ]},
            { type: "note", text: "public.client.db_name (registry DB) points at which per-tenant database to connect to for that client — this is the field carried in the JWT as db_name and threaded through every GraphQL call." },
        ],
        faqs: [
            { q: "Is there one Postgres database per Business Unit, or one per tenant with multiple schemas?", a: "One database per tenant (client). Multiple Business Units for an Enterprise-tier tenant are provisioned as additional schemas inside that same tenant database — see 'Multi-Tenancy & Business-Unit Provisioning'." },
            { q: "Where do I find the actual DDL?", a: "db/service_plus_client.sql (registry) and db/service_plus_demo.sql (a representative tenant database dump, demo1 + security schemas)." },
            { q: "How does the server pick a connection for a given request?", a: "app/db/pool_manager.py manages per-database connection pools, selected by the db_name carried in the request's decoded JWT / GraphQL context." },
        ],
    },

    {
        id: "dev-business-schema-reference",
        category: "Database & Schema",
        title: "Business Schema Reference (demo1)",
        summary: "The 47-table catalog for jobs, inventory, purchase/sales, masters, and configuration.",
        tags: ["schema", "demo1", "tables", "job", "inventory", "stock", "purchase", "sales", "masters", "erd"],
        content: [
            { type: "para", text: "Every tenant's business schema (named per-BU, e.g. demo1) follows the same 47-table shape. Grouped by area:" },
            { type: "heading", text: "Jobs" },
            { type: "table", headers: ["Table", "Purpose"], rows: [
                ["job", "The core job record — customer, device, division, technician, status, is_final, is_closed"],
                ["job_transaction", "Status-change history — one row per transition, drives the Job Transaction Ledger report"],
                ["job_status / job_type", "Lookup: RECEIVED/ASSIGNED/.../DELIVERED_OK etc.; UNDER_WARRANTY and other job types"],
                ["job_part_used", "Parts consumed on a job — cost_price/selling_price/gst_rate/hsn snapshot at time of use"],
                ["job_additional_charge", "Non-parts service charges on a job (labour, diagnostic fee, etc.)"],
                ["job_invoice / job_invoice_line", "The service invoice header and its line items"],
                ["job_payment", "Money receipts against a job (independent of the Deliver Job flow)"],
                ["job_image_doc", "Uploaded photos/documents attached to a job"],
                ["job_delivery_manner / job_receive_manner / job_receive_condition", "Lookups for how a device was received/delivered and its condition"],
            ]},
            { type: "heading", text: "Inventory" },
            { type: "table", headers: ["Table", "Purpose"], rows: [
                ["spare_part_master", "The parts catalog — cost/selling price, HSN, GST rate, UOM"],
                ["stock_balance", "Current quantity per part per branch"],
                ["stock_transaction / stock_transaction_type", "Every stock movement (Purchase, Consumption, Adjustment, Transfer, Loan, Opening) and its type lookup"],
                ["stock_snapshot", "Point-in-time stock levels, for reporting"],
                ["stock_adjustment / _line", "Manual quantity corrections"],
                ["stock_branch_transfer / _line", "Inter-branch stock movement"],
                ["stock_loan / _line", "Parts loaned out/returned (IN/OUT toggle on the same screen)"],
                ["stock_opening_balance / _line", "Initial inventory at system setup"],
                ["stock_location_master / stock_location_change", "Warehouse bin/shelf assignment per part per branch"],
            ]},
            { type: "heading", text: "Purchase / Sales" },
            { type: "table", headers: ["Table", "Purpose"], rows: [
                ["purchase_invoice / _line", "Supplier invoices — stock inward"],
                ["sales_invoice / _line", "Direct counter sales of parts — stock outward"],
                ["supplier", "Vendor master, unique system-wide (not branch-scoped)"],
            ]},
            { type: "heading", text: "Masters & Configuration" },
            { type: "table", headers: ["Table", "Purpose"], rows: [
                ["customer_contact / customer_type", "Customer master and type lookup"],
                ["technician", "Repair staff, branch-scoped, code unique per branch"],
                ["brand / product / product_brand_model", "The Brand → Product → Model hierarchy jobs are keyed to"],
                ["additional_charge", "Service-charge master (Diagnostic Fee, Labour Charge, etc.)"],
                ["state", "Indian states, for address/GST supply-state logic"],
                ["division", "Billing entity — GSTIN present ⇒ GST division; carries account_setting JSONB, see Configuration category"],
                ["document_sequence / document_type", "Auto-numbering config (JOB_SHEET, SERVICE_INVOICE, MONEY_RECEIPT, SALES_INVOICE)"],
                ["financial_year", "Accounting periods, non-overlapping date ranges"],
                ["branch", "Physical service-center location; jobs/inventory/technicians/sequences are branch-scoped"],
                ["app_setting", "Key-value system defaults — see Configuration category"],
            ]},
            { type: "note", text: "Key relationships: job → job_transaction → job_status; job → job_part_used → spare_part_master; job → job_invoice → job_invoice_line; purchase_invoice/sales_invoice → their _line tables; division carries the account_setting JSON used for Trace Plus posting (see Integrations)." },
        ],
        faqs: [
            { q: "Why is the schema literally named 'demo1' in the reference dump?", a: "It's the schema name for that particular sample/demo tenant. Real tenants' Business-Unit schemas get their own generated names via Admin Mode → Business Units → Create Schema & Seed Data." },
            { q: "Where do I get the authoritative, up-to-date column list for a table?", a: "The generated TypeScript types (src/types/db-schema-service.ts) or db/service_plus_demo.sql directly — this article is a map, not a substitute for the DDL." },
            { q: "Are Vendors/Suppliers branch-scoped like Technicians?", a: "No — supplier names are unique system-wide and shared across all branches, unlike Technician (branch-scoped, code unique per branch)." },
        ],
    },

    {
        id: "dev-security-schema-reference",
        category: "Database & Schema",
        title: "Security Schema Reference",
        summary: "The 6-table RBAC schema shared by every tenant database.",
        tags: ["security schema", "rbac", "user", "role", "access_right", "role_access_right", "user_bu_role", "bu"],
        content: [
            { type: "para", text: "Every tenant database also carries a security schema alongside its business schema — 6 tables implementing role-based access control." },
            { type: "table", headers: ["Table", "Purpose"], rows: [
                ["user", "username, email, password_hash, is_active, is_admin"],
                ["bu", "Business Units this user community belongs to"],
                ["role", "code, name, is_system — the three seeded system roles: MANAGER, TECHNICIAN, RECEPTIONIST"],
                ["access_right", "code, name, module, description — 6 seeded granular permission codes"],
                ["role_access_right", "M:N join: which access_right codes each role grants"],
                ["user_bu_role", "M:N join: which role a user holds on which bu, with an is_active flag"],
            ]},
            { type: "para", text: "The chain that actually determines what a logged-in user can do: user → user_bu_role → role → role_access_right → access_right. See 'RBAC Data Model & Login Flow' in Access Control & Security for how this is queried and turned into JWT claims." },
            { type: "note", text: "The schema supports a user having a different role on different Business Units (user_bu_role is per-BU), but the current UI (associate-bu-role-dialog.tsx) always assigns one role uniformly across every BU it associates — that per-BU distinction is unused today, not unsupported." },
        ],
        faqs: [
            { q: "Is there a permissions-editor UI to create custom roles or rights?", a: "No — roles and access rights are system-defined and seeded, matching src/features/admin/pages/roles-page.tsx's own stated philosophy ('Roles are system-defined and cannot be added, edited, or deleted'). See 'Seeding Roles & Access Rights'." },
            { q: "Can one user see multiple client companies (Business Units)?", a: "Yes — user_bu_role supports multiple rows per user, one per BU, via Admin Mode's Associate BU / Role dialog." },
        ],
    },

    {
        id: "dev-generated-ts-types",
        category: "Database & Schema",
        title: "Generated TypeScript Types (pg-to-ts) & pnpm gen-types-all",
        summary: "How the three DB schemas become typed TypeScript, exactly what gen-types-all does, and the TS7 compatibility fix baked into the toolchain.",
        tags: [
            "pg-to-ts", "types", "codegen", "db-schema-service.ts", "db-schema-security.ts", "db-schema-client.ts",
            "gen-types-all", "gen-types-service", "gen-types-security", "gen-types-client",
            "prettier", "pnpm patch", "typescript-formatter", "typescript 7", "manual table change",
        ],
        content: [
            { type: "para", text: "Rather than hand-maintaining TypeScript types for every table, the client generates them directly from Postgres using pg-to-ts. pnpm gen-types-all is the single command that keeps all three generated files honest against the real schema." },
            { type: "heading", text: "What each script generates" },
            { type: "table", headers: ["pnpm script", "Source DB / schema", "Output file", "Env var it reads"], rows: [
                ["gen-types-service", "SERVICE_PLUS_SERVICE connection, --schema demo1 (business schema)", "src/types/db-schema-service.ts", "SERVICE_PLUS_SERVICE"],
                ["gen-types-security", "SERVICE_PLUS_SERVICE connection, --schema security", "src/types/db-schema-security.ts", "SERVICE_PLUS_SERVICE"],
                ["gen-types-client", "SERVICE_PLUS_CLIENT connection, public schema (the registry DB)", "src/types/db-schema-client.ts"],
            ]},
            { type: "note", text: "gen-types-service and gen-types-security both point at SERVICE_PLUS_SERVICE — same tenant database, two different schemas inside it (--schema demo1 vs --schema security), matching the two-schemas-per-tenant-database topology described in 'Database Topology: Registry vs Tenant DBs'. gen-types-client is the odd one out: it targets SERVICE_PLUS_CLIENT, the separate one-table registry database (public.client)." },
            { type: "heading", text: "Running it" },
            { type: "steps", items: [
                "Set SERVICE_PLUS_SERVICE and SERVICE_PLUS_CLIENT in .env at the client repo root (postgresql://user:pwd@host:port/dbname) — read via dotenv-cli.",
                "pnpm gen-types-all — chains gen-types-service, then gen-types-security, then gen-types-client (package.json's gen-types-all script; a single pnpm run that fails fast if any step fails).",
                "Or run just one of the three (e.g. pnpm run gen-types-client) if only that schema actually changed.",
            ]},
            { type: "heading", text: "Why dotenv-cli + cross-var + cross-env, chained" },
            { type: "para", text: "Each script's real invocation is: dotenv -- cross-var cross-env PG_TO_TS_CONN=%SERVICE_PLUS_SERVICE% pg-to-ts generate .... dotenv-cli loads .env into the process; cross-var expands the %VAR% placeholder (Windows-style syntax, but works cross-platform via this tool); cross-env then sets PG_TO_TS_CONN for the pg-to-ts child process. This three-tool chain exists purely so the exact same command line works unmodified on both the Windows and Kubuntu dev setups documented in 'Environments & Secrets' — pg-to-ts itself only ever sees a plain PG_TO_TS_CONN env var, unaware of any of this." },
            { type: "heading", text: "Known fix baked into the toolchain: TypeScript 7 vs typescript-formatter" },
            { type: "warning", text: "This project runs typescript: ~7.0.2 — the new TypeScript rewrite, whose npm package no longer exports the classic compiler/Language Service API at all (require('typescript') resolves to just a version string; no ts.IndentStyle, no ts.createLanguageService, nothing). pg-to-ts@4.1.1 unconditionally pipes its generated output through typescript-formatter@7.2.2 (unmaintained since 2018) to pretty-print it, and that crashes immediately under TS 7 with TypeError: Cannot read properties of undefined (reading 'Smart') — it reaches for ts.IndentStyle.Smart, an API TS 7 simply doesn't ship." },
            { type: "para", text: "Neither package has a fix upstream — pg-to-ts@4.1.1 and typescript-formatter@7.2.2 are both the latest/final published versions on npm. pnpm's overrides and packageExtensions were both tried, to try to give typescript-formatter a private older typescript peer without touching the project's root TS 7 — both were dead ends: pnpm's peer-dependency resolver kept silently re-resolving it back to the root TS 7 install regardless, even after pnpm dedupe and direct lockfile surgery to force re-resolution." },
            { type: "para", text: "The fix that actually shipped: a pnpm patch (patches/pg-to-ts@4.1.1.patch, registered in pnpm-workspace.yaml's patchedDependencies) that replaces pg-to-ts's call to typescript-formatter with prettier.format(output, { parser: 'typescript' }) instead. prettier is already a project devDependency and has its own parser, entirely independent of TS 7's missing Language Service API. It's resolved at runtime via require(require.resolve('prettier', { paths: [process.cwd()] })) — reaching past pg-to-ts's own isolated pnpm node_modules into the consuming project's, since pg-to-ts has no direct dependency on prettier itself." },
            { type: "note", text: "Don't try to 're-fix' a future gen-types-all crash by upgrading typescript-formatter or revisiting pnpm overrides — both were already dead-ended. If pg-to-ts crashes again with this same TypeError, check first whether pnpm install silently dropped or reset the patch: patches/pg-to-ts@4.1.1.patch should exist, and pnpm-workspace.yaml should still list pg-to-ts@4.1.1 under patchedDependencies." },
            { type: "heading", text: "When you manually change a database table" },
            { type: "para", text: "Whenever a table is altered directly with SQL (ALTER TABLE, a new column, a new table, a dropped column) rather than through app code, the generated client types and — if the change belongs to the demo1 template schema — the server-side provisioning DDL both need refreshing by hand. Nothing runs either of these automatically." },
            { type: "table", headers: ["What changed", "Utility to run", "Why"], rows: [
                ["Any table in demo1 (business), security, or the registry public.client table, on an already-provisioned tenant", "pnpm gen-types-all (this repo)", "Regenerates src/types/db-schema-{service,security,client}.ts so the client's TypeScript types match the real columns — skip this and the compiler won't catch code written against stale column names/types."],
                ["A table in the demo1 template schema that should also apply to brand-new tenants/BUs provisioned from now on", "extract_schema.sh / extract_schema.py (service-plus-server repo) — see 'Schema Extraction Tool'", "Regenerates sql_bu.py / sql_security.py, the DDL actually executed when Super Admin provisions a new client or Admin Mode provisions a new Business Unit. Skip this and new tenants get created with the old table shape even though existing tenants (and the client's TS types) already reflect the change."],
            ]},
            { type: "warning", text: "These two utilities serve different purposes and are easy to conflate. pnpm gen-types-all only updates what the client compiler knows about databases that already exist. extract_schema.sh only updates the template used to create new databases/schemas going forward. A manual ALTER TABLE on an already-provisioned tenant always needs the first; it needs the second only if the change should also apply to tenants provisioned from now on. Neither tool retroactively migrates existing tenants — that stays a separate, manual DDL step run per tenant." },
        ],
        faqs: [
            { q: "Why not just hand-write the types?", a: "53+ tables across two databases and three schemas — hand-maintenance would drift immediately. Regeneration keeps the client's type layer honest against the actual DDL." },
            { q: "What do I do after adding a new column to a table?", a: "Update the DDL, then re-run pnpm gen-types-all before writing any client code that touches the new column. If the column belongs to the demo1 template and should exist on newly-provisioned tenants too, also refresh service_plus_service.sql and re-run extract_schema.sh — see 'Schema Extraction Tool'." },
            { q: "gen-types-all is crashing with \"Cannot read properties of undefined (reading 'Smart')\" — what's wrong?", a: "The pnpm patch that routes formatting through prettier instead of the TS7-incompatible typescript-formatter has been lost or not applied. Confirm patches/pg-to-ts@4.1.1.patch exists and pnpm-workspace.yaml still lists it under patchedDependencies, then re-run pnpm install." },
            { q: "Does gen-types-all touch the actual database?", a: "No — it only reads schema metadata (information_schema) to generate types; it never writes to any table." },
        ],
    },

    {
        id: "dev-multi-tenancy-concept",
        category: "Database & Schema",
        title: "Multi-Tenancy & Business-Unit Provisioning (Concept)",
        summary: "How a new client is onboarded end-to-end, and what 'provisioning' actually creates.",
        tags: ["multi-tenancy", "provisioning", "business unit", "initialize client", "create schema", "seed data"],
        content: [
            { type: "para", text: "Provisioning is the process that turns a registry-only client record into a usable, isolated tenant environment. It happens in two tiers." },
            { type: "heading", text: "Tier 1 — Tenant database (Super Admin)" },
            { type: "para", text: "Super Admin's 'Initialize Client' flow (initialize-client-dialog.tsx, attach-db-dialog.tsx) creates the tenant's dedicated Postgres database and both the demo1-pattern business schema and the security schema inside it, then seeds roles + access rights via seed_security_data.py. This is the step that takes a client from registry-only to actually usable." },
            { type: "heading", text: "Tier 2 — Business Unit schema (Admin Mode, Enterprise tier)" },
            { type: "para", text: "For tenants on the Enterprise tier (up to 10 Business Units), each additional BU is provisioned from Admin Mode → Business Units → 'Create Schema & Seed Data' (create-bu-schema-dialog.tsx) — this creates another business-schema-pattern set of tables inside the same tenant database, separate from the tenant's first/default BU schema." },
            { type: "note", text: "Cleanup tooling exists for both tiers: Super Admin's 'Orphaned Databases' dialog (orphan-databases-dialog.tsx) and Admin Mode's 'Orphaned Schemas' dialog (orphan-bu-schemas-dialog.tsx) — for database/schemas left behind by incomplete or reverted provisioning." },
        ],
        faqs: [
            { q: "What's the practical difference between the two tiers of provisioning?", a: "Tier 1 (Super Admin) happens once per tenant/client and creates the database itself. Tier 2 (Admin Mode) happens per Business Unit within an already-provisioned tenant, for Enterprise customers who need more than one company's worth of data isolated inside their account." },
            { q: "What happens if 'Create Schema & Seed Data' fails partway?", a: "If the schema was created but seeding failed, the row menu offers a narrower 'Add Seed Data' action to retry just the seed step without recreating the schema — see the end-user 'Business Units — Provisioning a Client Company' article for the exact UI flow." },
        ],
    },

    {
        id: "dev-extract-schema-tool",
        category: "Database & Schema",
        title: "Schema Extraction Tool: extract_schema.sh / extract_schema.py",
        summary: "Regenerates sql_security.py and sql_bu.py — the DDL used at runtime for service DB schema creation — from a pg_dump schema-only file.",
        tags: [
            "sql_bu", "sql_bu.py", "service db schema creation", "extract_schema.sh", "extract_schema.py",
            "pg_dump", "schema-only dump", "DDL generation", "demo1", "BU schema template",
            "SqlBu", "SqlSecurity", "Business Unit", "code generation",
        ],
        content: [
            { type: "para", text: "app/db/sql_security.py and app/db/sql_bu.py look hand-maintained but are not — they're generated by app/db/tools/extract_schema.py from a pg_dump schema-only dump (app/db/service_plus_service.sql). Do not hand-edit either generated file; re-run the extractor instead." },
            { type: "note", text: "Naming note: 'sql_bu' means Business Unit, not 'backup'. SqlBu.BU_SCHEMA_DDL is the DDL template for one Business Unit's schema — see 'Multi-Tenancy & Business-Unit Provisioning (Concept)' for where BU schemas fit in the provisioning flow." },
            { type: "heading", text: "How it works" },
            { type: "para", text: "The source file is a pg_dump --schema-only dump containing two Postgres schemas: a fixed security schema and one 'template' BU schema (default name: demo1) that stands in for 'a BU schema' in general. Every object in the dump is preceded by a 3-line marker comment: -- / -- Name: <object>; Type: <TABLE|SEQUENCE|CONSTRAINT|...>; Schema: <schema>; Owner: <owner> / --. The script scans for these markers to split the dump into blocks, then runs two passes over them:" },
            { type: "bullets", items: [
                "security schema — kept schema-qualified as-is → written to sql_security.py as SqlSecurity.SECURITY_SCHEMA_DDL.",
                "demo1 (or --bu-schema-name) template schema — the schema-qualifier prefix (e.g. 'demo1.') is stripped from every statement so the emitted DDL relies on Postgres search_path, matching the rest of the BU-schema tooling → written to sql_bu.py as SqlBu.BU_SCHEMA_DDL.",
            ]},
            { type: "para", text: "Both passes drop SCHEMA and COMMENT object types (structurally meaningless) and strip trailing ALTER ... OWNER TO ...; lines (pg_dump ownership noise, irrelevant to schema structure)." },
            { type: "heading", text: "Running it" },
            { type: "steps", items: [
                "If the live template/demo1 database has changed, first refresh the source dump: pg_dump --schema-only against that database, saved to app/db/service_plus_service.sql.",
                "From the service-plus-server repo root, run ./extract_schema.sh — a thin wrapper that sets LANG/LC_ALL to en_US.UTF-8, cd's into the repo root, and runs python3 -m app.db.tools.extract_schema with no arguments (so every flag below falls back to its default).",
                "Equivalently, call the module directly with explicit flags: python -m app.db.tools.extract_schema --source <path> --bu-schema-name <name> --out-dir <dir>.",
                "On success it prints e.g. 'Wrote app/db/sql_security.py (N lines)' and 'Wrote app/db/sql_bu.py (N lines)' — commit both regenerated files.",
            ]},
            { type: "table", headers: ["Flag", "Default", "Meaning"], rows: [
                ["--source", "app/db/service_plus_service.sql", "Path to the pg_dump schema-only source file."],
                ["--bu-schema-name", "demo1", "Name of the schema in the dump to treat as the BU template."],
                ["--out-dir", "app/db", "Directory to write sql_security.py / sql_bu.py into."],
            ]},
            { type: "note", text: "Runtime usage: app/graphql/resolvers/mutation_helper.py executes SqlBu.BU_SCHEMA_DDL live (after CREATE SCHEMA IF NOT EXISTS <code>) to physically create and populate a new Business Unit's tables when a client provisions one — see 'Multi-Tenancy & Business-Unit Provisioning (Concept)'. SqlSecurity.SECURITY_SCHEMA_DDL is used analogously to provision the security schema." },
            { type: "warning", text: "This is a manual step, not CI-triggered — re-run it by hand every time service_plus_service.sql changes, or sql_bu.py / sql_security.py will silently drift from the real DDL. Also note extract_schema.sh hardcodes an absolute cd path to the server repo root, so it must be run from (or adjusted for) that exact checkout location." },
            { type: "note", text: "This is the server-side half of a manual table change. The client-side half — regenerating TypeScript types for existing tenants — is pnpm gen-types-all, a separate tool with a separate purpose; see the checklist in 'Generated TypeScript Types (pg-to-ts) & pnpm gen-types-all' for when you need one, the other, or both." },
        ],
        faqs: [
            { q: "Does 'sql_bu' mean database backup?", a: "No — it means Business Unit. sql_bu.py holds SqlBu.BU_SCHEMA_DDL, the DDL template used to create a new Business Unit's schema, not a backup file." },
            { q: "Can I hand-edit sql_bu.py or sql_security.py directly?", a: "No — both carry an auto-generated header ('Do not hand-edit; re-run the extractor instead') and will be silently overwritten the next time extract_schema.sh runs. Change service_plus_service.sql (via a fresh pg_dump) and regenerate instead." },
            { q: "Where does this fit into service DB schema creation overall?", a: "It's the offline step that keeps the Python DDL constants in sync with the real database. The online step — actually creating a schema for a new tenant/BU — is covered in 'Multi-Tenancy & Business-Unit Provisioning (Concept)', which consumes SqlBu.BU_SCHEMA_DDL / SqlSecurity.SECURITY_SCHEMA_DDL produced here." },
            { q: "I manually altered a table — do I need this tool, pnpm gen-types-all, or both?", a: "Always pnpm gen-types-all, so the client's TypeScript stays honest. Add this tool on top only if the change is to the demo1 template schema and should also apply to tenants/BUs provisioned from now on — see the checklist in 'Generated TypeScript Types (pg-to-ts) & pnpm gen-types-all'." },
        ],
    },

    // ── Category 3: Server (Backend) ─────────────────────────────────────────

    {
        id: "dev-server-layout",
        category: "Server (Backend)",
        title: "FastAPI + GraphQL Layout",
        summary: "app/main.py, config, routers, and why main.py stays minimal.",
        tags: ["fastapi", "main.py", "config.py", "routers", "rest", "server layout"],
        content: [
            { type: "table", headers: ["File", "Role"], rows: [
                ["app/main.py", "App entrypoint — deliberately minimal per house rule, wires routers and the GraphQL app"],
                ["app/config.py", "pydantic-settings based env configuration"],
                ["app/logger.py", "Centralized logging setup — house rule: 'Implement robust logging using the logger module'"],
                ["app/scheduler.py", "APScheduler-based background jobs"],
                ["app/exceptions.py", "Custom exception types (e.g. AuthorizationException — used by auth_guards.py)"],
            ]},
            { type: "heading", text: "REST routers (app/routers/)" },
            { type: "table", headers: ["File", "Handles"], rows: [
                ["auth_router.py + auth_router_helper.py", "POST /api/auth/login, refresh token, password reset — the one place login actually happens"],
                ["base_router.py", "Shared/base route setup"],
                ["image_router.py", "Image upload/serving — the only router today that enforces auth via Depends(get_current_user)"],
            ]},
            { type: "note", text: "House rule: 'GraphQL for all secured/authenticated data calls. Otherwise use axios [REST] for api calls' on the client side, mirrored server-side as 'Routing: Use FastAPI Routers to handle REST endpoints. Keep main.py minimal.' Login itself is REST because it's the one call that happens before a JWT exists." },
        ],
        faqs: [
            { q: "Why is login REST instead of a GraphQL mutation?", a: "There's no JWT yet at that point in the flow — REST keeps the auth handshake outside the GraphQL context/auth-guard machinery entirely." },
            { q: "Where do I add a new authenticated REST endpoint?", a: "Follow image_router.py's pattern: a FastAPI Router with Depends(get_current_user) from app/core/dependencies.py. But default to GraphQL first — REST is the exception here, not the rule." },
        ],
    },

    {
        id: "dev-graphql-layer",
        category: "Server (Backend)",
        title: "GraphQL Layer (Ariadne)",
        summary: "schema.py's context_value, and the query/mutation/subscription resolver split.",
        tags: ["graphql", "ariadne", "schema.py", "context_value", "resolvers", "auth_guards"],
        content: [
            { type: "table", headers: ["File", "Role"], rows: [
                ["app/graphql/schema.py", "Builds the Ariadne GraphQL(...) app; get_graphql_context() reads Authorization, decodes the JWT, and injects user_id/user_type/role_code/access_rights/client_id/db_name into every resolver call"],
                ["app/graphql/resolvers/query.py + query_helper.py", "All Query-type resolvers, including genericQuery"],
                ["app/graphql/resolvers/mutation.py + mutation_helper.py", "All Mutation-type resolvers, including genericUpdate/genericUpdateScript, accountsPosting, seedSecurityData"],
                ["app/graphql/resolvers/subscription.py", "Subscription-type resolvers"],
                ["app/graphql/resolvers/auth_guards.py", "require_access_right(info, code) — the enforcement primitive, see Access Control & Security"],
                ["app/graphql/pubsub.py", "Pub/sub broker backing subscriptions"],
            ]},
            { type: "warning", text: "A missing or invalid token leaves context fields as None/[] rather than failing the request outright — context_value itself does not reject unauthenticated calls. Enforcement is opt-in per resolver via require_access_right(), not a blanket gate. See 'Known Gaps' for what this means in practice." },
        ],
        faqs: [
            { q: "If I add a new mutation, is it authenticated automatically?", a: "No. You must explicitly call require_access_right(info, CODE) inside the resolver (or rely on an existing allow-list like GENERIC_UPDATE_TABLE_RIGHTS) — nothing enforces this for you by default." },
            { q: "Where do I find the exact resolver-to-right mapping today?", a: "mutation.py's GENERIC_UPDATE_TABLE_RIGHTS allow-list, plus the single accountsPosting → JOBS_ACCOUNTS_POSTING call site — see 'Enforcement: Server Guard + Client Gating'." },
        ],
    },

    {
        id: "dev-db-access-layer",
        category: "Server (Backend)",
        title: "Database Access Layer",
        summary: "sql_store.py, pool_manager.py, and the seeding modules.",
        tags: ["sql_store.py", "pool_manager.py", "psycopg", "seeding", "cte pattern", "database access"],
        content: [
            { type: "table", headers: ["File", "Role"], rows: [
                ["app/db/sql_store.py", "Every SQL string in the app lives here — house rule: 'All SQL must live in a separate Python class file'"],
                ["app/db/sql_security.py, sql_bu.py", "Additional SQL groupings for the security schema and Business-Unit provisioning flows"],
                ["app/db/pool_manager.py", "Per-tenant-database connection pooling"],
                ["app/db/psycopg_driver.py", "Low-level psycopg execution helpers"],
                ["app/db/seed_security_data.py", "SeedSecurityData.SECURITY_SEED_SQL — role + access_right + role_access_right seed rows, ON CONFLICT DO NOTHING idempotent"],
                ["app/db/seed_bu_data.py", "Business-Unit-level seed data (Create Schema & Seed Data flow)"],
            ]},
            { type: "heading", text: "The house SQL style" },
            { type: "para", text: "Every parameterized query uses a CTE to bind parameters, with a commented-out test-value line directly above the real query for local debugging:" },
            { type: "steps", items: [
                'with "criteria" as (values(%(criteria)s::text))',
                "-- with \"criteria\" as (values('test_value'::text)) -- Test line",
                "SELECT id, name, is_active FROM client WHERE LOWER(\"name\") LIKE LOWER((table \"criteria\") || '%%') AND is_active = true ORDER BY name",
            ]},
            { type: "note", text: "Functions/classes/fields within every server file are kept sorted alphabetically per house convention — sql_store.py's queries are no exception." },
        ],
        faqs: [
            { q: "Can I write ad-hoc SQL inline in a resolver?", a: "No — the house rule is explicit: all SQL lives in sql_store.py (or sql_security.py/sql_bu.py for their respective areas). Resolvers reference a named query, they don't embed one." },
            { q: "Why the commented-out test-value CTE line?", a: "So a developer debugging a query can uncomment it, paste realistic values, and run the query standalone in a SQL client without reconstructing the parameter binding by hand." },
        ],
    },

    {
        id: "dev-core-utilities",
        category: "Server (Backend)",
        title: "Core Utilities & Services",
        summary: "JWT/security, dependencies, audit logging, email, and the file-server client.",
        tags: ["core", "security.py", "dependencies.py", "audit_log.py", "email.py", "file_client.py", "jwt"],
        content: [
            { type: "table", headers: ["File", "Role"], rows: [
                ["app/core/security.py", "JWT encode/decode, password hashing"],
                ["app/core/dependencies.py", "FastAPI Depends() providers, including get_current_user (used by image_router.py)"],
                ["app/core/audit_log.py", "Writes audit trail entries — surfaced in Admin Mode → Audit Logs (login/logout, user/BU management, provisioning events; day-to-day Client Mode CRUD is not audited)"],
                ["app/core/email.py", "Outbound email — password resets, credential mailing"],
                ["app/services/file_client.py", "HTTP client the API server uses to talk to the separate file-server microservice"],
            ]},
        ],
        faqs: [
            { q: "Does audit_log.py record Client Mode data changes (jobs, invoices)?", a: "No — per the end-user 'Audit Logs' article, only administrative/security actions are recorded (logins, user/BU management, provisioning). Ordinary Client Mode CRUD is not audited today." },
            { q: "How does the API server upload a file to the file-server?", a: "Via app/services/file_client.py, which makes HTTP calls to the file-server's own FastAPI endpoints (port 9000) — see 'System Overview' and 'Hosting Model & Nginx Configuration'." },
        ],
    },

    {
        id: "dev-server-conventions",
        category: "Server (Backend)",
        title: "Server Coding Conventions",
        summary: "The house rules from service-plus-server/claude.md, condensed.",
        tags: ["conventions", "claude.md", "coding standards", "server rules"],
        content: [
            { type: "table", headers: ["Rule", "Detail"], rows: [
                ["Centralized messaging", "All exception/application messages live in a single dedicated class file; use its properties, not inline strings"],
                ["SQL location", "All SQL lives in sql_store.py (or the sql_security.py/sql_bu.py siblings) — never inline in resolvers"],
                ["Routing", "FastAPI Routers for REST; GraphQL for all secured/authenticated calls; main.py stays minimal"],
                ["Alphabetical sorting", "Functions, classes, endpoints, and fields sorted alphabetically within every file"],
                ["Generic-first", "Prefer genericQuery/genericUpdate for insert/update/delete/get wherever it fits — see 'The Generic Query/Update Pattern'"],
                ["SQL parameter style", "CTE-bound parameters with a commented test-value line — see 'Database Access Layer'"],
                ["Logging", "Robust logging via app/logger.py, not ad-hoc print statements"],
            ]},
            { type: "note", text: "If the last word of an instruction given to the coding agent working in this repo is literally 'plan', the protocol is: don't alter code, write only a plan to plans/plan.md with sequential Step 1/Step 2/... and a Workflow section — this is a repo-specific convention documented in service-plus-server/claude.md itself, not a general rule." },
        ],
        faqs: [
            { q: "Where is the authoritative copy of these rules?", a: "dev/service-plus-server/claude.md — this article condenses it for quick reference, but the file itself is the source of truth and may have evolved since." },
            { q: "What's the Windows dev environment setup?", a: "Python virtual environment at c:\\projects\\service-plus\\env (Python 3.14.3); activate.bat or c:\\projects\\service-plus\\env\\Scripts\\activate.bat; run via run_server.bat or uvicorn app.main:app --reload." },
        ],
    },

    // ── Category 4: Client (Frontend) ────────────────────────────────────────

    {
        id: "dev-client-folder-structure",
        category: "Client (Frontend)",
        title: "Client Folder Structure",
        summary: "features/, components/, lib/, store/ — and the menu-hierarchy-mirrors-folders convention.",
        tags: ["folder structure", "features", "components", "shared", "convention"],
        content: [
            { type: "table", headers: ["Folder", "Contents"], rows: [
                ["src/features/{auth,client,admin,super-admin}/", "One folder per mode/domain, each with components/, pages/, store/, types/ as needed"],
                ["src/components/{ui,shared}/", "ui/ = shadcn primitives; shared/ = genuinely cross-feature components (e.g. the Help Panel, pdf-preview-modal.tsx)"],
                ["src/lib/", "apollo-client.ts, auth-service.ts, auth-storage.ts, graphql-utils.ts, gstin.ts, image-service.ts, string-utils.ts, utils.ts"],
                ["src/store/", "Redux Toolkit root store + shared slices (context-slice.ts)"],
                ["src/router/", "routes.ts (route table), protected-route.tsx (the gating component), index.tsx"],
                ["src/constants/", "messages.ts, sql-map.ts, graphql-map.ts — centralized string/key constants, see below"],
                ["src/types/", "Generated DB schema types — see 'Generated TypeScript Types'"],
            ]},
            { type: "heading", text: "The folder-mirrors-menu convention" },
            { type: "para", text: "Per house rule: for each top-level menu item, create a corresponding folder; for each submenu item, nest a folder inside it, maintaining the same hierarchy the sidebar/nav shows. This is why, e.g., Jobs → Receipts and Jobs → Opening Jobs each get their own folder under features/client/, rather than being siblings of unrelated features." },
        ],
        faqs: [
            { q: "Where does a component go if two features need it?", a: "src/components/shared/ — this is exactly the pattern followed when the Help Panel engine was generalized for both Client Mode and Super Admin (see Access Control & Security's sibling articles and this help system's own implementation)." },
            { q: "Is there an index.ts barrel file per feature?", a: "No — the house rule is explicit: never use index.ts for re-exporting, always use explicit named imports, intra-feature and cross-feature alike." },
        ],
    },

    {
        id: "dev-client-state-data-routing",
        category: "Client (Frontend)",
        title: "State, Data & Routing",
        summary: "Redux Toolkit, Apollo Client, and React Router — what's actually used vs. what the early notes explored.",
        tags: ["redux", "redux toolkit", "apollo client", "react router", "useAppDispatch", "useAppSelector"],
        content: [
            { type: "table", headers: ["Concern", "Library / pattern"], rows: [
                ["Global state", "Redux Toolkit — always via useAppDispatch/useAppSelector wrappers, never the raw useDispatch/useSelector hooks (hard rule)"],
                ["Feature slices", "auth-slice.ts, admin-slice.ts, super-admin-slice.ts, context-slice.ts"],
                ["GraphQL client", "Apollo Client (src/lib/apollo-client.ts), subscription-capable, attaches the JWT to every call via graphql-utils.ts"],
                ["Direct one-off queries", "apolloClient.query(...) directly — not the useApolloClient() hook (hard rule)"],
                ["Routing", "React Router (react-router-dom) — routes.ts + protected-route.tsx"],
            ]},
            { type: "warning", text: "notes/libs to use.md originally explored TanStack Router + TanStack Query as the data/routing layer. The codebase as actually built settled on React Router + Redux Toolkit + Apollo Client instead, per the authoritative dev/service-plus-client/claude.md. Treat the early notes file as historical exploration, not current architecture." },
            { type: "note", text: "Protected calls after login use GraphQL with an Authorization header; anything before login (or otherwise unauthenticated) uses axios directly, per house rule." },
        ],
        faqs: [
            { q: "Why useAppDispatch/useAppSelector instead of the raw hooks?", a: "They're pre-typed to this store's RootState/AppDispatch, avoiding repeated generic type annotations at every call site — a hard rule in dev/service-plus-client/claude.md." },
            { q: "Is TanStack Query used anywhere in the current codebase?", a: "Not per the authoritative claude.md conventions — verify with a grep before assuming it's present; the early notes exploring it predate the settled architecture." },
        ],
    },

    {
        id: "dev-client-forms-validation",
        category: "Client (Frontend)",
        title: "Forms & Validation",
        summary: "react-hook-form + Zod + fieldArray, and the red-color-means-error rule.",
        tags: ["forms", "react-hook-form", "zod", "fieldArray", "validation", "red color"],
        content: [
            { type: "bullets", items: [
                "Every form uses react-hook-form + Zod schemas + fieldArray for repeating rows (parts, charges, line items).",
                "Validation feedback is immediate — errors reflect as soon as validation runs, not only on submit.",
                "The submit button is disabled while the form is invalid; a failed validation never allows submission through.",
                "Zod schemas double as the single source of truth for form validation, GraphQL input validation, and client-side business rules (per notes/knowledgebase.md's 'Schema = Single Source of Truth' framing).",
            ]},
            { type: "warning", text: "Hard rule, no exceptions: red is reserved exclusively for errors and the '*' marking a mandatory field. Never use red for any other control CSS anywhere in the codebase." },
        ],
        faqs: [
            { q: "Where do I see fieldArray used for a real repeating-row form?", a: "Any multi-line entry screen — job finalization's Parts/Charges rows, purchase/sales invoice line items, stock adjustment lines — all use react-hook-form's fieldArray." },
            { q: "Can I use a different color for a 'this field needs attention' hint that isn't strictly an error?", a: "No — per the hard rule, red is error-only. Use amber/blue (note/warning treatment, matching the shared Help Panel's own note/warning block styling) for anything short of an actual validation error." },
        ],
    },

    {
        id: "dev-client-ui-conventions",
        category: "Client (Frontend)",
        title: "UI Conventions & Theming",
        summary: "shadcn/ui, Tailwind, the cn() helper, and the --cl-* theme token system.",
        tags: ["shadcn", "tailwind", "cn", "theme", "client-theme", "sp-help-theme", "dark mode"],
        content: [
            { type: "table", headers: ["Concern", "Tool"], rows: [
                ["Component library", "shadcn/ui + Tailwind CSS + lucide-react icons"],
                ["Notifications", "Sonner"],
                ["Transitions", "Framer Motion"],
                ["Conditional classNames", "cn() in lib/utils — twMerge(clsx(inputs)), smarter than plain clsx because later conflicting Tailwind classes win cleanly"],
            ]},
            { type: "heading", text: "Theme token scopes" },
            { type: "para", text: "Client Mode wraps its entire layout in a .client-theme class (src/index.css) defining --cl-bg, --cl-surface, --cl-text, --cl-border, --cl-hover, --cl-accent, etc., with a [data-theme=\"light\"] override for light mode (dark is the default declaration). Super Admin and Admin Mode currently use plain hardcoded Tailwind slate/white classes with no dark-mode variants." },
            { type: "note", text: "The shared Help Panel (src/components/shared/help/help-panel.tsx) is mounted in both places, so it carries its own independent .sp-help-theme scope (same --cl-* variable set, same values as .client-theme) rather than depending on an ambient theme wrapper that Super Admin doesn't have. This is why it renders identically inside Client Mode (nested inside .client-theme — redundant but harmless, same values) and correctly inside Super Admin (no .client-theme ancestor at all)." },
        ],
        faqs: [
            { q: "If I build a new Super Admin screen, do I get dark mode for free?", a: "No — Super Admin has no theme wrapper today. Either add one (mirroring .client-theme) or keep using the current hardcoded light styling, consistent with the rest of Super Admin." },
            { q: "Why not just reuse .client-theme for the shared Help Panel instead of adding .sp-help-theme?", a: "Because Super Admin has no ancestor element carrying .client-theme — reusing that class name without the wrapper it depends on would leave the CSS custom properties undefined. A self-contained scope avoids retrofitting theming onto all of Super Admin just to host one drawer." },
            { q: "What's the shadcn theming tool mentioned in the notes?", a: "tweakcn — noted in notes/knowledgebase.md as the preferred tool for building shadcn theme presets." },
        ],
    },

    {
        id: "dev-client-coding-conventions",
        category: "Client (Frontend)",
        title: "Client Coding Conventions",
        summary: "The house rules from service-plus-client/claude.md, condensed.",
        tags: ["conventions", "claude.md", "coding standards", "client rules", "messages.ts", "Type suffix"],
        content: [
            { type: "table", headers: ["Rule", "Detail"], rows: [
                ["Function style", "Arrow functions for components/hooks; normal functions for utilities, API helpers, and inline handlers"],
                ["Sorting", "Alphabetical: functions within a file, object/array properties, component props"],
                ["Types over interfaces", "Use type wherever possible; every type name ends in 'Type' (e.g. HelpArticleType-style naming, UserInstanceType, LoginResponseType)"],
                ["No index.ts re-exports", "Always explicit named imports, intra- and cross-feature"],
                ["Centralized messages", "Any text longer than two words goes in messages.ts, referenced by key; hardcoded control labels stay hardcoded"],
                ["Debounce default", "1200ms unless a specific case calls for otherwise"],
                ["Error handling", "Always handled properly — no silently swallowed failures"],
                ["Responsive design", "Always — no fixed-width layouts assumed"],
            ]},
            { type: "note", text: "This developer help system itself follows these conventions where applicable: types are re-exported via export type {...} from shared/help/help-types.ts (not an index.ts barrel), category style maps are alphabetically consistent with their end-user counterpart, and no new red control CSS was introduced." },
        ],
        faqs: [
            { q: "Where is the authoritative copy of these rules?", a: "dev/service-plus-client/claude.md — condensed here for quick reference; the file itself is the source of truth." },
            { q: "Does 'Type' suffix apply to the shared help types (ContentBlock, HelpArticle)?", a: "Not retroactively renamed as part of this feature (to avoid a large, unrelated rename across the existing end-user help content), but CategoryStyleType was named with the suffix when it was newly introduced during the shared-panel generalization — new types should follow the convention going forward." },
        ],
    },

    // ── Category 5: Access Control & Security ────────────────────────────────

    {
        id: "dev-rbac-data-model",
        category: "Access Control & Security",
        title: "RBAC Data Model & Login Flow",
        summary: "user → user_bu_role → role → role_access_right → access_right, and how login turns that into a JWT.",
        tags: ["rbac", "jwt", "login", "GET_USER_BY_IDENTITY", "token_claims", "access_rights"],
        content: [
            { type: "para", text: "The chain: security.user → user_bu_role → role → role_access_right → access_right. GET_USER_BY_IDENTITY in sql_store.py already aggregates a logging-in user's granular right codes across this whole chain into access_rights: string[] in one query." },
            { type: "heading", text: "Login flow" },
            { type: "steps", items: [
                "POST /api/auth/login → auth_router_helper.py::login_helper.",
                "Looks up the user via SqlStore.GET_USER_BY_IDENTITY, which returns role_code and the aggregated access_rights array.",
                "Issues a JWT with token_claims: sub, user_type, client_id, db_name, role_code, access_rights.",
                "Client stores the login response (roleCode, accessRights typed in src/lib/auth-service.ts) into Redux via auth-slice.ts, persisted through src/lib/auth-storage.ts.",
                "Every subsequent Apollo Client call attaches Authorization: Bearer <token> (apollo-client.ts).",
            ]},
            { type: "note", text: "The refresh-token path re-reads role_code/access_rights live from GET_USER_BY_ID_FOR_RESET rather than copying them from the old token — so a role change takes effect on the user's next token refresh, not only at their next full login." },
        ],
        faqs: [
            { q: "Does the JWT itself need to be re-decoded on every GraphQL call, or is it cached?", a: "Decoded fresh per request in get_graphql_context() (app/graphql/schema.py) — there's no server-side session cache for this." },
            { q: "What does a user with no user_bu_role rows see?", a: "They can authenticate (login succeeds) but access_rights comes back empty and role_code is unset — they'd see everything gated by a right as disabled. See the end-user 'Granting Access: Associate BU / Role' article for the UI side of fixing this." },
        ],
    },

    {
        id: "dev-rbac-seeding",
        category: "Access Control & Security",
        title: "Seeding Roles & Access Rights",
        summary: "seed_security_data.py, the seedSecurityData mutation, and the two-step Super Admin wizard.",
        tags: ["seeding", "seed_security_data.py", "seedSecurityData", "seed-roles-dialog", "idempotent"],
        content: [
            { type: "para", text: "Roles and access rights are seeded, not created through any UI form — matching the 'system-defined, not editable' philosophy in roles-page.tsx." },
            { type: "table", headers: ["Piece", "Detail"], rows: [
                ["seed_security_data.py", "ROLE_SEED_SQL (the 3 role rows) + ACCESS_RIGHT_SEED_SQL (6 access_right rows + role_access_right mapping), both ON CONFLICT DO NOTHING — fully idempotent, safe to re-run"],
                ["Automatic seeding", "Runs inline whenever a new client schema is created (Super Admin → Initialize Client)"],
                ["On-demand seeding", "The seedSecurityData GraphQL mutation, wired to Super Admin's seed-roles-dialog.tsx — a two-step wizard (Roles, then Access Rights), each step independently checked and idempotent"],
            ]},
            { type: "note", text: "This wizard is exactly the kind of Super Admin-only operational tool that belongs in this same Super Admin area as this help system — see plans/tran.md and the seed-wizard design in plans/plan.md for its own history." },
        ],
        faqs: [
            { q: "What happens if I run the seed a second time on an already-seeded tenant?", a: "Nothing changes — every INSERT uses ON CONFLICT DO NOTHING, so re-running is always safe." },
            { q: "Why does the wizard have two independently-checked steps instead of one 'Seed Everything' button?", a: "Because tenants provisioned before the access-right system existed already have role rows but not access_right/role_access_right rows — a single combined idempotency check would incorrectly report 'already done' for those tenants and never offer to backfill the missing half." },
        ],
    },

    {
        id: "dev-rbac-enforcement",
        category: "Access Control & Security",
        title: "Enforcement: Server Guard + Client Gating",
        summary: "require_access_right(), the six access-right codes, and the disabled+tooltip UX rule.",
        tags: ["require_access_right", "auth_guards", "access-rights.ts", "hasAccessRight", "disabled tooltip"],
        content: [
            { type: "heading", text: "The six seeded access-right codes" },
            { type: "table", headers: ["Code", "Gates"], rows: [
                ["JOBS_RECEIPTS", "Jobs → Receipts"],
                ["JOBS_OPENING_JOBS", "Jobs → Opening Jobs"],
                ["JOBS_ACCOUNTS_POSTING", "Jobs → Accounts Posting (in addition to the existing postDataToAccounts app-setting condition)"],
                ["MASTERS_MENU", "The whole Masters top-level tab"],
                ["CONFIG_MENU", "The whole Configurations top-level tab"],
                ["ADMIN_MENU", "Client Mode's Admin tab (Post/Unpost) — not the separate /admin/* Admin Mode"],
            ]},
            { type: "table", headers: ["Right", "MANAGER", "TECHNICIAN", "RECEPTIONIST"], rows: [
                ["JOBS_RECEIPTS", "✅", "❌", "✅"],
                ["JOBS_OPENING_JOBS", "✅", "❌", "✅"],
                ["JOBS_ACCOUNTS_POSTING", "✅", "❌", "✅"],
                ["MASTERS_MENU", "✅", "❌", "✅"],
                ["CONFIG_MENU", "✅", "❌", "❌"],
                ["ADMIN_MENU", "✅", "❌", "❌"],
            ]},
            { type: "note", text: "userType 'A' (Business Admin) and 'S' (Super Admin) bypass every restriction above unconditionally, everywhere — not a seeded row, a hardcoded bypass on both sides." },
            { type: "heading", text: "Server side" },
            { type: "para", text: "app/graphql/resolvers/auth_guards.py's require_access_right(info, code) raises AuthorizationException (the project's actual equivalent — there is no AppHttpException class in this codebase) when the caller's context lacks the right, bypassing for user_type in {'S','A'}." },
            { type: "heading", text: "Client side" },
            { type: "para", text: "src/features/auth/utils/access-rights.ts exports ACCESS_RIGHTS, hasAccessRight(user, code), and getRoleDisplayName(user, short) (short names Man/Tech/Rec for the space-constrained role badge)." },
            { type: "warning", text: "Universal UX rule: disabled + tooltip, never hide. Every gated menu/button always renders; when the current role lacks the right, it's visually disabled with an explanatory tooltip — this was a deliberate decision, not an oversight, so users always know a feature exists even if they can't currently use it." },
        ],
        faqs: [
            { q: "If a menu item is server-enforced, is the client-side disable/tooltip redundant?", a: "No — it's UX (immediate, no round-trip needed to know something is blocked). The server check is the actual security boundary; see 'Known Gaps' for where that server check doesn't exist yet despite the client-side disable being present." },
            { q: "Is there a hook like usePermission() somewhere?", a: "No dedicated hook — hasAccessRight(user, code) is called directly at each gated call site (layout/client-explorer-panel.tsx, layout/client-top-nav.tsx), not wrapped in a custom hook." },
        ],
    },

    {
        id: "dev-rbac-known-gaps",
        category: "Access Control & Security",
        title: "Known Gaps (Read Before Extending This Area)",
        summary: "genericUpdate's table-writer hole, and the two access rights with no server enforcement yet.",
        tags: ["known gaps", "security gap", "genericUpdate", "authorization hole", "blocker"],
        content: [
            { type: "warning", text: "This article exists so a developer touching Access Control doesn't assume more protection exists than actually does. Source: plans/plan-access-control.md's 'Gaps' and 'Step 10 blocker' sections — re-verify current state before relying on this, as this area is actively evolving." },
            { type: "heading", text: "Gap 1 — The generic table-writer hole" },
            { type: "para", text: "genericUpdate, genericUpdateScript, and genericQuery (see 'The Generic Query/Update Pattern') can, by construction, write to or read from almost any table by name. Only genericUpdate has any per-table check at all — a GENERIC_UPDATE_TABLE_RIGHTS allow-list covering the ~20 Masters/Configurations tables, gating them to MASTERS_MENU/CONFIG_MENU. genericUpdateScript and genericQuery have no per-table authorization at all today." },
            { type: "heading", text: "Gap 2 — JOBS_RECEIPTS and ADMIN_MENU: client-side disable only, no server enforcement" },
            { type: "para", text: "Receipts, Opening Jobs, and Post/Unpost all route through generic, shared resolvers (genericUpdate on tableName: \"job\", or the dedicated createJobPayment mutation) that are also used by explicitly unrestricted flows — Single Job, Batch Job, Final-a-Job all also write to job; createJobPayment is also called from inside the Deliver Job modal, which must stay open to every role. A tableName-only or mutation-only guard can't distinguish the restricted caller from the unrestricted one without either blocking something that should stay open, or leaving the restricted path ungated." },
            { type: "table", headers: ["Code", "Server enforcement status"], rows: [
                ["JOBS_ACCOUNTS_POSTING", "✅ Enforced — dedicated resolver, single call site"],
                ["MASTERS_MENU / CONFIG_MENU", "✅ Enforced — genericUpdate tableName allow-list"],
                ["JOBS_OPENING_JOBS", "⚠️ Potentially enforceable — is_opening_job: true already exists uniquely in that flow's xData, confirmed as a safe discriminator, but not yet wired into a guard"],
                ["JOBS_RECEIPTS", "❌ Not enforced — createJobPayment has no discriminator between the Receipts screen and the Deliver Job modal's receipt step"],
                ["ADMIN_MENU (Post/Unpost)", "❌ Not enforced — the only distinguishing signal is that its xData is exactly {id, is_posted} with no other keys, a payload-shape heuristic considered too fragile to rely on as-is"],
            ]},
            { type: "heading", text: "Options on the table (not yet decided)" },
            { type: "bullets", items: [
                "(a) Accept a payload-shape/field heuristic per case (safe for Opening Jobs via is_opening_job; not safe as-is for Receipts or Post/Unpost).",
                "(b) Have the client send an explicit discriminator field (e.g. area or rightCode) in the shared mutation's payload, so the server keys off an authoritative signal instead of guessing from shape.",
                "(c) Split the shared resolvers into distinct GraphQL fields per calling area — bigger change, touches client call sites too.",
            ]},
        ],
        faqs: [
            { q: "Is the app currently vulnerable because of these gaps?", a: "Authentication (a valid token) is still required for every GraphQL call once context_value enforcement is in place, per Step 8 of plan-access-control.md — the gap is specifically about fine-grained authorization (which right a given authenticated user needs), not about anonymous access." },
            { q: "If I need to add enforcement to Receipts or Post/Unpost, what should I do first?", a: "Read the full 'Step 10 blocker' section in plans/plan-access-control.md before writing code — this is a design decision (which of options a/b/c above), not a quick guard addition, and picking wrong risks either leaving a hole or blocking a role that must stay unrestricted." },
        ],
    },

    // ── Category 6: Multi-Tenancy & Provisioning ─────────────────────────────

    {
        id: "dev-client-lifecycle",
        category: "Multi-Tenancy & Provisioning",
        title: "Client Lifecycle (Super Admin)",
        summary: "Add Client → Initialize Client → Create Admin User → Activate, and the reverse path.",
        tags: ["client lifecycle", "add client", "initialize client", "activate", "deactivate", "delete client"],
        content: [
            { type: "steps", items: [
                "Add Client (add-client-dialog.tsx) — creates the public.client registry row: code, name, email, GSTIN, etc.",
                "Initialize Client (initialize-client-dialog.tsx, attach-db-dialog.tsx) — provisions the tenant's dedicated database, business + security schemas, and seeds roles/access rights.",
                "Create Admin User (create-admin-dialog.tsx) — the first Type A (Business Admin) login for that client.",
                "Mail credentials (mail-admin-credentials-dialog.tsx) — sends the new admin their login details.",
                "Activate (activate-client-dialog.tsx) — makes the client usable.",
            ]},
            { type: "heading", text: "Winding down" },
            { type: "bullets", items: [
                "Deactivate (deactivate-client-dialog.tsx) — blocks access without deleting data.",
                "Detach DB (detach-db-dialog.tsx) — disassociates a database from a client record without dropping it.",
                "Delete Client (delete-client-dialog.tsx) — removes the client record.",
                "Deactivate Admin / Edit Admin (deactivate-admin-dialog.tsx, edit-admin-dialog.tsx) — manage the Type A user itself.",
                "Orphaned Databases (orphan-databases-dialog.tsx) — maintenance tool for tenant databases with no matching client record.",
            ]},
            { type: "note", text: "All of the above live under src/features/super-admin/components/ — the same directory this help system's own trigger and content file live in." },
        ],
        faqs: [
            { q: "What's the minimum sequence to get a brand-new client usable end to end?", a: "Add Client → Initialize Client → Create Admin User → Activate. Skipping Initialize Client leaves the client with no database at all — nothing else will work." },
            { q: "Can a client be re-attached to a different database?", a: "Detach DB followed by Attach DB (attach-db-dialog.tsx) — used for edge cases like restoring a client onto a migrated or recovered database." },
        ],
    },

    {
        id: "dev-bu-lifecycle",
        category: "Multi-Tenancy & Provisioning",
        title: "Business Unit Lifecycle (Admin Mode)",
        summary: "Create Business Unit → Create Schema & Seed Data → Create Business User → Associate BU/Role → Activate.",
        tags: ["business unit lifecycle", "create business unit", "create schema", "business user", "associate bu role"],
        content: [
            { type: "steps", items: [
                "Create Business Unit (create-business-unit-dialog.tsx) — the company record; starts with schema Missing.",
                "Create Schema & Seed Data (create-bu-schema-dialog.tsx) — provisions the BU's dedicated schema inside the tenant database.",
                "Create Business User (create-business-user-dialog.tsx) — a login for this client company.",
                "Associate BU / Role (associate-bu-role-dialog.tsx) — the step that actually grants access: pick Business Unit(s) + exactly one Role.",
                "Mail credentials (mail-business-user-credentials-dialog.tsx) — send the new user their login.",
                "Activate Business Unit / Activate Business User (activate-business-unit-dialog.tsx, activate-business-user-dialog.tsx).",
            ]},
            { type: "note", text: "All of these live under src/features/admin/components/ — moved there from super-admin/ in a folder rename (see plan-access-control.md's Status section), since this is Business-Admin-scoped tooling (userType 'A'), distinct from the platform-level Super Admin tier." },
            { type: "para", text: "Full end-user-facing detail on this exact flow already exists in the Client Mode help center's Access Management category ('Business Units — Provisioning a Client Company', 'Granting Access: Associate BU / Role') — this article is the developer-facing index into the same flow, pointing at the actual component files." },
        ],
        faqs: [
            { q: "Why do Business Unit dialogs live in features/admin/ but Client dialogs live in features/super-admin/?", a: "They're scoped to different tiers — Admin Mode (userType 'A', one client company at a time) vs. the platform-level Super Admin tier (userType 'S', spans all clients). See 'Three Operating Modes & Routing'." },
            { q: "Is Business Unit deletion available from the UI?", a: "Yes, but only once Inactive — see delete-business-unit-dialog.tsx and the equivalent end-user article for the exact confirmation flow (typed-code confirmation required)." },
        ],
    },

    // ── Category 7: Deployment & Infrastructure ──────────────────────────────

    {
        id: "dev-hosting-model",
        category: "Deployment & Infrastructure",
        title: "Hosting Model & Nginx Configuration",
        summary: "One CloudJiffy container serves both the API and the built React app; file-server is separate.",
        tags: ["hosting", "cloudjiffy", "nginx", "reverse proxy", "websocket", "dist"],
        content: [
            { type: "para", text: "service-plus-server's container serves both the FastAPI API and the built React dist/ from the same nginx instance — the client isn't hosted separately in production. service-plus-file-server runs in its own separate container/port (9000)." },
            { type: "heading", text: "Nginx config (service-plus-server.conf)" },
            { type: "table", headers: ["Location", "Behavior"], rows: [
                ["/", "Serves the React dist/ static build; try_files $uri /index.html for client-side routing"],
                ["/health", "Proxies to FastAPI on 127.0.0.1:8000"],
                ["/api/", "Proxies REST calls to FastAPI"],
                ["/graphql/", "Proxies GraphQL, with Upgrade/Connection headers set — required for subscription WebSocket support"],
            ]},
            { type: "note", text: "nginx's default site and autostart are deliberately disabled (rm /etc/nginx/sites-enabled/default, systemctl disable nginx) — nginx is started manually from startup.sh instead, alongside uvicorn, so both processes come up together on container boot rather than nginx racing ahead with a stale default page." },
        ],
        faqs: [
            { q: "Why disable nginx autostart instead of just leaving it enabled?", a: "So the deploy process controls startup ordering explicitly via startup.sh (nginx first, then export APP_ENV, then uvicorn) rather than relying on systemd's own ordering, which could start nginx before the app code is even unzipped in a fresh container." },
            { q: "What breaks if the /graphql/ location is missing the Upgrade/Connection headers?", a: "GraphQL subscriptions (WebSocket-based) fail to connect — regular queries/mutations over plain HTTP still work fine, only real-time subscriptions are affected." },
        ],
    },

    {
        id: "dev-deploy-process",
        category: "Deployment & Infrastructure",
        title: "Deploy Process",
        summary: "startup.sh, the zip-upload-extract flow, and APP_ENV switching.",
        tags: ["deploy", "startup.sh", "deploy.sh", "extract", "APP_ENV"],
        content: [
            { type: "heading", text: "startup.sh (runs at container boot / CloudJiffy entrypoint)" },
            { type: "steps", items: [
                "sudo nginx & — start nginx in the background.",
                "export APP_ENV=production.",
                "cd into the deployed app folder and run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload.",
            ]},
            { type: "heading", text: "Manual/local-to-server deploy flow" },
            { type: "steps", items: [
                "Build the client (npm run build for the React app) and copy dist/ alongside the server code into a local 'final' folder.",
                "Zip it (final.zip) and run the local deploy.sh, or upload manually to /usr/share/nginx/html.",
                "On the server, an extract script at /usr/local/bin/extract (chmod +x once) unzips the upload in place.",
                "Restart the server process (or the whole container) to pick up the new code.",
            ]},
            { type: "note", text: "APP_ENV is read in code as env: str = os.getenv(\"APP_ENV\", \"dev\") — defaulting to dev locally, explicitly set to production by startup.sh in deployed environments. Anything in config.py that branches on environment should read this same variable, not invent a second one." },
        ],
        faqs: [
            { q: "Where does the file-server's deploy differ from the main server's?", a: "Same shape (zip, upload, startup.sh) but its startup.sh only runs uvicorn on port 9000 with --host 0.0.0.0 (not 127.0.0.1) so external callers — not just the same container — can reach it directly; it does not run its own nginx." },
            { q: "Why --host 0.0.0.0 for the file-server but 127.0.0.1 for the main server?", a: "The main server's uvicorn is only ever called by its own container's nginx (127.0.0.1 is sufficient); the file-server has no nginx in front of it in this setup, so it must bind externally to be reachable at all." },
        ],
    },

    {
        id: "dev-environments-secrets",
        category: "Deployment & Infrastructure",
        title: "Environments & Secrets",
        summary: "Windows/Kubuntu venv setup, samba sharing, and where connection secrets live.",
        tags: ["environments", "venv", "kubuntu", "windows", "samba", "secrets", "conn string"],
        content: [
            { type: "table", headers: ["Task", "How"], rows: [
                ["Windows venv", "python -m pip install virtualenv; python -m venv env; env\\Scripts\\activate"],
                ["Kubuntu venv", "sudo apt install python3-venv (or python3.14-venv for a specific version); python3 -m venv env; source env/bin/activate"],
                ["Cross-machine file sharing (Kubuntu ↔ Windows dev)", "Install Samba on Kubuntu, share the folder, connect from Windows Explorer via \\\\<kubuntu-ip>"],
            ]},
            { type: "heading", text: "Where secrets actually live" },
            { type: "para", text: "The most sensitive secret in this system is the per-tenant database connection string used for cross-system posting to Trace Plus — stored encrypted in division.account_setting.*.conn (JSONB, encrypted string), decrypted only server-side. See 'Division & Account Setting' and 'Accounts Posting (Trace Plus) — Implementation' for the full shape." },
        ],
        faqs: [
            { q: "Are API keys ever committed to the repo?", a: "Treat anything found in notes/*.md as a leaked development-time convenience, not a sanctioned secrets-management practice — production secrets should come from environment variables or a secrets manager, read via config.py's pydantic-settings, not hardcoded or note-file-stored." },
            { q: "How is the encrypted conn string in account_setting produced?", a: "Encrypted server-side before being written to the division row; the exact decrypt path is in the server's accountsPosting resolver — see 'Accounts Posting (Trace Plus) — Implementation'." },
        ],
    },

    // ── Category 8: Configuration ─────────────────────────────────────────────

    {
        id: "dev-app-settings-numbering",
        category: "Configuration",
        title: "App Settings & Document Numbering",
        summary: "The app_setting key-value table and document_sequence auto-numbering, from the schema side.",
        tags: ["app_setting", "document_sequence", "document_type", "numbering", "prefix"],
        content: [
            { type: "para", text: "App Settings (Configurations → App Settings in Client Mode) is backed by a simple key-value table, app_setting, in the business schema. Document numbering is backed by document_sequence + document_type." },
            { type: "table", headers: ["Setting key", "Controls"], rows: [
                ["default_gst_rate", "Fallback GST rate when a part has no specific rate"],
                ["default_hsn_for_spare_part / default_hsn_for_service_charge", "Fallback HSN codes"],
                ["no_of_job_sheets_per_print / no_of_job_invoices_per_print", "Print copy counts"],
                ["show_parts_in_job_invoice", "JSON controlling the merged-line invoice fallback label/HSN/GST"],
                ["markup_percent_over_cost", "Auto-markup for selling price = cost × (1 + markup%)"],
                ["post_data_to_accounts", "Feature-flags the whole Trace Plus integration (Jobs → Accounts Posting) — read client-side in layout/client-layout.tsx and dispatched into Redux at app load"],
            ]},
            { type: "heading", text: "document_sequence" },
            { type: "para", text: "Required sequences: JOB_SHEET, SERVICE_INVOICE, MONEY_RECEIPT, SALES_INVOICE — each with prefix/separator/padding/next-number columns. JOB_SHEET and PURCHASE_INVOICE numbering is branch-wide; SERVICE_INVOICE/MONEY_RECEIPT/SALES_INVOICE are configured per-division. A sequence with no prefix causes a runtime save failure — see 'Common Dev-Time Issues' and the end-user 'Document Sequences' article." },
        ],
        faqs: [
            { q: "Where does client-layout.tsx read app_setting from?", a: "A genericQuery call with sqlId: SQL_MAP.GET_APP_SETTINGS, dispatched into context-slice.ts's setDefaultGstRate/setMarkupPercentOverCost/etc. actions on every mount when dbName+schema are available. (File: layout/client-layout.tsx.)" },
            { q: "Is there server-side validation that a required document_sequence exists before allowing a job/invoice save?", a: "The failure mode described in notes/todo.md ('Document numbering and auto series') was originally a raw SQL execute failure with a generic client error — check current sql_store.py / resolver behavior for whether a friendlier pre-check has since been added." },
        ],
    },

    {
        id: "dev-division-account-setting",
        category: "Configuration",
        title: "Division & Account Setting",
        summary: "The division.account_setting JSONB shape that drives GST mode and Trace Plus posting.",
        tags: ["division", "account_setting", "jsonb", "gstin", "trace plus", "gst mode"],
        content: [
            { type: "para", text: "A division is GST if its GSTIN field is filled, non-GST if blank — this single field drives invoice tax-calculation mode throughout Client Mode." },
            { type: "para", text: "division carries an additional account_setting JSONB column, populated only when post_data_to_accounts is enabled, used exclusively for the Trace Plus accounting integration. Shape (from notes/todo.md's 'New field in division'):" },
            { type: "table", headers: ["Key", "Purpose"], rows: [
                ["clientCode, buCode, branchId", "Identify the target Trace Plus tenant/BU/branch to post into"],
                ["receipt.debitAccountId / creditAccountId", "Ledger account mapping for money-receipt postings"],
                ["purchaseInvoice.{debitAccountId,creditAccountId,productCode,defaultProductHsn,defaultGstRate}", "Mapping for purchase-invoice postings"],
                ["salesInvoice.{...same shape}", "Mapping for sales-invoice postings"],
                ["jobInvoice.{...same shape}", "Mapping for job-invoice postings"],
            ]},
            { type: "note", text: "The Configurations → Divisions form in Client Mode only shows this JSON entry form when post_data_to_accounts is true — it's otherwise hidden, not just disabled, since it's meaningless without the integration turned on." },
        ],
        faqs: [
            { q: "Is account_setting the same shape across every transaction type?", a: "Each of receipt/purchaseInvoice/salesInvoice/jobInvoice has its own sub-object; purchase/sales/job invoice sub-objects share the same {debitAccountId, creditAccountId, productCode, defaultProductHsn, defaultGstRate} shape, while receipt only needs debit/credit account IDs (no product/HSN/GST fields — receipts aren't taxable line items)." },
            { q: "Where is this JSON actually consumed?", a: "Server-side, in the accountsPosting mutation/resolver, which pulls clientCode/buCode/debitAccountId/creditAccountId etc. out of it to build the payload sent to Trace Plus — see 'Accounts Posting (Trace Plus) — Implementation'." },
        ],
    },

    // ── Category 9: Integrations ──────────────────────────────────────────────

    {
        id: "dev-accounts-posting-trace-plus",
        category: "Integrations",
        title: "Accounts Posting (Trace Plus) — Implementation",
        summary: "The cross-system design for posting receipts and invoices to the Trace Plus accounting system.",
        tags: ["trace plus", "accounts posting", "is_posted", "TranH", "TranD", "integration"],
        content: [
            { type: "para", text: "Trace Plus is a separate accounting system (its own FastAPI + GraphQL + Postgres server, repo at trace-plus/dev/trace-server) that Service+ posts financial documents into. The end-user-facing side of this is Jobs → Accounts Posting, documented in the Client Mode help center; this article is the implementation counterpart." },
            { type: "heading", text: "The is_posted pattern" },
            { type: "para", text: "job_payment, purchase_invoice, sales_invoice, and job_invoice each carry an is_posted flag. Posting sends unposted rows to Trace Plus and flips the flag on success. Once posted, a record is locked from edit/delete/regenerate in Client Mode until it's unposted again via Admin → Post/Unpost." },
            { type: "heading", text: "The accountsPosting mutation (both ends)" },
            { type: "steps", items: [
                "service-plus-server's accountsPosting: reads account_setting off the division (see 'Division & Account Setting'), fetches not-yet-posted records for the given document type, and maps them into Trace Plus's expected payload shape (TranH header with nested TranD lines, ExtGstTranD for GST detail, SalePurchaseDetails for product/quantity/price detail).",
                "Account ID substitution: each line's accId is replaced by debitAccountId or creditAccountId from account_setting, chosen by the line's dc ('D' or 'C') — the substitution direction differs slightly between money-receipt lines and purchase/sales/job-invoice lines, so check the exact dc→id mapping in mutation_helper.py rather than assuming it's symmetric.",
                "The connection string to Trace Plus's own per-client database (dbParams.conn) is an encrypted string, decrypted only server-side, never exposed to the client.",
                "trace-server's own accountPosting mutation receives clientCode/buCode/data, looks up the target database via its traceAuth registry, fills in the connection, and calls its internal validateDebitCreditAndUpdate mutation to actually post.",
            ]},
            { type: "note", text: "The client's role is narrow: Jobs → Accounts Posting shows unposted-record counts per division/document-type and a 'Post data to Trace Plus' button with a live progress bar (records processed, current division, % complete, failure count) — all the mapping and cross-system auth happens server-side." },
        ],
        faqs: [
            { q: "Does the client ever see the Trace Plus connection string?", a: "No — it stays encrypted in division.account_setting and is only decrypted inside the server's accountsPosting resolver, immediately before the cross-system call." },
            { q: "What happens to records that fail to post?", a: "They stay is_posted = false and are retried on the next posting run — the progress bar surfaces a failure count so an operator can investigate (commonly a missing GSTIN or an unmapped account/product code) before retrying." },
            { q: "Is authentication between service-plus-server and trace-server handled the same way as client-facing auth?", a: "It's a separate, server-to-server concern from the client-facing JWT flow — see the current accountsPosting resolver implementation for exactly how that handshake is authenticated today, as this is one of the areas flagged for 'best practices, no need to write detailed code' design-phase treatment in notes/todo.md and may have evolved since." },
        ],
    },

    // ── Category 10: Troubleshooting (Dev) ────────────────────────────────────

    {
        id: "dev-common-dev-issues",
        category: "Troubleshooting (Dev)",
        title: "Common Dev-Time Issues",
        summary: "Type regeneration, venv activation, resetting test data, and other everyday snags.",
        tags: ["troubleshooting", "dev issues", "pg-to-ts", "venv", "truncate", "docker", "samba"],
        content: [
            { type: "table", headers: ["Issue", "Fix"], rows: [
                ["Client TS types out of sync after a manual DB change", "Re-run pnpm gen-types-all; also re-run extract_schema.sh if the change should apply to future tenants too — see the checklist in 'Generated TypeScript Types (pg-to-ts) & pnpm gen-types-all'"],
                ["gen-types-all crashes with \"Cannot read properties of undefined (reading 'Smart')\"", "The pnpm patch routing pg-to-ts's formatting through prettier (instead of the TS7-incompatible typescript-formatter) was lost — check patches/pg-to-ts@4.1.1.patch and pnpm-workspace.yaml's patchedDependencies, then pnpm install — see 'Generated TypeScript Types (pg-to-ts) & pnpm gen-types-all'"],
                ["'command not found: python' on a fresh Kubuntu box", "Install the matching python3.X-venv package (e.g. python3.14-venv), then python3 -m venv env"],
                ["Need to reset a table's test data including identity sequence", "TRUNCATE spare_part_master RESTART IDENTITY CASCADE; (swap in the target table — CASCADE will also clear dependent rows, so double-check what's downstream first)"],
                ["Need a disposable local container to test something in isolation", "docker run -it --name fastapi -p 8080:80 debian:bookworm-20260316 bash — interactive TTY, named container, host:container port mapping"],
                ["Need to share a folder between a Kubuntu dev box and a Windows machine", "Install Samba on Kubuntu, share the folder, connect from Windows via \\\\<kubuntu-ip>, credentials are the Kubuntu user's own login"],
                ["'Job Sheet document sequence is not configured or has no prefix' while testing", "This is a data-setup issue, not a code bug — see the end-user 'Document Sequences' article; add a prefix via Configurations → Numbering / Auto Series in the test tenant"],
                ["Adding a new shadcn component triggers an eslint error", "Add rules: { 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } to eslint.config.js"],
            ]},
        ],
        faqs: [
            { q: "Where do I find the versioning convention for the client package?", a: "Standard semver via npm/pnpm version: patch for bug fixes, minor for new features (e.g. a new module), major for breaking changes (e.g. a DB schema change) — no extra tooling required." },
            { q: "What package manager does this repo use?", a: "pnpm, not npm — house rule. corepack enable pnpm if it's not already available, and use pnpm dlx in place of npx." },
        ],
    },
];

// ─── Category style map ────────────────────────────────────────────────────────

export const DEV_CAT_STYLE: Record<string, CategoryStyleType> = {
    "Architecture": {
        emoji:    "🏗️",
        gradient: "from-slate-600 to-indigo-700",
        pill:     "bg-slate-100 dark:bg-slate-800/60",
        pillText: "text-slate-700 dark:text-slate-300",
        stepBg:   "bg-slate-600",
        stepText: "text-white",
        border:   "border-slate-300 dark:border-slate-700",
    },
    "Database & Schema": {
        emoji:    "🗄️",
        gradient: "from-blue-600 to-cyan-600",
        pill:     "bg-blue-100 dark:bg-blue-900/40",
        pillText: "text-blue-700 dark:text-blue-300",
        stepBg:   "bg-blue-600",
        stepText: "text-white",
        border:   "border-blue-300 dark:border-blue-700",
    },
    "Server (Backend)": {
        emoji:    "⚙️",
        gradient: "from-emerald-600 to-green-700",
        pill:     "bg-emerald-100 dark:bg-emerald-900/40",
        pillText: "text-emerald-700 dark:text-emerald-300",
        stepBg:   "bg-emerald-600",
        stepText: "text-white",
        border:   "border-emerald-300 dark:border-emerald-700",
    },
    "Client (Frontend)": {
        emoji:    "💻",
        gradient: "from-violet-600 to-purple-700",
        pill:     "bg-violet-100 dark:bg-violet-900/40",
        pillText: "text-violet-700 dark:text-violet-300",
        stepBg:   "bg-violet-600",
        stepText: "text-white",
        border:   "border-violet-300 dark:border-violet-700",
    },
    "Access Control & Security": {
        emoji:    "🔐",
        gradient: "from-rose-600 to-pink-700",
        pill:     "bg-rose-100 dark:bg-rose-900/40",
        pillText: "text-rose-700 dark:text-rose-300",
        stepBg:   "bg-rose-600",
        stepText: "text-white",
        border:   "border-rose-300 dark:border-rose-700",
    },
    "Multi-Tenancy & Provisioning": {
        emoji:    "🏢",
        gradient: "from-amber-500 to-yellow-600",
        pill:     "bg-amber-100 dark:bg-amber-900/40",
        pillText: "text-amber-700 dark:text-amber-300",
        stepBg:   "bg-amber-500",
        stepText: "text-white",
        border:   "border-amber-300 dark:border-amber-700",
    },
    "Deployment & Infrastructure": {
        emoji:    "🚀",
        gradient: "from-orange-500 to-amber-600",
        pill:     "bg-orange-100 dark:bg-orange-900/40",
        pillText: "text-orange-700 dark:text-orange-300",
        stepBg:   "bg-orange-500",
        stepText: "text-white",
        border:   "border-orange-300 dark:border-orange-700",
    },
    "Configuration": {
        emoji:    "🛠️",
        gradient: "from-teal-600 to-cyan-700",
        pill:     "bg-teal-100 dark:bg-teal-900/40",
        pillText: "text-teal-700 dark:text-teal-300",
        stepBg:   "bg-teal-600",
        stepText: "text-white",
        border:   "border-teal-300 dark:border-teal-700",
    },
    "Integrations": {
        emoji:    "🔗",
        gradient: "from-fuchsia-600 to-pink-600",
        pill:     "bg-fuchsia-100 dark:bg-fuchsia-900/40",
        pillText: "text-fuchsia-700 dark:text-fuchsia-300",
        stepBg:   "bg-fuchsia-600",
        stepText: "text-white",
        border:   "border-fuchsia-300 dark:border-fuchsia-700",
    },
    "Troubleshooting (Dev)": {
        emoji:    "🧰",
        gradient: "from-stone-600 to-neutral-700",
        pill:     "bg-stone-100 dark:bg-stone-800/60",
        pillText: "text-stone-700 dark:text-stone-300",
        stepBg:   "bg-stone-600",
        stepText: "text-white",
        border:   "border-stone-300 dark:border-stone-700",
    },
};

// ─── Popular articles shown on the Help Center home view ──────────────────────

export const DEV_POPULAR_IDS = [
    "dev-system-overview",
    "dev-generic-query-update-pattern",
    "dev-db-topology",
    "dev-rbac-data-model",
    "dev-server-layout",
    "dev-client-folder-structure",
];

export const DEV_HELP_CATEGORIES = [
    "Architecture",
    "Database & Schema",
    "Server (Backend)",
    "Client (Frontend)",
    "Access Control & Security",
    "Multi-Tenancy & Provisioning",
    "Deployment & Infrastructure",
    "Configuration",
    "Integrations",
    "Troubleshooting (Dev)",
] as const;
