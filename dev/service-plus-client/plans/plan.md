Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Point LOCAL service-plus at the REMOTE stage trace server

 Goal

 Make the locally-run service-plus server post accounts vouchers to
 the remote trace server
 at http://node267892-stage.cloudjiffy.net:11147 instead of a local
 trace server on
 localhost:8001.

 Why it currently only works with local trace on :8001

 Accounts posting calls POST
 {trace_plus_url}/internal/accounts-posting
 (app/graphql/resolvers/mutation_helper.py:2385).
 settings.trace_plus_url is chosen by
 APP_ENV (app/config.py:171-178). Run locally, APP_ENV defaults to
 development, so it
 uses trace_plus_url_development = http://localhost:8001
 (config.py:126-128). That's why
 posting only works when a trace server is running locally on 8001.

 Do NOT just set APP_ENV=production to get a remote URL —
 APP_ENV=production also switches
 the DB host selection to production IPs
 (app/db/pool_manager.py:48-49,
 app/db/psycopg_driver.py:430-431,491-492), which is not wanted for
 local dev. Keep
 APP_ENV=development and only repoint the development trace URL.

 Fix (recommended: env var, no code change)

 In the local dev/service-plus-server/.env, add/override:
 TRACE_PLUS_URL_DEVELOPMENT=http://node267892-stage.cloudjiffy.net:11
 147
 (pydantic BaseSettings reads .env, case_sensitive=False, no
 env_prefix — config.py:97,
 so the field trace_plus_url_development is set by env var
 TRACE_PLUS_URL_DEVELOPMENT.)
 Then restart the local uvicorn server.

 Alternative (code): change the default of trace_plus_url_development
 in
 dev/service-plus-server/app/config.py:127 to the cloudjiffy URL.
 Simpler but hardcodes a
 stage URL into the repo for all devs — the env var is
 cleaner/reversible.

 Critical: service key must match

 TRACE_PLUS_SERVICE_KEY (config.py:142, default 5171f52c…) is sent as
 X-Service-Key
 and must equal the remote stage trace server's SERVICE_PLUS_API_KEY.
 If the stage server
 uses a different key, posting returns 401/403. If so, also set in
 the local .env:
 TRACE_PLUS_SERVICE_KEY=<stage server's SERVICE_PLUS_API_KEY>

 Verification

 1. From the local machine, confirm reach + auth against the stage
 server:
 curl -i -sS --max-time 35 \
   -X POST 'http://node267892-stage.cloudjiffy.net:11147/internal/acc
 ounts-posting' \
   -H 'Content-Type: application/json' \
   -H 'X-Service-Key:
 5171f52c545e8a88a3eca272685f4e2016cb7fbefd8ef687acdec9cf606491c6' \
   -d '{"value":"ping"}'
   - refused/timeout → port :11147 not reachable from local / not
 exposed publicly.
   - 401/403 → key mismatch → set TRACE_PLUS_SERVICE_KEY to the stage
 key.
   - 400/422/500 → reached + authorized (ping body invalid) → good to
 go.
 2. Restart local service-plus, run Accounts Posting from the UI,
 confirm rows flip to
 is_posted = true and vouchers appear in the stage trace server.
