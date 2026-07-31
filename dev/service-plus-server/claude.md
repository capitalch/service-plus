# instructions
- Limit your operations and file references strictly to the /projects/service-plus/dev/service-plus-server folder.
- Implement robust logging using the logger module.
- If the last word of command given to claude is "plan", claude must strictly follow this protocol:
    - Do not alter the code. Only generate a plan for the requested command.
    - Output Location: Write the plan to plans/plan.md in the root directory (overwrite if it exists).
    - Content Structure: List all execution steps sequentially (e.g., Step 1, Step 2).
    - Include a Workflow section that visualizes or describes the entire logic flow of the steps.
    - Write a plan.md file in the root directory's plans folder (In windows it is C:\projects\service-plus\dev\service-plus-server\plans) (overwrite if it exists).
- Centralized Messaging: Keep all custom exception and application messages in a single dedicated class file. Use its properties for all error handling and user feedback.
- All SQL must live in a separate Python class file.
- Routing: Use FastAPI Routers to handle REST endpoints. Keep main.py minimal.
- GraphQL: Use GraphQL for all secured/authenticated data calls.
- Sorting: Within every file, always sort code alphabetically by function names, class names, endpoint names, and field names.
- Make use of genericQuery and genericUpdate as far as possible for insert, update, delete and get operations.
- SQL Generation Standards
    - When generating SQL queries, you must adhere to this specific syntax:
        - Parameter Handling: Use Common Table Expressions (CTE) for all SQL parameters.
        - Testing Helper: Include a commented-out CTE line with actual test values for debugging purposes.
        - Syntax Pattern:
            - SQL Example Pattern
            with "criteria" as (values(%(criteria)s::text)) 
            -- with "criteria" as (values('test_value'::text)) -- Test line
            SELECT id, name, is_active
            FROM client
            WHERE LOWER("name") LIKE LOWER((table "criteria") || '%%')
            AND is_active = true
            ORDER BY name
    Database schemas
        The two database schemas are in app/db/schema_dumps/service_plus_client.sql and
        app/db/schema_dumps/service_plus_service.sql files
- All SQL scripts live in app/db/sql/ (split by domain: sql_jobs.py, sql_inventory.py,
  sql_sales_accounts.py, sql_bu_admin.py, sql_reports_audit.py, sql_shared.py), composed
  into one SqlStore class via multiple inheritance in app/db/sql/sql_base.py. Every
  `SqlStore.CONST_NAME` call site still works unmodified — see plans/plan.md Step 3.
- client
    - client is react + vite and is located at C:\projects\service-plus\dev\service-plus-client

- Virtual Environment Setup
    - Python virtual environment is located at: c:\projects\service-plus\env
    - All project dependencies are installed in this isolated environment
    - Python version: 3.14.3

    ## Activating Virtual Environment:
    - Windows: Run `scripts\activate.bat` or call `c:\projects\service-plus\env\Scripts\activate.bat`
    - Or use the Python directly: `c:\projects\service-plus\env\Scripts\python.exe`

    ## Installing New Libraries:
    - Always use the virtual environment pip: `c:\projects\service-plus\env\Scripts\python.exe -m pip install <package>`
    - Or activate venv first, then: `pip install <package>`
    - Update requirements.txt (production deps) or requirements-dev.txt (dev/test-only
      deps, e.g. pytest, mcp[cli]) after installing new packages

    ## Running the Server:
    - Option 1: Run `scripts\run_server.bat`
    - Option 2: `c:\projects\service-plus\env\Scripts\python.exe -m uvicorn app.main:app --reload`
    - Option 3: Activate venv, then `python -m uvicorn app.main:app --reload`
    - Secrets are read from a local, gitignored `.env` file (see `.env.example` for the
      full documented list of env vars) — never hardcode secret defaults in
      app/core/settings/*.py.

    ## Running Tests:
    - `pip install -r requirements-dev.txt` once (installs pytest/pytest-asyncio on top
      of the production deps).
    - Run the whole suite: `python -m pytest` (config in pytest.ini; no CI is wired up
      yet, so this is currently a manual step — see plans/plan.md Step 6.3).
    - Tests live under tests/, mirroring the app/ domain layout (tests/jobs/,
      tests/inventory/, tests/sales_accounts/, tests/bu_admin/, tests/reports_audit/,
      tests/core/).
    - Tests that mutate real data (job/inventory/sales/admin-user creation) are marked
      `@pytest.mark.skip` by default — they document the call shape but must not run
      against a shared dev DB. Only enable them against a disposable database.

    ## Installed Libraries:
    - fastapi, uvicorn[standard], pydantic, pydantic-settings
    - ariadne (GraphQL), graphql-core
    - psycopg[binary] (PostgreSQL)
    - websockets (for GraphQL subscriptions)
    - pytest, pytest-asyncio (dev/test only — requirements-dev.txt)
    - All dependencies are in requirements.txt (requirements-dev.txt for dev/test extras)
