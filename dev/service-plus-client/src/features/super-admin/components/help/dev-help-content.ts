import type { CategoryStyleType, HelpArticle } from "@/components/shared/help/help-types";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { ShieldCheck } from "lucide-react";

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
			{
				type: "para",
				text: "Service+ is split across three independently deployed repos. Understanding the boundary between them is the first thing to internalize before touching any of them.",
			},
			{
				type: "table",
				headers: ["Repo", "Role", "Stack"],
				rows: [
					[
						"service-plus-client",
						"The React SPA — Client Mode, Admin Mode, Super Admin",
						"React + TypeScript (strict) + Vite + Tailwind + shadcn/ui",
					],
					[
						"service-plus-server",
						"The API — auth, GraphQL, REST, DB access, scheduling",
						"FastAPI + Ariadne GraphQL + psycopg + Pydantic",
					],
					[
						"service-plus-file-server",
						"Standalone microservice for file/image uploads",
						"FastAPI + Pillow, its own container/port (9000)",
					],
				],
			},
			{ type: "heading", text: "SaaS tenant tiers" },
			{
				type: "para",
				text: "Free tier: one Business Unit, capped at 1000 transactions. Pro tier: one Business Unit, unlimited transactions. Enterprise tier: up to 10 Business Units, unlimited transactions. See the Multi-Tenancy category for how a Business Unit is actually provisioned.",
			},
			{ type: "heading", text: "Request flow" },
			{
				type: "steps",
				items: [
					"Browser → Apollo Client (src/lib/apollo-client.ts) attaches Authorization: Bearer <token> to every GraphQL call.",
					"→ POST /graphql, handled by Ariadne's GraphQL app (app/graphql/schema.py).",
					"→ context_value / get_graphql_context() decodes the JWT and injects user_id, user_type, role_code, access_rights, client_id, db_name, bu_codes into every resolver call.",
					"→ Resolvers (app/graphql/resolvers/{query,mutation,subscription}.py) run business logic, calling SQL from app/db/sql_store.py.",
					"→ psycopg_driver.py / pool_manager.py execute against the correct tenant database (selected by db_name from the JWT).",
					"→ Response flows back through Apollo Client into Redux / component state.",
				],
			},
			{
				type: "note",
				text: "Non-GraphQL calls (login, image upload, health check) go through plain FastAPI routers instead (app/routers/*), per the house rule 'GraphQL for all secured/authenticated data calls, REST via FastAPI Routers otherwise.'",
			},
		],
		faqs: [
			{
				q: "Why three separate repos instead of one monorepo?",
				a: "Each is deployed independently to its own container (see Deployment & Infrastructure). The file-server in particular is intentionally decoupled so image/upload traffic doesn't compete with the API server.",
			},
			{
				q: "Where does a GraphQL request actually get authenticated?",
				a: "In app/graphql/schema.py's context_value / get_graphql_context(), which reads the Authorization header and decodes the JWT before any resolver runs. See 'RBAC Data Model & Login Flow' and 'Known Gaps' for what is and isn't actually enforced from there.",
			},
			{
				q: "How does the server know which tenant database to use?",
				a: "db_name is embedded in the JWT at login (see 'RBAC Data Model & Login Flow') and threaded through the GraphQL context. It's also now validated, not just threaded through — see 'Tenant & BU Enforcement' for require_own_tenant/require_bu_access, the guards that reject a genericQuery/genericUpdate call whose db_name/schema doesn't match the caller's own token.",
			},
		],
	},

	{
		id: "dev-generic-query-update-pattern",
		category: "Architecture",
		title: "The Generic Query/Update Pattern",
		summary: "Why almost every mutation in this codebase is genericUpdate, not a bespoke resolver.",
		tags: [
			"generic query",
			"generic update",
			"genericUpdate",
			"genericQuery",
			"xData",
			"fkeyName",
			"sqlObject",
			"pattern",
		],
		content: [
			{
				type: "para",
				text: "The dominant data-access idiom in this codebase, on both client and server, is three generic GraphQL operations rather than one bespoke mutation per table: genericQuery, genericUpdate, and genericUpdateScript.",
			},
			{ type: "heading", text: "Shape" },
			{
				type: "para",
				text: "A generic update call takes a tableName plus an xData payload. Nested child rows are expressed via fkeyName + xDetails, recursively — one call can insert/update/delete a parent row and all its child rows in a single round trip.",
			},
			{
				type: "table",
				headers: ["TS type", "Fields"],
				rows: [
					["SqlObject", "tableName?, fkeyName?, deletedIds?: (number|string)[], xData?: XData | XData[]"],
					["XData", "id?, isIdInsert?, xDetails?: SqlObject | SqlObject[], plus arbitrary column-name keys"],
				],
			},
			{
				type: "note",
				text: "These two types are the backbone of nearly every form-save in the client — see notes/knowledgebase.md for the original definition, reproduced here verbatim.",
			},
			{ type: "heading", text: "Why this exists" },
			{
				type: "bullets",
				items: [
					"One generic resolver replaces dozens of table-specific CRUD mutations — huge reduction in server boilerplate as the schema (53+ tables) grew.",
					"genericQuery additionally takes a sqlId referencing a named, parameterized query in sql_store.py — so reads stay centralized and reviewable even though they're dispatched generically.",
				],
			},
			{
				type: "warning",
				text: "The trade-off: genericUpdate/genericUpdateScript/genericQuery can, by construction, write to or read from almost any table by name, with no per-table authorization check by default. This is the single biggest authorization gap in the codebase today — see 'Known Gaps' in Access Control & Security before assuming a table is protected just because the app has a login screen.",
			},
		],
		faqs: [
			{
				q: "When should I add a bespoke resolver instead of using genericUpdate?",
				a: "When the operation needs server-side business logic beyond a straight column write (e.g. accountsPosting, seedSecurityData, createJobPayment) — genericUpdate is for direct table writes only.",
			},
			{
				q: "Where do I see a real example of nested xDetails?",
				a: "Any multi-line form save — e.g. a job with parts and charges, or a purchase invoice with line items — sends one genericUpdate call with the parent xData and child rows nested under xDetails.",
			},
			{
				q: "Is genericUpdate authorization-checked at all?",
				a: "Partially. mutation.py has a GENERIC_UPDATE_TABLE_RIGHTS allow-list covering the ~20 Masters/Configurations tables gated by MASTERS_MENU/CONFIG_MENU rights. Tables shared with unrestricted flows (job, job_payment, purchase_invoice, sales_invoice, job_invoice) are deliberately left unscoped — see 'Known Gaps'.",
			},
		],
	},

	{
		id: "dev-realtime-updates",
		category: "Architecture",
		title: "Real-Time Updates (GraphQL Subscriptions)",
		summary: "How pubsub.py and subscription.py deliver live updates to the client.",
		tags: ["subscriptions", "pubsub", "websocket", "realtime", "graphql"],
		content: [
			{
				type: "para",
				text: "Service+ uses GraphQL subscriptions over WebSockets for real-time updates, layered on top of Ariadne's subscription support.",
			},
			{
				type: "table",
				headers: ["Piece", "Location"],
				rows: [
					["Pub/sub broker", "app/graphql/pubsub.py"],
					["Subscription resolvers", "app/graphql/resolvers/subscription.py"],
					[
						"Nginx WebSocket upgrade",
						"location /graphql/ in the deployed nginx config — see Deployment & Infrastructure",
					],
				],
			},
			{
				type: "note",
				text: "The client's Apollo Client setup (src/lib/apollo-client.ts) is configured for subscription support per the house rule 'Use GraphQL with subscription support for authenticated query. Use apollo for GraphQL.'",
			},
		],
		faqs: [
			{
				q: "Do subscriptions go through the same auth context as queries/mutations?",
				a: "They go through the same Ariadne GraphQL app and context_value wiring described in 'GraphQL Layer' — verify current behavior in schema.py before assuming parity, since subscriptions are a separate transport (WebSocket) from queries/mutations.",
			},
			{
				q: "What breaks subscriptions in production if misconfigured?",
				a: "Missing the WebSocket upgrade headers (Upgrade/Connection) on the /graphql/ nginx location — see 'Hosting Model & Nginx Configuration'.",
			},
		],
	},

	{
		id: "dev-operating-modes",
		category: "Architecture",
		title: "Three Operating Modes & Routing",
		summary: "Client Mode, Admin Mode, and Super Admin — what gates each, and where the code lives.",
		tags: ["client mode", "admin mode", "super admin", "userType", "sessionMode", "protected route", "routing"],
		content: [
			{
				type: "table",
				headers: ["Mode", "userType", "Code location", "Purpose"],
				rows: [
					[
						"Client Mode",
						"A, B, or S (day-to-day ops for any authenticated user)",
						"src/features/client/",
						"Jobs, Inventory, Masters, Configurations, Reports — the operational app",
					],
					[
						"Admin Mode",
						"A only (Business Admin)",
						"src/features/admin/",
						"Business Units, Business Users, Roles CRUD for one client company",
					],
					[
						"Super Admin",
						"S only (platform operator)",
						"src/features/super-admin/",
						"Client onboarding, DB/schema provisioning, platform-level seeding — this help center lives here",
					],
				],
			},
			{ type: "heading", text: "How gating actually works" },
			{
				type: "para",
				text: "src/router/protected-route.tsx's ProtectedRoute component takes optional requiredUserType ('A' | 'B' | 'S') and requiredSessionMode ('admin' | 'client') props. If the current user's userType or sessionMode doesn't match, it redirects to ROUTES.home rather than rendering the route's Outlet — this is a client-side redirect only, not a security boundary by itself (the server must independently enforce anything sensitive, per Access Control & Security).",
			},
			{
				type: "note",
				text: 'Because Super Admin routes are gated by requiredUserType="S", any UI mounted only inside the Super Admin layout — including this developer help center — is reachable only by Super Admin users, with no additional gating code needed.',
			},
		],
		faqs: [
			{
				q: "Can a userType 'A' user reach Super Admin?",
				a: "No — ProtectedRoute checks userType strictly, and Super Admin routes require exactly 'S'.",
			},
			{
				q: "Is Admin Mode role-gated the way Client Mode is?",
				a: "No — per plan-access-control.md's Decision section, Admin Mode is explicitly out of scope for the granular access-right system. It's reachable only by userType 'A', who face no further restrictions there.",
			},
			{
				q: "Where's the switch between Client Mode and Admin Mode?",
				a: "The ShieldCheck icon at the bottom of the left-hand activity bar in Client Mode, visible only to userType 'A' users.",
			},
		],
	},

	// ── Category 2: Database & Schema ────────────────────────────────────────

	{
		id: "dev-db-topology",
		category: "Database & Schema",
		title: "Database Topology: Registry vs Tenant DBs",
		summary: "One registry database vs one database per tenant — how they relate.",
		tags: [
			"database",
			"topology",
			"registry",
			"tenant",
			"public.client",
			"multi-tenant",
			"demo1",
			"security schema",
		],
		content: [
			{
				type: "para",
				text: "There are two distinct kinds of Postgres database in this system — don't confuse them.",
			},
			{ type: "heading", text: "1. The registry database (service_plus_client)" },
			{
				type: "para",
				text: "A single platform-wide database whose schema is db/service_plus_client.sql. It holds exactly one table, public.client — the list of tenants: client_code, db_name, name, email, phone, gstin, is_active, plus unique constraints on code/db_name/email/name. This is what Super Admin's client list is reading from.",
			},
			{ type: "heading", text: "2. Per-tenant databases (pattern: service_plus_demo)" },
			{
				type: "para",
				text: "Each tenant gets its own dedicated Postgres database (schema pattern in db/service_plus_demo.sql), created when Super Admin runs 'Initialize Client'. Inside that one database live two Postgres schemas together:",
			},
			{
				type: "table",
				headers: ["Schema", "Contents"],
				rows: [
					[
						"demo1 (business schema)",
						"47 tables — jobs, inventory, purchase/sales, masters, configuration. Naming pattern 'demo1' is per-BU; see 'Multi-Tenancy & Business-Unit Provisioning'.",
					],
					[
						"security",
						"6 tables — user, bu, role, access_right, role_access_right, user_bu_role. The RBAC schema, see Access Control & Security.",
					],
				],
			},
			{
				type: "note",
				text: "public.client.db_name (registry DB) points at which per-tenant database to connect to for that client — this is the field carried in the JWT as db_name and threaded through every GraphQL call.",
			},
		],
		faqs: [
			{
				q: "Is there one Postgres database per Business Unit, or one per tenant with multiple schemas?",
				a: "One database per tenant (client). Multiple Business Units for an Enterprise-tier tenant are provisioned as additional schemas inside that same tenant database — see 'Multi-Tenancy & Business-Unit Provisioning'.",
			},
			{
				q: "Where do I find the actual DDL?",
				a: "db/service_plus_client.sql (registry) and db/service_plus_demo.sql (a representative tenant database dump, demo1 + security schemas).",
			},
			{
				q: "How does the server pick a connection for a given request?",
				a: "app/db/pool_manager.py manages per-database connection pools, selected by the db_name carried in the request's decoded JWT / GraphQL context.",
			},
		],
	},

	{
		id: "dev-business-schema-reference",
		category: "Database & Schema",
		title: "Business Schema Reference (demo1)",
		summary: "The 47-table catalog for jobs, inventory, purchase/sales, masters, and configuration.",
		tags: ["schema", "demo1", "tables", "job", "inventory", "stock", "purchase", "sales", "masters", "erd"],
		content: [
			{
				type: "para",
				text: "Every tenant's business schema (named per-BU, e.g. demo1) follows the same 47-table shape. Grouped by area:",
			},
			{ type: "heading", text: "Jobs" },
			{
				type: "table",
				headers: ["Table", "Purpose"],
				rows: [
					[
						"job",
						"The core job record — customer, device, division, technician, status, is_final, is_closed",
					],
					[
						"job_transaction",
						"Status-change history — one row per transition, drives the Job Transaction Ledger report",
					],
					[
						"job_status / job_type",
						"Lookup: RECEIVED/ASSIGNED/.../DELIVERED_OK etc.; UNDER_WARRANTY and other job types",
					],
					[
						"job_part_used",
						"Parts consumed on a job — cost_price/selling_price/gst_rate/hsn snapshot at time of use",
					],
					["job_additional_charge", "Non-parts service charges on a job (labour, diagnostic fee, etc.)"],
					["job_invoice / job_invoice_line", "The service invoice header and its line items"],
					["job_payment", "Money receipts against a job (independent of the Deliver Job flow)"],
					["job_image_doc", "Uploaded photos/documents attached to a job"],
					[
						"job_delivery_manner / job_receive_manner / job_receive_condition",
						"Lookups for how a device was received/delivered and its condition",
					],
				],
			},
			{ type: "heading", text: "Inventory" },
			{
				type: "table",
				headers: ["Table", "Purpose"],
				rows: [
					["spare_part_master", "The parts catalog — cost/selling price, HSN, GST rate, UOM"],
					["stock_balance", "Current quantity per part per branch"],
					[
						"stock_transaction / stock_transaction_type",
						"Every stock movement (Purchase, Consumption, Adjustment, Transfer, Loan, Opening) and its type lookup",
					],
					["stock_snapshot", "Point-in-time stock levels, for reporting"],
					["stock_adjustment / _line", "Manual quantity corrections"],
					["stock_branch_transfer / _line", "Inter-branch stock movement"],
					["stock_loan / _line", "Parts loaned out/returned (IN/OUT toggle on the same screen)"],
					["stock_opening_balance / _line", "Initial inventory at system setup"],
					[
						"stock_location_master / stock_location_change",
						"Warehouse bin/shelf assignment per part per branch",
					],
				],
			},
			{ type: "heading", text: "Purchase / Sales" },
			{
				type: "table",
				headers: ["Table", "Purpose"],
				rows: [
					["purchase_invoice / _line", "Supplier invoices — stock inward"],
					["sales_invoice / _line", "Direct counter sales of parts — stock outward"],
					["supplier", "Vendor master, unique system-wide (not branch-scoped)"],
				],
			},
			{ type: "heading", text: "Masters & Configuration" },
			{
				type: "table",
				headers: ["Table", "Purpose"],
				rows: [
					["customer_contact / customer_type", "Customer master and type lookup"],
					["technician", "Repair staff, branch-scoped, code unique per branch"],
					[
						"brand / product / product_brand_model",
						"The Brand → Product → Model hierarchy jobs are keyed to",
					],
					["additional_charge", "Service-charge master (Diagnostic Fee, Labour Charge, etc.)"],
					["state", "Indian states, for address/GST supply-state logic"],
					[
						"division",
						"Billing entity — GSTIN present ⇒ GST division; carries account_setting JSONB, see Configuration category",
					],
					[
						"document_sequence / document_type",
						"Auto-numbering config (JOB_SHEET, SERVICE_INVOICE, MONEY_RECEIPT, SALES_INVOICE)",
					],
					["financial_year", "Accounting periods, non-overlapping date ranges"],
					[
						"branch",
						"Physical service-center location; jobs/inventory/technicians/sequences are branch-scoped",
					],
					["app_setting", "Key-value system defaults — see Configuration category"],
					[
						"spare_part_web",
						"Branch-scoped, customer-facing parts listing (Masters → Spare Parts Web) — decoupled from spare_part_master/stock_balance entirely; part_id is a nullable optional link to spare_part_master, so market-sourced parts with no internal part code can be listed. Carries its own price, model, hsn_code, and an ordered text[] of file-server image paths (element 0 is the cover/thumbnail) rather than a child image table. See plans/plan-parts-web.md for the full design, including the public-site browsing/order flow this table also backs.",
					],
				],
			},
			{
				type: "note",
				text: "Key relationships: job → job_transaction → job_status; job → job_part_used → spare_part_master; job → job_invoice → job_invoice_line; purchase_invoice/sales_invoice → their _line tables; division carries the account_setting JSON used for Trace Plus posting (see Integrations); spare_part_web.part_id → spare_part_master.id is an optional, nullable link (not a required FK-driven join like job_part_used's).",
			},
		],
		faqs: [
			{
				q: "Why is the schema literally named 'demo1' in the reference dump?",
				a: "It's the schema name for that particular sample/demo tenant. Real tenants' Business-Unit schemas get their own generated names via Admin Mode → Business Units → Create Schema & Seed Data.",
			},
			{
				q: "Where do I get the authoritative, up-to-date column list for a table?",
				a: "The generated TypeScript types (src/types/db-schema-service.ts) or db/service_plus_demo.sql directly — this article is a map, not a substitute for the DDL.",
			},
			{
				q: "Are Vendors/Suppliers branch-scoped like Technicians?",
				a: "No — supplier names are unique system-wide and shared across all branches, unlike Technician (branch-scoped, code unique per branch).",
			},
		],
	},

	{
		id: "dev-security-schema-reference",
		category: "Database & Schema",
		title: "Security Schema Reference",
		summary: "The 6-table RBAC schema shared by every tenant database.",
		tags: ["security schema", "rbac", "user", "role", "access_right", "role_access_right", "user_bu_role", "bu"],
		content: [
			{
				type: "para",
				text: "Every tenant database also carries a security schema alongside its business schema — 6 tables implementing role-based access control.",
			},
			{
				type: "table",
				headers: ["Table", "Purpose"],
				rows: [
					["user", "username, email, password_hash, is_active, is_admin"],
					["bu", "Business Units this user community belongs to"],
					[
						"role",
						"code, name, is_system — the three seeded system roles: MANAGER, TECHNICIAN, RECEPTIONIST",
					],
					[
						"access_right",
						"code, name, module, description — 17 seeded granular permission codes as of the WhatsApp feature (JOBS_CUSTOMER_CONNECT, id=17, was the latest addition) — re-verify the exact count in seed_security_data.py before citing it, this number moves",
					],
					["role_access_right", "M:N join: which access_right codes each role grants"],
					["user_bu_role", "M:N join: which role a user holds on which bu, with an is_active flag"],
				],
			},
			{
				type: "para",
				text: "The chain that actually determines what a logged-in user can do: user → user_bu_role → role → role_access_right → access_right. See 'RBAC Data Model & Login Flow' in Access Control & Security for how this is queried and turned into JWT claims.",
			},
			{
				type: "note",
				text: "The schema supports a user having a different role on different Business Units (user_bu_role is per-BU), but the current UI (associate-bu-role-dialog.tsx) always assigns one role uniformly across every BU it associates — that per-BU distinction is unused today, not unsupported.",
			},
		],
		faqs: [
			{
				q: "Is there a permissions-editor UI to create custom roles or rights?",
				a: "No — roles and access rights are system-defined and seeded, matching src/features/admin/pages/roles-page.tsx's own stated philosophy ('Roles are system-defined and cannot be added, edited, or deleted'). See 'Seeding Roles & Access Rights'.",
			},
			{
				q: "Can one user see multiple client companies (Business Units)?",
				a: "Yes — user_bu_role supports multiple rows per user, one per BU, via Admin Mode's Associate BU / Role dialog.",
			},
		],
	},

	{
		id: "dev-generated-ts-types",
		category: "Database & Schema",
		title: "Generated TypeScript Types (pg-to-ts) & pnpm gen-types-all",
		summary:
			"How the three DB schemas become typed TypeScript, exactly what gen-types-all does, and the TS7 compatibility fix baked into the toolchain.",
		tags: [
			"pg-to-ts",
			"types",
			"codegen",
			"db-schema-service.ts",
			"db-schema-security.ts",
			"db-schema-client.ts",
			"gen-types-all",
			"gen-types-service",
			"gen-types-security",
			"gen-types-client",
			"prettier",
			"pnpm patch",
			"typescript-formatter",
			"typescript 7",
			"manual table change",
		],
		content: [
			{
				type: "para",
				text: "Rather than hand-maintaining TypeScript types for every table, the client generates them directly from Postgres using pg-to-ts. pnpm gen-types-all is the single command that keeps all three generated files honest against the real schema.",
			},
			{ type: "heading", text: "What each script generates" },
			{
				type: "table",
				headers: ["pnpm script", "Source DB / schema", "Output file", "Env var it reads"],
				rows: [
					[
						"gen-types-service",
						"SERVICE_PLUS_SERVICE connection, --schema demo1 (business schema)",
						"src/types/db-schema-service.ts",
						"SERVICE_PLUS_SERVICE",
					],
					[
						"gen-types-security",
						"SERVICE_PLUS_SERVICE connection, --schema security",
						"src/types/db-schema-security.ts",
						"SERVICE_PLUS_SERVICE",
					],
					[
						"gen-types-client",
						"SERVICE_PLUS_CLIENT connection, public schema (the registry DB)",
						"src/types/db-schema-client.ts",
						"SERVICE_PLUS_CLIENT",
					],
				],
			},
			{
				type: "note",
				text: "gen-types-service and gen-types-security both point at SERVICE_PLUS_SERVICE — same tenant database, two different schemas inside it (--schema demo1 vs --schema security), matching the two-schemas-per-tenant-database topology described in 'Database Topology: Registry vs Tenant DBs'. gen-types-client is the odd one out: it targets SERVICE_PLUS_CLIENT, the separate one-table registry database (public.client).",
			},
			{ type: "heading", text: "Running it" },
			{
				type: "steps",
				items: [
					"Set SERVICE_PLUS_SERVICE and SERVICE_PLUS_CLIENT in .env at the client repo root (postgresql://user:pwd@host:port/dbname) — read via dotenv-cli.",
					"pnpm gen-types-all — chains gen-types-service, then gen-types-security, then gen-types-client (package.json's gen-types-all script; a single pnpm run that fails fast if any step fails).",
					"Or run just one of the three (e.g. pnpm run gen-types-client) if only that schema actually changed.",
				],
			},
			{ type: "heading", text: "Why dotenv-cli + cross-var + cross-env, chained" },
			{
				type: "para",
				text: "Each script's real invocation is: dotenv -- cross-var cross-env PG_TO_TS_CONN=%SERVICE_PLUS_SERVICE% pg-to-ts generate .... dotenv-cli loads .env into the process; cross-var expands the %VAR% placeholder (Windows-style syntax, but works cross-platform via this tool); cross-env then sets PG_TO_TS_CONN for the pg-to-ts child process. This three-tool chain exists purely so the exact same command line works unmodified on both the Windows and Kubuntu dev setups documented in 'Environments & Secrets' — pg-to-ts itself only ever sees a plain PG_TO_TS_CONN env var, unaware of any of this.",
			},
			{ type: "heading", text: "Known fix baked into the toolchain: TypeScript 7 vs typescript-formatter" },
			{
				type: "warning",
				text: "This project runs typescript: ~7.0.2 — the new TypeScript rewrite, whose npm package no longer exports the classic compiler/Language Service API at all (require('typescript') resolves to just a version string; no ts.IndentStyle, no ts.createLanguageService, nothing). pg-to-ts@4.1.1 unconditionally pipes its generated output through typescript-formatter@7.2.2 (unmaintained since 2018) to pretty-print it, and that crashes immediately under TS 7 with TypeError: Cannot read properties of undefined (reading 'Smart') — it reaches for ts.IndentStyle.Smart, an API TS 7 simply doesn't ship.",
			},
			{
				type: "para",
				text: "Neither package has a fix upstream — pg-to-ts@4.1.1 and typescript-formatter@7.2.2 are both the latest/final published versions on npm. pnpm's overrides and packageExtensions were both tried, to try to give typescript-formatter a private older typescript peer without touching the project's root TS 7 — both were dead ends: pnpm's peer-dependency resolver kept silently re-resolving it back to the root TS 7 install regardless, even after pnpm dedupe and direct lockfile surgery to force re-resolution.",
			},
			{
				type: "para",
				text: "The fix that actually shipped: a pnpm patch (patches/pg-to-ts@4.1.1.patch, registered in pnpm-workspace.yaml's patchedDependencies) that replaces pg-to-ts's call to typescript-formatter with prettier.format(output, { parser: 'typescript' }) instead. prettier is already a project devDependency and has its own parser, entirely independent of TS 7's missing Language Service API. It's resolved at runtime via require(require.resolve('prettier', { paths: [process.cwd()] })) — reaching past pg-to-ts's own isolated pnpm node_modules into the consuming project's, since pg-to-ts has no direct dependency on prettier itself.",
			},
			{
				type: "note",
				text: "Don't try to 're-fix' a future gen-types-all crash by upgrading typescript-formatter or revisiting pnpm overrides — both were already dead-ended. If pg-to-ts crashes again with this same TypeError, check first whether pnpm install silently dropped or reset the patch: patches/pg-to-ts@4.1.1.patch should exist, and pnpm-workspace.yaml should still list pg-to-ts@4.1.1 under patchedDependencies.",
			},
			{ type: "heading", text: "When you manually change a database table" },
			{
				type: "para",
				text: "Whenever a table is altered directly with SQL (ALTER TABLE, a new column, a new table, a dropped column) rather than through app code, the generated client types and — if the change belongs to the demo1 template schema — the server-side provisioning DDL both need refreshing by hand. Nothing runs either of these automatically.",
			},
			{
				type: "table",
				headers: ["What changed", "Utility to run", "Why"],
				rows: [
					[
						"Any table in demo1 (business), security, or the registry public.client table, on an already-provisioned tenant",
						"pnpm gen-types-all (this repo)",
						"Regenerates src/types/db-schema-{service,security,client}.ts so the client's TypeScript types match the real columns — skip this and the compiler won't catch code written against stale column names/types.",
					],
					[
						"A table in the demo1 template schema that should also apply to brand-new tenants/BUs provisioned from now on",
						"extract_schema.sh / extract_schema.py (service-plus-server repo) — see 'Schema Extraction Tool'",
						"Regenerates sql_bu.py / sql_security.py, the DDL actually executed when Super Admin provisions a new client or Admin Mode provisions a new Business Unit. Skip this and new tenants get created with the old table shape even though existing tenants (and the client's TS types) already reflect the change.",
					],
				],
			},
			{
				type: "warning",
				text: "These two utilities serve different purposes and are easy to conflate. pnpm gen-types-all only updates what the client compiler knows about databases that already exist. extract_schema.sh only updates the template used to create new databases/schemas going forward. A manual ALTER TABLE on an already-provisioned tenant always needs the first; it needs the second only if the change should also apply to tenants provisioned from now on. Neither tool retroactively migrates existing tenants — that stays a separate, manual DDL step run per tenant.",
			},
		],
		faqs: [
			{
				q: "Why not just hand-write the types?",
				a: "53+ tables across two databases and three schemas — hand-maintenance would drift immediately. Regeneration keeps the client's type layer honest against the actual DDL.",
			},
			{
				q: "What do I do after adding a new column to a table?",
				a: "Update the DDL, then re-run pnpm gen-types-all before writing any client code that touches the new column. If the column belongs to the demo1 template and should exist on newly-provisioned tenants too, also refresh service_plus_service.sql and re-run extract_schema.sh — see 'Schema Extraction Tool'.",
			},
			{
				q: "gen-types-all is crashing with \"Cannot read properties of undefined (reading 'Smart')\" — what's wrong?",
				a: "The pnpm patch that routes formatting through prettier instead of the TS7-incompatible typescript-formatter has been lost or not applied. Confirm patches/pg-to-ts@4.1.1.patch exists and pnpm-workspace.yaml still lists it under patchedDependencies, then re-run pnpm install.",
			},
			{
				q: "Does gen-types-all touch the actual database?",
				a: "No — it only reads schema metadata (information_schema) to generate types; it never writes to any table.",
			},
		],
	},

	{
		id: "dev-multi-tenancy-concept",
		category: "Database & Schema",
		title: "Multi-Tenancy & Business-Unit Provisioning (Concept)",
		summary: "How a new client is onboarded end-to-end, and what 'provisioning' actually creates.",
		tags: ["multi-tenancy", "provisioning", "business unit", "initialize client", "create schema", "seed data"],
		content: [
			{
				type: "para",
				text: "Provisioning is the process that turns a registry-only client record into a usable, isolated tenant environment. It happens in two tiers.",
			},
			{ type: "heading", text: "Tier 1 — Tenant database (Super Admin)" },
			{
				type: "para",
				text: "Super Admin's 'Initialize Client' flow (initialize-client-dialog.tsx, attach-db-dialog.tsx) creates the tenant's dedicated Postgres database and both the demo1-pattern business schema and the security schema inside it, then seeds roles + access rights via seed_security_data.py. This is the step that takes a client from registry-only to actually usable.",
			},
			{ type: "heading", text: "Tier 2 — Business Unit schema (Admin Mode, Enterprise tier)" },
			{
				type: "para",
				text: "For tenants on the Enterprise tier (up to 10 Business Units), each additional BU is provisioned from Admin Mode → Business Units → 'Create Schema & Seed Data' (create-bu-schema-dialog.tsx) — this creates another business-schema-pattern set of tables inside the same tenant database, separate from the tenant's first/default BU schema.",
			},
			{
				type: "note",
				text: "Cleanup tooling exists for both tiers: Super Admin's 'Orphaned Databases' dialog (orphan-databases-dialog.tsx) and Admin Mode's 'Orphaned Schemas' dialog (orphan-bu-schemas-dialog.tsx) — for database/schemas left behind by incomplete or reverted provisioning.",
			},
		],
		faqs: [
			{
				q: "What's the practical difference between the two tiers of provisioning?",
				a: "Tier 1 (Super Admin) happens once per tenant/client and creates the database itself. Tier 2 (Admin Mode) happens per Business Unit within an already-provisioned tenant, for Enterprise customers who need more than one company's worth of data isolated inside their account.",
			},
			{
				q: "What happens if 'Create Schema & Seed Data' fails partway?",
				a: "If the schema was created but seeding failed, the row menu offers a narrower 'Add Seed Data' action to retry just the seed step without recreating the schema — see the end-user 'Business Units — Provisioning a Client Company' article for the exact UI flow.",
			},
		],
	},

	{
		id: "dev-extract-schema-tool",
		category: "Database & Schema",
		title: "Schema Extraction Tool: extract_schema.sh / extract_schema.py",
		summary:
			"Regenerates sql_security.py and sql_bu.py — the DDL used at runtime for service DB schema creation — from a pg_dump schema-only file.",
		tags: [
			"sql_bu",
			"sql_bu.py",
			"service db schema creation",
			"extract_schema.sh",
			"extract_schema.py",
			"pg_dump",
			"schema-only dump",
			"DDL generation",
			"demo1",
			"BU schema template",
			"SqlBu",
			"SqlSecurity",
			"Business Unit",
			"code generation",
		],
		content: [
			{
				type: "para",
				text: "app/db/sql_security.py and app/db/sql_bu.py look hand-maintained but are not — they're generated by app/db/tools/extract_schema.py from a pg_dump schema-only dump (app/db/service_plus_service.sql). Do not hand-edit either generated file; re-run the extractor instead.",
			},
			{
				type: "note",
				text: "Naming note: 'sql_bu' means Business Unit, not 'backup'. SqlBu.BU_SCHEMA_DDL is the DDL template for one Business Unit's schema — see 'Multi-Tenancy & Business-Unit Provisioning (Concept)' for where BU schemas fit in the provisioning flow.",
			},
			{ type: "heading", text: "How it works" },
			{
				type: "para",
				text: "The source file is a pg_dump --schema-only dump containing two Postgres schemas: a fixed security schema and one 'template' BU schema (default name: demo1) that stands in for 'a BU schema' in general. Every object in the dump is preceded by a 3-line marker comment: -- / -- Name: <object>; Type: <TABLE|SEQUENCE|CONSTRAINT|...>; Schema: <schema>; Owner: <owner> / --. The script scans for these markers to split the dump into blocks, then runs two passes over them:",
			},
			{
				type: "bullets",
				items: [
					"security schema — kept schema-qualified as-is → written to sql_security.py as SqlSecurity.SECURITY_SCHEMA_DDL.",
					"demo1 (or --bu-schema-name) template schema — the schema-qualifier prefix (e.g. 'demo1.') is stripped from every statement so the emitted DDL relies on Postgres search_path, matching the rest of the BU-schema tooling → written to sql_bu.py as SqlBu.BU_SCHEMA_DDL.",
				],
			},
			{
				type: "para",
				text: "Both passes drop SCHEMA and COMMENT object types (structurally meaningless) and strip trailing ALTER ... OWNER TO ...; lines (pg_dump ownership noise, irrelevant to schema structure).",
			},
			{ type: "heading", text: "Running it" },
			{
				type: "steps",
				items: [
					"If the live template/demo1 database has changed, first refresh the source dump: pg_dump --schema-only against that database, saved to app/db/service_plus_service.sql.",
					"From the service-plus-server repo root, run ./extract_schema.sh — a thin wrapper that sets LANG/LC_ALL to en_US.UTF-8, cd's into the repo root, and runs python3 -m app.db.tools.extract_schema with no arguments (so every flag below falls back to its default).",
					"Equivalently, call the module directly with explicit flags: python -m app.db.tools.extract_schema --source <path> --bu-schema-name <name> --out-dir <dir>.",
					"On success it prints e.g. 'Wrote app/db/sql_security.py (N lines)' and 'Wrote app/db/sql_bu.py (N lines)' — commit both regenerated files.",
				],
			},
			{
				type: "table",
				headers: ["Flag", "Default", "Meaning"],
				rows: [
					["--source", "app/db/service_plus_service.sql", "Path to the pg_dump schema-only source file."],
					["--bu-schema-name", "demo1", "Name of the schema in the dump to treat as the BU template."],
					["--out-dir", "app/db", "Directory to write sql_security.py / sql_bu.py into."],
				],
			},
			{
				type: "note",
				text: "Runtime usage: app/graphql/resolvers/mutation_helper.py executes SqlBu.BU_SCHEMA_DDL live (after CREATE SCHEMA IF NOT EXISTS <code>) to physically create and populate a new Business Unit's tables when a client provisions one — see 'Multi-Tenancy & Business-Unit Provisioning (Concept)'. SqlSecurity.SECURITY_SCHEMA_DDL is used analogously to provision the security schema.",
			},
			{
				type: "warning",
				text: "This is a manual step, not CI-triggered — re-run it by hand every time service_plus_service.sql changes, or sql_bu.py / sql_security.py will silently drift from the real DDL. Also note extract_schema.sh hardcodes an absolute cd path to the server repo root, so it must be run from (or adjusted for) that exact checkout location.",
			},
			{
				type: "note",
				text: "This is the server-side half of a manual table change. The client-side half — regenerating TypeScript types for existing tenants — is pnpm gen-types-all, a separate tool with a separate purpose; see the checklist in 'Generated TypeScript Types (pg-to-ts) & pnpm gen-types-all' for when you need one, the other, or both.",
			},
		],
		faqs: [
			{
				q: "Does 'sql_bu' mean database backup?",
				a: "No — it means Business Unit. sql_bu.py holds SqlBu.BU_SCHEMA_DDL, the DDL template used to create a new Business Unit's schema, not a backup file.",
			},
			{
				q: "Can I hand-edit sql_bu.py or sql_security.py directly?",
				a: "No — both carry an auto-generated header ('Do not hand-edit; re-run the extractor instead') and will be silently overwritten the next time extract_schema.sh runs. Change service_plus_service.sql (via a fresh pg_dump) and regenerate instead.",
			},
			{
				q: "Where does this fit into service DB schema creation overall?",
				a: "It's the offline step that keeps the Python DDL constants in sync with the real database. The online step — actually creating a schema for a new tenant/BU — is covered in 'Multi-Tenancy & Business-Unit Provisioning (Concept)', which consumes SqlBu.BU_SCHEMA_DDL / SqlSecurity.SECURITY_SCHEMA_DDL produced here.",
			},
			{
				q: "I manually altered a table — do I need this tool, pnpm gen-types-all, or both?",
				a: "Always pnpm gen-types-all, so the client's TypeScript stays honest. Add this tool on top only if the change is to the demo1 template schema and should also apply to tenants/BUs provisioned from now on — see the checklist in 'Generated TypeScript Types (pg-to-ts) & pnpm gen-types-all'.",
			},
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
			{
				type: "table",
				headers: ["File", "Role"],
				rows: [
					[
						"app/main.py",
						"App entrypoint — deliberately minimal per house rule, wires routers and the GraphQL app",
					],
					["app/config.py", "pydantic-settings based env configuration"],
					[
						"app/logger.py",
						"Centralized logging setup — house rule: 'Implement robust logging using the logger module'",
					],
					["app/scheduler.py", "APScheduler-based background jobs"],
					[
						"app/exceptions.py",
						"Custom exception types (e.g. AuthorizationException — used by auth_guards.py)",
					],
				],
			},
			{ type: "heading", text: "REST routers (app/routers/)" },
			{
				type: "table",
				headers: ["File", "Handles"],
				rows: [
					[
						"auth_router.py + auth_router_helper.py",
						"POST /api/auth/login, refresh token, password reset — the one place login actually happens",
					],
					["base_router.py", "Shared/base route setup"],
					["media/image_router.py", "Image upload/serving, auth via Depends(get_current_user)"],
				],
			},
			{
				type: "note",
				text: "House rule: 'GraphQL for all secured/authenticated data calls. Otherwise use axios [REST] for api calls' on the client side, mirrored server-side as 'Routing: Use FastAPI Routers to handle REST endpoints. Keep main.py minimal.' Login itself is REST because it's the one call that happens before a JWT exists; the image router is REST because its payload is binary/multipart, not because it's unauthenticated — both enforce the same Depends(get_current_user) as any GraphQL resolver calling require_access_right.",
			},
		],
		faqs: [
			{
				q: "Why is login REST instead of a GraphQL mutation?",
				a: "There's no JWT yet at that point in the flow — REST keeps the auth handshake outside the GraphQL context/auth-guard machinery entirely.",
			},
			{
				q: "Where do I add a new authenticated REST endpoint?",
				a: "Follow image_router.py's pattern: a FastAPI Router with Depends(get_current_user) from app/core/dependencies.py. But default to GraphQL first — REST is the exception here, reserved for binary/multipart payloads, not the rule.",
			},
		],
	},

	{
		id: "dev-graphql-layer",
		category: "Server (Backend)",
		title: "GraphQL Layer (Ariadne)",
		summary: "schema.py's context_value, and the query/mutation/subscription resolver split.",
		tags: ["graphql", "ariadne", "schema.py", "context_value", "resolvers", "auth_guards"],
		content: [
			{
				type: "table",
				headers: ["File", "Role"],
				rows: [
					[
						"app/graphql/schema.py",
						"Builds the Ariadne GraphQL(...) app; get_graphql_context() reads Authorization, decodes the JWT, and injects user_id/user_type/role_code/access_rights/client_id/db_name into every resolver call",
					],
					[
						"app/graphql/resolvers/query.py + query_helper.py",
						"All Query-type resolvers, including genericQuery",
					],
					[
						"app/graphql/resolvers/mutation.py + mutation_helper.py",
						"All Mutation-type resolvers, including genericUpdate/genericUpdateScript, accountsPosting, seedSecurityData",
					],
					["app/graphql/resolvers/subscription.py", "Subscription-type resolvers"],
					[
						"app/graphql/resolvers/auth_guards.py",
						"require_access_right(info, code) — the enforcement primitive, see Access Control & Security",
					],
					["app/graphql/pubsub.py", "Pub/sub broker backing subscriptions"],
				],
			},
			{
				type: "warning",
				text: "A missing or invalid token leaves context fields as None/[] rather than failing the request outright — context_value itself does not reject unauthenticated calls. Enforcement is opt-in per resolver via require_access_right(), not a blanket gate. See 'Known Gaps' for what this means in practice.",
			},
		],
		faqs: [
			{
				q: "If I add a new mutation, is it authenticated automatically?",
				a: "No. You must explicitly call require_access_right(info, CODE) inside the resolver (or rely on an existing allow-list like GENERIC_UPDATE_TABLE_RIGHTS) — nothing enforces this for you by default.",
			},
			{
				q: "Where do I find the exact resolver-to-right mapping today?",
				a: "mutation.py's GENERIC_UPDATE_TABLE_RIGHTS allow-list, plus the single accountsPosting → JOBS_ACCOUNTS_POSTING call site — see 'Enforcement: Server Guard + Client Gating'.",
			},
		],
	},

	{
		id: "dev-db-access-layer",
		category: "Server (Backend)",
		title: "Database Access Layer",
		summary: "sql_store.py, pool_manager.py, and the seeding modules.",
		tags: ["sql_store.py", "pool_manager.py", "psycopg", "seeding", "cte pattern", "database access"],
		content: [
			{
				type: "table",
				headers: ["File", "Role"],
				rows: [
					[
						"app/db/sql_store.py",
						"Every SQL string in the app lives here — house rule: 'All SQL must live in a separate Python class file'",
					],
					[
						"app/db/sql_security.py, sql_bu.py",
						"Additional SQL groupings for the security schema and Business-Unit provisioning flows",
					],
					["app/db/pool_manager.py", "Per-tenant-database connection pooling"],
					["app/db/psycopg_driver.py", "Low-level psycopg execution helpers"],
					[
						"app/db/seed_security_data.py",
						"SeedSecurityData.SECURITY_SEED_SQL — role + access_right + role_access_right seed rows, ON CONFLICT DO NOTHING idempotent",
					],
					["app/db/seed_bu_data.py", "Business-Unit-level seed data (Create Schema & Seed Data flow)"],
				],
			},
			{ type: "heading", text: "The house SQL style" },
			{
				type: "para",
				text: "Every parameterized query uses a CTE to bind parameters, with a commented-out test-value line directly above the real query for local debugging:",
			},
			{
				type: "steps",
				items: [
					'with "criteria" as (values(%(criteria)s::text))',
					"-- with \"criteria\" as (values('test_value'::text)) -- Test line",
					'SELECT id, name, is_active FROM client WHERE LOWER("name") LIKE LOWER((table "criteria") || \'%%\') AND is_active = true ORDER BY name',
				],
			},
			{
				type: "note",
				text: "Functions/classes/fields within every server file are kept sorted alphabetically per house convention — sql_store.py's queries are no exception.",
			},
		],
		faqs: [
			{
				q: "Can I write ad-hoc SQL inline in a resolver?",
				a: "No — the house rule is explicit: all SQL lives in sql_store.py (or sql_security.py/sql_bu.py for their respective areas). Resolvers reference a named query, they don't embed one.",
			},
			{
				q: "Why the commented-out test-value CTE line?",
				a: "So a developer debugging a query can uncomment it, paste realistic values, and run the query standalone in a SQL client without reconstructing the parameter binding by hand.",
			},
		],
	},

	{
		id: "dev-core-utilities",
		category: "Server (Backend)",
		title: "Core Utilities & Services",
		summary: "JWT/security, dependencies, audit logging, email, and the file-server client.",
		tags: ["core", "security.py", "dependencies.py", "audit_log.py", "email.py", "file_client.py", "jwt"],
		content: [
			{
				type: "table",
				headers: ["File", "Role"],
				rows: [
					["app/core/security.py", "JWT encode/decode, password hashing"],
					[
						"app/core/dependencies.py",
						"FastAPI Depends() providers, including get_current_user (used by image_router.py)",
					],
					[
						"app/core/audit_log.py",
						"Writes audit trail entries — surfaced in Admin Mode → Audit Logs (login/logout, user/BU management, provisioning events; day-to-day Client Mode CRUD is not audited)",
					],
					["app/core/email.py", "Outbound email — password resets, credential mailing"],
					[
						"app/services/file_client.py",
						"HTTP client the API server uses to talk to the separate file-server microservice",
					],
				],
			},
		],
		faqs: [
			{
				q: "Does audit_log.py record Client Mode data changes (jobs, invoices)?",
				a: "No — per the end-user 'Audit Logs' article, only administrative/security actions are recorded (logins, user/BU management, provisioning). Ordinary Client Mode CRUD is not audited today.",
			},
			{
				q: "How does the API server upload a file to the file-server?",
				a: "Via app/services/file_client.py, which makes HTTP calls to the file-server's own FastAPI endpoints (port 9000) — see 'System Overview' and 'Hosting Model & Nginx Configuration'.",
			},
		],
	},

	{
		id: "dev-server-conventions",
		category: "Server (Backend)",
		title: "Server Coding Conventions",
		summary: "The house rules from service-plus-server/claude.md, condensed.",
		tags: ["conventions", "claude.md", "coding standards", "server rules"],
		content: [
			{
				type: "table",
				headers: ["Rule", "Detail"],
				rows: [
					[
						"Centralized messaging",
						"All exception/application messages live in a single dedicated class file; use its properties, not inline strings",
					],
					[
						"SQL location",
						"All SQL lives in sql_store.py (or the sql_security.py/sql_bu.py siblings) — never inline in resolvers",
					],
					[
						"Routing",
						"FastAPI Routers for REST; GraphQL for all secured/authenticated calls; main.py stays minimal",
					],
					[
						"Alphabetical sorting",
						"Functions, classes, endpoints, and fields sorted alphabetically within every file",
					],
					[
						"Generic-first",
						"Prefer genericQuery/genericUpdate for insert/update/delete/get wherever it fits — see 'The Generic Query/Update Pattern'",
					],
					[
						"SQL parameter style",
						"CTE-bound parameters with a commented test-value line — see 'Database Access Layer'",
					],
					["Logging", "Robust logging via app/logger.py, not ad-hoc print statements"],
				],
			},
			{
				type: "note",
				text: "If the last word of an instruction given to the coding agent working in this repo is literally 'plan', the protocol is: don't alter code, write only a plan to plans/plan.md with sequential Step 1/Step 2/... and a Workflow section — this is a repo-specific convention documented in service-plus-server/claude.md itself, not a general rule.",
			},
		],
		faqs: [
			{
				q: "Where is the authoritative copy of these rules?",
				a: "dev/service-plus-server/claude.md — this article condenses it for quick reference, but the file itself is the source of truth and may have evolved since.",
			},
			{
				q: "What's the Windows dev environment setup?",
				a: "Python virtual environment at c:\\projects\\service-plus\\env (Python 3.14.3); activate.bat or c:\\projects\\service-plus\\env\\Scripts\\activate.bat; run via run_server.bat or uvicorn app.main:app --reload.",
			},
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
			{
				type: "table",
				headers: ["Folder", "Contents"],
				rows: [
					[
						"src/features/{auth,client,admin,super-admin}/",
						"One folder per mode/domain, each with components/, pages/, store/, types/ as needed",
					],
					[
						"src/components/{ui,shared}/",
						"ui/ = shadcn primitives; shared/ = genuinely cross-feature components (e.g. the Help Panel, pdf-preview-modal.tsx)",
					],
					[
						"src/lib/",
						"apollo-client.ts, auth-service.ts, auth-storage.ts, graphql-utils.ts, gstin.ts, image-service.ts, string-utils.ts, utils.ts",
					],
					["src/store/", "Redux Toolkit root store + shared slices (context-slice.ts)"],
					["src/router/", "routes.ts (route table), protected-route.tsx (the gating component), index.tsx"],
					[
						"src/constants/",
						"messages.ts, sql-map.ts, graphql-map.ts — centralized string/key constants, see below",
					],
					["src/types/", "Generated DB schema types — see 'Generated TypeScript Types'"],
				],
			},
			{ type: "heading", text: "The folder-mirrors-menu convention" },
			{
				type: "para",
				text: "Per house rule: for each top-level menu item, create a corresponding folder; for each submenu item, nest a folder inside it, maintaining the same hierarchy the sidebar/nav shows. This is why, e.g., Jobs → Receipts and Jobs → Opening Jobs each get their own folder under features/client/, rather than being siblings of unrelated features.",
			},
		],
		faqs: [
			{
				q: "Where does a component go if two features need it?",
				a: "src/components/shared/ — this is exactly the pattern followed when the Help Panel engine was generalized for both Client Mode and Super Admin (see Access Control & Security's sibling articles and this help system's own implementation).",
			},
			{
				q: "Is there an index.ts barrel file per feature?",
				a: "No — the house rule is explicit: never use index.ts for re-exporting, always use explicit named imports, intra-feature and cross-feature alike.",
			},
		],
	},

	{
		id: "dev-client-state-data-routing",
		category: "Client (Frontend)",
		title: "State, Data & Routing",
		summary:
			"Redux Toolkit, Apollo Client, and React Router — what's actually used vs. what the early notes explored.",
		tags: ["redux", "redux toolkit", "apollo client", "react router", "useAppDispatch", "useAppSelector"],
		content: [
			{
				type: "table",
				headers: ["Concern", "Library / pattern"],
				rows: [
					[
						"Global state",
						"Redux Toolkit — always via useAppDispatch/useAppSelector wrappers, never the raw useDispatch/useSelector hooks (hard rule)",
					],
					["Feature slices", "auth-slice.ts, admin-slice.ts, super-admin-slice.ts, context-slice.ts"],
					[
						"GraphQL client",
						"Apollo Client (src/lib/apollo-client.ts), subscription-capable, attaches the JWT to every call via graphql-utils.ts",
					],
					[
						"Direct one-off queries",
						"apolloClient.query(...) directly — not the useApolloClient() hook (hard rule)",
					],
					["Routing", "React Router (react-router-dom) — routes.ts + protected-route.tsx"],
				],
			},
			{
				type: "warning",
				text: "notes/libs to use.md originally explored TanStack Router + TanStack Query as the data/routing layer. The codebase as actually built settled on React Router + Redux Toolkit + Apollo Client instead, per the authoritative dev/service-plus-client/claude.md. Treat the early notes file as historical exploration, not current architecture.",
			},
			{
				type: "note",
				text: "Protected calls after login use GraphQL with an Authorization header; anything before login (or otherwise unauthenticated) uses axios directly, per house rule.",
			},
		],
		faqs: [
			{
				q: "Why useAppDispatch/useAppSelector instead of the raw hooks?",
				a: "They're pre-typed to this store's RootState/AppDispatch, avoiding repeated generic type annotations at every call site — a hard rule in dev/service-plus-client/claude.md.",
			},
			{
				q: "Is TanStack Query used anywhere in the current codebase?",
				a: "Not per the authoritative claude.md conventions — verify with a grep before assuming it's present; the early notes exploring it predate the settled architecture.",
			},
		],
	},

	{
		id: "dev-client-forms-validation",
		category: "Client (Frontend)",
		title: "Forms & Validation",
		summary: "react-hook-form + Zod + fieldArray, and the red-color-means-error rule.",
		tags: ["forms", "react-hook-form", "zod", "fieldArray", "validation", "red color"],
		content: [
			{
				type: "bullets",
				items: [
					"Every form uses react-hook-form + Zod schemas + fieldArray for repeating rows (parts, charges, line items).",
					"Validation feedback is immediate — errors reflect as soon as validation runs, not only on submit.",
					"The submit button is disabled while the form is invalid; a failed validation never allows submission through.",
					"Zod schemas double as the single source of truth for form validation, GraphQL input validation, and client-side business rules (per notes/knowledgebase.md's 'Schema = Single Source of Truth' framing).",
				],
			},
			{
				type: "warning",
				text: "Hard rule, no exceptions: red is reserved exclusively for errors and the '*' marking a mandatory field. Never use red for any other control CSS anywhere in the codebase.",
			},
		],
		faqs: [
			{
				q: "Where do I see fieldArray used for a real repeating-row form?",
				a: "Any multi-line entry screen — job finalization's Parts/Charges rows, purchase/sales invoice line items, stock adjustment lines — all use react-hook-form's fieldArray.",
			},
			{
				q: "Can I use a different color for a 'this field needs attention' hint that isn't strictly an error?",
				a: "No — per the hard rule, red is error-only. Use amber/blue (note/warning treatment, matching the shared Help Panel's own note/warning block styling) for anything short of an actual validation error.",
			},
		],
	},

	{
		id: "dev-client-ui-conventions",
		category: "Client (Frontend)",
		title: "UI Conventions & Theming",
		summary: "shadcn/ui, Tailwind, the cn() helper, and the --cl-* theme token system.",
		tags: [
			"shadcn",
			"tailwind",
			"cn",
			"theme",
			"client-theme",
			"sp-help-theme",
			"dark mode",
			"portal container",
			"usePortalContainer",
			"radix portal",
		],
		content: [
			{
				type: "table",
				headers: ["Concern", "Tool"],
				rows: [
					["Component library", "shadcn/ui + Tailwind CSS + lucide-react icons"],
					["Notifications", "Sonner"],
					["Transitions", "Framer Motion"],
					[
						"Conditional classNames",
						"cn() in lib/utils — twMerge(clsx(inputs)), smarter than plain clsx because later conflicting Tailwind classes win cleanly",
					],
				],
			},
			{ type: "heading", text: "Theme token scopes" },
			{
				type: "para",
				text: 'Client Mode wraps its entire layout in a .client-theme class (src/index.css) defining --cl-bg, --cl-surface, --cl-text, --cl-border, --cl-hover, --cl-accent, etc., with a [data-theme="light"] override for light mode (dark is the default declaration). Super Admin and Admin Mode currently use plain hardcoded Tailwind slate/white classes with no dark-mode variants.',
			},
			{
				type: "note",
				text: "The shared Help Panel (src/components/shared/help/help-panel.tsx) is mounted in both places, so it carries its own independent .sp-help-theme scope (same --cl-* variable set, same values as .client-theme) rather than depending on an ambient theme wrapper that Super Admin doesn't have. This is why it renders identically inside Client Mode (nested inside .client-theme — redundant but harmless, same values) and correctly inside Super Admin (no .client-theme ancestor at all).",
			},
			{ type: "heading", text: "Radix portals vs. .client-theme: PortalContainerContext" },
			{
				type: "warning",
				text: "Radix primitives (Dialog, AlertDialog, Popover, Select, DropdownMenu) render their content into a portal appended to document.body by default — outside the .client-theme div entirely. Any --cl-* custom property referenced inside that portaled content resolves to nothing, since the CSS variable is only defined on .client-theme's own subtree. This showed up as blank/unstyled dialogs and popovers in Client Mode.",
			},
			{
				type: "para",
				text: "Fix: client-layout.tsx defines PortalContainerContext (a React context holding the .client-theme DOM node) and exports usePortalContainer(). client-layout.tsx sets it via ref={setThemeRoot} on the .client-theme div and wraps its returned JSX in <PortalContainerContext.Provider value={themeRoot}>. Every portal-based ui/ primitive (dialog.tsx, alert-dialog.tsx, popover.tsx, select.tsx, dropdown-menu.tsx) now reads container={usePortalContainer() ?? undefined} and passes it to its underlying Radix Portal — inside .client-theme, content portals into that div (tokens resolve); outside it (Super Admin, Admin Mode), the hook returns null and Radix falls back to its own document.body default.",
			},
			{
				type: "note",
				text: "usePortalContainer() safely returns null when called outside a PortalContainerContext.Provider (default context value), so ui/ primitives work unmodified in Super Admin/Admin Mode — no separate code path needed there.",
			},
			{ type: "heading", text: "Global chrome (src/index.css)" },
			{
				type: "para",
				text: "index.css scopes a set of micro-details to both .client-theme and .sp-help-theme: caret-color: var(--cl-accent) on inputs/textareas/selects, an accent-tinted ::selection (color-mix 35%), and thin custom scrollbars (8px, rounded thumb via color-mix of --cl-text, plus scrollbar-width: thin). The self-contained .sp-help-theme scope carries the same rules so the help drawer looks right inside Super Admin too.",
			},
			{
				type: "para",
				text: ".client-theme also layers a radial ambient glow onto its own background-image (color-mix of --cl-accent at 7%, fading by 55%) — it lives on the element's own paint layer, so it can never sit above or obscure content. The status bar gets its gradient from the .client-theme .status-bar-accent class (linear-gradient from --cl-accent toward a white-mixed tone) rather than a hardcoded hex.",
			},
			{ type: "heading", text: "Radius, shadow & overlay vocabulary (2026 visual refresh)" },
			{
				type: "para",
				text: "Controls: inputs and textareas are rounded-lg; buttons and selects are rounded-lg; dialog/alert-dialog content is rounded-2xl (footers must use rounded-b-2xl to match); KPI/chart/toolbar cards are rounded-xl; badges stay rounded-4xl pills. Elevation: dialogs and alert-dialogs carry shadow-[0_2px_24px_-12px_rgba(0,0,0,0.35)]; KPI/chart/toolbar cards use shadow-[0_1px_3px_rgba(0,0,0,0.08)]; popovers/selects/dropdowns use shadow-lg. Overlay scrims (Dialog, AlertDialog) are bg-black/25 backdrop-blur-sm — not bg-black/10 backdrop-blur-xs — and the clickable KpiCard lifts on hover (-translate-y-0.5 + hover:shadow-lg).",
			},
		],
		faqs: [
			{
				q: "If I build a new Super Admin screen, do I get dark mode for free?",
				a: "No — Super Admin has no theme wrapper today. Either add one (mirroring .client-theme) or keep using the current hardcoded light styling, consistent with the rest of Super Admin.",
			},
			{
				q: "Why not just reuse .client-theme for the shared Help Panel instead of adding .sp-help-theme?",
				a: "Because Super Admin has no ancestor element carrying .client-theme — reusing that class name without the wrapper it depends on would leave the CSS custom properties undefined. A self-contained scope avoids retrofitting theming onto all of Super Admin just to host one drawer.",
			},
			{
				q: "What's the shadcn theming tool mentioned in the notes?",
				a: "tweakcn — noted in notes/knowledgebase.md as the preferred tool for building shadcn theme presets.",
			},
			{
				q: "A dialog/popover I added inside Client Mode renders unstyled or blank — why?",
				a: "Almost certainly a Radix portal escaping .client-theme. Confirm the component is one of dialog/alert-dialog/popover/select/dropdown-menu from src/components/ui/, and that it's passing container={usePortalContainer() ?? undefined} through to its Portal — see 'Radix portals vs. .client-theme: PortalContainerContext' above.",
			},
			{
				q: "Do I need usePortalContainer() in a brand-new Radix-based primitive I'm adding to ui/?",
				a: "Yes, if it portals (most Radix primitives do) and might be used inside Client Mode. Follow the existing pattern in dialog.tsx or popover.tsx rather than inventing a new one.",
			},
		],
	},

	{
		id: "dev-client-coding-conventions",
		category: "Client (Frontend)",
		title: "Client Coding Conventions",
		summary: "The house rules from service-plus-client/claude.md, condensed.",
		tags: ["conventions", "claude.md", "coding standards", "client rules", "messages.ts", "Type suffix"],
		content: [
			{
				type: "table",
				headers: ["Rule", "Detail"],
				rows: [
					[
						"Function style",
						"Arrow functions for components/hooks; normal functions for utilities, API helpers, and inline handlers",
					],
					["Sorting", "Alphabetical: functions within a file, object/array properties, component props"],
					[
						"Types over interfaces",
						"Use type wherever possible; every type name ends in 'Type' (e.g. HelpArticleType-style naming, UserInstanceType, LoginResponseType)",
					],
					["No index.ts re-exports", "Always explicit named imports, intra- and cross-feature"],
					[
						"Centralized messages",
						"Any text longer than two words goes in messages.ts, referenced by key; hardcoded control labels stay hardcoded",
					],
					["Debounce default", "1200ms unless a specific case calls for otherwise"],
					["Error handling", "Always handled properly — no silently swallowed failures"],
					["Responsive design", "Always — no fixed-width layouts assumed"],
				],
			},
			{
				type: "note",
				text: "This developer help system itself follows these conventions where applicable: types are re-exported via export type {...} from shared/help/help-types.ts (not an index.ts barrel), category style maps are alphabetically consistent with their end-user counterpart, and no new red control CSS was introduced.",
			},
		],
		faqs: [
			{
				q: "Where is the authoritative copy of these rules?",
				a: "dev/service-plus-client/claude.md — condensed here for quick reference; the file itself is the source of truth.",
			},
			{
				q: "Does 'Type' suffix apply to the shared help types (ContentBlock, HelpArticle)?",
				a: "Not retroactively renamed as part of this feature (to avoid a large, unrelated rename across the existing end-user help content), but CategoryStyleType was named with the suffix when it was newly introduced during the shared-panel generalization — new types should follow the convention going forward.",
			},
		],
	},

	{
		id: "dev-report-drilldown-pattern",
		category: "Client (Frontend)",
		title: "Shared Report Components: ReportTable, DialogContent Widths, and the Drill-Down Pattern",
		summary:
			"The sm:max-w-* tailwind-merge gotcha, ReportTable's single-scroll-container shape, and the reusable click-a-cell-to-drill-down dialog convention.",
		tags: [
			"reports",
			"report-table",
			"ReportTable",
			"drill down",
			"drilldown",
			"DialogContent",
			"sm:max-w",
			"tailwind-merge",
			"CategoryRangeCellDialog",
			"EventTrackingCellDialog",
			"invisible",
			"KpiCard",
			"emptyAlertOpen",
			"handleCardClick",
			"dashboard-section",
			"OpenJobsByProductDialog",
			"GET_DASHBOARD_OPEN_JOBS_LIST",
			"nestedDialogOpen",
			"onDrillDown",
		],
		content: [
			{ type: "heading", text: "The DialogContent sm:max-w-* gotcha" },
			{
				type: "warning",
				text: "shadcn's DialogContent ships a base className of sm:max-w-lg (via a CVA/cn() default). Overriding width with a bare max-w-* utility (e.g. className=\"max-w-3xl\") silently loses — tailwind-merge only dedupes classes within the same variant scope, and sm:max-w-lg is scoped to the sm: breakpoint while max-w-3xl is unscoped, so twMerge keeps both and the browser's own cascade/specificity rules (not merge order) decide which wins, which in practice is rarely the one you intended. The fix is always to override at the same or a narrower breakpoint the base class uses — sm:max-w-3xl, not max-w-3xl.",
			},
			{
				type: "note",
				text: "This bit multiple dialogs across the codebase in one pass this session (master-data-diff-modal.tsx, physical-invoice-modal.tsx, undo-transaction-dialog.tsx, warranty-job-detail-dialog.tsx, job-pipeline-cell-dialog.tsx, technician-profit-cell-dialog.tsx, customer-search-modal.tsx, import-part-dialog.tsx, and the delivered-job-actions hook's modal). When adding a new DialogContent with a custom width, always use the sm:max-w-* form, never bare max-w-*.",
			},
			{ type: "heading", text: "ReportTable's scroll container" },
			{
				type: "para",
				text: 'src/features/client/components/reports/common/report-table.tsx renders exactly one scrolling div (overflow-auto, with an optional maxHeight prop) rather than nesting an overflow-hidden outer div around an overflow-x-auto inner one. The two-div version created a double scrollbar / clipped-sticky-header bug in dialogs that cap the table\'s height (e.g. drill-down job lists at maxHeight="60vh"). Pass maxHeight whenever ReportTable sits inside a fixed-height container like a Dialog; omit it when the table should grow with its page section.',
			},
			{ type: "heading", text: "The click-a-cell-to-drill-down pattern" },
			{
				type: "para",
				text: 'Three report areas — Technician Profit Report, Event Tracking, and every tab of Jobs Summary — share one interaction shape: a non-zero matrix cell is a <button>; clicking it sets a small "cell" state object, which a sibling dialog component watches and fetches the underlying job list for.',
			},
			{
				type: "table",
				headers: ["Dialog component", "Cell type", "Used by"],
				rows: [
					[
						"TechnicianProfitCellDialog (reports/profit/)",
						"ProfitCellType",
						"Technician Profit Report — the original implementation this pattern was copied from",
					],
					[
						"EventTrackingCellDialog (reports/jobs/)",
						"EventTrackingCellType",
						"Event Tracking — Cost/Sale/Profit columns shown only for Finalize/Deliver events (COST_EVENTS set)",
					],
					[
						"CategoryRangeCellDialog (reports/common/)",
						"CategoryRangeCellType",
						"Every Jobs Summary tab (Received/Repaired/Delivered/Transactions) via CategoryRangeMatrixSection's drillDownSqlId prop, and Jobs Summary's Combined tab directly — both reuse this one dialog rather than each tab shipping its own",
					],
				],
			},
			{
				type: "bullets",
				items: [
					"Each dialog takes { cell, onClose } — cell is null when closed, a populated object when a matrix cell was clicked; the parent owns the state (useState<CellType | null>(null)).",
					"sqlId for the job-list query is either hardcoded (EventTrackingCellDialog always calls GET_EVENT_TRACKING_JOBS) or passed in per caller (CategoryRangeCellDialog takes cell.sqlId, so CategoryRangeMatrixSection's drillDownSqlId prop and Jobs Combined's per-stage STAGE_DETAIL map both resolve to one of GET_JOBS_RECEIVED_DETAIL / GET_JOBS_REPAIRED_OK_DETAIL / GET_JOBS_DELIVERED_OK_DETAIL / GET_JOB_TRANSACTIONS_DETAIL).",
					"showFinancials / showCosts (dialog-specific prop name) gates the Cost/Sale/Profit columns — only wired on where the underlying jobs are already costed (Delivered-related queries, Finalize/Deliver events). The figures come from the job's own job_part_used / job_additional_charge lines (sale = pre-GST selling total), never from job_invoice — a Finalize event fires before the job is invoiced, so an invoice-based profit would report every just-finalized job at a loss of its full cost.",
					"Clicking a row in the job list opens JobFinalInfoModal(jobId) for the full per-job breakdown — every one of these dialogs nests it the same way.",
				],
			},
			{ type: "heading", text: "The invisible-while-nested trick — and the Overlay it doesn't cover" },
			{
				type: "para",
				text: 'JobFinalInfoModal is itself a fixed-position modal narrower than the drill-down dialog behind it. Simply rendering both open at once left the wider drill-down dialog\'s edges visibly peeking out from behind the narrower nested one. Fix: the drill-down DialogContent\'s className includes cn("sm:max-w-3xl", finalInfoJobId != null && "invisible") — it stays mounted (state, scroll position, and fetched rows are preserved) but is hidden via CSS visibility while JobFinalInfoModal is open, and reappears unchanged when it closes.',
			},
			{
				type: "warning",
				text: "className only reaches DialogContent's own box — dialog.tsx's DialogContent renders a separate DialogOverlay (the fixed inset-0 backdrop) that className never touches. Hiding only the content and leaving its Overlay live means a second full-viewport backdrop stacks behind the nested modal's own Overlay — harmless-looking but doubled darkening, and a real second-modal-visible bug if the content itself weren't fully covered. All three drill-down dialogs pass overlayClassName={cn(finalInfoJobId != null && \"invisible\")} alongside the className invisible, hiding both pieces together — copy both props together, not just className, for any new nested-modal case.",
			},
			{
				type: "note",
				text: "This is deliberately invisible, not a conditional unmount — unmounting would refetch the job list and lose scroll position every time a user opens and closes a job's detail from within the list. Copy this exact cn(...) pattern (not display:none, not conditional rendering) if you add a fourth drill-down dialog that can nest JobFinalInfoModal.",
			},
			{ type: "heading", text: "A related, separate hardening: JobFinalInfoModal's own loading/loaded swap" },
			{
				type: "para",
				text: "JobFinalInfoModal originally returned two entirely separate <Dialog> trees from two different code paths — one for its loading/error placeholder (sm:max-w-sm), one for the loaded content (sm:max-w-[40rem]) — selected via an early return. Swapping which Dialog tree is returned unmounts one Radix Dialog/Portal and mounts a different one at the same position, which is fragile (two independently-animating Portals at the same moment) even if it wasn't caught misbehaving in practice.",
			},
			{
				type: "note",
				text: "Fixed by keeping a single <Dialog> instance and branching only the DialogContent's children on the loading/error/loaded state, so there's exactly one Radix Dialog/Portal mounted for the whole lifetime of the component. If you add a similar self-fetching modal with a loading state, render one Dialog with conditional content — never two Dialog trees swapped by an early return.",
			},
			{
				type: "heading",
				text: 'The actual "content spills out of the modal" bug: CSS Grid\'s automatic minimum size',
			},
			{
				type: "warning",
				text: "What users reported as the drill-down dialog's content overflowing the visible box (initially described as \"2 modal windows overlapping\" — it was one window, with its own content spilling past its right edge) traced to CSS Grid, not the Dialog-stacking issues above. DialogContent's base classes (dialog.tsx) set display: grid but never set overflow — it's overflow: visible by default, browser standard. A grid ITEM's default automatic minimum size is its content's own min-content size (min-width: auto), not 0 — so a direct-child <div> wrapping a wide ReportTable can refuse to shrink below the table's natural width, growing past the grid container's own max-width. Since the container's overflow is visible, that excess isn't clipped or scrolled — it just renders outside the dialog's rounded white box, over the dimmed backdrop. This had been a latent risk in all three drill-down dialogs from the start; it only became visibly triggered once the Event Tracking dialog's row shape grew wide enough (Type + Division columns added on top of the existing Cost/Sale/Profit columns) to exceed sm:max-w-4xl for the first time.",
			},
			{
				type: "note",
				text: "Fix: give the direct-child wrapper div (the one holding ReportLoading/ReportError/ReportEmpty/ReportTable, immediately inside DialogContent) className=\"min-w-0\" — not overflow-hidden on DialogContent itself. min-w-0 lets that grid item shrink to the container's actual track width, at which point ReportTable's own overflow-auto wrapper (report-table.tsx) takes over and shows an internal horizontal scrollbar instead of pushing the whole modal wider. All three drill-down dialogs (EventTrackingCellDialog, CategoryRangeCellDialog, TechnicianProfitCellDialog) now carry this on their content wrapper div.",
			},
			{
				type: "note",
				text: 'Diagnosing this kind of bug from a description alone is unreliable — "the modal\'s edges don\'t line up" and "content spills past the modal" sound similar but have opposite fixes (Overlay-hiding vs. min-w-0). Confirm which one you\'re facing by comparing element.scrollWidth to element.getBoundingClientRect().width on the DialogContent node — scrollWidth > width means content is escaping an overflow:visible ancestor, which points at the CSS Grid min-width issue here, not a stacked-dialog issue.',
			},
			{ type: "heading", text: "Zero-count KpiCards: an alert dialog instead of an empty drill-down" },
			{
				type: "para",
				text: "reports/dashboard/dashboard-section.tsx (the Operations Dashboard) wraps every KpiCard's onClick in a local handleCardClick(count, onOpen) helper: count === 0 sets a local emptyAlertOpen boolean instead of calling onOpen, so a zero-count card never opens DashboardJobsListDialog / DashboardRevenueDetailDialog / OpenJobsByProductDialog / DashboardOverdueDetailDialog on an empty result. This copies extended-warranty/ew-pipeline-section.tsx's emptyAlertOpen pattern verbatim (added 2026-09-14 there, see the Extended Warranty article): a plain shadcn Dialog (not AlertDialog — nothing to confirm, so Escape/outside-click dismissal should work), showCloseButton={false}, an Inbox icon badge, a title, MESSAGES.INFO_REPORTS_NO_DATA as the body (the same \"no data\" wording ReportEmpty falls back to — one wording app-wide, not a new key), and a single OK button.",
			},
			{
				type: "note",
				text: "Each KpiCard's count is the exact number already rendered on its face (kpis?.jobs_received ?? 0, overdueQ.data.length, etc.) — there is no second query. Revenue is gated the same way even though it's a currency amount, not a job count: ₹0 also means there is nothing to drill into. Add the same handleCardClick(count, onOpen) wrap around any new KpiCard whose click opens a query-backed dialog.",
			},
			{ type: "heading", text: "Open Jobs' two-level drill-down: summary dialog nesting a job-list dialog" },
			{
				type: "para",
				text: "open-jobs-by-product-dialog.tsx was originally a dead-end: GET_DASHBOARD_OPEN_JOBS_BY_PRODUCT rows (product_name, warranty_count, oow_count, total_count) rendered as a plain ReportTable with no further click. It now takes an onDrillDown({ productName, isWarranty, label }) prop and wraps its W/OOW/Total cells in a shared drillDownCell(count, onClick, className) helper — a <button disabled={count === 0}> matching the CategoryRangeMatrixSection cell-click styling (hover:ring-2 hover:ring-(--cl-accent) hover:ring-inset). The Product name column and every footer cell stay plain text, matching CategoryRangeMatrixSection's own footer (never clickable there either).",
			},
			{
				type: "para",
				text: "A new sql id, GET_DASHBOARD_OPEN_JOBS_LIST (sql_reports_audit.py), is the job-detail counterpart of GET_DASHBOARD_OPEN_JOBS_BY_PRODUCT: same is_closed = false AND js.code NOT IN ('CANCELLED', 'COMPLETED_OK', 'RETURN') filter and the same job/customer_contact/job_status/technician/product_brand_model/brand/product joins as GET_DASHBOARD_JOBS_RECEIVED_LIST, but takes { product_name, is_warranty } instead of a date range — Open Jobs has never been date-scoped. product_name is matched against COALESCE(p.name, 'Unknown') so the \"Unknown\" product bucket in the summary drills down correctly too; either param can be SQL NULL (both %(x)s::type IS NULL OR ... guards) to widen the filter, though dashboard-section.tsx always passes both. dashboard-section.tsx's handleOpenJobsDrillDown reuses the existing jobsListModal state and DashboardJobsListDialog — no new dialog component for the detail level, only for the summary level.",
			},
			{
				type: "warning",
				text: 'This is a second Dialog opening on top of a first (open-jobs-by-product-dialog.tsx\'s summary is itself a Dialog, not a page section) — the same "invisible-while-nested" shape as JobFinalInfoModal above, not the sibling-dialog shape CategoryRangeCellDialog uses (that one\'s caller, CategoryRangeMatrixSection, is a page section, so only the drill-down dialog itself is ever mounted). OpenJobsByProductDialog takes nestedDialogOpen, applied as className={cn("sm:max-w-lg", nestedDialogOpen && "invisible")} AND overlayClassName={cn(nestedDialogOpen && "invisible")} on its own DialogContent — both props, not just className, per the Overlay gotcha above. dashboard-section.tsx passes nestedDialogOpen={jobsListModal != null}. Closing the job-list dialog reveals the still-mounted, unrefetched summary exactly as it was.',
			},
		],
		faqs: [
			{
				q: 'I set className="max-w-2xl" on a DialogContent and the dialog didn\'t get wider — why?',
				a: "You hit the sm:max-w-* gotcha above — the shadcn default is sm:max-w-lg, and an unscoped max-w-2xl doesn't reliably beat a breakpoint-scoped class through tailwind-merge. Use sm:max-w-2xl instead.",
			},
			{
				q: "I'm adding a fourth report area that needs cell drill-down — should I write a new dialog component?",
				a: "Only if its row shape genuinely differs. If it's job-list-shaped like the existing three, prefer reusing CategoryRangeCellDialog (it already supports an arbitrary sqlId and an optional showFinancials flag) over writing a fourth near-identical dialog.",
			},
			{
				q: "Why does ReportTable take a maxHeight prop instead of always filling its container?",
				a: "Report sections on a normal page want the table to grow naturally; the same table dropped into a Dialog needs a hard cap so the dialog itself doesn't grow past the viewport. maxHeight is optional so both callers use the same component without one fighting the other's layout.",
			},
			{
				q: "I still see two modal edges/boxes after applying className invisible to my nested DialogContent — what am I missing?",
				a: 'Almost certainly the Overlay — pass overlayClassName={cn(finalInfoJobId != null && "invisible")} (or your equivalent condition) alongside className, since DialogContent\'s className prop never reaches its own DialogOverlay.',
			},
			{
				q: "I added more columns to a drill-down dialog's ReportTable and now content pokes out past the dialog's right edge — why?",
				a: "The direct-child wrapper div inside your DialogContent is missing min-w-0. DialogContent is display: grid with overflow: visible, so a wide table forces its grid-item ancestor wider than the container's max-width instead of triggering ReportTable's own internal scrollbar — see \"The actual content-spills-out-of-the-modal bug\" above.",
			},
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
			{
				type: "para",
				text: "The chain: security.user → user_bu_role → role → role_access_right → access_right. GET_USER_BY_IDENTITY in sql_store.py already aggregates a logging-in user's granular right codes across this whole chain into access_rights: string[] in one query.",
			},
			{ type: "heading", text: "Login flow" },
			{
				type: "steps",
				items: [
					"POST /api/auth/login → auth_router_helper.py::login_helper.",
					"Looks up the user via SqlStore.GET_USER_BY_IDENTITY, which returns role_code and the aggregated access_rights array.",
					"Issues a JWT with token_claims: sub, user_type, client_id, db_name, role_code, access_rights, bu_codes (the last one added by the tenant/BU enforcement fix — see 'Tenant & BU Enforcement').",
					"Client stores the login response (roleCode, accessRights typed in src/lib/auth-service.ts) into Redux via auth-slice.ts, persisted through src/lib/auth-storage.ts.",
					"Every subsequent Apollo Client call attaches Authorization: Bearer <token> (apollo-client.ts).",
				],
			},
			{
				type: "note",
				text: "The refresh-token path re-reads role_code/access_rights live from GET_USER_BY_ID_FOR_RESET, and (as of the tenant/BU enforcement fix) also re-runs GET_USER_BUS for bu_codes, rather than copying any of these from the old token — so a role or BU-assignment change takes effect on the user's next token refresh, not only at their next full login.",
			},
		],
		faqs: [
			{
				q: "Does the JWT itself need to be re-decoded on every GraphQL call, or is it cached?",
				a: "Decoded fresh per request in get_graphql_context() (app/graphql/schema.py) — there's no server-side session cache for this.",
			},
			{
				q: "What does a user with no user_bu_role rows see?",
				a: "They can authenticate (login succeeds) but access_rights comes back empty and role_code is unset — they'd see everything gated by a right as disabled. See the end-user 'Granting Access: Associate BU / Role' article for the UI side of fixing this.",
			},
		],
	},

	{
		id: "dev-tenant-bu-enforcement",
		category: "Access Control & Security",
		title: "Tenant & BU Enforcement — require_own_tenant / require_bu_access",
		summary:
			"Why genericQuery/genericUpdate can now 403 with tenant_mismatch or bu_mismatch, even when the access right is fine.",
		tags: [
			"require_own_tenant",
			"require_bu_access",
			"bu_codes",
			"tenant_mismatch",
			"bu_mismatch",
			"auth_guards",
			"multi-tenancy",
			"security fix",
		],
		content: [
			{
				type: "para",
				text: "Before this fix, db_name and schema were accepted as plain arguments on genericQuery/genericBatchQuery/genericUpdate/genericUpdateScript and never checked against the caller's own token — any logged-in user could send a different db_name (another tenant) or schema (another BU) and the server would simply run the request there. Proven live: a user assigned to exactly one BU successfully read another BU's data in the same tenant, and a different tenant's data entirely, using their own unmodified token.",
			},
			{ type: "heading", text: "The fix" },
			{
				type: "steps",
				items: [
					"login_helper and refresh_token_helper now add a bu_codes: string[] claim to the JWT (lowercased security.bu.code values), derived from the same GET_USER_BUS query already run at login for the 'select business unit' screen — refresh_token_helper didn't run that query at all before this fix.",
					"get_graphql_context (app/graphql/schema.py) decodes bu_codes into context alongside the existing user_id/user_type/access_rights/db_name — an old token with no bu_codes claim decodes to an empty list, not 'unrestricted'.",
					"Two new guards in auth_guards.py: require_own_tenant(info, db_name) rejects unless the request's db_name matches context.db_name (Super Admin, whose token always carries db_name=None, bypasses); require_bu_access(info, schema) rejects unless schema is in context.bu_codes, short-circuiting to allow for schema in {'security','public'} (tenant-wide, not BU-specific) and bypassing entirely for Super Admin/Business Admin (user_type in {'S','A'}) — Admin already owns every BU in their own tenant everywhere else in this codebase.",
					"Both guards are called first, before any existing right-check, in all four generic dispatchers (query.py's resolve_generic_query/resolve_generic_batch_query, mutation.py's resolve_generic_update/resolve_generic_update_script).",
					"genericBatchQuery is the one wrinkle: each item in its items list carries its own schema, so resolve_generic_batch_query_helper (shared/generic_query.py) now takes info as its first argument and calls require_bu_access per item, inside the loop, before that item is appended to the batch — one bad schema rejects the whole call before exec_sql_batch_query ever runs, so there's no partial-batch leak.",
				],
			},
			{
				type: "note",
				text: "bu_admin/provisioning.py's Super-Admin-only resolvers (createClient, createBuSchema, dropDatabase, etc.) are untouched — they're cross-tenant by design and don't route through the four generic dispatchers.",
			},
		],
		faqs: [
			{
				q: "A genericQuery call is failing with FORBIDDEN and extensions.reason is tenant_mismatch or bu_mismatch — what does that mean, and how is it different from a missing access right?",
				a: "It means the request's db_name didn't match the caller's own tenant (tenant_mismatch), or its schema wasn't one of the BUs in the caller's token (bu_mismatch) — this is checked before any access-right check runs, so it can fire even when the user has every right they need. Compare to require_access_right's FORBIDDEN, which has no reason extension and means the user lacks a specific access-right code.",
			},
			{
				q: "A user was just added to a new BU (or removed from one) — why doesn't the change take effect immediately?",
				a: "bu_codes is baked into the JWT at login/refresh, same as access_rights already was — it takes effect on that user's next token refresh (the client proactively refreshes within 5 minutes of expiry; access tokens last 30 minutes by default), not instantly. This is the same staleness window access-right changes have always had.",
			},
			{
				q: "Does this fix the 'genericUpdate table-writer hole' described in Known Gaps?",
				a: "No — that's a different question (which table a caller may write to) from this one (which tenant/BU a caller may address at all). See 'Known Gaps' — Gap 1 is unaffected by this change.",
			},
		],
	},

	{
		id: "dev-rbac-seeding",
		category: "Access Control & Security",
		title: "Seeding Roles & Access Rights",
		summary: "seed_security_data.py, the seedSecurityData mutation, and the two-step Super Admin wizard.",
		tags: ["seeding", "seed_security_data.py", "seedSecurityData", "seed-roles-dialog", "idempotent"],
		content: [
			{
				type: "para",
				text: "Roles and access rights are seeded, not created through any UI form — matching the 'system-defined, not editable' philosophy in roles-page.tsx.",
			},
			{
				type: "table",
				headers: ["Piece", "Detail"],
				rows: [
					[
						"seed_security_data.py",
						"ROLE_SEED_SQL (the 3 role rows) + ACCESS_RIGHT_SEED_SQL (18 access_right rows as of job cost correction + role_access_right mapping), both ON CONFLICT DO NOTHING — fully idempotent, safe to re-run. A new right needs a new row here AND a corresponding role_access_right row per role that should get it — see 'WhatsApp Integration — Implementation' for a worked example (JOBS_CUSTOMER_CONNECT, id=17), and 'Job Cost Correction — Implementation' for the most recent one (JOBS_CORRECT_COST, id=18, MANAGER only).",
					],
					[
						"Automatic seeding",
						"Runs inline whenever a new client schema is created (Super Admin → Initialize Client)",
					],
					[
						"On-demand seeding",
						"The seedSecurityData GraphQL mutation, wired to Super Admin's seed-roles-dialog.tsx — a two-step wizard (Roles, then Access Rights), each step independently checked and idempotent",
					],
				],
			},
			{
				type: "note",
				text: "This wizard is exactly the kind of Super Admin-only operational tool that belongs in this same Super Admin area as this help system — see plans/tran.md and the seed-wizard design in plans/plan.md for its own history.",
			},
		],
		faqs: [
			{
				q: "What happens if I run the seed a second time on an already-seeded tenant?",
				a: "Nothing changes — every INSERT uses ON CONFLICT DO NOTHING, so re-running is always safe.",
			},
			{
				q: "Why does the wizard have two independently-checked steps instead of one 'Seed Everything' button?",
				a: "Because tenants provisioned before the access-right system existed already have role rows but not access_right/role_access_right rows — a single combined idempotency check would incorrectly report 'already done' for those tenants and never offer to backfill the missing half.",
			},
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
			{
				type: "table",
				headers: ["Code", "Gates"],
				rows: [
					["JOBS_RECEIPTS", "Jobs → Receipts"],
					["JOBS_OPENING_JOBS", "Jobs → Opening Jobs"],
					[
						"JOBS_ACCOUNTS_POSTING",
						"Jobs → Accounts Posting (in addition to the existing postDataToAccounts app-setting condition)",
					],
					["MASTERS_MENU", "The whole Masters top-level tab"],
					["CONFIG_MENU", "The whole Configurations top-level tab"],
					["ADMIN_MENU", "Client Mode's Admin tab (Post/Unpost) — not the separate /admin/* Admin Mode"],
				],
			},
			{
				type: "table",
				headers: ["Right", "MANAGER", "TECHNICIAN", "RECEPTIONIST"],
				rows: [
					["JOBS_RECEIPTS", "✅", "❌", "✅"],
					["JOBS_OPENING_JOBS", "✅", "❌", "✅"],
					["JOBS_ACCOUNTS_POSTING", "✅", "❌", "✅"],
					["MASTERS_MENU", "✅", "❌", "✅"],
					["CONFIG_MENU", "✅", "❌", "❌"],
					["ADMIN_MENU", "✅", "❌", "❌"],
				],
			},
			{
				type: "note",
				text: "userType 'A' (Business Admin) and 'S' (Super Admin) bypass every restriction above unconditionally, everywhere — not a seeded row, a hardcoded bypass on both sides.",
			},
			{ type: "heading", text: "Server side" },
			{
				type: "para",
				text: "app/graphql/resolvers/auth_guards.py's require_access_right(info, code) raises AuthorizationException (the project's actual equivalent — there is no AppHttpException class in this codebase) when the caller's context lacks the right, bypassing for user_type in {'S','A'}.",
			},
			{ type: "heading", text: "Client side" },
			{
				type: "para",
				text: "src/features/auth/utils/access-rights.ts exports ACCESS_RIGHTS, hasAccessRight(user, code), and getRoleDisplayName(user, short) (short names Man/Tech/Rec for the space-constrained role badge).",
			},
			{
				type: "warning",
				text: "Universal UX rule: disabled + tooltip, never hide. Every gated menu/button always renders; when the current role lacks the right, it's visually disabled with an explanatory tooltip — this was a deliberate decision, not an oversight, so users always know a feature exists even if they can't currently use it.",
			},
		],
		faqs: [
			{
				q: "If a menu item is server-enforced, is the client-side disable/tooltip redundant?",
				a: "No — it's UX (immediate, no round-trip needed to know something is blocked). The server check is the actual security boundary; see 'Known Gaps' for where that server check doesn't exist yet despite the client-side disable being present.",
			},
			{
				q: "Is there a hook like usePermission() somewhere?",
				a: "No dedicated hook — hasAccessRight(user, code) is called directly at each gated call site (layout/client-explorer-panel.tsx, layout/client-top-nav.tsx), not wrapped in a custom hook.",
			},
		],
	},

	{
		id: "dev-rbac-known-gaps",
		category: "Access Control & Security",
		title: "Known Gaps (Read Before Extending This Area)",
		summary: "genericUpdate's table-writer hole, and the two access rights with no server enforcement yet.",
		tags: ["known gaps", "security gap", "genericUpdate", "authorization hole", "blocker"],
		content: [
			{
				type: "warning",
				text: "This article exists so a developer touching Access Control doesn't assume more protection exists than actually does. Source: plans/plan-access-control.md's 'Gaps' and 'Step 10 blocker' sections — re-verify current state before relying on this, as this area is actively evolving.",
			},
			{
				type: "note",
				text: "This article is about which table/right an authenticated user needs within their own tenant/BU. A separate question — which tenant/BU a caller may address at all — was a real, exploited-in-testing gap and is now closed by require_own_tenant/require_bu_access; see 'Tenant & BU Enforcement'. Gap 1 below is unaffected by that fix.",
			},
			{ type: "heading", text: "Gap 1 — The generic table-writer hole" },
			{
				type: "para",
				text: "genericUpdate, genericUpdateScript, and genericQuery (see 'The Generic Query/Update Pattern') can, by construction, write to or read from almost any table by name. Only genericUpdate has any per-table check at all — a GENERIC_UPDATE_TABLE_RIGHTS allow-list covering the ~20 Masters/Configurations tables, gating them to MASTERS_MENU/CONFIG_MENU. genericUpdateScript and genericQuery have no per-table authorization at all today.",
			},
			{
				type: "heading",
				text: "Gap 3 (closed, 2026-09-17) — createBusinessUser/createAdminUser/createBuSchemaAndFeedSeedData had no guard at all",
			},
			{
				type: "para",
				text: 'Found while implementing the Manager-created-users feature (plans/plan.md): createBusinessUser, createAdminUser, createBuSchemaAndFeedSeedData, and setUserBuRole are dedicated named mutations, not routed through genericUpdate/genericUpdateScript — so Gap 1\'s per-table allow-list never covered them, and unlike Gap 2 they had not even a client-side disable\'s worth of thought given to the server side: literally zero require_access_right/require_user_type/userType check. Any authenticated user, any role, could call any of the four directly and create a business user of any role for any BU, a second Admin, or a whole new BU schema. Fixed: createBusinessUser and setUserBuRole now call require_own_tenant + require_user_type(info, {"A", "B"}) in mutation.py, with the real role/BU/tier rule enforced inside users_roles.py (see "Manager-Created Users & Subscription Tiers" below); createAdminUser now calls require_user_type(info, {"S"}) — Super Admin only, permanently, on every tier.',
			},
			{
				type: "warning",
				text: 'createBuSchemaAndFeedSeedData briefly went Super-Admin-only on 2026-09-17 as part of this same fix, per an earlier draft of plans/plan.md ("no tenant\'s own Admin ever gets this"). Reverted 2026-09-18: the client\'s Admin Panel (features/admin/components/create-business-unit-dialog.tsx) still shows "Add Business Unit" to tenant Admin, and Super Admin has no equivalent screen to create a BU for a tenant — the lockdown left BU creation broken for everyone. Now require_own_tenant(info, db_name) + require_user_type(info, {"S", "A"}): Super Admin (any tenant) or the tenant\'s own Admin (their tenant only, enforced by require_own_tenant). If a proper Super Admin BU-management screen is ever built, this can be tightened back to {"S"} only — see plans/plan.md "Flags and constraints" for this decision.',
			},
			{
				type: "warning",
				text: "createClient (bu_admin/provisioning.py) was found in the same audit and is STILL unguarded — only Super Admin's own UI reaches it today, same as the other three were before this fix, so treat it with the same suspicion until it's actually closed. Not fixed here because this feature didn't touch it; don't assume it's safe.",
			},
			{
				type: "heading",
				text: "Gap 2 — JOBS_RECEIPTS and ADMIN_MENU: client-side disable only, no server enforcement",
			},
			{
				type: "para",
				text: 'Receipts, Opening Jobs, and Post/Unpost all route through generic, shared resolvers (genericUpdate on tableName: "job", or the dedicated createJobPayment mutation) that are also used by explicitly unrestricted flows — Single Job, Batch Job, Final-a-Job all also write to job; createJobPayment is also called from inside the Deliver Job modal, which must stay open to every role. A tableName-only or mutation-only guard can\'t distinguish the restricted caller from the unrestricted one without either blocking something that should stay open, or leaving the restricted path ungated.',
			},
			{
				type: "table",
				headers: ["Code", "Server enforcement status"],
				rows: [
					["JOBS_ACCOUNTS_POSTING", "✅ Enforced — dedicated resolver, single call site"],
					["MASTERS_MENU / CONFIG_MENU", "✅ Enforced — genericUpdate tableName allow-list"],
					[
						"JOBS_OPENING_JOBS",
						"⚠️ Potentially enforceable — is_opening_job: true already exists uniquely in that flow's xData, confirmed as a safe discriminator, but not yet wired into a guard",
					],
					[
						"JOBS_RECEIPTS",
						"❌ Not enforced — createJobPayment has no discriminator between the Receipts screen and the Deliver Job modal's receipt step",
					],
					[
						"ADMIN_MENU (Post/Unpost)",
						"❌ Not enforced — the only distinguishing signal is that its xData is exactly {id, is_posted} with no other keys, a payload-shape heuristic considered too fragile to rely on as-is",
					],
				],
			},
			{ type: "heading", text: "Options on the table (not yet decided)" },
			{
				type: "bullets",
				items: [
					"(a) Accept a payload-shape/field heuristic per case (safe for Opening Jobs via is_opening_job; not safe as-is for Receipts or Post/Unpost).",
					"(b) Have the client send an explicit discriminator field (e.g. area or rightCode) in the shared mutation's payload, so the server keys off an authoritative signal instead of guessing from shape.",
					"(c) Split the shared resolvers into distinct GraphQL fields per calling area — bigger change, touches client call sites too.",
				],
			},
		],
		faqs: [
			{
				q: "Is the app currently vulnerable because of these gaps?",
				a: "Authentication (a valid token) is still required for every GraphQL call once context_value enforcement is in place, per Step 8 of plan-access-control.md — the gap is specifically about fine-grained authorization (which right a given authenticated user needs), not about anonymous access.",
			},
			{
				q: "If I need to add enforcement to Receipts or Post/Unpost, what should I do first?",
				a: "Read the full 'Step 10 blocker' section in plans/plan-access-control.md before writing code — this is a design decision (which of options a/b/c above), not a quick guard addition, and picking wrong risks either leaving a hole or blocking a role that must stay unrestricted.",
			},
		],
	},

	{
		id: "dev-manager-created-users",
		category: "Access Control & Security",
		title: "Manager-Created Users & Subscription Tiers",
		summary:
			"USERS_MANAGE_OWN_BU, the Basic/Pro/Enterprise tier field, the Basic-tier one-user/one-branch caps, and user_bu_role_branch.",
		tags: [
			"USERS_MANAGE_OWN_BU",
			"subscription_tier",
			"BASIC",
			"PRO",
			"ENTERPRISE",
			"MANAGER_ROLE_ID",
			"user_bu_role_branch",
			"Users",
			"require_user_type",
			"branch restriction",
			"useIsAdminHiddenForBasicManager",
			"useSubscriptionTier",
			"plans/plan.md",
		],
		content: [
			{
				type: "para",
				text: "Implements plans/plan.md: Admin is unchanged (any role, any BU in their own tenant); a Manager can now create Technician/Receptionist users for their own BU(s) only, never another Manager; BU creation is Super Admin (any tenant) or a tenant's own Admin for their own tenant only — reverted 2026-09-18 from a brief Super-Admin-only window, since the client's Admin Panel still exposes 'Add Business Unit' to Admin and Super Admin has no replacement screen; a client has a Basic/Pro/Enterprise tier, and Basic caps a client to one business user (role Manager) and one branch per BU; a user's BU assignment can optionally be restricted to specific branches.",
			},
			{ type: "heading", text: "USERS_MANAGE_OWN_BU (access_right id 21)" },
			{
				type: "para",
				text: "Seeded to MANAGER only (seed_security_data.py) — TECHNICIAN and RECEPTIONIST never get it, by design; this is the one access right that is NOT simply 'does the role need this feature' but specifically gates a privilege-escalation-shaped capability. Existing tenants need scripts/seed_access_right_users_manage_own_bu.sql or a re-run of the Super Admin seed wizard to pick it up (same as every other right — see 'Seeding Roles & Access Rights').",
			},
			{ type: "heading", text: "The rule (users_roles.py)" },
			{
				type: "para",
				text: "resolve_create_business_user_helper and resolve_set_user_bu_role_helper both now take info and run _check_basic_tier_user_cap(db_name, schema, role_id) FIRST, unconditionally — before checking who's calling — then _require_can_create_business_user(info, db_name, role_id, bu_ids). Admin/Super Admin: unrestricted (unless the Basic cap above already blocked it). A 'B' caller: must carry USERS_MANAGE_OWN_BU, role_id must not be MANAGER_ROLE_ID (1), and every bu_id in the payload must come back from GET_MANAGER_BU_IDS_FOR_USER for that caller — a fresh DB read each call, not trusted from the JWT's role_code claim, since role_code is a single string that can't represent 'MANAGER in BU 1, something else in BU 2' even though user_bu_role technically could.",
			},
			{
				type: "note",
				text: "setUserBuRole (the edit path) runs the identical _require_can_create_business_user check — a Manager can't use 'edit' to grant themselves or someone else a BU they don't manage, or promote someone to MANAGER, just because 'edit' sounds less privileged than 'create'.",
			},
			{ type: "heading", text: "require_user_type (auth_guards.py)" },
			{
				type: "para",
				text: 'New guard, sibling to require_access_right/require_bu_access but with no S/A bypass — it checks WHO is calling, not what right they hold. createAdminUser calls require_user_type(info, {"S"}) in mutation.py — Super Admin only, permanently, no exceptions. createBuSchemaAndFeedSeedData calls require_own_tenant + require_user_type(info, {"S", "A"}) — Super Admin (any tenant) or the tenant\'s own Admin (own tenant only), reverted 2026-09-18 (see the warning under "Server-Side Authorization Gaps"). createBusinessUser and setUserBuRole call require_own_tenant + require_user_type(info, {"A", "B"}) as a coarse pre-filter, with the real rule inside the helper (above) since it needs more than a caller\'s bare identity.',
			},
			{ type: "heading", text: "subscription_tier (public.client)" },
			{
				type: "para",
				text: "text column, CHECK'd to ('BASIC', 'PRO', 'ENTERPRISE'), default 'BASIC' — scripts/subscription_tier_schema.sql, run once against service_plus_client (there is only one). Read by db_name via GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME — deliberately keyed by db_name (already on the caller's token / already the resolver's own db_name argument once require_own_tenant has run) rather than by client_id, so no extra round trip or client_id JWT claim is needed. Edited from Super Admin's Edit Client dialog via the existing generic genericUpdate(tableName: \"client\") path — no new mutation needed, since the column just rides along with every other client field already saved that way. Surfaced read-side through resolve_super_admin_clients_data_helper (adds subscription_tier to the dict it already builds from GET_CLIENT_DB_NAMES) and GET_CLIENT_BY_ID.",
			},
			{ type: "heading", text: "Basic tier: one user, one branch" },
			{
				type: "para",
				text: "One user: _check_basic_tier_user_cap counts COUNT_BUSINESS_USERS (is_admin = false rows) in the target schema; at BASIC with count >= 1, or count == 0 but role_id != MANAGER_ROLE_ID, it raises before anything else runs — this blocks Admin too, not just a Manager caller, since the cap is a plan limit, not a permission. The one Admin login every client gets at setup is_admin = true and is not counted.",
			},
			{
				type: "para",
				text: 'One branch: mutation.py\'s _require_basic_tier_branch_cap runs inside resolve_generic_update, scoped to tableName === "branch" and only a NEW row (xData.id absent, or present with isIdInsert — same insert-vs-update test process_details itself uses: `x_data.get("id") and not x_data.get("isIdInsert")` means update). Branch has no dedicated mutation of its own — same Gap-1 shape as everything else on genericUpdate — so this check had to be added narrowly inside the shared dispatcher rather than as a clean per-table right; it is NOT in GENERIC_UPDATE_TABLE_RIGHTS since it is not a right-based check at all. Client-side, branch-section.tsx fetches its own tier via GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME and disables the Add Branch button once at cap — the server check is the real boundary, that\'s only the UX.',
			},
			{ type: "heading", text: "Branch restriction — user_bu_role_branch" },
			{
				type: "para",
				text: "New table in the `security` schema (scripts/user_bu_role_branch_schema.sql, one row per (user_id, bu_id, branch_id), PK on all three, FK on the (user_id, bu_id) pair back to user_bu_role with ON DELETE CASCADE). branch_id is a SOFT reference — branches live inside each BU's own schema (named after security.bu.code), which Postgres can't FK across generically. _validate_and_save_branch_restrictions (users_roles.py) resolves bu_id → code via GET_BU_CODE_BY_ID, then checks every branch_id actually exists in that schema via CHECK_BRANCH_IDS_EXIST before inserting — reject the whole call (BRANCH_NOT_IN_BU) rather than write a dangling reference. No rows for a (user_id, bu_id) = unrestricted, which is every user's state today, so this shipped with zero behavior change until someone actively sets a restriction.",
			},
			{
				type: "warning",
				text: "This plan only covers the ASSIGNMENT side — who can be tagged to which branch. It does not filter what a branch-restricted user can actually see or do in jobs/reports/etc.; that's explicitly out of scope (plans/plan.md, 'Flags and constraints') and would touch most genericQuery report/list resolvers, a materially bigger change than this one. Don't assume a branch-restricted Technician is actually confined to that branch's data — they aren't, yet.",
			},
			{ type: "heading", text: "Client-side surface" },
			{
				type: "para",
				text: "New route-free nav entry: client-explorer-panel.tsx's AdminExplorer renders a \"Users\" TreeItem (label must match the case in client-admin-page.tsx's AdminContent switch exactly, same pattern as \"Post / Unpost\") when hasAccessRight(currentUser, ACCESS_RIGHTS.USERS_MANAGE_OWN_BU) — true for Manager and, incidentally, for Admin too via the S/A bypass in hasAccessRight, so Admin sees a redundant-but-harmless extra entry alongside their own /admin/users screen. The screen itself, accounts-admin/users-section.tsx (component UsersSection), follows the same table + toolbar + add/edit-dialog convention as every other master list (e.g. masters/branch/branch-section.tsx): an Add User button opens accounts-admin/add-user-dialog.tsx (component AddUserDialog, the old inline create form lifted into a Dialog), and each row's dropdown wires Edit/Activate/Deactivate/Delete straight to the existing Admin dialogs — features/admin/components/{edit,activate,deactivate,delete}-business-user-dialog.tsx — reused unmodified since none of them are BU-scoped. UsersSection reads the caller's own BUs from currentUser.availableBus (client Redux state already populated at login for the BU switcher) rather than a fresh query — valid because a Manager's availableBus is already exactly their MANAGER-role BU set (role is applied uniformly across every BU an action touches, per the existing one-role-per-user UI constraint).",
			},
			{
				type: "para",
				text: "The grid's rows are GET_BUSINESS_USERS (schema security) filtered client-side to role_name !== \"Manager\" and bu_ids intersecting the caller's own BU set — GET_BUSINESS_USERS itself has no BU argument and returns every business user in the tenant. This filtering is UX only, not a security boundary: GET_BUSINESS_USERS (a genericQuery sqlId) and genericUpdate(tableName: \"user\") are both inside 'Known Gaps' Gap 1 — genericQuery has no per-table authorization at all, and \"user\" is not in GENERIC_UPDATE_TABLE_RIGHTS — so today any authenticated caller, any role, can already read every business user in the tenant or edit/deactivate/delete any of them directly against the API, Manager UI or not. Don't extend this screen's reach (e.g. wiring in cross-BU actions) on the assumption the server enforces the BU boundary it doesn't.",
			},
			{
				type: "note",
				text: "create-business-user-dialog.tsx and associate-bu-role-dialog.tsx (Admin's own screens) both gained the same branch picker — fetched per-BU via GET_BU_BRANCHES against that BU's own schema, shown only when a BU has more than one branch, sent as branch_ids: { \"<bu_id>\": [branch_id, ...] } alongside bu_ids/role_id on both createBusinessUser and setUserBuRole. add-user-dialog.tsx carries the same picker for the Manager's own create flow.",
			},
			{ type: "heading", text: "Hiding Admin for a Basic-tier Manager" },
			{
				type: "para",
				text: 'ADMIN_MENU and USERS_MANAGE_OWN_BU are both granted to the Manager role unconditionally in seed data — there is no tier-aware seeding, so a Basic-tier Manager\'s JWT/accessRights carries both rights exactly like a Pro/Enterprise Manager\'s. But on Basic there\'s nothing usable behind them: the one-user cap (above) means the Manager\'s own account is already the client\'s single allowed business user, so create always fails, and UsersSection\'s grid (which excludes role_name === "Manager") shows nobody. Two hooks in features/client/components/layout/ close this client-side: use-subscription-tier.ts (useSubscriptionTier) and use-admin-tab-visibility.ts (useIsAdminHiddenForBasicManager: true when userType === "B" && hasAccessRight(ADMIN_MENU) && tier === "BASIC"). client-top-nav.tsx filters the Admin tab out of NAV_ITEMS and drops the "Unposted documents" notification-bell item (it deep-links straight to /client/admin, bypassing the nav filter); client-explorer-panel.tsx filters MOBILE_NAV_ITEMS the same way and AdminExplorer/AdminContent (client-admin-page.tsx) each render a "Not available on your plan." fallback instead of their normal content, in case a stale link/bookmark reaches the route directly.',
			},
			{
				type: "warning",
				text: 'useSubscriptionTier does NOT query the database — it reads currentUser.subscriptionTier from Redux, set once at login. It was originally written against genericQuery(GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME, db_name: "", schema: "public") — the same call branch-section.tsx already had inline for its Add-Branch-cap check — and that call is silently broken for every caller except Super Admin: query.py\'s resolve_generic_query calls require_own_tenant(info, db_name) BEFORE running the query, and that guard rejects any db_name that does not equal the caller\'s own tenant db_name (confirmed live: a simulated Manager context raises AuthorizationException(\'tenant_mismatch\')). db_name: "" is required here because subscription_tier lives in public.client in the separate service_plus_client registry database, not in the tenant\'s own database (confirmed live: service_plus_demo\'s public schema has zero tables) — so there was no db_name value that could satisfy both require_own_tenant and the connection-pool selection in exec_sql_query (db_name: "" picks pool_manager.client_pool; anything else picks the tenant\'s own pool). Net effect: branch-section.tsx\'s "disable Add Branch once at the Basic one-branch cap" UX has silently never worked for anyone but Super Admin since require_own_tenant was added — the server-side _require_basic_tier_branch_cap check was always the real boundary, same as below.',
			},
			{
				type: "para",
				text: 'Fixed by piggy-backing subscription_tier onto the client-row lookup login_helper already does to resolve db_name from client_id (GET_CLIENT_DB_NAME now SELECTs subscription_tier too), threading it onto LoginResponse (subscriptionTier, auth_schema.py) and onto the client\'s UserInstanceType/LoginResponseType (auth-service.ts) and the Redux user object (login-form.tsx). This sidesteps require_own_tenant entirely — no change to that guard, or to any other caller of genericQuery — since the server already resolves the caller\'s own client row using its own client_id/db_name, never a client-supplied lookup key. Verified end-to-end by calling login_helper in-process for user3 (Manager, client_id=1="demo"=BASIC): response includes subscriptionTier: "BASIC" after Pydantic alias serialization (model_dump(by_alias=True), matching how FastAPI actually serializes it over HTTP).',
			},
			{
				type: "warning",
				text: "subscriptionTier is login-time-only, like fullName/email/mobile — refresh_token_helper's RefreshTokenResponse carries only new tokens, no user fields, so it is never updated mid-session the way role_code/access_rights are (re-read from the DB on every refresh). A session logged in before this change, or a client moved between tiers mid-session, needs a fresh login to pick up the current value. And this is still client-side only, same caveat as everywhere else in this article: createBusinessUser is still reachable directly with the Manager's own token, and the server-side _check_basic_tier_user_cap rule (not a hidden nav item) is the actual boundary that keeps Basic at one user. Nothing here changes server enforcement — it only stops the UI from presenting a tab that can never do anything useful on Basic.",
			},
		],
		faqs: [
			{
				q: "Why does the Basic-tier check run before the caller-identity check, not after?",
				a: "It's a plan limit, not a permission — Admin is just as capped as a Manager would be. Checking identity first would let an Admin bypass the cap; checking the cap first makes it apply to literally anyone, which is the actual rule in plans/plan.md.",
			},
			{
				q: "Can a Manager see or restrict users in a BU they don't manage?",
				a: "No — _require_can_create_business_user checks every bu_id in the payload against GET_MANAGER_BU_IDS_FOR_USER for that specific caller, on both create and edit. A BU outside that set raises MANAGER_BU_NOT_OWNED.",
			},
			{
				q: "I want to add branch-level READ enforcement (jobs, reports) — where do I start?",
				a: "This isn't built yet — user_bu_role_branch only exists to record the restriction, nothing reads it outside the assignment screens themselves. Expect to touch most genericQuery report/list resolvers; treat it as a new, separate piece of work, not an extension of this one.",
			},
			{
				q: "Does setting a client to Basic retroactively enforce the cap on an existing multi-user or multi-branch client?",
				a: "No — the checks only fire on a NEW business-user or NEW branch insert. A client already over the cap when downgraded to Basic keeps what it has; nothing removes users or branches automatically. What should happen here isn't decided (plans/plan.md flags this explicitly).",
			},
		],
	},

	// ── Category 6: Multi-Tenancy & Provisioning ─────────────────────────────

	{
		id: "dev-cost-correction",
		category: "Jobs",
		title: "Job Cost Correction — Implementation",
		summary:
			"SET_JOB_COST_CORRECTION via genericUpdateScript, why the per-table rights map cannot serve it, and where every guard lives.",
		tags: [
			"cost correction",
			"SET_JOB_COST_CORRECTION",
			"JOBS_CORRECT_COST",
			"genericUpdateScript",
			"GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS",
			"job_part_used",
			"job_additional_charge",
		],
		content: [
			{
				type: "para",
				text: "Cost correction edits cost_price on rows that already exist in job_part_used / job_additional_charge, at any job status including delivered, closed and posted. No row is inserted, no row is deleted, and no other column is written. Selling price, job.amount, the invoice, receipts and stock are never touched.",
			},
			{ type: "heading", text: "The write path" },
			{
				type: "table",
				headers: ["Piece", "Where"],
				rows: [
					[
						"SQL",
						"SqlStore.SET_JOB_COST_CORRECTION in app/db/sql/sql_jobs.py — a single statement with input / valid / upd_parts / upd_charges CTEs",
					],
					["Mutation", "The existing genericUpdateScript — no new resolver, no schema.graphql change"],
					["Right", "JOBS_CORRECT_COST (access_right id 18), MANAGER only"],
					[
						"Rights map",
						"JOBS_GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS in jobs/mutations.py, merged into GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS in mutation.py",
					],
					[
						"Guard",
						"_require_generic_update_script_right() reads sql_id off the payload and calls require_access_right()",
					],
					["Read query", "SqlStore.GET_JOB_COST_LINES — both tables UNIONed into one branch-scoped result"],
					[
						"Client",
						"features/client/components/jobs/cost-correction/ — modal, save function, schema, helpers",
					],
				],
			},
			{ type: "heading", text: "Why not plain genericUpdate" },
			{
				type: "para",
				text: "_require_generic_update_table_right() reads only the top-level tableName and never walks xDetails, which leaves two dead ends. Sending tableName 'job' with the two tables nested (the finalizeJobSave shape) means the guard never sees them, so no right can be applied at all. Sending job_part_used / job_additional_charge top-level is guardable, but GENERIC_UPDATE_TABLE_RIGHTS is keyed per table — registering either against JOBS_CORRECT_COST would also gate part-used-section.tsx, edit-part-used-dialog.tsx, delete-part-used-dialog.tsx and job-charges-modal.tsx, all Receptionist-usable today.",
			},
			{
				type: "para",
				text: "genericUpdateScript's rights map is keyed per sql_id instead, so the right applies to this one operation and nothing else. That keying is the whole reason the feature went this way.",
			},
			{ type: "heading", text: "Every guard lives in the SQL" },
			{
				type: "bullets",
				items: [
					"cost_price > 0 — the valid CTE drops non-positive costs.",
					"Ownership — the row must belong to this job_id AND this branch_id, checked with EXISTS against job.",
					"Column allowlist — both UPDATEs hardcode SET cost_price, so the payload cannot reach selling_price or qty however it is crafted.",
					"DISTINCT ON (line_table, id) — without it, a payload repeating an id with two different costs makes UPDATE ... FROM valid non-deterministic.",
					"The statement returns submitted vs updated; a mismatch means rows were rejected, and the client treats that as a failure rather than success.",
				],
			},
			{
				type: "note",
				text: "This matters because genericUpdate writes whatever keys the payload carries. With no audit trail, these server-side guarantees are the only thing holding the feature's safety case up — do not move any of them into the client.",
			},
			{ type: "heading", text: "The (spare|parts) pattern lives in two places" },
			{
				type: "table",
				headers: ["Location", "Form"],
				rows: [
					[
						"sql_jobs.py — missing_cost_lines on GET_DELIVERED_JOBS_PAGED and GET_DELIVERABLE_JOBS_PAGED",
						"charge_name ~* '(spare|parts)'",
					],
					[
						"jobs/charge-cost-rule.ts — the one client-side copy",
						"SPARE_CHARGE_PATTERN = /(spare|parts)/i, exposed as chargeNeedsCost()",
					],
				],
			},
			{
				type: "para",
				text: "Three client sites consume charge-cost-rule.ts and none of them restate the regex: cost-correction-helpers.ts (needsCost / isMissingCost), finalize-job-save.ts (the zeroCostCharges filter that blocks Finalize) and final-job-form.tsx (isChargeCostMissing — the red Cost cell). The Cost column on the Additional Charges table deliberately carries no red asterisk, because the column is not mandatory on every row.",
			},
			{
				type: "warning",
				text: "Change one, change both — they define the same 'this charge needs a cost' rule, and a drift shows up as a badge count that disagrees with what the editor flags. Until this was fixed, finalize-job-save.ts held a fourth, stricter rule of its own (cost > 0 on every named charge), which rejected zero-cost labour charges the badge and the Correct Costs modal were happy with.",
			},
			{ type: "heading", text: "No audit trail — deliberate" },
			{
				type: "para",
				text: "There is no audit table, no reason field, and nothing is shown about who changed a cost or when. job_part_used gets updated_at = now() only because the column already exists; job_additional_charge has no such column and one was deliberately not added. If an audit requirement ever arrives, it is a new feature, not a bug fix.",
			},
		],
		faqs: [
			{
				q: "Why is the action allowed on a posted job when Revise Final and Undo Final are not?",
				a: "Those two rewrite customer-facing and accounting-relevant data. Cost correction writes one internal column that no invoice, receipt, or posting reads — so the posted state is irrelevant to it. The dropdown items deliberately omit the is_posted disabled/title attributes for that reason.",
			},
			{
				q: "Do I need to add anything to schema.graphql for a new sql_id like this?",
				a: "No. genericUpdateScript already exists on both sides; a new operation is a new SqlStore attribute plus, if it needs gating, one entry in a domain's *_GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS dict.",
			},
			{
				q: "How does an existing tenant get access_right id 18?",
				a: "Super Admin → the seed-roles dialog re-runs the access-rights seed on open and upgrades tenants seeded before the code existed (ON CONFLICT DO NOTHING). See 'Seeding Roles & Access Rights'.",
			},
			{
				q: "Why does the client still check cost > 0 if the SQL already does?",
				a: "For the error message and to keep Save disabled. It is convenience only — the server rejects the row regardless, and the client treats an updated/submitted mismatch as a failure.",
			},
		],
	},

	{
		id: "dev-charge-lock-back-calc",
		category: "Jobs",
		title: "Charge Lock on Apply (Back-Calculation) — Implementation",
		summary:
			"is_locked is UI-only session state on EditableChargeLine; the two computeBackCalc edit points that must both honour it, and why it is deliberately never persisted.",
		tags: [
			"is_locked",
			"charge lock",
			"back calculation",
			"computeBackCalc",
			"applyBackCalc",
			"scaleCharges",
			"chargeUpsertRows",
			"EditableChargeLine",
			"isLastResortCharge",
		],
		content: [
			{
				type: "para",
				text: "A Lock checkbox on each Additional Charge row in the finalize form excludes that row from Apply (target-amount back-calculation), in both directions and at every step. Parts have no equivalent — the cost-price floor is their protection. The column is hidden on warranty jobs, where selling prices are hidden and the amount is always ₹0.",
			},
			{ type: "heading", text: "Where it lives" },
			{
				type: "table",
				headers: ["Piece", "Where"],
				rows: [
					[
						"The field",
						"EditableChargeLine.is_locked: boolean in final-a-job-schema.ts — a real boolean, unlike the strings every other editable field uses (those are strings because they are bound to text inputs mid-typing)",
					],
					[
						"Seeded false",
						"emptyChargeLine(), plus both load sites: final-a-job-section.tsx and job-control/final-job-dialog.tsx",
					],
					["Apply logic", "computeBackCalc() in final-job-form.tsx — two edit points, below"],
					[
						"The column",
						"The Additional Charges table in final-job-form.tsx, wired to onPatchCharge (a Partial<EditableChargeLine>), never onUpdateCharge (typed for string fields only)",
					],
					[
						"Never saved",
						"chargeUpsertRows in finalize-job-save.ts — an explicit field allowlist that structurally cannot carry it",
					],
				],
			},
			{
				type: "note",
				text: "final-job-dialog.tsx reuses FinalJobForm, so the form and Apply changes cover both finalize surfaces at once. Only the load mapping is duplicated — a new field on the line type needs adding in both places.",
			},
			{ type: "heading", text: "computeBackCalc has two edit points, and both must exclude locked rows" },
			{
				type: "bullets",
				items: [
					"activeCharges — filtering locked rows out of the active set removes them from step 2 (other charges) and step 4 (Labour/Service) in one stroke. scaleCharges already takes (allCharges, active, …) and patches only keys present in active, so it needed no change at all.",
					"Step 2's zero-out fallback — it walks curCharges() (the full list), not active, so the !c.is_locked predicate has to be repeated there or a locked row gets zeroed.",
				],
			},
			{
				type: "warning",
				text: "total() is deliberately NOT filtered. A locked row still counts toward the job total — locking changes what Apply moves, never what it measures. Filtering it there would silently redefine the target.",
			},
			{
				type: "para",
				text: "scaleCharges, scaleParts, allocateFloored, pickResidualKey and snapInclToWholeRupee are all untouched by this feature.",
			},
			{ type: "heading", text: "It must never reach the database" },
			{
				type: "para",
				text: "There is no is_locked column on job_additional_charge and there is not meant to be one. chargeUpsertRows builds each row as an explicit field allowlist rather than a spread of the line object, which is the only thing keeping is_locked out of the payload — and genericUpdate writes whatever keys the payload carries. Refactoring that mapping to `...c` breaks the save. There is a comment there saying so; keep it.",
			},
			{ type: "heading", text: "Why it is not persisted — settled, do not re-litigate" },
			{
				type: "bullets",
				items: [
					"The durable need is already met. isLastResortCharge() permanently holds Labour and Service Charge back until every other lever is exhausted — 'we never discount labour' is enforced with no user action and no storage.",
					"What is left is inherently in-session: ad-hoc per-negotiation cases ('on this job the diagnostic fee stays at ₹500'). The lock's work is finished at Apply time.",
					"Persisting creates stale-state surprise — a checkbox ticked three weeks ago silently constraining today's Apply on a job someone else is revising.",
					"The cost was real: no migration framework here, so a column meant a manual ALTER TABLE per already-provisioned tenant plus defensive ?? false fallbacks on every load site during rollout.",
				],
			},
			{
				type: "para",
				text: "The one thing persistence would have bought — locks surviving a revise — is covered instead by an inline hint near the Target Amount field, shown when an already-finalized job is reopened with a target set.",
			},
			{ type: "heading", text: "Deliberately out of scope" },
			{
				type: "bullets",
				items: [
					"Reset Prices and the division/GST change both rebuild charges with prev.map(c => ({ ...c, … })) and rewrite only gst_rate, hsn_code and sale_pr_gst — unlisted fields survive, so locks survive both for free. Do not add lock handling to either.",
					"Job Pipeline's charges modal (job-charges-modal.tsx) has no Apply, so it gets no Lock column and no change.",
					"No persistence means no audit, no history and no cross-user visibility. Two people editing the same job see independent locks.",
				],
			},
		],
		faqs: [
			{
				q: "Why a field on the line rather than a Set of locked _keys?",
				a: "It then flows through patchChargeLine, the reset helper and the division-change helper for free, and it cannot reach the database anyway because chargeUpsertRows is an allowlist.",
			},
			{
				q: "Does locking disable the Sale input?",
				a: "No, deliberately. Lock blocks Apply, not typing. The locked row's Sale box gets an amber ring as a cue and stays fully editable.",
			},
			{
				q: "A user locked everything and now Save & Mark Final is blocked.",
				a: "Expected, and not a regression. The hard block in finalize-job-save.ts fires whenever the target and the line total disagree by more than ₹0.02. They unlock a charge, change the target, or clear the Target Amount field. This is the most likely support question the feature generates — it is covered in the client help article.",
			},
			{
				q: "Why do Parts get no lock?",
				a: "The cost-price floor already stops Apply discounting a part into a loss in step 1, and step 3 (below cost) only runs when every charge is at zero. A per-part lock would add a second protection mechanism for the same problem.",
			},
		],
	},

	{
		id: "dev-job-control-receipt-chip",
		category: "Jobs",
		title: "Job Control Receipt Chip (Rec:) — Implementation",
		summary:
			"receipt_total on GET_JOB_SEARCH_PAGED feeds the 'Rec: ₹…' chip in Job Control's Customer column; where it lives and what it deliberately does not do.",
		tags: ["job control", "receipt_total", "job_payment", "GET_JOB_SEARCH_PAGED", "GET_JOB_CONTROL_PAGED", "chip"],
		content: [
			{
				type: "para",
				text: "Job Control's grid shows a 'Rec: ₹…' chip under the customer name (below the GSTIN chip) with the sum of every job_payment row for that job. It is display-only — no click action — and is hidden when the total is 0.",
			},
			{
				type: "table",
				headers: ["Piece", "Where"],
				rows: [
					[
						"The column",
						"receipt_total in GET_JOB_SEARCH_PAGED (sql_jobs.py) — a correlated COALESCE(SUM(jp.amount), 0) subquery on job_payment, served by idx_job_payment_job",
					],
					[
						"Client alias",
						"SQL_MAP.GET_JOB_CONTROL_PAGED maps to that server id; Job Control is its only caller",
					],
					["The type", "JobControlRow.receipt_total (features/client/types/job.ts), optional"],
					[
						"The chip",
						"Customer cell in job-control-section.tsx, formatted with formatCurrency from lib/utils; Number() wraps the value because numeric sums can arrive as strings",
					],
				],
			},
			{
				type: "note",
				text: "GET_JOB_SEARCH_COUNT is untouched — the total is per row, not a filter. The Job Pipeline drilldown uses its own query and does not show the chip; adding it there means adding the same subquery to that SQL.",
			},
		],
		faqs: [
			{
				q: "Does the chip include receipts that are not yet posted to accounts?",
				a: "Yes. It sums every job_payment row regardless of is_posted — it answers 'how much has the customer paid', not 'what has reached the books'.",
			},
		],
	},

	{
		id: "dev-client-lifecycle",
		category: "Multi-Tenancy & Provisioning",
		title: "Client Lifecycle (Super Admin)",
		summary: "Add Client → Initialize Client → Create Admin User → Activate, and the reverse path.",
		tags: ["client lifecycle", "add client", "initialize client", "activate", "deactivate", "delete client"],
		content: [
			{
				type: "steps",
				items: [
					"Add Client (add-client-dialog.tsx) — creates the public.client registry row: code, name, email, GSTIN, etc.",
					"Initialize Client (initialize-client-dialog.tsx, attach-db-dialog.tsx) — provisions the tenant's dedicated database, business + security schemas, and seeds roles/access rights.",
					"Create Admin User (create-admin-dialog.tsx) — the first Type A (Business Admin) login for that client.",
					"Mail credentials (mail-admin-credentials-dialog.tsx) — sends the new admin their login details.",
					"Activate (activate-client-dialog.tsx) — makes the client usable.",
				],
			},
			{ type: "heading", text: "Winding down" },
			{
				type: "bullets",
				items: [
					"Deactivate (deactivate-client-dialog.tsx) — blocks access without deleting data.",
					"Detach DB (detach-db-dialog.tsx) — disassociates a database from a client record without dropping it.",
					"Delete Client (delete-client-dialog.tsx) — removes the client record.",
					"Deactivate Admin / Edit Admin (deactivate-admin-dialog.tsx, edit-admin-dialog.tsx) — manage the Type A user itself.",
					"Orphaned Databases (orphan-databases-dialog.tsx) — maintenance tool for tenant databases with no matching client record.",
				],
			},
			{
				type: "note",
				text: "All of the above live under src/features/super-admin/components/ — the same directory this help system's own trigger and content file live in.",
			},
		],
		faqs: [
			{
				q: "What's the minimum sequence to get a brand-new client usable end to end?",
				a: "Add Client → Initialize Client → Create Admin User → Activate. Skipping Initialize Client leaves the client with no database at all — nothing else will work.",
			},
			{
				q: "Can a client be re-attached to a different database?",
				a: "Detach DB followed by Attach DB (attach-db-dialog.tsx) — used for edge cases like restoring a client onto a migrated or recovered database.",
			},
		],
	},

	{
		id: "dev-bu-lifecycle",
		category: "Multi-Tenancy & Provisioning",
		title: "Business Unit Lifecycle (Admin Mode)",
		summary:
			"Create Business Unit → Create Schema & Seed Data → Create Business User → Associate BU/Role → Activate.",
		tags: [
			"business unit lifecycle",
			"create business unit",
			"create schema",
			"business user",
			"associate bu role",
		],
		content: [
			{
				type: "steps",
				items: [
					"Create Business Unit (create-business-unit-dialog.tsx) — the company record; starts with schema Missing.",
					"Create Schema & Seed Data (create-bu-schema-dialog.tsx) — provisions the BU's dedicated schema inside the tenant database.",
					"Create Business User (create-business-user-dialog.tsx) — a login for this client company.",
					"Associate BU / Role (associate-bu-role-dialog.tsx) — the step that actually grants access: pick Business Unit(s) + exactly one Role.",
					"Mail credentials (mail-business-user-credentials-dialog.tsx) — send the new user their login.",
					"Activate Business Unit / Activate Business User (activate-business-unit-dialog.tsx, activate-business-user-dialog.tsx).",
				],
			},
			{
				type: "note",
				text: "All of these live under src/features/admin/components/ — moved there from super-admin/ in a folder rename (see plan-access-control.md's Status section), since this is Business-Admin-scoped tooling (userType 'A'), distinct from the platform-level Super Admin tier.",
			},
			{
				type: "para",
				text: "Full end-user-facing detail on this exact flow already exists in the Client Mode help center's Access Management category ('Business Units — Provisioning a Client Company', 'Granting Access: Associate BU / Role') — this article is the developer-facing index into the same flow, pointing at the actual component files.",
			},
		],
		faqs: [
			{
				q: "Why do Business Unit dialogs live in features/admin/ but Client dialogs live in features/super-admin/?",
				a: "They're scoped to different tiers — Admin Mode (userType 'A', one client company at a time) vs. the platform-level Super Admin tier (userType 'S', spans all clients). See 'Three Operating Modes & Routing'.",
			},
			{
				q: "Is Business Unit deletion available from the UI?",
				a: "Yes, but only once Inactive — see delete-business-unit-dialog.tsx and the equivalent end-user article for the exact confirmation flow (typed-code confirmation required).",
			},
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
			{
				type: "para",
				text: "service-plus-server's container serves both the FastAPI API and the built React dist/ from the same nginx instance — the client isn't hosted separately in production. service-plus-file-server runs in its own separate container/port (9000).",
			},
			{ type: "heading", text: "Nginx config (service-plus-server.conf)" },
			{
				type: "table",
				headers: ["Location", "Behavior"],
				rows: [
					["/", "Serves the React dist/ static build; try_files $uri /index.html for client-side routing"],
					["/health", "Proxies to FastAPI on 127.0.0.1:8000"],
					["/api/", "Proxies REST calls to FastAPI"],
					[
						"/graphql/",
						"Proxies GraphQL, with Upgrade/Connection headers set — required for subscription WebSocket support",
					],
				],
			},
			{
				type: "note",
				text: "nginx's default site and autostart are deliberately disabled (rm /etc/nginx/sites-enabled/default, systemctl disable nginx) — nginx is started manually from startup.sh instead, alongside uvicorn, so both processes come up together on container boot rather than nginx racing ahead with a stale default page.",
			},
		],
		faqs: [
			{
				q: "Why disable nginx autostart instead of just leaving it enabled?",
				a: "So the deploy process controls startup ordering explicitly via startup.sh (nginx first, then export APP_ENV, then uvicorn) rather than relying on systemd's own ordering, which could start nginx before the app code is even unzipped in a fresh container.",
			},
			{
				q: "What breaks if the /graphql/ location is missing the Upgrade/Connection headers?",
				a: "GraphQL subscriptions (WebSocket-based) fail to connect — regular queries/mutations over plain HTTP still work fine, only real-time subscriptions are affected.",
			},
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
			{
				type: "steps",
				items: [
					"sudo nginx & — start nginx in the background.",
					"export APP_ENV=production.",
					"cd into the deployed app folder and run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload.",
				],
			},
			{ type: "heading", text: "Manual/local-to-server deploy flow" },
			{
				type: "steps",
				items: [
					"Build the client (npm run build for the React app) and copy dist/ alongside the server code into a local 'final' folder.",
					"Zip it (final.zip) and run the local deploy.sh, or upload manually to /usr/share/nginx/html.",
					"On the server, an extract script at /usr/local/bin/extract (chmod +x once) unzips the upload in place.",
					"Restart the server process (or the whole container) to pick up the new code.",
				],
			},
			{
				type: "note",
				text: 'APP_ENV is read in code as env: str = os.getenv("APP_ENV", "dev") — defaulting to dev locally, explicitly set to production by startup.sh in deployed environments. Anything in config.py that branches on environment should read this same variable, not invent a second one.',
			},
		],
		faqs: [
			{
				q: "Where does the file-server's deploy differ from the main server's?",
				a: "Same shape (zip, upload, startup.sh) but its startup.sh only runs uvicorn on port 9000 with --host 0.0.0.0 (not 127.0.0.1) so external callers — not just the same container — can reach it directly; it does not run its own nginx.",
			},
			{
				q: "Why --host 0.0.0.0 for the file-server but 127.0.0.1 for the main server?",
				a: "The main server's uvicorn is only ever called by its own container's nginx (127.0.0.1 is sufficient); the file-server has no nginx in front of it in this setup, so it must bind externally to be reachable at all.",
			},
		],
	},

	{
		id: "dev-environments-secrets",
		category: "Deployment & Infrastructure",
		title: "Environments & Secrets",
		summary: "Windows/Kubuntu venv setup, samba sharing, and where connection secrets live.",
		tags: ["environments", "venv", "kubuntu", "windows", "samba", "secrets", "conn string"],
		content: [
			{
				type: "table",
				headers: ["Task", "How"],
				rows: [
					["Windows venv", "python -m pip install virtualenv; python -m venv env; env\\Scripts\\activate"],
					[
						"Kubuntu venv",
						"sudo apt install python3-venv (or python3.14-venv for a specific version); python3 -m venv env; source env/bin/activate",
					],
					[
						"Cross-machine file sharing (Kubuntu ↔ Windows dev)",
						"Install Samba on Kubuntu, share the folder, connect from Windows Explorer via \\\\<kubuntu-ip>",
					],
				],
			},
			{ type: "heading", text: "Where secrets actually live" },
			{
				type: "para",
				text: "The most sensitive secret in this system is the per-tenant database connection string used for cross-system posting to Trace Plus — stored encrypted in division.account_setting.*.conn (JSONB, encrypted string), decrypted only server-side. See 'Division & Account Setting' and 'Accounts Posting (Trace Plus) — Implementation' for the full shape.",
			},
		],
		faqs: [
			{
				q: "Are API keys ever committed to the repo?",
				a: "Treat anything found in notes/*.md as a leaked development-time convenience, not a sanctioned secrets-management practice — production secrets should come from environment variables or a secrets manager, read via config.py's pydantic-settings, not hardcoded or note-file-stored.",
			},
			{
				q: "How is the encrypted conn string in account_setting produced?",
				a: "Encrypted server-side before being written to the division row; the exact decrypt path is in the server's accountsPosting resolver — see 'Accounts Posting (Trace Plus) — Implementation'.",
			},
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
			{
				type: "para",
				text: "App Settings (Configurations → App Settings in Client Mode) is backed by a simple key-value table, app_setting, in the business schema. Document numbering is backed by document_sequence + document_type.",
			},
			{
				type: "table",
				headers: ["Setting key", "Controls"],
				rows: [
					["default_gst_rate", "Fallback GST rate when a part has no specific rate"],
					["default_hsn_for_spare_part / default_hsn_for_service_charge", "Fallback HSN codes"],
					["no_of_job_sheets_per_print / no_of_job_invoices_per_print", "Print copy counts"],
					["show_parts_in_job_invoice", "JSON controlling the merged-line invoice fallback label/HSN/GST"],
					["markup_percent_over_cost", "Auto-markup for selling price = cost × (1 + markup%)"],
					[
						"post_data_to_accounts",
						"Feature-flags the whole Trace Plus integration (Jobs → Accounts Posting) — read client-side in layout/client-layout.tsx and dispatched into Redux at app load",
					],
					[
						"whatsapp_notifications",
						"Per-event on/off switch for outbound WhatsApp sends ({JOB_CREATION, JOB_COMPLETION, JOB_DELIVERY, JOB_MONEY_RECEIPT, JOB_INVOICE, EXTENDED_WARRANTY} booleans, only JOB_COMPLETION seeded true) — read server-side, in app/whatsapp/sender.py's _is_event_enabled(), not by the client. See 'WhatsApp Integration — Implementation' for the fail-closed gating logic.",
					],
					[
						"extended_warranty (id 16)",
						"JSON {contact_phone, daily_send_cap, enabled, notify_email, staff_whatsapp_number, whatsapp_number}. enabled (strictly true) is read client-side in layout/client-layout.tsx into Redux (extendedWarrantyEnabled — shows Custom → Extended Warranty) and server-side by app/whatsapp/ew_sender.py; sending also needs whatsapp_notifications.EXTENDED_WARRANTY. Edited in its own dialog, edit-extended-warranty-dialog.tsx. See 'Extended Warranty — Lead State Machine'.",
					],
				],
			},
			{ type: "heading", text: "document_sequence" },
			{
				type: "para",
				text: "Required sequences: JOB_SHEET, SERVICE_INVOICE, MONEY_RECEIPT, SALES_INVOICE — each with prefix/separator/padding/next-number columns. JOB_SHEET, PURCHASE_INVOICE, and PURCHASE_RETURN_INVOICE numbering is branch-wide (division_id IS NULL); SERVICE_INVOICE/MONEY_RECEIPT/SALES_INVOICE are configured per-division. A sequence with no prefix causes a runtime save failure — see 'Common Dev-Time Issues' and the end-user 'Document Sequences' article.",
			},
			{
				type: "note",
				text: "seed_bu_data.py's BU_SEED_SQL (reverted/updated 2026-09-18) pre-populates document_sequence for the auto-created 'HO' branch: JOB_SHEET→'J', PURCHASE_INVOICE→'P', PURCHASE_RETURN_INVOICE→'PR', all with next_number=1, padding=5, separator='/', division_id NULL — matching document-sequence-section.tsx's own client-side fallback defaults (next_number ?? 1, padding ?? 5, separator ?? '/') so the saved row and an unsaved/blank row render identically. Inserted via JOIN branch/document_type + WHERE NOT EXISTS (same idiom as the branch insert above it), so it's safe on re-seed and never overwrites a value an Admin already changed. SERVICE_INVOICE/MONEY_RECEIPT/SALES_INVOICE are NOT pre-seeded — they're per-division and no division exists yet at BU-creation time.",
			},
		],
		faqs: [
			{
				q: "Where does client-layout.tsx read app_setting from?",
				a: "A genericQuery call with sqlId: SQL_MAP.GET_APP_SETTINGS, dispatched into context-slice.ts's setDefaultGstRate/setMarkupPercentOverCost/etc. actions on every mount when dbName+schema are available. (File: layout/client-layout.tsx.)",
			},
			{
				q: "Is there server-side validation that a required document_sequence exists before allowing a job/invoice save?",
				a: "The failure mode described in notes/todo.md ('Document numbering and auto series') was originally a raw SQL execute failure with a generic client error — check current sql_store.py / resolver behavior for whether a friendlier pre-check has since been added.",
			},
		],
	},

	{
		id: "dev-division-account-setting",
		category: "Configuration",
		title: "Division & Account Setting",
		summary: "The division.account_setting JSONB shape that drives GST mode and Trace Plus posting.",
		tags: ["division", "account_setting", "jsonb", "gstin", "trace plus", "gst mode"],
		content: [
			{
				type: "para",
				text: "A division is GST if its GSTIN field is filled, non-GST if blank — this single field drives invoice tax-calculation mode throughout Client Mode.",
			},
			{
				type: "para",
				text: "division carries an additional account_setting JSONB column, populated only when post_data_to_accounts is enabled, used exclusively for the Trace Plus accounting integration. Shape (from notes/todo.md's 'New field in division'):",
			},
			{
				type: "table",
				headers: ["Key", "Purpose"],
				rows: [
					["clientCode, buCode, branchId", "Identify the target Trace Plus tenant/BU/branch to post into"],
					["receipt.debitAccountId / creditAccountId", "Ledger account mapping for money-receipt postings"],
					[
						"purchaseInvoice.{debitAccountId,creditAccountId,productCode,defaultProductHsn,defaultGstRate}",
						"Mapping for purchase-invoice postings",
					],
					["salesInvoice.{...same shape}", "Mapping for sales-invoice postings"],
					["jobInvoice.{...same shape}", "Mapping for job-invoice postings"],
				],
			},
			{
				type: "note",
				text: "The Configurations → Divisions form in Client Mode only shows this JSON entry form when post_data_to_accounts is true — it's otherwise hidden, not just disabled, since it's meaningless without the integration turned on.",
			},
		],
		faqs: [
			{
				q: "Is account_setting the same shape across every transaction type?",
				a: "Each of receipt/purchaseInvoice/salesInvoice/jobInvoice has its own sub-object; purchase/sales/job invoice sub-objects share the same {debitAccountId, creditAccountId, productCode, defaultProductHsn, defaultGstRate} shape, while receipt only needs debit/credit account IDs (no product/HSN/GST fields — receipts aren't taxable line items).",
			},
			{
				q: "Where is this JSON actually consumed?",
				a: "Server-side, in the accountsPosting mutation/resolver, which pulls clientCode/buCode/debitAccountId/creditAccountId etc. out of it to build the payload sent to Trace Plus — see 'Accounts Posting (Trace Plus) — Implementation'.",
			},
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
			{
				type: "para",
				text: "Trace Plus is a separate accounting system (its own FastAPI + GraphQL + Postgres server, repo at trace-plus/dev/trace-server) that Service+ posts financial documents into. The end-user-facing side of this is Jobs → Accounts Posting, documented in the Client Mode help center; this article is the implementation counterpart.",
			},
			{ type: "heading", text: "The is_posted pattern" },
			{
				type: "para",
				text: "job_payment, purchase_invoice, sales_invoice, and job_invoice each carry an is_posted flag. Posting sends unposted rows to Trace Plus and flips the flag on success. Once posted, a record is locked from edit/delete/regenerate in Client Mode until it's unposted again via Admin → Post/Unpost.",
			},
			{ type: "heading", text: "The accountsPosting mutation (both ends)" },
			{
				type: "steps",
				items: [
					"service-plus-server's accountsPosting: reads account_setting off the division (see 'Division & Account Setting'), fetches not-yet-posted records for the given document type, and maps them into Trace Plus's expected payload shape (TranH header with nested TranD lines, ExtGstTranD for GST detail, SalePurchaseDetails for product/quantity/price detail).",
					"Account ID substitution: each line's accId is replaced by debitAccountId or creditAccountId from account_setting, chosen by the line's dc ('D' or 'C') — the substitution direction differs slightly between money-receipt lines and purchase/sales/job-invoice lines, so check the exact dc→id mapping in mutation_helper.py rather than assuming it's symmetric.",
					"The connection string to Trace Plus's own per-client database (dbParams.conn) is an encrypted string, decrypted only server-side, never exposed to the client.",
					"trace-server's own accountPosting mutation receives clientCode/buCode/data, looks up the target database via its traceAuth registry, fills in the connection, and calls its internal validateDebitCreditAndUpdate mutation to actually post.",
				],
			},
			{
				type: "note",
				text: "The client's role is narrow: Jobs → Accounts Posting shows unposted-record counts per division/document-type and a 'Post data to Trace Plus' button with a live progress bar (records processed, current division, % complete, failure count) — all the mapping and cross-system auth happens server-side.",
			},
		],
		faqs: [
			{
				q: "Does the client ever see the Trace Plus connection string?",
				a: "No — it stays encrypted in division.account_setting and is only decrypted inside the server's accountsPosting resolver, immediately before the cross-system call.",
			},
			{
				q: "What happens to records that fail to post?",
				a: "They stay is_posted = false and are retried on the next posting run — the progress bar surfaces a failure count so an operator can investigate (commonly a missing GSTIN or an unmapped account/product code) before retrying.",
			},
			{
				q: "Is authentication between service-plus-server and trace-server handled the same way as client-facing auth?",
				a: "It's a separate, server-to-server concern from the client-facing JWT flow — see the current accountsPosting resolver implementation for exactly how that handshake is authenticated today, as this is one of the areas flagged for 'best practices, no need to write detailed code' design-phase treatment in notes/todo.md and may have evolved since.",
			},
		],
	},

	{
		id: "dev-whatsapp-integration",
		category: "WhatsApp",
		title: "WhatsApp Integration — Implementation",
		summary:
			"Five events on one send rail, Meta's own delivery webhook for tracking, tenant + event routing via biz_opaque_callback_data, token-gated public PDFs, and a per-attempt send history inside the same jsonb — still no document/media send path.",
		tags: [
			"whatsapp",
			"whatsapp integration",
			"whatsapp_notifications",
			"sendWhatsappCompletion",
			"sendWhatsappJobIntake",
			"sendWhatsappJobDelivery",
			"sendWhatsappMoneyReceipt",
			"sendWhatsappJobInvoice",
			"biz_opaque_callback_data",
			"customer connect",
			"job intake",
			"job delivery",
			"money receipt",
			"job invoice",
			"attempts",
			"send history",
			"meta cloud api",
			"webhook",
			"jsonb_set",
			"token.py",
			"job_intake_router",
		],
		content: [
			{
				type: "para",
				text: "This article is the as-built implementation summary for the shared WhatsApp rail, kept current across five builds: the original completion notice (Customer Connect), the Job Intake Notice (plans/plan-whatsapp.md), paperless Job Delivery (plan-wa-delivery.md), the Money Receipt send (plan-wa-money-receipt.md) and the Invoice resend (plan-wa-invoice-resend.md). Extended Warranty (plans/plan-ew-final.md) rides the same Meta client, templates, token module and webhook but keeps its own tables and sender, so it is not one of the five — see 'Extended Warranty — Lead State Machine'. Every one of those plan docs still carries a stale '(not implemented yet)' in its title — read the per-step Done markers inside them, not the heading. Two sibling articles go deeper where an event breaks the shared pattern: 'Paperless Job Delivery' (the OTP subsystem) and 'Money Receipt & Invoice Sends' (the array-shaped log and the second token pair). Everything on this page is what all five events share. Direct Meta WhatsApp Cloud API, one shared phone_number_id across all tenants, no BSP intermediary and no provider-registry abstraction.",
			},
			{
				type: "note",
				text: "When testing this locally, run the server from dev/service-plus-server — never deployment/app-server/service-plus-server. Both exist in this monorepo and look identical, but only dev/service-plus-server is the one uvicorn --reload actually watches; the deployment/ copy is a separate, unrelated, non-running mirror. Editing the wrong one produces no errors and no effect, which reads exactly like a fix that silently isn't working.",
			},
			{ type: "heading", text: "The five events" },
			{
				type: "table",
				headers: ["event_key", "Mutation", "Trigger screen", "Grouped?", "jsonb shape"],
				rows: [
					[
						"JOB_CREATION",
						"sendWhatsappJobIntake",
						"New Job / Batch Job, job detail view",
						"Yes — by customer_contact_id, 35/message",
						"flat object",
					],
					[
						"JOB_COMPLETION",
						"sendWhatsappCompletion",
						"Customer Connect (the only sending tab)",
						"Yes — same",
						"flat object",
					],
					[
						"JOB_DELIVERY",
						"sendWhatsappJobDelivery",
						"delivery-modal.tsx, batch warranty jobs",
						"Yes — same, one shared OTP",
						"flat object + otp_*/confirmed_* fields",
					],
					[
						"JOB_MONEY_RECEIPT",
						"sendWhatsappMoneyReceipt",
						"receipts-section.tsx row actions",
						"No — one job_payment row per send",
						"ARRAY, one element per payment_id",
					],
					[
						"JOB_INVOICE",
						"sendWhatsappJobInvoice",
						"delivered-jobs-grid.tsx row actions",
						"No — one job per send",
						"flat object",
					],
				],
			},
			{
				type: "note",
				text: "JOB_MONEY_RECEIPT is the only event that does not fit the shared write/read stack — its array value needs its own SET_JOB_MONEY_RECEIPT_WHATSAPP_ATTEMPT and its own Customer Connect components. Every other event, including the two newest, reuses SET_JOB_WHATSAPP_ATTEMPT/_OUTCOME and GET_WHATSAPP_EVENT_LOG_PAGED unchanged, because those took %(event_key)s as a bind parameter from the start — a generalization that has now paid off three separate times.",
			},
			{
				type: "note",
				text: "The Job Completion grid's own read, GET_WHATSAPP_ELIGIBLE_JOBS_PAGED / _JOB_IDS / _COUNT (sql_jobs.py, JobsSql — separate from the shared GET_WHATSAPP_EVENT_LOG_PAGED above), was changed 2026-09-14 to sort and display by completion date, not intake date. All three now JOIN job_transaction jtx ON jtx.id = j.last_transaction_id and sort ORDER BY jtx.performed_at DESC, j.id DESC. This works with no status_id filter on the join because every row is already WHERE is_final = true AND job_status.code = 'COMPLETED_OK' — updateJob (mutations.py) always writes job.job_status_id and the new job_transaction.status_id from the same value in one call, then repoints job.last_transaction_id at that new row, so a job currently reading COMPLETED_OK necessarily has last_transaction_id pointing at the transaction that put it there. ok_date is jtx.performed_at::date (a real DEFAULT now() timestamp, NOT job_transaction.transaction_date — final-a-job's finalize-job-save.ts writes transaction_date as a copy of job_date, so it would have shown the intake date again under a new name). The client still shows job_date too, moved from its own column to a second line under Job No (\'Job …\', customer-connect-grid.tsx) rather than dropped. The COUNT query got the same JOIN for the same reason GET_EW_LEADS_PAGED/_DETAIL share one projection: paging math must agree with what the page can actually list, or the pager and the grid disagree by however many rows the join would exclude.",
			},
			{ type: "heading", text: "Server: app/whatsapp/ package" },
			{
				type: "table",
				headers: ["File", "Role"],
				rows: [
					[
						"client.py",
						"send_template() only — the single call that touches Meta's HTTP API. It sends header + body components and, when the template has any, dynamic-URL button components (one parameter per button, e.g. JOB_CREATION's two 'token' buttons). upload_media() and any document/header branch are still gone — every template here is text + link, never a Meta-hosted attachment.",
					],
					[
						"templates.py",
						"TEMPLATES holds eight TemplateSpec entries for seven events: JOB_COMPLETION (job_completed_ready_for_pickup_v2), JOB_CREATION (job_intake_notice_v2), JOB_DELIVERY (job_delivery_notice_v1), JOB_DELIVERY_OTP (job_delivery_otp_v1 — the only AUTHENTICATION-category one, and why the entry count exceeds the event count), JOB_MONEY_RECEIPT (job_money_receipt_v1), JOB_INVOICE (job_invoice_v1), EXTENDED_WARRANTY (extended_warranty_reminder_v1, the only MARKETING one) and EXTENDED_WARRANTY_LEAD (extended_warranty_lead_alert_v1). The last two are sent by app/whatsapp/ew_sender.py (the Extended Warranty lead state machine); they were kept byte-for-byte through the 2026-09-13 rebuild, because any edit would mean resubmission. TemplateSpec carries header_params/body_params (Meta's named-parameter form for UTILITY templates — a param-name/slot mismatch is impossible by construction; AUTHENTICATION is positional-only, Meta's rule not ours) plus button_count: how many dynamic-URL buttons the template has, in button order — 0 for JOB_COMPLETION, 2 for JOB_CREATION and JOB_DELIVERY (both buttons carry the identical token), 1 for JOB_MONEY_RECEIPT, JOB_INVOICE, EXTENDED_WARRANTY and EXTENDED_WARRANTY_LEAD. It replaced a named button_params list after two production sends shipped broken on 2026-08-30: a button URL takes no placeholder at all, only a bare static prefix the sent value is appended to. An approved template can't be edited — a wording change means a new _vN name and a fresh Meta review.",
					],
					[
						"mobile.py",
						"is_valid_mobile()/normalize_mobile() — same validation the client mirrors, shared by every event.",
					],
					[
						"token.py",
						"THREE independent signing pairs over the same HMAC-SHA256 scheme and helpers (_b64url/_signature). The third, sign_ew(db_name, schema, ew_lead_id, ew_message_id, ttl_days=180)/verify_ew(token) — payload EWL|db_name|schema|ew_lead_id|ew_message_id|exp — backs the Extended Warranty reminder's button; its EWL type tag exists because sign_receipt's five-field payload has exactly the shape an untagged lead token would have, so without it a receipt link would verify as a lead link. sign(db_name, schema, job_ids, ttl_days=730)/verify(token) — payload db_name|schema|job_ids|exp — backs the JOB_CREATION status page and job slip, both JOB_DELIVERY PDF buttons, and JOB_INVOICE (reused unchanged; it was written generic, never OTP-specific). sign_receipt(db_name, schema, job_id, payment_id)/verify_receipt(token) — payload db_name|schema|job_id|payment_id|exp — exists only because the first pair cannot name a single payment row, and job_ids was deliberately not overloaded with a second meaning. None of them is the delivery OTP, which is a separate secret entirely (see \u2018Paperless Job Delivery\u2019).",
					],
					[
						"otp.py",
						"JOB_DELIVERY only \u2014 generate_otp() (4 digits, secrets.randbelow, never random) and the HMAC-SHA256 hash/compare used to store and check it. The code is never stored in plaintext, never logged, and never returned to the client.",
					],
					[
						"sender.py",
						"Every send path. The grouped events (JOB_CREATION/JOB_COMPLETION/JOB_DELIVERY): server-side re-filter (never trust the client's selection) \u2192 group by customer_contact_id \u2192 cap at MAX_JOBS_PER_WHATSAPP_MESSAGE (35) per customer, splitting into multiple messages above that \u2192 build biz_opaque_callback_data \u2192 send \u2192 _persist_attempt per job. The ungrouped ones (JOB_MONEY_RECEIPT/JOB_INVOICE) skip grouping and chunking entirely \u2014 one row in, one message out \u2014 and JOB_MONEY_RECEIPT persists through _persist_receipt_attempt instead, the array-shaped writer. _is_event_enabled() gates every event before any DB or Meta work happens. Also holds the delivery OTP lifecycle (OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS, verify/manual-override).",
					],
				],
			},
			{ type: "heading", text: "Tenant + event routing: biz_opaque_callback_data, not a table" },
			{
				type: "para",
				text: "A status webhook carries only a wamid — no job, customer, tenant, or event. Meta's send API accepts an arbitrary string, biz_opaque_callback_data, echoed back verbatim on every status callback for that message. Current format is 4-part, pipe-delimited: db_name|schema|event_code|job_id,job_id,… — event_code is a 2-letter abbreviation (CC=JOB_COMPLETION, JC=JOB_CREATION, JD=JOB_DELIVERY, MR=JOB_MONEY_RECEIPT, JI=JOB_INVOICE, plus EW=EXTENDED_WARRANTY and EL=EXTENDED_WARRANTY_LEAD, whose id list is [ew_message_id] rather than job ids) kept out of the full event-key vocabulary on the wire only, since every byte here subtracts from the 512-char cap available for job ids. The webhook decodes it back with _EVENT_KEY_BY_CODE before it goes near SQL, so event_key is always the full string by the time it reaches the database. A legacy 3-part payload (db_name|schema|job_ids, no event code — from before JOB_CREATION existed) is still decoded, treated as JOB_COMPLETION; both formats are accepted indefinitely since an old in-flight callback could arrive at any time.",
			},
			{ type: "heading", text: "Webhook receiver: app/routers/webhooks/whatsapp_webhook_router.py" },
			{
				type: "table",
				headers: ["Endpoint", "Role"],
				rows: [
					[
						"GET /api/webhooks/whatsapp",
						"Meta's one-time verification handshake — echoes hub.challenge as plain text when hub.verify_token matches WHATSAPP_WEBHOOK_VERIFY_TOKEN, 403 otherwise.",
					],
					[
						"POST /api/webhooks/whatsapp",
						"The real traffic. Verifies X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the App Secret) before trusting anything in the payload — biz_opaque_callback_data is attacker-controlled data otherwise. Parses entry[].changes[].value.statuses[] (Meta batches several per request), decodes biz_opaque_callback_data into db_name/schema/event_key/job_ids, applies the status ladder per job_id under that event's key, and always returns 200 — even for an unrecognized wamid or event code — since a 500 just buys an infinite Meta retry loop. The EW/EL codes branch off before the per-job loop to _apply_ew_status_callback, which settles ew_message by wamid (see 'Extended Warranty — Lead State Machine').",
					],
				],
			},
			{ type: "heading", text: "Public, token-gated pages: app/routers/public/" },
			{
				type: "para",
				text: "Every document a customer can reach is a plain URL button pointing back at this server — nothing is ever a WhatsApp document/media attachment. Four routers serve them, each 404ing plainly on a bad or expired token: job_intake_router.py (the no-login status page and the job-slip PDF, JOB_CREATION), job_delivery_router.py (the Delivery Note PDF and the Invoice PDF — the latter reused unchanged by JOB_INVOICE, since it verifies a token and queries by job_ids with no status filter at all), job_money_receipt_router.py (one payment row's receipt PDF, behind verify_receipt), and extended_warranty_router.py (the Extended Warranty landing page with its interest and opt-out forms, behind verify_ew, mounted at /extended-warranty/ with no /api prefix). All PDFs are reportlab, built server-side from whitelisted public SQL — deliberately not ports of the client's jsPDF builders.",
			},
			{
				type: "warning",
				text: "Each public prefix needs its own nginx location block in production. The SPA's catch-all intercepts anything not explicitly proxied first, which has already broken a release once — /job-intake/, /job-delivery/, /job-money-receipt/ and /extended-warranty/ are all proxied today, and any future public prefix must be added there before its buttons will work outside dev.",
			},
			{
				type: "note",
				text: "No app-setting holds this host — Meta bakes a template button's base URL into the template itself at registration time (not read from any DB value at send time), so service-plus-server's public host lives only in the Meta-registered template and plans/plan-whatsapp.md, not in app_setting.",
			},
			{ type: "heading", text: "Live push to the client: whatsappDeliveryStatus subscription" },
			{
				type: "para",
				text: "Neither Customer Connect nor any job-creation screen polls for delivery outcomes — the webhook handler publishes to app/graphql/pubsub.py's in-memory PubSub (the same one accountsPostingProgress already used) right after a status update actually applies. The whatsappDeliveryStatus(db_name: String!) subscription (app/graphql/resolvers/subscription.py) filters server-side by db_name and yields {db_name, job_id, kind, status, error} for job events — event-agnostic apart from kind ('JOB'); the client tells JOB_COMPLETION and JOB_CREATION apart by which jobIds it's currently tracking, not by a field on the payload. Extended Warranty publishes on the same channel with kind 'EW', {ew_lead_id, ew_message_id, target: 'CUSTOMER' | 'STAFF'} instead of job_id; a missing kind must be read as 'JOB'. Client-side, WhatsappStatusCell (jobs/whatsapp-status-cell.tsx) was generalized off an eventKey prop rather than forked, so the same pill component reads either event's status wherever it's rendered (Customer Connect's grid, job creation call sites).",
			},
			{ type: "heading", text: "Status ladder — never moves backwards, and gated on wamid" },
			{
				type: "para",
				text: "PENDING(0) < ACCEPTED(1) < SENT(2) < DELIVERED(3) < READ(4), FAILED(9) terminal — shared by every event, keyed independently per event_key so a JOB_CREATION callback can never advance or reset JOB_COMPLETION's ladder for the same job. A callback ranked at or below the currently stored value is a no-op (200, no write) — Meta reorders and retries callbacks, so out-of-order delivery is expected, not a bug to fix upstream. SET_JOB_WHATSAPP_OUTCOME's WHERE clause also requires the callback's wamid to match that event's current last_wamid, not just the rank check — without that, a resend (which gets a fresh wamid) could still have a late/duplicate callback for its superseded wamid land afterward and clobber the new attempt's outcome, since FAILED outranks everything on the ladder alone. JOB_MONEY_RECEIPT is the exception that proves the rule: its value is an array, so that same ->> 'last_wamid' extraction yields NULL, the row never matches, and its outcome callbacks are silently and harmlessly dropped — its counters only ever reflect the initial send.",
			},
			{
				type: "heading",
				text: "job.whatsapp_notifications — event_key-parameterized, single-level jsonb_set only",
			},
			{
				type: "para",
				text: "Five live keys. Four are flat objects with an identical shape (attempt_count, success_count, fail_count, last_wamid, last_status, last_sent_at, last_error, plus an attempts array holding the 20 most recent sends); JOB_DELIVERY adds otp_*/confirmed_* fields to that object, and JOB_MONEY_RECEIPT alone is an array of per-payment_id elements. SET_JOB_WHATSAPP_ATTEMPT/_OUTCOME (sql_jobs.py) both take %(event_key)s as a bind parameter rather than hardcoding a literal — a deliberate generalization that has since absorbed JOB_CREATION, JOB_DELIVERY and JOB_INVOICE with zero SQL changes. sender.py records the attempt at send time (attempt_count, last_wamid, status ACCEPTED, a new attempts element); the webhook settles the outcome later (success_count/fail_count, last_status, last_error, and the matching attempts element) once Meta actually confirms delivery or failure. Every counter increment is SQL-side jsonb_set on the current row, not a Python read-modify-write — racy the moment a webhook and a send could touch the same job concurrently.",
			},
			{ type: "heading", text: "attempts[] — the per-send history (plans/plan-wa-completion.md)" },
			{
				type: "para",
				text: "The flat last_* fields only ever describe the newest send, so a job messaged three times looked identical to one messaged once. attempts is a nested array inside the same event object — {attempt_no, wamid, sent_at, status, status_at, error} — appended by SET_JOB_WHATSAPP_ATTEMPT and settled in place by SET_JOB_WHATSAPP_OUTCOME, which rewrites the element whose wamid matches the callback (keyed on wamid, never on array position). It was nested rather than replacing the object with an array like JOB_MONEY_RECEIPT's, because that array's elements are different subjects (one per payment) while these are all one subject messaged repeatedly; replacing the object would have meant rewriting both shared write queries, GET_WHATSAPP_EVENT_LOG_PAGED's jsonb_typeof(...) = 'object' filter and its last_sent_at sort, hasAnyPriorAttempt (which gates every checkbox on the Customer Connect grid), the live-subscription patch, and a migration for every already-messaged job.",
			},
			{
				type: "note",
				text: "Capped at the 20 most recent (LIMIT 19 + the new one). This is a display history for the Customer Connect log, not an audit log — it lives inside a column read on every page of every job grid, and an uncapped array grows without bound in the hot path. attempt_no is stored explicitly rather than inferred from array position, so a capped array still reads '12, 13, 14…' and never misreports which send it was.",
			},
			{
				type: "note",
				text: "Additive, so no migration: a job messaged before this shipped has no attempts key at all. The client reconciles that in customer-connect-helpers.ts's resolveAttemptHistory — the newest send is reconstructed from the flat last_* fields (which do record it), and the sends before it, which were never written down, are surfaced as a count of unrecorded entries rather than invented. Without that reconciliation the feature would have been invisible until every job had been messaged twice more.",
			},
			{
				type: "note",
				text: "jsonb_set cannot auto-vivify a path more than one level deep — jsonb_set('{}', '{JOB_COMPLETION,attempt_count}', ..., true) silently leaves the value unchanged instead of creating JOB_COMPLETION, because all earlier path steps must already exist. Both SET_JOB_WHATSAPP_ATTEMPT and SET_JOB_WHATSAPP_OUTCOME build the %(event_key)s object as its own isolated value first (single-level jsonb_set calls only, reading the prior value via a jsonb_typeof(...) = 'object' guard that also self-heals any corrupted/non-object legacy value instead of erroring on it), then attach it with one single-level jsonb_set keyed on ARRAY[%(event_key)s] at the end. A version of this that instead threaded multi-level paths through the chain went unnoticed for a while — it silently no-ops on a job's first-ever send. If completion or intake messages ever stop persisting again, check this convention first before assuming the bug is elsewhere.",
			},
			{ type: "heading", text: "Per-event on/off switch: app_setting.whatsapp_notifications (plans/plan.md)" },
			{
				type: "para",
				text: 'A single app_setting row, setting_key = \'whatsapp_notifications\' (id 15), holds a per-BU on/off switch for outbound sends — one boolean per event key: JOB_CREATION, JOB_COMPLETION, JOB_DELIVERY, JOB_MONEY_RECEIPT, JOB_INVOICE, EXTENDED_WARRANTY. Seeded with only JOB_COMPLETION true. EXTENDED_WARRANTY is checked by ew_sender.send_ew_reminders together with extended_warranty.enabled — both must be on. sender.py\'s _is_event_enabled(db_name, schema, event_key) reads it via the existing SqlStore.GET_APP_SETTING_BY_KEY lookup and fails CLOSED: a missing row, a non-dict value, or a missing key all resolve to disabled, never enabled-by-default. Every send path calls it immediately after payload validation, before its eligible-rows query runs — so a disabled event skips the DB lookup and the Meta call entirely and returns {"results": [], "disabled": true}, which each client wrapper surfaces as an informational toast rather than an error.',
			},
			{
				type: "note",
				text: "This app_setting's key, whatsapp_notifications, is intentionally the exact same string as the job.whatsapp_notifications jsonb column documented above — but they are unrelated: job.whatsapp_notifications is a per-job send-attempt log (one row per job, written after each attempt); app_setting.whatsapp_notifications is a single per-BU switch (one row total, read before a send is attempted). Don't conflate the two when grepping — 'whatsapp_notifications' alone is ambiguous in this codebase.",
			},
			{
				type: "para",
				text: "Client side: the generic App Settings editor (edit-app-setting-dialog.tsx) is bypassed for this one key — app-settings-section.tsx branches on record.setting_key === \"whatsapp_notifications\" to open edit-whatsapp-notifications-dialog.tsx instead, a purpose-built dialog with one Switch per event (src/components/ui/switch.tsx), still writing through the same genericUpdate mutation, no new resolver. Both sendWhatsappCompletion/sendWhatsappJobIntake's TS wrapper types (send-whatsapp-completion.ts / send-whatsapp-job-intake.ts) now return {results, disabled} instead of a bare array specifically so a disabled event isn't shown to staff as a send failure — use-send-whatsapp-job-intake.ts and customer-connect-section.tsx's handleConfirmSend both check disabled before falling into the existing empty-results/failure branches.",
			},
			{ type: "heading", text: "Access rights" },
			{
				type: "para",
				text: "JOBS_CUSTOMER_CONNECT in seed_security_data.py's ACCESS_RIGHT_SEED_SQL, granted to MANAGER and RECEPTIONIST (not TECHNICIAN), gates the Customer Connect menu item. None of the five send mutations carries a require_access_right guard of its own — gating is client-side, by whichever screen hosts the trigger: Customer Connect's own right for the completion send, and the existing job-creation / deliver-job / receipts rights for the other four. No new access right was seeded for any of the four later events; the precedent established with JOB_COMPLETION was deliberately reused rather than re-litigated each time. Extended Warranty is the deliberate exception: each of its four mutations calls require_access_right(CUSTOM_EXTENDED_WARRANTY) itself, because a state change or a Marketing send must not be one crafted request away — see 'Extended Warranty — Lead State Machine'.",
			},
			{ type: "heading", text: "What was removed (still true)" },
			{
				type: "table",
				headers: ["Removed", "Reason"],
				rows: [
					[
						"app/routers/notifications/whatsapp_router.py",
						"The PDF-carrying REST endpoint (job creation/delivery/receipt sends) — no document/media path survives, even after JOB_CREATION came back in a redesigned, link-only form.",
					],
					[
						"app/notifications/whatsapp_client.py / _helpers.py / _templates.py",
						"Superseded by app/whatsapp/{client,mobile,templates,sender,token}.py.",
					],
					["app/graphql/resolvers/jobs/whatsapp.py", "Rewritten inside app/whatsapp/sender.py."],
					[
						"src/lib/whatsapp-service.ts, src/features/client/components/jobs/use-whatsapp-send.ts",
						"The REST fetch wrapper and shared hook for the old PDF-carrying buttons — deleted outright at the time; job creation's WhatsApp button was later rebuilt from scratch (send-whatsapp-job-intake.ts) against the new mutation, not restored from this.",
					],
					[
						"GET_JOBS_FOR_WHATSAPP_SEND (sql_jobs.py)",
						"Its only caller was the deleted REST router; replaced conceptually by GET_JOBS_FOR_WHATSAPP_COMPLETION / _CREATION, which are new queries, not a revival of this one.",
					],
				],
			},
			{
				type: "warning",
				text: "The removals above are about the old PDF-carrying REST mechanism, and that is still gone. Job delivery and payment-receipt sends themselves are NOT gone — they were rebuilt on this rail as JOB_DELIVERY, JOB_MONEY_RECEIPT and JOB_INVOICE, with token-gated button links instead of attachments. Old rows may still carry a legacy 'RECEIPT' key from the removed mechanism; it is unrelated to JOB_MONEY_RECEIPT and is read by nothing.",
			},
		],
		faqs: [
			{
				q: "Why isn't there a provider-registry abstraction for the BSP?",
				a: "Only Meta's WhatsApp Cloud API is in use, direct, no BSP layer at all. A registry is premature until there's a second provider to abstract over.",
			},
			{
				q: "Why does sendWhatsappCompletion re-filter to COMPLETED_OK + is_final while sendWhatsappJobIntake doesn't filter by status at all?",
				a: "Different eligibility by design, not an oversight — a completion notice only makes sense once a job is actually finalized, while an intake notice is meant to fire the moment a job is created, before it's anywhere near final. Both resolvers still independently re-load and re-check the jobs server-side; the client's selection is never trusted for either.",
			},
			{
				q: "Is there an audit trail of every individual WhatsApp send attempt?",
				a: 'Yes, within a rolling window: job.whatsapp_notifications[event_key].attempts holds the 20 most recent sends ({attempt_no, wamid, sent_at, status, status_at, error}), appended by SET_JOB_WHATSAPP_ATTEMPT and settled in place by SET_JOB_WHATSAPP_OUTCOME. It is a display history for the Customer Connect log (the Job Completion tab expands it as "N sends"), not a compliance audit log — it is capped, and it lives inside a row read by every job grid. The flat attempt_count/success_count/fail_count counters are still the authoritative running totals. A job messaged before this array existed has no attempts key at all — the client reconciles that case (customer-connect-helpers.ts, resolveAttemptHistory): the newest send is reconstructed from the flat last_* fields, and the sends before it, which were never written down, are shown as a count of unrecorded entries rather than invented.',
			},
			{
				q: "How does a status callback find its tenant database and which event it belongs to, without a routing table?",
				a: "biz_opaque_callback_data, set at send time to db_name|schema|event_code|job_ids, is echoed back by Meta on every status callback for that message — decode it, no lookup needed. A legacy 3-part payload with no event_code is treated as JOB_COMPLETION, the only event that existed before the format changed.",
			},
			{
				q: "Why does the webhook trust biz_opaque_callback_data instead of re-deriving the tenant some other way?",
				a: "It's only trustworthy because the HMAC signature check runs first — the field is attacker-controlled input otherwise. The signature check is what makes decoding it safe, not optional.",
			},
			{
				q: "What happens if a customer has more than 35 eligible jobs (or a batch that large)?",
				a: "sender.py splits them into multiple messages, each independently grouped, sent, and tracked — same behavior for both events. 35 is the cap that keeps biz_opaque_callback_data under Meta's 512-char limit with real margin.",
			},
			{
				q: "Why does JOB_CREATION's status link use a signed token instead of a session or a lookup id?",
				a: "No login exists for a customer, and a sequential/lookup id would let one customer guess another's link. token.py's HMAC-signed token is self-contained (db_name/schema/job_ids/expiry, all in the token itself) — verifiable with no DB round-trip and unforgeable without the server's secret.",
			},
			{
				q: "Could plan1.md's original delivery-notice design (a WhatsApp document/media attachment) be added the same way?",
				a: "Not as designed there — that mechanism was deliberately removed and nothing in app/whatsapp/ can attach a document. What shipped instead is JOB_DELIVERY: the same information as a Utility template with token-gated URL buttons, which is why no media path had to come back. Any future document need should follow that shape, not resurrect the attachment path.",
			},
			{
				q: "Why does JOB_MONEY_RECEIPT need its own SQL and its own Customer Connect components when the other four don't?",
				a: "Its value is a jsonb array, one element per payment_id, because a job can have several receipts each needing an independent ladder. SET_JOB_WHATSAPP_ATTEMPT/_OUTCOME write one level deep at a fixed path and assume the event value IS the ladder object, and GET_WHATSAPP_EVENT_LOG_PAGED filters on jsonb_typeof(...) = 'object' with one row per job. Neither holds for an array, so it has SET_JOB_MONEY_RECEIPT_WHATSAPP_ATTEMPT (find-or-append by payment_id in one atomic UPDATE) and a lateral-join log query producing one row per receipt send. JOB_INVOICE is flat, so it needed none of that — see 'Money Receipt & Invoice Sends'.",
			},
			{
				q: "Why is the delivery OTP two messages instead of one?",
				a: "Meta's category classifier rejects a numeric confirmation code inside a UTILITY template regardless of the surrounding content — confirmed directly in their editor, and a single-message v2 was rejected on submission. So JOB_DELIVERY sends a UTILITY summary with the two PDF buttons, then a separate AUTHENTICATION message carrying only the code in Meta's own fixed wording. Only the OTP send is tracked in whatsapp_notifications; a summary-send failure is logged but never written there, so it can't be mistaken for a missed code.",
			},
			{
				q: "The plan docs say '(not implemented yet)' in their titles — which features are actually live?",
				a: "All of them. plan-wa-delivery.md, plan-wa-money-receipt.md and plan-wa-invoice-resend.md each carry a stale heading while every implementation step inside is marked Done, and the code confirms it: eight mutations, eight templates, four public routers, six toggle keys. Trust the per-step markers and the codebase, not the headings.",
			},
		],
	},

	{
		id: "dev-whatsapp-job-delivery",
		category: "WhatsApp",
		title: "Paperless Job Delivery — OTP Implementation",
		summary:
			"JOB_DELIVERY's two-template send, the hashed 4-digit code, batch-wide OTP writes, and the confirmation record — the one event on the WhatsApp rail with a completion state.",
		tags: [
			"job delivery",
			"paperless",
			"otp",
			"confirmation code",
			"verifyJobDeliveryOtp",
			"setJobDeliveryManualConfirmation",
			"sendWhatsappJobDelivery",
			"job_delivery_otp_v1",
			"job_delivery_notice_v1",
			"delivery note pdf",
			"invoice pdf",
			"confirmed_at",
			"manual_override",
			"whatsapp",
		],
		content: [
			{
				type: "para",
				text: "As-built summary of plans/plan-wa-delivery.md (all steps Done, despite the doc's stale title). Read 'WhatsApp Integration — Implementation' first — this page only covers what JOB_DELIVERY does differently. What makes it different is that it is the only event with a completion state: every other send is fire-and-forget, this one expects something back.",
			},
			{ type: "heading", text: "Two templates, one logical event" },
			{
				type: "para",
				text: "sendWhatsappJobDelivery sends twice. First job_delivery_notice_v1 (UTILITY) — job list, amount paid/balance, and two dynamic-URL buttons, 'Download Delivery Note' and 'Download Invoice', both carrying the identical token. Then job_delivery_otp_v1 (AUTHENTICATION) — the 4-digit code alone, in Meta's fixed wording, with the 'Copy Code' button that category mandates.",
			},
			{
				type: "note",
				text: "This split is not a design preference. Meta's category classifier rejects a numeric confirmation code inside a UTILITY body no matter what surrounds it — a combined single-message v2 was submitted and refused (plan-wa-delivery.md, Step 3 v2). Don't try to merge them again.",
			},
			{
				type: "warning",
				text: "Only the OTP send is persisted to whatsapp_notifications (event_key JOB_DELIVERY). The summary send is logged but never written there — deliberately, so a failed summary can never be misread as a missed code. The order matters: summary first, OTP second, because the OTP is the one being tracked.",
			},
			{ type: "heading", text: "The code" },
			{
				type: "table",
				headers: ["Property", "Value", "Why"],
				rows: [
					[
						"Length",
						"4 digits (otp.py, secrets.randbelow — never random)",
						"Read aloud at a counter; 10,000 codes is ATM-PIN order, and the lockout is what does the real work, not the keyspace",
					],
					[
						"Lifetime",
						"OTP_TTL_MINUTES = 15",
						"Long enough to find a phone, short enough that a stale code is worthless",
					],
					[
						"Lockout",
						"OTP_MAX_ATTEMPTS = 5, then a resend is required",
						"The actual security control given a 4-digit keyspace",
					],
					[
						"At rest",
						"HMAC-SHA256 under whatsapp_delivery_otp_secret",
						"Never plaintext, never logged, never returned to the client — staff cannot see the code anywhere in the app",
					],
					[
						"Resend",
						"Re-run the send mutation; no separate resend mutation",
						"A fresh code overwrites the hash, invalidating the old one for free",
					],
				],
			},
			{ type: "heading", text: "Batch writes: all jobs or none" },
			{
				type: "para",
				text: "A multi-job delivery is the normal case, not an edge case. One send covers every selected job with one shared code, and SET_JOB_DELIVERY_OTP writes the same otp_hash/otp_expires_at onto every job_id in one transaction via exec_sql_batch — a partial write must never leave some jobs on a new hash and others on a stale one. verifyJobDeliveryOtp then requires every job_id passed to share the same matching, unexpired hash before confirming any of them; it does not trust one representative job. A wrong guess increments otp_attempt_count on all of them together, so the 5-attempt lockout cannot drift apart within a batch.",
			},
			{
				type: "note",
				text: "A delivery exceeding MAX_JOBS_PER_WHATSAPP_MESSAGE (35) splits into several messages, each with its own independent code. Known limitation, not handled in the UI — a handover that large is expected to use manual override instead.",
			},
			{ type: "heading", text: "The confirmation record" },
			{
				type: "code",
				language: "jsonc",
				text: '// job.whatsapp_notifications -> JOB_DELIVERY\n{\n  // ...the same flat ladder every event has (attempt_count, last_status, attempts[], ...)\n  "otp_hash": "...",             // HMAC-SHA256, never the code\n  "otp_expires_at": "...",\n  "otp_attempt_count": 0,        // lockout at 5\n  "confirmed_at": null,\n  "confirmation_method": null,   // "otp_verified" | "manual_override"\n  "confirmed_by_staff_id": null  // who verified or overrode\n}',
			},
			{
				type: "para",
				text: "confirmed_by_staff_id names the staff member who performed the verification, taken from the caller's existing authenticated session — no new auth plumbing. It is a materially better dispute record than retaining the code would be ('verified by this named employee' beats 'a correct-looking code was entered somewhere'), with no security downside since it isn't a secret.",
			},
			{
				type: "warning",
				text: "These fields are written by dedicated queries (SET_JOB_DELIVERY_OTP, SET_JOB_DELIVERY_CONFIRMATION, INCREMENT_JOB_DELIVERY_OTP_ATTEMPT), never through SET_JOB_WHATSAPP_OUTCOME — that query's WHERE clause demands a Meta wamid and a status-ladder advance, neither of which an OTP verification has. Both SET_ queries use the same defensive jsonb_typeof(...) = 'object' guard as the shared writers, because the manual-override path can legitimately be the first write ever for this event on a job that was never messaged at all.",
			},
			{ type: "heading", text: "Manual override" },
			{
				type: "para",
				text: "setJobDeliveryManualConfirmation writes confirmed_at/confirmation_method='manual_override'/confirmed_by_staff_id with no code and no Meta send. Always available — the customer may have no valid mobile, no phone to hand, or the message may simply have failed. It exists so a real handover is never left unconfirmed just because WhatsApp didn't cooperate.",
			},
			{ type: "heading", text: "Client" },
			{
				type: "bullets",
				items: [
					"whatsapp-delivery-control.tsx — the 'Whatsapp Delivery' button (disabled with an explanatory title when no valid mobile) plus the 'Verify Code' button, which appears only while getJobDeliveryOtpPending reports a live unconfirmed code. Both the send and the dialog live in this one component to stop the two drifting apart.",
					"verify-otp-dialog.tsx — code entry, with distinct copy for expired vs locked-out so staff are pointed at 'Resend Code' rather than at retrying.",
					"Wired into both delivery-modal.tsx and the Batch Warranty Jobs results modal — two screens can produce delivered jobs, and the server re-filters by status rather than by which screen called it.",
					"whatsapp-status-cell.tsx renders 'Confirmed' / 'Confirmed in person' / 'Verify Code' from confirmation_method and otp_pending; the pending flag is computed server-side (GET_JOB_DELIVERY_OTP_PENDING) so the client never sees the hash or the raw expiry.",
				],
			},
			{
				type: "note",
				text: "GET_JOB_DELIVERY_OTP_PENDING is a single server-computed boolean per job precisely so the 'Verify Code' affordance can exist without shipping otp_hash or otp_expires_at to the browser.",
			},
			{ type: "heading", text: "Customer Connect's Job Delivery tab" },
			{
				type: "para",
				text: "GET_WHATSAPP_EVENT_LOG_PAGED carves out this one event: for JOB_DELIVERY it additionally requires confirmed_at IS NOT NULL. 'Delivery happened' means the customer confirmed, not merely that a message went out, so an unconfirmed send is not a log entry. WhatsappStatusCell also counts the confirmation itself as the success for this event rather than success_count — that counter is written only by Meta's DELIVERED webhook and measures transport to the handset, so leading every confirmed row with a raw '✓ 0' was reporting a success as a failure.",
			},
		],
		faqs: [
			{
				q: "Does confirmation gate is_closed, accounts posting, or stock?",
				a: "No. Delivery, invoicing and posting fire exactly as they did before; the confirmation is informational and nothing waits on it. That was a deliberate decision — making a paper-replacement flow able to block revenue posting would have been a much riskier feature.",
			},
			{
				q: "Why 4 digits and not 6?",
				a: "It is read aloud across a counter. 10,000 codes is the same order as a bank PIN, and like a PIN its security comes from the 5-attempt lockout, not the keyspace. Six digits would have made the flow worse without changing the threat model, since anyone holding the customer's phone can read the code out either way — this proves physical presence with a staff witness, not identity.",
			},
			{
				q: "Can staff look up the code to help a confused customer?",
				a: "No, by design. It is hashed at rest, never logged, and never returned to the client. If the customer can't produce it, resend or use manual override.",
			},
			{
				q: "Why is there a separate secret for the OTP instead of reusing token.py's?",
				a: "Different lifetime and blast radius. token.py signs public document links that must stay valid for ~2 years; the OTP secret protects a 15-minute proof-of-handover. Rotating one should never invalidate the other.",
			},
			{
				q: "A delivery is confirmed but doesn't appear in the Job Delivery log tab.",
				a: "Check confirmed_at is actually set — the tab filters on it. A send with no confirmation is intentionally absent; that tab is the record of collections, not of sends.",
			},
		],
	},

	{
		id: "dev-whatsapp-receipt-invoice",
		category: "WhatsApp",
		title: "Money Receipt & Invoice Sends — Implementation",
		summary:
			"The two ungrouped, fire-and-forget events — why JOB_MONEY_RECEIPT needed its own array-shaped SQL, its own token pair and its own Customer Connect stack, while JOB_INVOICE needed none of it.",
		tags: [
			"money receipt",
			"job invoice",
			"sendWhatsappMoneyReceipt",
			"sendWhatsappJobInvoice",
			"job_money_receipt_v1",
			"job_invoice_v1",
			"sign_receipt",
			"verify_receipt",
			"jsonb array",
			"SET_JOB_MONEY_RECEIPT_WHATSAPP_ATTEMPT",
			"MoneyReceiptLogGrid",
			"delivered jobs",
			"whatsapp",
		],
		content: [
			{
				type: "para",
				text: "As-built summary of plans/plan-wa-money-receipt.md and plans/plan-wa-invoice-resend.md (all steps Done in both, despite their stale titles). These two shipped separately but belong on one page: they are the two events with no grouping, no chunking and no confirmation state — one row in, one message out. Read 'WhatsApp Integration — Implementation' first. The interesting part is that they look like twins and diverge sharply at the data model.",
			},
			{
				type: "table",
				headers: ["", "JOB_MONEY_RECEIPT", "JOB_INVOICE"],
				rows: [
					["Scope", "One job_payment row", "One job (one invoice)"],
					[
						"Trigger",
						"receipts-section.tsx row actions",
						"delivered-jobs-grid.tsx row actions, gated on row.invoice_no",
					],
					["Template", "job_money_receipt_v1 (UTILITY, 1 button)", "job_invoice_v1 (UTILITY, 1 button)"],
					[
						"Token",
						"sign_receipt/verify_receipt — NEW pair",
						"token.py's original sign/verify — reused unchanged",
					],
					[
						"PDF route",
						"job_money_receipt_router.py — NEW",
						"GET /job-delivery/invoice/{token} — reused unchanged, no new route",
					],
					["jsonb value", "ARRAY, one element per payment_id", "flat object, like JOB_CREATION/COMPLETION"],
					[
						"Write query",
						"SET_JOB_MONEY_RECEIPT_WHATSAPP_ATTEMPT — NEW",
						"SET_JOB_WHATSAPP_ATTEMPT — reused unchanged",
					],
					[
						"Outcome webhook",
						"Never applies (see below) — send status only",
						"Applies normally, full ladder",
					],
					[
						"Customer Connect",
						"New sibling stack: MoneyReceiptLogSection/Grid + 2 new SQL",
						"WhatsappLogSection/Grid, eventKey widened — zero new components",
					],
				],
			},
			{ type: "heading", text: "Why the array, and what it costs" },
			{
				type: "para",
				text: 'A job has one invoice but can have many payments, each needing its own independent attempt ladder. Encoding that as {"<payment_id>": {...}} would put a row id into a JSON key path; an array keeps payment_id as ordinary data inside each element and matches how this codebase already shapes per-row jsonb collections. The cost is that nothing generic works on it.',
			},
			{
				type: "bullets",
				items: [
					"SET_JOB_WHATSAPP_ATTEMPT/_OUTCOME write one level deep at a fixed path and assume the event value IS the ladder object. Postgres has no builtin for 'upsert into a jsonb array by key', so SET_JOB_MONEY_RECEIPT_WHATSAPP_ATTEMPT hand-rolls it: find the element whose payment_id matches and replace it in place, else append — one atomic UPDATE either way, never a read-modify-write, or two receipts sent close together on the same job would race and drop an entry.",
					"GET_WHATSAPP_EVENT_LOG_PAGED filters on jsonb_typeof(...) = 'object' and yields one row per job. The Money Receipt tab needs one row per receipt SEND, so GET_JOB_MONEY_RECEIPT_WHATSAPP_LOG_PAGED/_COUNT use a CROSS JOIN LATERAL over the array, joining back to job_payment on (log_entry ->> 'payment_id')::bigint.",
					"WhatsappStatusCell survived unchanged only because it was already refactored to take an already-resolved state object rather than a row plus an eventKey — the lateral join hands it one array element and it cannot tell the difference.",
				],
			},
			{
				type: "warning",
				text: "JOB_MONEY_RECEIPT has no _OUTCOME counterpart and deliberately gets none. The webhook still decodes 'MR' to JOB_MONEY_RECEIPT (so it doesn't log a spurious 'cannot resolve tenant' for every callback), but the generic SET_JOB_WHATSAPP_OUTCOME it then calls extracts last_wamid via ->>, which is NULL against an array, so the WHERE never matches and the row is silently ignored. Verified by reading that WHERE clause, not assumed. Consequence: this event's last_status/success_count only ever reflect the initial ACCEPTED/FAILED send and never advance to DELIVERED/READ. Anyone adding delivery tracking here must write the array-shaped outcome query first.",
			},
			{ type: "heading", text: "Why JOB_INVOICE needed almost nothing" },
			{
				type: "para",
				text: "One job has one invoice, so its value is flat and everything generic applies: the shared write queries, _persist_attempt, the log SQL, and the whole WhatsappLogSection/Grid/StatusCell stack — the tab cost three widened type unions and one new tab button. It also needed no new PDF and no new route: GET /job-delivery/invoice/{token} already verifies a token and queries by job_ids with no status or closure filter, and the invoice PDF it serves already renders the payments/receipts table alongside the line items. One button covers 'invoice with receipts' in a single document, which is why there is no second 'Download Receipt' button on that message.",
			},
			{
				type: "note",
				text: "That reuse is the whole reason the Invoice feature was small. The route was written generic for JOB_DELIVERY without anticipating this caller, and token.py was explicitly written as 'a digital stand-in for a paper slip a customer may need a year later' rather than as delivery-specific — both decisions paid off here.",
			},
			{ type: "heading", text: "The second token pair" },
			{
				type: "para",
				text: "token.py's original sign(db_name, schema, job_ids) cannot name a single payment row. sign_receipt(db_name, schema, job_id, payment_id)/verify_receipt use the same HMAC-SHA256 scheme and the same _b64url/_signature helpers, with their own payload layout (db_name|schema|job_id|payment_id|exp). Overloading job_ids with a second meaning was rejected deliberately — a token that sometimes means 'these jobs' and sometimes 'this payment' is a decoding ambiguity waiting to become a security bug.",
			},
			{ type: "heading", text: "Where each can be triggered — and where it can't" },
			{
				type: "para",
				text: "Sending only ever happens from the screen that owns the record: receipts from the Receipts grid, invoices from Delivered Jobs. Customer Connect's Money Receipt and Invoice tabs are read-only logs; viewing is not a second way to send. The Invoice send lives on Delivered Jobs specifically because GET_DELIVERED_JOBS_PAGED (is_closed = true) is the only query that still lists a job after closure — delivery-modal.tsx is fed by a query filtered to is_closed = false, so a closed job can never be reopened there, which is exactly the gap this event was built to close.",
			},
			{
				type: "warning",
				text: "job_money_receipt_router.py needs its own nginx location block in production, same as /job-intake/ and /job-delivery/. The SPA catch-all swallows any public prefix that isn't explicitly proxied, and that has already broken a release once.",
			},
		],
		faqs: [
			{
				q: "Can one send cover all of a job's receipts?",
				a: "No — one send is one job_payment row, matching the Receipts grid's own per-row PDF scope. If the customer wants the full picture, send the invoice instead: that PDF already lists every payment received against the job.",
			},
			{
				q: "Why does the Money Receipt tab show the same job several times?",
				a: "It is one row per receipt send, produced by a lateral join over the array, not one row per job. That is the whole reason it couldn't reuse the generic log stack.",
			},
			{
				q: "Does sending an invoice regenerate it or consume a number?",
				a: "No. It mints a token for the existing job and hands it to the existing invoice route. Nothing is regenerated, no document sequence advances.",
			},
			{
				q: "Why is there no access-right guard on either mutation?",
				a: "Same precedent as every other send on this rail: the hosting screen's own right already gates the entry point. No new right was seeded, and that decision was reused rather than re-litigated per event.",
			},
			{
				q: "Could JOB_INVOICE have reused JOB_DELIVERY's message instead of getting its own template?",
				a: "No — an approved Meta template can't be edited, and job_delivery_notice_v1 carries two buttons plus delivery-specific wording and a companion OTP send. job_invoice_v1 is a plain one-button Utility message with no code in it, which is also why it needed none of JOB_DELIVERY's category-classifier trouble.",
			},
		],
	},

	{
		id: "dev-extended-warranty",
		category: "Extended Warranty",
		title: "Extended Warranty — Lead State Machine",
		summary:
			"Custom → Extended Warranty as built (plans/plan-ew-final.md): three tables and one view, a server-authoritative transition table, exactly-once sends by partial unique index, a wamid-keyed webhook, tagged public links, and an access check inside every mutation.",
		tags: [
			"extended warranty",
			"ew_lead",
			"ew_message",
			"ew_lead_event",
			"ew_lead_view",
			"can_send",
			"band",
			"EW_TRANSITIONS",
			"transitionEwLead",
			"addEwFollowUp",
			"sendEwReminders",
			"resendEwLeadAlert",
			"ew_sender.py",
			"sign_ew",
			"verify_ew",
			"ExtendedWarrantySql",
			"ExtendedWarrantyServerSql",
			"CUSTOM_EXTENDED_WARRANTY",
			"CUSTOM_MENU",
			"custom-menu-registry",
			"extended_warranty_reminder_v1",
			"extended_warranty_lead_alert_v1",
			"EW_WARRANTY_END_BACKDATE_MONTHS",
			"buildEwLeadSchema",
			"SECTION_DEFAULTS",
			"getVisibleCustomMenuItems",
			"publish_ew_lead_changed",
			"EW_LEAD_CHANGED_KIND",
			"whatsapp_delivery_status",
			"ew_schema.sql",
			"ew_cleanup.sql",
			"ew_sql_test.py",
			"ew_server_test.py",
		],
		content: [
			{
				type: "para",
				text: "plans/plan-ew-final.md. Built on 2026-09-13 (Steps 10–14) after Part A deleted the old single-table module (ew_customer with jsonb stages). A lead is always in exactly one state; staff move it along allowed transitions; WhatsApp reminders go only from New Lead and Message Sent; a customer's tap on the reminder's button records interest and alerts staff. The plan's §0 decisions (D1–D16) and its 'As built' notes in §C4 / §C5 are the reference behind everything below.",
			},
			{ type: "heading", text: "Tables and view — scripts/ew_schema.sql, per BU schema" },
			{
				type: "table",
				headers: ["Object", "Holds"],
				rows: [
					[
						"ew_lead",
						"One row per lead. state (seven values, CHECK); progress_stage 1..3 only while IN_PROGRESS; is_closed GENERATED from state, never written; closed_at set exactly when WON / LOST / CANCELLED; interest, follow-up and opt-out columns. Unique on (mobile, COALESCE(serial_no, ''), warranty_end_date).",
					],
					[
						"ew_message",
						"One row per WhatsApp send, kind REMINDER or LEAD_ALERT. band is recorded at send time (REMINDER only); delivery_status + status_rank; wamid unique. ew_message_once_per_band_idx — partial unique (ew_lead_id, band) WHERE kind = 'REMINDER' AND delivery_status <> 'FAILED' — is the once-per-window rule (D7).",
					],
					[
						"ew_lead_event",
						"History: STATE_CHANGE, STAGE_CHANGE, INTEREST, FOLLOW_UP, OPT_OUT. created_by_name is stamped server-side from the session user.",
					],
					[
						"ew_lead_view",
						"The ONLY home of the band rule (days_left = warranty_end_date − CURRENT_DATE → D61_PLUS / D31_60 / D8_30 / D0_7 / OVERDUE), the 7-day grace window and can_send. Also the latest reminder, message_count, the latest alert and message_group (Message Sent substate). Columns are listed explicitly — a new ew_lead column is a deliberate view edit.",
					],
				],
			},
			{
				type: "warning",
				text: "A CHECK passes when its expression is NULL. ew_lead_progress_chk and ew_message_band_chk were first written as (state = 'IN_PROGRESS' AND progress_stage BETWEEN 1 AND 3) OR …, which lets a NULL through — Step 11's test caught it. Both are now CASE … COALESCE(…, false), and live outside CREATE TABLE in a drop-and-re-add block, so re-running ew_schema.sql corrects an existing schema. Write any new CHECK the same way.",
			},
			{
				type: "para",
				text: "New BUs get everything from the regenerated BU_SCHEMA_DDL and seed_bu_data.py (app_setting row 16 and the EXTENDED_WARRANTY key on row 15). extract_schema.py now also strips ALTER VIEW … OWNER TO, which used to leak into BU_SCHEMA_DDL.",
			},
			{ type: "heading", text: "State machine" },
			{
				type: "code",
				language: "text",
				text: "NEW_LEAD      → MESSAGE_SENT*, IN_PROGRESS, WON, LOST, CANCELLED\nMESSAGE_SENT  → INTERESTED†,   IN_PROGRESS, WON, LOST, CANCELLED\nINTERESTED    →                IN_PROGRESS, WON, LOST, CANCELLED\nIN_PROGRESS   →                             WON, LOST, CANCELLED   (+ stage n → higher)\nLOST          →                IN_PROGRESS, WON\nCANCELLED     →                IN_PROGRESS\nWON           →  (terminal)\n\n*  only by sending (CLAIM_EW_REMINDER)\n†  also by the customer's tap (RECORD_EW_INTEREST)",
			},
			{
				type: "para",
				text: "EW_TRANSITIONS in app/graphql/resolvers/custom/extended_warranty.py is authoritative; the client mirror is ew-state-machine.ts, which additionally carries NEW_LEAD → MESSAGE_SENT because the flow diagram draws it. TRANSITION_EW_LEAD receives an allowed_from list computed by the resolver and locks the row (FOR UPDATE); no row back means the lead changed or the move is not allowed, returned as {ok: false, reason: 'STALE'}. Entering IN_PROGRESS always sets Stage 1 inside the SQL (D3); a stage advance is IN_PROGRESS → IN_PROGRESS with a strictly higher stage. Leaving IN_PROGRESS clears the stage and next follow-up; closing stamps closed_at, reopening clears it.",
			},
			{ type: "heading", text: "SQL store — app/db/sql/sql_extended_warranty.py" },
			{
				type: "para",
				text: 'Two classes. ExtendedWarrantySql — the six browser reads (GET_EW_LEADS_PAGED, GET_EW_LEAD_DETAIL, GET_EW_LEAD_TIMELINE, GET_EW_LEAD_BY_MOBILE, GET_EW_DASHBOARD, COUNT_EW_OPEN_INTEREST) — is composed into SqlStore and mirrored in sql-map.ts. ExtendedWarrantyServerSql — every write and the server-only reads — is deliberately NOT in SqlStore: genericQuery runs any SqlStore constant by sqlId on an autocommit connection, so a write placed there is callable from the browser (TRANSITION_EW_LEAD with a hand-made allowed_from would bypass both the transition table and the access check). A placeholder used more than once is bound once in a "p_<name>" CTE and read with (table "p_<name>"); every genericQuery read needs every key in sqlArgs, null meaning \'filter off\'. _LEAD_JOINS (shared by GET_EW_LEADS_PAGED and GET_EW_LEAD_DETAIL) carries a LEFT JOIN LATERAL onto ew_lead_event for the most recent FOLLOW_UP row — added 2026-09-14 because the grid had no way to show who did the last follow-up or what they said without opening the lead. It reads ew_lead_event_lead_idx (ew_lead_id, created_at DESC), so a paged list of 50 costs 50 cheap index lookups, not a scan. The three columns (last_follow_up_action, last_follow_up_by_name, last_follow_up_notes) are declared by hand on EwLeadType in extended-warranty.ts, same as every other query-only column there — no view edit and no gen-types-service run were needed, because they are not on ew_lead_view, only on the two SqlStore reads that project it.',
			},
			{
				type: "note",
				text: "The same exposure exists for writes that already live in SqlStore (for example SET_JOB_WHATSAPP_ATTEMPT). It was noted during this build and not addressed.",
			},
			{ type: "heading", text: "Sending — app/whatsapp/ew_sender.py" },
			{
				type: "bullets",
				items: [
					"sendEwReminders {branch_id, ew_lead_ids}: both switches (fail closed) → GET_EW_LEADS_FOR_SEND (this branch AND can_send) → invalid mobiles skipped → the daily cap checked once (GET_EW_SENT_TODAY_COUNT, per BU schema) → per lead: claim, call Meta, settle. Result statuses SENT / FAILED / SKIPPED / CAPPED; {disabled: true} when a switch is off.",
					"CLAIM_EW_REMINDER inserts the PENDING message AND moves NEW_LEAD → MESSAGE_SENT in one statement. The partial unique index makes two concurrent claims produce one row — the loser does nothing and never calls Meta (proven with two sessions by scripts/ew_sql_test.py, test 5). A send is attempted, then settled: an immediate failure still leaves the lead in Message Sent, retryable (D8).",
					"_send_and_settle settles an exception from the Meta call as FAILED — a PENDING reminder would count as live under the index and block its window for good.",
					"send_ew_lead_alert(db, schema, lead) runs after the interest has committed, and from resendEwLeadAlert. It never raises; it returns SENT / FAILED / NO_STAFF_NUMBER / INVALID_STAFF_NUMBER / NOT_FOUND / ERROR, and an invalid staff number is recorded as a FAILED LEAD_ALERT row so staff can see it.",
					"biz_opaque_callback_data is db|schema|EW|<ew_message_id> (EL for the alert). The reminder's button suffix is a sign_ew token; the alert's is the bare lead id, because /client/custom/ew/:ref is behind ProtectedRoute.",
				],
			},
			{ type: "heading", text: "Live updates — why nobody has to press Refresh" },
			{
				type: "para",
				text: "Until 2026-09-14 the only EW push was the Meta delivery callback: the webhook published whatsapp_delivery_status {kind: 'EW'} and the client re-read. Every OTHER change was local-only — the acting session bumped its own refreshKey, so a colleague's transition, follow-up, send, or a customer's tap sat unseen until someone pressed Refresh. app/graphql/pubsub.py now carries publish_ew_lead_changed(db_name, schema, reason, ew_lead_id), which publishes {kind: 'EW_LEAD' (EW_LEAD_CHANGED_KIND), reason, schema, ew_lead_id} on the SAME whatsapp_delivery_status channel — deliberately not a channel of its own, so the client keeps one subscription and an older client just ignores the kind. It never raises; a lead change must not fail because the push did.",
			},
			{
				type: "table",
				headers: ["Publisher", "reason"],
				rows: [
					["resolvers/custom/extended_warranty.py — transition_ew_lead, after a non-STALE row", "TRANSITION"],
					["…add_ew_follow_up, after a row comes back", "FOLLOW_UP"],
					["…resend_ew_lead_alert, after send_ew_lead_alert returns", "LEAD_ALERT_RESENT"],
					[
						"whatsapp/ew_sender.py — send_ew_reminders, ONCE for the batch and only when something was attempted",
						"REMINDERS_SENT",
					],
					[
						"routers/public/extended_warranty_router.py — after interest commits and its alert/e-mail go",
						"INTEREST",
					],
					["…after a first opt-out (can_send goes false, so the send tick disappears)", "OPT_OUT"],
					[
						"resolvers/mutation.py — resolve_generic_update when _generic_update_table(value) == 'ew_lead'",
						"LEAD_SAVED",
					],
				],
			},
			{
				type: "warning",
				text: "A lead saved, edited or deleted has no mutation of its own — it rides genericUpdate — so its push lives in resolve_generic_update, the shared dispatcher. That is why _require_generic_update_table_right was split: _generic_update_table(value) now reads the tableName for both the right check and the publish. Any future table needing the same treatment adds a branch there, not a copy of the decode.",
			},
			{
				type: "note",
				text: "The webhook's 'EW' payload gained `schema` at the same time, purely so the client can skip another BU's event; scripts/ew_server_test.py test W compares that payload exactly, so it was updated with it. Both suites are green after the change (95 server, 100 SQL). The section's subscription logic moved out to components/shared/use-ew-live-refresh.ts — kind/schema filtering, the 350 ms coalescing timer, everything — so extended-warranty-section.tsx now just calls useEwLiveRefresh(bump). The bell's Interested count uses the same hook: use-notifications-summary.ts calls useEwLiveRefresh(ewQ.refetch, ewEnabled), gated on the SAME condition (add-on on, right held) that already gates COUNT_EW_OPEN_INTEREST — a session with neither opens no EW subscription at all. The other three bell signals (jobs overdue, unposted docs, low stock) are still read on mount only; nothing publishes for them.",
			},
			{ type: "heading", text: "Webhook, public page and token" },
			{
				type: "para",
				text: "EW / EL decode to EXTENDED_WARRANTY / EXTENDED_WARRANTY_LEAD and branch to _apply_ew_status_callback, which runs SET_EW_MESSAGE_OUTCOME keyed on wamid with the status_rank guard and publishes whatsapp_delivery_status {kind: 'EW', ew_lead_id, ew_message_id, status, error, target}. extended_warranty_router.py serves GET /extended-warranty/{token}, POST …/interest and POST …/opt-out; verify_ew plus GET_EW_LEAD_FOR_PUBLIC bind the lead AND the message (it must be a REMINDER of that lead). RECORD_EW_INTEREST commits first and matches only the first tap; the staff alert and the optional e-mail follow. The customer's typed comment lands in TWO places in that one statement — ew_lead.customer_remarks and the INTEREST ew_lead_event's `notes` — which is why the detail timeline shows it without a column of its own. It reaches staff through four channels: the grid's Interest cell (labelled Said: '…'), the detail dialog's own 'Customer said' fact, the timeline, and _build_lead_alert_params' fifth body line ('No remarks' when blank, since a Meta template cannot branch). The notify e-mail was the one channel that dropped it until 2026-09-14: _notify_by_email takes `row` from _load(token), loaded BEFORE the write, so it can never carry what the customer just typed — the remark is now passed in as its own argument. Any future notification off this route must do the same. The call/WhatsApp chooser was removed from the page on 2026-09-14 (the shop only calls): post_extended_warranty_interest no longer takes a preferred_contact Form field and writes NULL, so a stale page still posting one is ignored rather than honoured, and ew_lead.preferred_contact keeps meaning 'what the customer chose' for the leads that actually chose. _build_lead_alert_params' NULL fallback therefore became 'Please call back' — a template slot cannot be empty and cannot branch — while a lead carrying CALL or WHATSAPP still reads 'Prefers …'. The e-mail lost its Prefers line for the same reason, and _notify_by_email lost the `choice` argument. The client needed nothing: every render is already guarded on `row.preferred_contact`, so a NULL simply shows no line. A grid or the detail dialog stating a historic lead's CALL preference is noise now that calling is the only path, so both were narrowed on 2026-09-14 to mention only a leftover WHATSAPP — `row.preferred_contact === 'WHATSAPP'` in ew-lead-grid.tsx and ew-lead-detail-dialog.tsx, in place of the old PREFERENCE_LABEL / PREFERENCE lookup maps. Two different fields called remarks is the trap this cost: ew_lead.remarks is the STAFF note (the only remarks genericUpdate may write) and ew_lead.customer_remarks is the customer's. Every label now says which — 'Staff note' in the grid header, the detail fact and the lead form; 'Customer said' / Said: '…' for the other. Opt-out keeps the state and only turns can_send off. sign_ew payloads carry the EWL type tag, six fields, TTL 180 days.",
			},
			{ type: "heading", text: "Access" },
			{
				type: "para",
				text: "CUSTOM_MENU (19) gates the Custom tab; CUSTOM_EXTENDED_WARRANTY (20) gates the menu item, and — unlike the job WhatsApp mutations — each of the four mutations calls require_access_right(EW_ACCESS_RIGHT) itself. ew_lead is in GENERIC_UPDATE_TABLE_RIGHTS through CUSTOM_GENERIC_UPDATE_TABLE_RIGHTS. genericQuery reads are ungated, like every other genericQuery. Both rights already exist in every tenant, so no re-seed was needed.",
			},
			{ type: "heading", text: "Client — features/client/components/custom/extended-warranty/" },
			{
				type: "bullets",
				items: [
					"Menu: the item in layout/custom-menu-registry.ts is gated on context { extendedWarrantyEnabled } (context-slice, parsed strictly in client-layout.tsx) plus the right; the top nav, the explorer and client-custom-page.tsx all read the same list. client-activity-bar.tsx (the left-hand icon rail) did NOT read this list until 2026-09-20 — it hardcoded the Custom (ShieldCheck) icon in ACTIVITY_ITEMS unconditionally, so the icon stayed visible even when the top nav correctly hid the Custom tab for a tenant with no add-ons. Fixed by filtering ACTIVITY_ITEMS the same way (`item.section !== 'custom' || hasCustomItems`) — any future icon-rail item that mirrors a hideable (not just disableable) top-nav item needs the same explicit filter, since ACTIVITY_ITEMS has no other gating mechanism at all.",
					"Header breadcrumb: SECTION_DEFAULTS.custom is an empty string because the section's items are bought add-ons, so client-layout.tsx fills the selection in with getVisibleCustomMenuItems(...)[0]?.label in a second effect, declared AFTER the section-reset effect and guarded on (activeSection === 'custom' && !selected). Doing it from the page instead does not work — a child effect runs before the parent's reset and is immediately overwritten. That is what makes the header read 'Custom > Extended Warranty'.",
					"extended-warranty-section.tsx owns three tabs — Dashboard, Details, Flow — and the single New Lead button, which lives in the tab row (a flex wrapper around TabsList, itself given mb-0) rather than inside any tab. The tab row replaces the screen title; neither EwDashboard nor EwLeadGrid carries a New Lead button of its own any more. Flow holds the ChartCard + EwStateFlowDiagram that used to sit at the top of the Dashboard tab. Two filled buttons, deliberately different colours: teal for New Lead (the module accent, in the tab row) and indigo for ew-drilldown-view.tsx's Back to dashboard, which is the only way out of a drill-down and sits directly under the teal one.",
					"use-ew-lead-actions.tsx owns every lead action and dialog, so the grids, the detail dialog and the deep link behave identically. The row menu comes from availableActions(row); a disabled item stays visible and toasts its reason (Radix hides tooltips on truly disabled items).",
					"ew-lead-actions-menu.tsx gives every item an icon in a tinted chip: ACTION_VISUALS is keyed by EwActionKeyType, and a TRANSITION is looked up instead in TRANSITION_VISUALS by its toState, so a move is coloured by the state it lands in (Won emerald, Lost amber, Cancelled rose, In Progress violet, Interested orange). Colours come from constants/icon-colors.ts — add any new lucide icon there too, that map is the app-wide one-colour-per-icon contract. ew-lead-grid.tsx's state filter (STATE_VISUAL) repeats the same five icons plus MessageSquare (already indigo in the app-wide map, for MESSAGE_SENT) and UserPlus (added blue, for NEW_LEAD) as LITERAL classes matching ACTION_VISUALS/TRANSITION_VISUALS exactly — not EW_COLOR_CLASSES[EW_STATE_META[state].color], which would put WON in green rather than the row-menu's emerald. Two colour tokens meaning the same 'success green' is deliberate here: keep the filter's classes byte-for-byte with the row-menu's, not with EW_STATE_META's. The grid's own `<tr>` also gained `even:bg-(--cl-surface-2)/40` for zebra striping — shared by the Details tab and every dashboard drill-down, since both render through this one component. SEND is the exception: it renders components/shared/whatsapp-icon.tsx, which paints its own brand green, so VisualType.brand drops the chip and ignores `color`; the send bar's button in ew-lead-grid.tsx carries the same mark, since it is the same action under the same label. Shadcn's item recolours descendants on focus, so the hovered item loses its accent — expected, not a bug.",
					"ew-state-flow-diagram.tsx draws edges generated from EW_TRANSITIONS; EW_PIPELINE_GROUPS holds the brief's card table with each card's drill-down filter; the New Lead band cards are labelled '31–60 D' / '8–30 D' / '0–7 D' so they fit one line, while EW_BANDS (the grid and the detail dialog) still spells 'days' out. Layout is NOT in that data: ew-pipeline-section.tsx keys GROUP_LAYOUT by group.key for the column span, the inner card grid and a light per-section tint, over an xl:grid-cols-6 outer grid — spans 3+3 then 1+2+3, which is what pins the five groups to exactly two rows. Add a sixth group and you must add its GROUP_LAYOUT entry and rebalance the spans, or it falls to FALLBACK_LAYOUT and spills onto a third row. The New Lead group renders all five bands — new_61_plus was returned by GET_EW_DASHBOARD but had no card until now, so the All card (new_all = COUNT(*) FILTER (WHERE state = 'NEW_LEAD'), every band) silently exceeded the cards beside it; keep a card per band or that gap comes back. A card's onClick checks its own count first (2026-09-14): 0 sets emptyAlertOpen instead of calling onOpen, opening the section's one shared modal rather than a toast, which is what this used before the user asked for a messagebox instead. The description reuses MESSAGES.INFO_EW_NO_LEADS, the same string ReportEmpty shows for an empty grid — one 'no leads' wording app-wide, not two. It is components/ui/dialog.tsx (Dialog), NOT AlertDialog, and that was a deliberate correction, not the first guess: AlertDialog was tried first for its centred header/media layout, but Radix's AlertDialog blocks Escape and outside-pointer dismissal by design — it exists for real confirmations (data loss, irreversible actions) that must not be dismissed by accident. This box has nothing to confirm, so when the user asked for outside-click-to-close, the fix was switching primitives, not fighting AlertDialog's dismiss-layer props. Dialog has no AlertDialogMedia slot, so the icon badge (`size-10 rounded-md bg-slate-100/800 text-slate-500/400`, matching AlertDialogMedia's own classes) is inlined by hand inside DialogHeader. `showCloseButton={false}` — the OK button is the one dismiss affordance; the corner X would be redundant. AlertDialogFooter's `group-data-[size=sm]:grid-cols-2` (built for a Cancel+Action pair) also briefly left a single button stuck in the left cell — DialogFooter has no such variant, so `sm:justify-center` on it is enough on its own, no wrapper div needed. Cross-cutting figures are chips under the grid, never cards, because a card there must be a disjoint slice of one state: 'follow-ups due' ({followUpDue: true, state: 'IN_PROGRESS'}) and 'open leads' ({isClosed: false}, summed client-side from new_all + sent_all + interested + in_progress_all — there is no is_closed = false count in GET_EW_DASHBOARD, and EwLeadGrid passes filter.isClosed straight through to the is_closed sqlArg). leads_total is still returned and still unrendered. Below it sits ONE ew-period-matrix.tsx card, Overall summary (OVERALL_ROWS in ew-dashboard.tsx). The separate Message summary card was deleted — its three rows were already in OVERALL_ROWS, indented under msg_total — and msg_awaiting came across as a fourth indented 'In transit' row, so Read + Delivered + Fail + In transit now add up to Messages sent on screen. EwPeriodMatrix's `footnote` prop went with it; msg_awaiting is an ordinary row now. GET_EW_DASHBOARD's bounds CTE (2026-09-14) gained three columns — pm (start of last calendar month), y (start of this calendar year), ly (start of last calendar year) — feeding three new period suffixes: this_year (>= y, cumulative — a superset of month), prev_month (>= pm AND < m, a discrete window), last_year (>= ly AND < y, discrete, labelled 'Prev year' client-side). Every EwPeriodMetricType (leads/interested/won/lost/cancelled/msg_total/msg_read/msg_delivered/msg_failed/msg_awaiting) got all three added by the same mechanical pattern the other periods already used — 10 metrics × 3 = 30 new FILTER expressions. The `older` period (everything before this month, the catch-all) was added in that same change and removed again later the same day at the user's request — 'sequence of columns: today, this week, this month, prev month, this year, prev year' named exactly six, and the user confirmed dropping it rather than keeping it trailing. Every `_older` FILTER expression (10 of them) came back out of GET_EW_DASHBOARD, `older` came out of EwPeriodType, and EW_PERIODS.older is gone — EwDashboardType (a template-literal type over EwPeriodMetricType × EwPeriodType) drops every `*_older` key automatically, so nothing downstream needed an unused-field allowance. Two tests in ew_sql_test.py looped over the period literally — `for p in ('today', 'week', 'month', 'older')` in test 12, and `older` in test 13's `expected` dict — both were failing with KeyError before the fix. Test 12's loop was widened to ('today', 'week', 'month', 'this_year', 'prev_month', 'last_year') rather than just dropping 'older', closing a gap from the same-day addition: the read+delivered+failed+awaiting=total invariant had never been checked for the three new periods until now. Test 13 just lost 'older' from its dict — it tests boundary edges (midnight/week-start/month-start) that this_year/prev_month/last_year don't share. EW_PERIODS in ew-state-machine.ts carries the labels and final column order: today(1), week(2), month(3), prev_month(4), this_year(5), last_year(6) — prev_month and this_year swap from the interim order (this_year was 4, prev_month 5) to match the user's requested sequence. ew-period-matrix.tsx needed no code change for either the addition or the removal, since it already iterates PERIODS = Object.keys(EW_PERIODS) generically — only its min-w moved (520px → 820px → 720px) to track the column count. The matrix is deliberately the quiet half of the tab — a counter is a bare number in its row's colour, not a filled bordered tile, and the card drops its shadow; keep any new counter there at that weight. Its legibility comes from the table shape instead: a headline row gets a colour dot and text-base, an indented row gets a guide rule and text-sm, figures are right-aligned tabular-nums, a zero renders muted at opacity-50, and EwMatrixRowType's `divider` draws the rule that separates the message breakdown from the outcome rows (set on `interested`). NODE_CAPTION is string[] — one entry per rendered tspan — so a caption that would be crammed (NEW_LEAD's four bands) breaks over two lines; the band rects are labelled plainly 'Active' / 'Closed' rather than with the is_closed column.",
					"buildEwLeadSchema(isEdit) rejects a warranty_end_date older than today minus EW_WARRANTY_END_BACKDATE_MONTHS (3, in ew-state-machine.ts) on create only — overdue leads are entered deliberately. Nothing server-side checks this: a lead is written through genericUpdate straight into ew_lead, so the zod schema is the only gate. It is unrelated to EW_SEND_GRACE_DAYS (7), which is the view's can_send window — a lead backdated past that is enterable but never sendable.",
					"isCompleteMobile, not lib/mobile's isValidMobile (which accepts '' for optional fields), is used wherever a reminder depends on the mobile.",
					"EwColorType / EW_COLOR_CLASSES carry an 'amber' entry, and the non-error categories were moved onto it — EW_BANDS.OVERDUE, EW_STATE_META.LOST, and the Overdue / Lost / Cancelled pipeline and summary rows. Red is left only where something genuinely failed (EW_DELIVERY_STATUS_META.FAILED, EW_MESSAGE_GROUPS.FAILED, the Fail card and msg_failed rows, an unusable mobile, form errors), per the global rule that red means error. Adding a colour to EwColorType means adding it to EW_COLOR_CLASSES AND to NODE_CLASSES in ew-state-flow-diagram.tsx — both are Record<EwColorType, …>, so tsc catches a miss.",
					"Deep link /client/custom/ew/:ref (digits only) → pages/client-custom-ew-ref-page.tsx → router state {ewLeadId, subItem}; the section opens the follow-up dialog for an In Progress lead, the detail dialog otherwise. The bell item navigates with {ewDrill: 'INTERESTED'}; its count (COUNT_EW_OPEN_INTEREST) is queried only when the add-on is on and the user has the right.",
					"The section refreshes on any EW mutation and on every whatsappDeliveryStatus event with kind 'EW' or 'EW_LEAD'; grids and the dashboard refetch in place rather than remounting. A pushed event is coalesced behind a PUSH_COALESCE_MS (350 ms) timer and skipped when its `schema` names another BU, since the subscription is scoped to db_name alone. Manual refresh is components/shared/refresh-button.tsx, the app-wide control — in the Lead Pipeline ChartCard's `actions` slot (one GET_EW_DASHBOARD call backs both cards, so it re-reads the summary too) and at the right of EwLeadGrid's toolbar, which puts it on drill-down lists as well as Details. Both drive the local useGenericQuery refetch and pass its `loading` for the spin; neither bumps the section's refreshKey, so a refresh never re-reads the other tab.",
					"EW_PIPELINE_GROUPS' 0–7 D, Interested, Stage 3 and Cancelled cards (2026-09-23) moved off orange/amber — indigo, teal, violet and blue respectively — at the user's request to get them away from red-adjacent hues on the Dashboard specifically; INTERESTED's own GROUP_LAYOUT tint in ew-pipeline-section.tsx moved from orange to teal to match its one card. This is intentionally Dashboard-only: EW_PIPELINE_GROUPS has exactly one consumer (ew-pipeline-section.tsx — grep confirms it), so it doesn't touch EW_STATE_META.INTERESTED/CANCELLED or EW_BANDS.D0_7, which still drive the Details-grid badges, the state filter, and ew-lead-actions-menu.tsx's TRANSITION_VISUALS (line above: 'Interested orange', 'Cancelled rose'). So the Dashboard's Interested/Cancelled cards now deliberately differ in colour from the same states' badges elsewhere — not a bug, a scoped ask. EW_STAGES[3].color was left alone too; grep confirms it was already dead — nothing reads `.color` off EW_STAGES anywhere, only `.label` (ew-state-badge.tsx, ew-follow-up-dialog.tsx, ew-lead-detail-dialog.tsx, ew-transition-dialog.tsx) — so Stage 3's badge colour was never orange to begin with; only its EW_PIPELINE_GROUPS card literal was, and that's what changed.",
					"Immediate follow-up, same session (2026-09-23): Overdue (amber) and Fail (red) moved TO orange, at the user's explicit request — not a reversal of the bullet above, a separate, deliberate ask for these two specific cards. Fail (sent_failed, in the Message Sent group) is the one EW_PIPELINE_GROUPS card that named a genuine failure — a WhatsApp delivery failure, not a lead outcome — so moving it off red is a real product call, not a slip; EW_DELIVERY_STATUS_META.FAILED and EW_MESSAGE_GROUPS.FAILED (the delivery-status chip and the message filter elsewhere) are untouched and still red, so a failed reminder still reads as red everywhere except this one Dashboard card.",
					"Then 'more light' (same session): EwPipelineCardType gained two optional fields, lightBorderClassName/lightTextClassName, read by ew-pipeline-section.tsx as `card.lightBorderClassName ?? colors.border` / `card.lightTextClassName ?? colors.text` — an explicit per-card override that wins over EW_COLOR_CLASSES[card.color] when present, every other card falls through to the shared token unchanged. Overdue and Fail are the only two cards that set them (border-orange-200/text-orange-500, vs. the shared orange token's border-orange-500/text-orange-700), because EW_COLOR_CLASSES.orange is still shared with EW_STATE_META.INTERESTED and ew-lead-actions-menu.tsx's TRANSITION_VISUALS.INTERESTED elsewhere — lightening the token itself would have paled the Interested badge/menu colour too, which nobody asked for. Reach for this same pair of fields, not a new EwColorType member, the next time one specific pipeline card needs a shade its shared token doesn't have — adding an EwColorType member instead means updating every Record<EwColorType, …> in the file (EW_COLOR_CLASSES, and ew-state-flow-diagram.tsx's NODE_CLASSES) for one card's sake.",
					"ew-lead-grid.tsx's dedicated State column (its `<th>` and the `<EwStateBadge row={row} />` `<td>` beside the row-menu column) is gone (2026-09-23) — the same `<EwStateBadge row={row} />` now renders as a second line inside the Purchased cell instead, under `formatDate(row.purchase_date)`, so the state lives in exactly one place in the row rather than two. The state filter dropdown (`showStateFilter`) is untouched — filtering was never tied to the column's presence. Removing a `<th>`/`<td>` pair from a plain HTML table needs no colSpan/column-count bookkeeping elsewhere in this file (no colSpan usage here; ReportEmpty renders outside the table).",
				],
			},
			{ type: "heading", text: "Fixed by the Meta-approved templates (plan Part B)" },
			{
				type: "table",
				headers: ["Piece", "Why it cannot change"],
				rows: [
					[
						"TEMPLATES['EXTENDED_WARRANTY'] (extended_warranty_reminder_v1, MARKETING) and ['EXTENDED_WARRANTY_LEAD'] (extended_warranty_lead_alert_v1, UTILITY)",
						"Approved by Meta; any edit means resubmission and a sending gap. Parameter order is fixed; composed lines and button suffixes are the free parts.",
					],
					[
						"Public prefix /extended-warranty/ (FastAPI, no /api) and its nginx location block",
						"The reminder's button is that bare prefix plus the token.",
					],
					[
						"Client route /client/custom/ew/:ref",
						"The lead alert's 'Open in Service+' button is that prefix plus the lead id.",
					],
				],
			},
			{ type: "heading", text: "Tests" },
			{
				type: "para",
				text: "scripts/ew_sql_test.py (100 checks on the SQL, inside BEGIN … ROLLBACK; test 5 commits one fixture and deletes it) and scripts/ew_server_test.py (95 checks: resolvers, access on all four mutations and genericUpdate, the cap, both switches, tokens, the public page and the webhook; send_template is faked, fixtures named 'EW SQL TEST' are committed and deleted). Run both after any change to the SQL, the transition table or the sender. ew_server_test.py test 1 compares the server's EW_TRANSITIONS against its own copy of the plan's table — update both when a transition changes.",
			},
			{
				type: "note",
				text: "Rollout: scripts/ew_cleanup.sql then scripts/ew_schema.sql on every BU schema of every tenant, before the server that reads ew_lead goes live; delete ew_cleanup.sql once every tenant has run it. Time zone: database sessions run in UTC, so days_left, the bands and the dashboard periods roll over at 05:30 IST — an app-wide open question in the plan.",
			},
		],
		faqs: [
			{
				q: "Can genericUpdate change a lead's state?",
				a: "Technically yes — ew_lead is only gated by the access right, not by column. By convention the lead dialog writes contact, device and remarks fields only; state and stage change through transitionEwLead, addEwFollowUp, the send claim and the public interest route. A BEFORE UPDATE trigger keyed on a session flag is the hardening option (plan §D4 R4).",
			},
			{
				q: "Why isn't TRANSITION_EW_LEAD in SqlStore like everything else?",
				a: "Because genericQuery will run any SqlStore constant the browser names, on a connection that commits. Server-only statements live in ExtendedWarrantyServerSql and are reachable only through the resolvers, which check the access right and compute allowed_from themselves.",
			},
			{
				q: "A reminder is stuck in PENDING and the lead can't be sent to in that window.",
				a: "It should not happen: _send_and_settle settles every outcome, including an exception. It can only follow a process crash between the claim and the settle. Set that ew_message row to FAILED (status_rank 9) and the window opens again.",
			},
			{
				q: "The webhook logs 'EW outcome ignored' — is that a problem?",
				a: "No. It is a duplicate or out-of-order status (the rank guard) or a wamid with no row — for example a late callback for a message from the old, deleted module, whose ids were [customer_id, stage].",
			},
			{
				q: "How do I add a state or a transition?",
				a: "Change EW_TRANSITIONS on the server and in ew-state-machine.ts, the state CHECK in ew_schema.sql (and re-run it on every BU), the diagram's NODE_POS / edge classification, the pipeline groups if it gets a card, ew_server_test.py's table, and both help articles.",
			},
		],
	},

	{
		id: "dev-spare-parts-web",
		category: "Integrations",
		title: "Spare Parts Web — Implementation",
		summary:
			"A public, per-branch, no-login parts catalogue and order-request flow spanning service-plus-server, service-plus-client, and service-plus-web, with images reusing the existing job-attachment file-server API unmodified.",
		tags: [
			"spare parts web",
			"spare_part_web",
			"spare_part_web_order",
			"public catalogue",
			"website_router",
			"image_urls",
			"text array",
			"file server",
			"branch scoping",
			"public directory",
		],
		content: [
			{
				type: "para",
				text: "As-built implementation summary for plans/plan-parts-web.md — a public spare-parts catalogue and order-request feature (no payment gateway, no automated fulfillment) shipped through Phase 3 (schema + admin CRUD, public read-only browsing, and order submission); the optional Phase 4 staff-order-list screen and 'copy to branch' bulk action were deliberately deferred, not built. It spans four repos: service-plus-server (schema, public API, image routes), service-plus-client (the Masters admin screen), service-plus-web (the public browse/order pages), and service-plus-file-server (one new route).",
			},
			{ type: "heading", text: "Data model — three new tenant-schema tables" },
			{
				type: "table",
				headers: ["Table", "Role"],
				rows: [
					[
						"spare_part_web",
						"The catalogue itself, one row per listed part, scoped by branch_id. part_id (FK spare_part_master) is nullable — a market-sourced part with no internal costing/stock record is a first-class row, not a workaround. image_urls text[] holds an ordered gallery; element 1 is the cover, no separate cover column.",
					],
					[
						"spare_part_web_order",
						"One row per customer order request. branch_id is on the header (not the line) — an order never spans branches, enforced in Python at submission time, not a DB constraint. status is NEW/CONTACTED/CANCELLED with no automated transitions.",
					],
					[
						"spare_part_web_order_line",
						"Line items, unit_price/line_total snapshotted at order time — always server-recomputed from spare_part_web.price at submission, never trusted from the client.",
					],
				],
			},
			{
				type: "note",
				text: "No migration runner exists in this codebase — new-tenant provisioning applies the whole BU_SCHEMA_DDL string wholesale, but an existing tenant needs new DDL hand-applied per schema. All three tables were hand-applied to every existing tenant at rollout time; a future new table needs the same manual step, and the app_setting row this feature added (web_order_notify_email) was rolled out to existing tenants via the existing feedBuSeedData mutation instead, since every seed insert is ON CONFLICT (id) DO NOTHING — a materially easier path than hand-applying DDL, worth reusing for any future app-setting-only addition.",
			},
			{ type: "heading", text: "Why image_urls is a plain text[], not a child table" },
			{
				type: "para",
				text: "job_image_doc (the existing one-parent-many-images pattern) exists mainly to carry a required per-image about caption — a job's photos are of different unnamed things and each needs its own label. A part's photos are all photos of the same, already-named part, so a caption is unwanted friction, not a missing feature. text[] on spare_part_web buys: one less table/sequence/FK/hand-applied-DDL-statement per tenant; the detail endpoint returns the full gallery straight off the row (no join, no second query); ordering is free (array order is display order); and it writes through the existing generic-update envelope with zero server code, since psycopg3 adapts a Python list of strings to text[] natively. The one real trade-off is concurrency — an array read-modify-write can lose a write — avoided by doing every mutation in one SQL statement, never a Python read-modify-write: append via image_urls || %s::text[], remove via array_remove(image_urls, %s), reorder/clear via a deliberate full-array write.",
			},
			{ type: "heading", text: "Image storage — the existing file-server API, reused unmodified" },
			{
				type: "para",
				text: 'service-plus-file-server\'s upload API takes client_code/bu_code/branch_code/job_no and nests files under those four (slugified) segments — none of it is actually job-specific in the route signature. This feature repurposes the same four segments rather than adding new file-server routes: branch_code becomes "spare-part-web-{branch.code}" (keeping this feature\'s image folder disjoint from that same branch\'s job-image folder, which lives at the bare branch code), and job_no becomes str(spare_part_web_id) (globally unique via an identity sequence, so no cross-branch path collision is possible even before the branch-folder prefix). This means the existing per-job DELETE /files/delete-job works unmodified as "delete all images for this one part" — no file-server change needed for per-part cleanup.',
			},
			{
				type: "para",
				text: "The one real file-server addition: DELETE /files/delete-folder (client_code, bu_code, branch_code → shutil.rmtree on that resolved 3-level directory, same X-API-Key gate as every other route) — there was no delete-above-job-level capability before. Called with branch_code=\"spare-part-web-{CODE}\" it wipes exactly one branch's catalogue images without touching that branch's job images. app/services/file_client.py gained a matching delete_folder() wrapper; the admin-triggered UI action for it was deferred (Phase 4), so today it's reachable but not wired to a button.",
			},
			{
				type: "para",
				text: "Server-side, image_router.py added four spare-part-web routes (upload/append, delete-by-url, reorder with a permutation check against the stored array, delete-all-for-part) that all resolve branch_code server-side from the part's own branch_id — a client can never file an image under a branch the part doesn't belong to. Reads need no new route: the existing unauthenticated GET /api/images/uploads/{path} proxy ('paths are unguessable' is this codebase's stated rationale) serves catalogue photos directly, with no branch awareness needed since the branch is already baked into the stored path.",
			},
			{ type: "heading", text: "Public API — app/routers/public/website_router.py + sql_public.py" },
			{
				type: "para",
				text: "Same require_website_key + rate-limit pattern as the pre-existing 'Track your repair' routes, and the same tenant-resolution mechanism reused, not reinvented: public_directory.resolve_company(token) turns an opaque company token into (db_name, bu_code) with no real identifier ever reaching the browser. Branch is deliberately not folded into that token — it's an ordinary column filter, addressed by branch.code (not branch.id) and re-validated server-side on every request via a shared resolve_branch(db_name, schema, branch_code | None) helper: omitted → first active branch (head-office-first); supplied-but-invalid-for-this-tenant → 404, never a silent fallback to the default.",
			},
			{
				type: "table",
				headers: ["Endpoint", "Notes"],
				rows: [
					[
						"GET /api/public/branches?company=",
						"Drives the client's show/hide-dropdown rule: exactly one active branch means the frontend renders no dropdown at all.",
					],
					[
						"GET /api/public/company-info?company=&branch=",
						"Support phone for the selected branch, falling back branch.phone → head office → first active branch.",
					],
					[
						"GET /api/public/parts?company=&branch=&search=&page=",
						"Paginated, branch+is_active filtered; image_url is the cover only (image_urls[1]) — the listing deliberately doesn't ship the whole gallery.",
					],
					[
						"GET /api/public/parts/{id}?company=&branch=",
						"Full detail incl. images: string[] straight off the row, already in display order. 404s if not found, inactive, or owned by a different branch than the one resolved — never leaks a sibling branch's row for a guessed id.",
					],
					[
						"POST /api/public/part-orders",
						"Re-validates every line against the resolved branch (exists, active, right branch) with a specific per-line rejection reason; always recomputes price server-side; inserts header+lines in one manual transaction (the existing exec_sql*/exec_sql_batch helpers don't support one insert's returned id feeding another's FK, so this route uses get_service_db_connection directly); sends the staff notification email; a single bad line rejects the whole order, nothing is partially written.",
					],
				],
			},
			{ type: "heading", text: "Order notification — branch-first email resolution" },
			{
				type: "para",
				text: "On successful submission, app/core/email.py's existing send_email is called with no new SMTP infrastructure. Recipient resolves branch.email (the ordered-from branch) → the per-BU web_order_notify_email app-setting → the head-office branch's email, in that order; if nothing resolves, the order is still persisted and a warning is logged — an order with no notified recipient is recoverable, a lost order is not. The call is wrapped in its own try/except (send_email raises when SMTP isn't configured, by that function's own contract), so a notification failure never fails the order itself, which is already committed by that point.",
			},
			{ type: "heading", text: "Internal admin screen (service-plus-client)" },
			{
				type: "para",
				text: "Masters → Spare Parts – Web Catalogue follows this codebase's established master-data convention exactly: table + toolbar + one add/edit dialog, react-hook-form + zod, persistence through the generic-query/generic-update GraphQL envelope — no bespoke REST CRUD router. Branch scoping comes from the existing Redux context-slice (selectCurrentBranch), the same mechanism every other branch-scoped screen already uses, not a new picker; branch_id is never a form field, only stamped on insert. Access gating reuses the existing MASTERS_MENU right via INVENTORY_GENERIC_UPDATE_TABLE_RIGHTS (BU_ADMIN_GENERIC_UPDATE_TABLE_RIGHTS, a different/narrower dict scoped to division/app_setting/document_sequence, was the wrong one in an earlier draft of the design doc) — no new access-right code was seeded.",
			},
			{
				type: "para",
				text: "Image management generalizes job-image-upload.tsx rather than forking it wholesale: compressImage was extracted into a shared src/lib/image-compression.ts (byte-for-byte, no behavior change to the job uploader), and a genuinely entity-agnostic src/components/shared/entity-image-upload.tsx was built new — takes images: string[] + onChange plus three async callbacks (upload/delete/reorder) and knows nothing about spare-part-web, job, or any endpoint; the caller binds all of that. Two deliberate differences from the job version: no required about caption (opt-in via a prop, since part photos aren't individually captioned), and drag-to-reorder posts the full url list in one call rather than patching per-row sort values (there is no sort-order column to patch).",
			},
			{ type: "heading", text: "Public frontend (service-plus-web)" },
			{
				type: "para",
				text: "New /spare-parts route following the 'Track your repair' feature's own conventions (react-hook-form + zod + shadcn/ui, lib/api.ts's publicGet/ApiError, sonner toasts). company-select.tsx was extracted out of the two existing job-status/open-jobs forms so all three features share one picker. branch-select.tsx renders null outright at 0 or 1 branches (only a 2+ case shows a dropdown, preselected to the first) — the single-branch case is completely invisible to the customer, not merely disabled. The cart is client-side, localStorage-persisted, and keyed on the (company, branch) pair specifically so it can never silently mix parts from two branches — the same thing the order-submission endpoint would reject server-side, made structurally impossible client-side instead of just handled as an error.",
			},
			{ type: "heading", text: "Known, deliberate limitations" },
			{
				type: "bullets",
				items: [
					"Fully decoupled from live inventory — is_active is the only availability signal, no stock check at order time, since many rows have no spare_part_master link to check stock against at all.",
					"No BU-level shared catalogue — every branch's listing is fully independent rows, prices, and images; a 'Copy to branch…' bulk action exists in the plan as the mitigation for near-identical multi-branch catalogues but was deferred, not built (no evidence yet that a live tenant needs it).",
					"No staff-facing order list screen yet — orders are only reachable via the notification email or a direct query against spare_part_web_order; deferred for the same reason as the copy-to-branch action.",
					"Search is free-text only (part_name/part_description/model) — there's no structured brand/category filter, and many rows have no product/brand FK to filter on anyway.",
				],
			},
		],
		faqs: [
			{
				q: "Why does the catalogue live in its own spare_part_web table instead of extending spare_part_master?",
				a: "spare_part_master requires a part_code and a brand_id and is used for job costing/stock; many web-catalogue rows are market-sourced parts with neither. Decoupling the tables lets a branch list a part it has no internal costing record for at all.",
			},
			{
				q: "Why text[] instead of a child image table, given job_image_doc is the existing precedent?",
				a: "job_image_doc's shape exists specifically to carry a required per-image caption, which this feature doesn't want — every photo is already of one named part. Stripped of that requirement, a child table is just a sort_order column and a join wrapped around a list of strings; text[] gets ordering, a join-free detail read, and one fewer hand-applied-per-tenant table for free.",
			},
			{
				q: "Why reuse the job-image file-server API instead of building a dedicated one?",
				a: "The upload/read/delete routes were never actually job-specific in their signature — client_code/bu_code/branch_code/job_no are just four path segments. Repurposing branch_code (prefixed 'spare-part-web-') and job_no (the part's own id) maps this feature onto the existing hierarchy with zero file-server route changes for per-part upload/read/delete; only the whole-folder-delete capability needed a genuinely new route.",
			},
			{
				q: "Can a customer order parts from two different branches in one checkout?",
				a: "No — an order's branch_id lives on the header, not the line, and the server rejects a submission mixing branches. The cart is also structurally scoped to one (company, branch) pair client-side, so this is prevented before it would ever reach the server, not just caught there.",
			},
			{
				q: "Is there a payment step anywhere in this feature?",
				a: "No payment gateway exists in this codebase; there never was one to integrate for this feature. Checkout collects name/mobile/email/remarks only, and the confirmation screen states plainly that fulfillment (delivery and billing) is manual and offline.",
			},
			{
				q: "What happens to an order's notification email if the branch has no email and no app-setting is configured?",
				a: "The order is still inserted — recipient resolution failing is logged as a warning, not treated as a submission failure. An unnotified order is recoverable by querying the table directly; a lost order isn't, which is why persistence never depends on the email succeeding.",
			},
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
			{
				type: "table",
				headers: ["Issue", "Fix"],
				rows: [
					[
						"Client TS types out of sync after a manual DB change",
						"Re-run pnpm gen-types-all; also re-run extract_schema.sh if the change should apply to future tenants too — see the checklist in 'Generated TypeScript Types (pg-to-ts) & pnpm gen-types-all'",
					],
					[
						"gen-types-all crashes with \"Cannot read properties of undefined (reading 'Smart')\"",
						"The pnpm patch routing pg-to-ts's formatting through prettier (instead of the TS7-incompatible typescript-formatter) was lost — check patches/pg-to-ts@4.1.1.patch and pnpm-workspace.yaml's patchedDependencies, then pnpm install — see 'Generated TypeScript Types (pg-to-ts) & pnpm gen-types-all'",
					],
					[
						"'command not found: python' on a fresh Kubuntu box",
						"Install the matching python3.X-venv package (e.g. python3.14-venv), then python3 -m venv env",
					],
					[
						"Need to reset a table's test data including identity sequence",
						"TRUNCATE spare_part_master RESTART IDENTITY CASCADE; (swap in the target table — CASCADE will also clear dependent rows, so double-check what's downstream first)",
					],
					[
						"Need a disposable local container to test something in isolation",
						"docker run -it --name fastapi -p 8080:80 debian:bookworm-20260316 bash — interactive TTY, named container, host:container port mapping",
					],
					[
						"Need to share a folder between a Kubuntu dev box and a Windows machine",
						"Install Samba on Kubuntu, share the folder, connect from Windows via \\\\<kubuntu-ip>, credentials are the Kubuntu user's own login",
					],
					[
						"'Job Sheet document sequence is not configured or has no prefix' while testing",
						"On the BU's original HO branch this shouldn't happen since 2026-09-18 (seed_bu_data.py pre-fills JOB_SHEET/PURCHASE_INVOICE/PURCHASE_RETURN_INVOICE) — on a later branch or division it's still a data-setup issue, not a code bug; see the end-user 'Document Sequences' article and add a prefix via Configurations → Numbering / Auto Series in the test tenant",
					],
					[
						"Adding a new shadcn component triggers an eslint error",
						"Add rules: { 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } to eslint.config.js",
					],
				],
			},
		],
		faqs: [
			{
				q: "Where do I find the versioning convention for the client package?",
				a: "Standard semver via npm/pnpm version: patch for bug fixes, minor for new features (e.g. a new module), major for breaking changes (e.g. a DB schema change) — no extra tooling required.",
			},
			{
				q: "What package manager does this repo use?",
				a: "pnpm, not npm — house rule. corepack enable pnpm if it's not already available, and use pnpm dlx in place of npx.",
			},
		],
	},
];

// ─── Category style map ────────────────────────────────────────────────────────

export const DEV_CAT_STYLE: Record<string, CategoryStyleType> = {
	Architecture: {
		emoji: "🏗️",
		gradient: "from-slate-600 to-indigo-700",
		pill: "bg-slate-100 dark:bg-slate-800/60",
		pillText: "text-slate-700 dark:text-slate-300",
		stepBg: "bg-slate-600",
		stepText: "text-white",
		border: "border-slate-300 dark:border-slate-700",
	},
	"Database & Schema": {
		emoji: "🗄️",
		gradient: "from-blue-600 to-cyan-600",
		pill: "bg-blue-100 dark:bg-blue-900/40",
		pillText: "text-blue-700 dark:text-blue-300",
		stepBg: "bg-blue-600",
		stepText: "text-white",
		border: "border-blue-300 dark:border-blue-700",
	},
	"Server (Backend)": {
		emoji: "⚙️",
		gradient: "from-emerald-600 to-green-700",
		pill: "bg-emerald-100 dark:bg-emerald-900/40",
		pillText: "text-emerald-700 dark:text-emerald-300",
		stepBg: "bg-emerald-600",
		stepText: "text-white",
		border: "border-emerald-300 dark:border-emerald-700",
	},
	"Client (Frontend)": {
		emoji: "💻",
		gradient: "from-violet-600 to-purple-700",
		pill: "bg-violet-100 dark:bg-violet-900/40",
		pillText: "text-violet-700 dark:text-violet-300",
		stepBg: "bg-violet-600",
		stepText: "text-white",
		border: "border-violet-300 dark:border-violet-700",
	},
	"Access Control & Security": {
		emoji: "🔐",
		gradient: "from-rose-600 to-pink-700",
		pill: "bg-rose-100 dark:bg-rose-900/40",
		pillText: "text-rose-700 dark:text-rose-300",
		stepBg: "bg-rose-600",
		stepText: "text-white",
		border: "border-rose-300 dark:border-rose-700",
	},
	Jobs: {
		emoji: "🧾",
		gradient: "from-teal-600 to-cyan-700",
		pill: "bg-teal-100 dark:bg-teal-900/40",
		pillText: "text-teal-700 dark:text-teal-300",
		stepBg: "bg-teal-600",
		stepText: "text-white",
		border: "border-teal-300 dark:border-teal-700",
	},
	"Multi-Tenancy & Provisioning": {
		emoji: "🏢",
		gradient: "from-amber-500 to-yellow-600",
		pill: "bg-amber-100 dark:bg-amber-900/40",
		pillText: "text-amber-700 dark:text-amber-300",
		stepBg: "bg-amber-500",
		stepText: "text-white",
		border: "border-amber-300 dark:border-amber-700",
	},
	"Deployment & Infrastructure": {
		emoji: "🚀",
		gradient: "from-orange-500 to-amber-600",
		pill: "bg-orange-100 dark:bg-orange-900/40",
		pillText: "text-orange-700 dark:text-orange-300",
		stepBg: "bg-orange-500",
		stepText: "text-white",
		border: "border-orange-300 dark:border-orange-700",
	},
	Configuration: {
		emoji: "🛠️",
		gradient: "from-teal-600 to-cyan-700",
		pill: "bg-teal-100 dark:bg-teal-900/40",
		pillText: "text-teal-700 dark:text-teal-300",
		stepBg: "bg-teal-600",
		stepText: "text-white",
		border: "border-teal-300 dark:border-teal-700",
	},
	WhatsApp: {
		emoji: "💬",
		icon: WhatsAppIcon,
		gradient: "from-green-500 to-emerald-600",
		pill: "bg-green-100 dark:bg-green-900/40",
		pillText: "text-green-700 dark:text-green-300",
		stepBg: "bg-green-500",
		stepText: "text-white",
		border: "border-green-300 dark:border-green-700",
	},
	"Extended Warranty": {
		emoji: "🛡️",
		icon: ShieldCheck,
		gradient: "from-sky-500 to-blue-600",
		pill: "bg-sky-100 dark:bg-sky-900/40",
		pillText: "text-sky-700 dark:text-sky-300",
		stepBg: "bg-sky-500",
		stepText: "text-white",
		border: "border-sky-300 dark:border-sky-700",
	},
	Integrations: {
		emoji: "🔗",
		gradient: "from-fuchsia-600 to-pink-600",
		pill: "bg-fuchsia-100 dark:bg-fuchsia-900/40",
		pillText: "text-fuchsia-700 dark:text-fuchsia-300",
		stepBg: "bg-fuchsia-600",
		stepText: "text-white",
		border: "border-fuchsia-300 dark:border-fuchsia-700",
	},
	"Troubleshooting (Dev)": {
		emoji: "🧰",
		gradient: "from-stone-600 to-neutral-700",
		pill: "bg-stone-100 dark:bg-stone-800/60",
		pillText: "text-stone-700 dark:text-stone-300",
		stepBg: "bg-stone-600",
		stepText: "text-white",
		border: "border-stone-300 dark:border-stone-700",
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
	"Jobs",
	"Multi-Tenancy & Provisioning",
	"Deployment & Infrastructure",
	"Configuration",
	"WhatsApp",
	"Extended Warranty",
	"Integrations",
	"Troubleshooting (Dev)",
] as const;
