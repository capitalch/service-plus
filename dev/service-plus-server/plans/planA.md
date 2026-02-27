# Plan: Verify GraphQL Readiness at localhost:8000/graphql

## Workflow
1. Verify GraphQL Schema & Server Configuration
2. Run the Application Server Locally
3. Test the Setup using GraphQL Playground
4. Execute Test API Calls using an HTTP Client

## Steps of Execution

### Step 1: Verify GraphQL Schema & Server Configuration
- Check that FastAPI mounts the `graphql_app` at the correct path configured in `app/config.py` (which defaults to `/graphql`).
- Ensure CORS in `app/main.py` is appropriately set to accept requests from the origin where testing occurs.
- Verify `create_graphql_app` correctly resolves the GraphQL types present in `app/graphql/schema.graphql` and binds them to Py resolvers (like `genericQuery` in `app/graphql/resolvers/query.py`).

### Step 2: Run the Application Server Locally
- Open a terminal in the root directory (`c:\projects\service-plus\dev\service-plus-server\`).
- Ensure the Python virtual environment is activated.
- Start the server using Uvicorn running the FastAPI app by executing:
  `uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
- Wait for the log message "GraphQL ASGI app created with WebSocket support enabled" and "GraphQL endpoint: http://127.0.0.1:8000/graphql".

### Step 3: Test the Setup Using GraphQL Playground
- Open a web browser and navigate to `http://localhost:8000/graphql`.
- Verify that the interactive GraphQL Playground interface loads successfully (this feature depends on `settings.graphql_playground` being set to `True` in `app/config.py`).
- Inspect the Docs/Schema tab within the Playground to ensure the `genericQuery` resolver and its arguments (`db_name`, `value`) are mapped accurately.

### Step 4: Execute Test API Calls Using an HTTP Client
- Send a simple POST query using the Playground, `curl`, or Postman to ensure resolving works and data is accurately fetched.
- Example query:
  ```graphql
  query {
    genericQuery(db_name: "testDB", value: "testVal")
  }
  ```
- Make sure the API call successfully returns a 200 OK block containing the defined response structure and a "status" of "OK", validating that the GraphQL API endpoints are fully active and reachable.
