# Tenant/BU security fix

## 1. The problem

Service+ is a multi-tenant app. Each customer company has its own database (`db_name`),
and inside that database, each business location has its own section called a BU
("Business Unit" — one Postgres schema per location, e.g. `schema = "capitalelectronics"`
for one shop, `schema = "navtechnology"` for another). A logged-in user is normally only
allowed to work inside their own company's database, and only inside the specific BUs
they've been assigned to.

Every time the app reads or writes data, the request says which company (`db_name`) and
which BU (`schema`) to use. Today, the server does not check that the requester is
actually allowed to use the company/BU named in the request — it just does whatever the
request says. It only checks the login token to know *who* the user is, but never
compares that against the `db_name`/`schema` the request is asking for.

This means: a normal, legitimately logged-in user — no hacking tools, just their own
regular login — can change the company or BU value in their request and read (or in some
cases write) another company's data, or a BU inside their own company they were never
given access to.

This was proven with real data: a real user, who is only assigned to one BU in one
company, was able to successfully pull customer lists from a different BU in the same
company, and from a completely different company altogether, just by changing those two
values in the request. Nothing else about the request needed to change.

This gap exists on every read and write that goes through the app's four general-purpose
data endpoints, which together handle almost all data access in the app (listing
records, saving records, running reports, etc.) — so it isn't a rare corner case, it's the
main door.

## 2. The remedy

At login, the server already knows which company the user belongs to, and which BUs they
are allowed to work in. Today only the company is stored inside the user's login token;
the list of allowed BUs is looked up but thrown away after the login screen shows it.

The fix: also store the list of allowed BUs inside the token, and check both things —
company and BU — on every request, not just at login:

1. When a user logs in, or when their token is refreshed (this already happens
   automatically every so often while they're using the app), also save their current
   list of allowed BUs into the token, next to the company they belong to.
2. Before running any read or write, decode the token and check:
   - Does the company named in the request match the company in the token? If not,
     reject the request.
   - Is the BU named in the request one of the BUs listed in the token? If not, reject
     the request.
3. Two roles are allowed to skip parts of this check, because that's already how they
   work everywhere else in the app:
   - A company-level admin (the owner-type user for one company) can use any BU inside
     their own company, but still only their own company.
   - The platform-level Super Admin (who manages every company on the platform) can use
     any company and any BU — that is their job.
4. If a single request bundles more than one query together (each naming its own BU),
   each one is checked separately. If even one of them names a BU the user isn't allowed,
   the whole request is rejected — not just that one part — so nothing partial slips
   through.
5. A token issued before this fix won't have the new BU list yet. Such a token should be
   treated as "no BUs allowed" rather than "everything allowed," so it fails safely until
   it naturally refreshes with the real list.

Nothing about this changes what a legitimate, correctly-scoped user experiences — the app
sends the same company/BU values it already sends today. The only difference is the
server now actually checks them instead of trusting them blindly.

## 3. Implementation

All code below is in the server project (`service-plus-server`), not this client project.
File paths are given relative to that project's root.

### Step 1 — Add the allowed-BU list to the login token

File: `app/routers/auth/helper.py`, function `login_helper` (runs right after checking
username and password). It already runs a query to look up the BUs a user may use, to
show on the "select business unit" screen — reuse that same result:

```python
# Existing lookup, already in the code — just also derive bu_codes from it now:
user_bus_rows = await exec_sql(
    db_name=db_name,
    schema="security",
    sql=SqlStore.GET_USER_BUS,
    sql_args={"user_id": user["id"]},
)
available_bus = [dict(row) for row in (user_bus_rows or [])]
bu_codes = [row["code"].lower() for row in available_bus if row.get("code")]

# Add bu_codes to the token payload, alongside the fields already there:
token_claims = {
    "sub": str(user["id"]),
    "user_type": user_type,
    "client_id": body.client_id,
    "db_name": db_name,
    "role_code": user.get("role_code") or "",
    "access_rights": user.get("access_rights") or [],
    "bu_codes": bu_codes,   # NEW
}
access_token = create_access_token(token_claims)
refresh_token = create_refresh_token(token_claims)
```

(The lookup already happens before the login response is built — just make sure it also
happens before `token_claims` is built, and pass `bu_codes` in.)

Do the same in `refresh_token_helper` in the same file — this function runs
automatically in the background to keep a session alive. It currently does **not** look
up the allowed-BU list at all, so add that lookup:

```python
# Add this lookup — mirrors the existing role_code/access_rights refresh below it:
user_bus_rows = await exec_sql(
    db_name=db_name,
    schema="security",
    sql=SqlStore.GET_USER_BUS,
    sql_args={"user_id": user_id},
)
bu_codes = [row["code"].lower() for row in (user_bus_rows or []) if row.get("code")]

token_claims = {
    "sub": user_id_raw,
    "user_type": user_type,
    "client_id": client_id,
    "db_name": db_name,
    "role_code": user.get("role_code") or "",
    "access_rights": user.get("access_rights") or [],
    "bu_codes": bu_codes,   # NEW
}
```

The Super Admin branch in both functions needs no change — Super Admin skips the BU
check entirely (Step 3).

### Step 2 — Make the allowed-BU list available wherever a request is handled

File: `app/graphql/schema.py`, function `get_graphql_context` — this decodes the token
once per incoming request into a plain dict the rest of the server reads. Add `bu_codes`
to it, defaulting to an empty list so an old token (from before this fix) is treated as
"no BUs allowed" rather than crashing or being treated as unrestricted:

```python
context: dict = {
    "request": request,
    "user_id": None,
    "user_type": None,
    "role_code": None,
    "access_rights": [],
    "client_id": None,
    "db_name": None,
    "bu_codes": [],        # NEW
    "auth_error": None,
}
...
context.update({
    "user_id": payload.get("sub"),
    "user_type": payload.get("user_type"),
    "role_code": payload.get("role_code"),
    "access_rights": payload.get("access_rights") or [],
    "client_id": payload.get("client_id"),
    "db_name": payload.get("db_name"),
    "bu_codes": payload.get("bu_codes") or [],   # NEW
})
```

### Step 3 — Write the check itself

File: `app/graphql/resolvers/auth_guards.py` — this already holds one reusable check
(`require_access_right`) that every part of the server can call. Add two more,
right next to it, in the same style:

```python
def require_own_tenant(info, db_name: str | None) -> None:
    """Reject unless the request's company matches the token's company.
    Super Admin may use any company."""
    context = info.context or {}
    _reject_bad_token(context)
    if context.get("user_type") == "S":
        return
    if context.get("db_name") != db_name:
        raise AuthorizationException(
            message=AppMessages.FORBIDDEN,
            extensions={"reason": "tenant_mismatch"},
        )


def require_bu_access(info, schema: str | None) -> None:
    """Reject unless the request's BU is one the token says this user may use.
    Super Admin and company-level Admin may use any BU."""
    context = info.context or {}
    _reject_bad_token(context)
    if context.get("user_type") in BYPASS_USER_TYPES:   # {"S", "A"} — already defined above
        return
    normalized = (schema or "").lower()
    if not normalized or normalized in {"security", "public"}:
        return   # these are shared, not BU-specific — nothing to check
    if normalized not in (context.get("bu_codes") or []):
        raise AuthorizationException(
            message=AppMessages.FORBIDDEN,
            extensions={"reason": "bu_mismatch"},
        )
```

### Step 4 — Call the check before every read and write

There are four places in the server that handle general-purpose reads and writes — one
for reading a single thing, one for reading several things at once in a bundle, one for
saving/updating a record, one for running a named script. Call both checks from Step 3 as
the very first thing in each one:

File: `app/graphql/resolvers/query.py`

```python
@query.field("genericQuery")
async def resolve_generic_query(_, info, db_name="", schema="public", value="") -> Any:
    require_own_tenant(info, db_name)
    require_bu_access(info, schema)
    return await resolve_generic_query_helper(db_name, schema, value)
```

The "read several things in a bundle" version is slightly different: each item in the
bundle names its own BU, so each one has to be checked on its own, before any of them
run — if one item fails, the whole bundle is rejected, none of it runs:

```python
@query.field("genericBatchQuery")
async def resolve_generic_batch_query(_, info, db_name="", items=None) -> Any:
    require_own_tenant(info, db_name)
    return await resolve_generic_batch_query_helper(info, db_name, items or [])
```

```python
# inside resolve_generic_batch_query_helper, in the loop that reads each item:
async def resolve_generic_batch_query_helper(info, db_name: str, items: list[str]) -> list:
    batch = []
    for raw in items:
        params = json.loads(unquote(raw))
        sql_id = params.get("sqlId", "")
        item_schema = params.get("schema") or "public"
        require_bu_access(info, item_schema)   # NEW — checked before this item is queued
        batch.append(SqlBatchItem(
            sql_id=sql_id,
            sql_args=params.get("sqlArgs") or {},
            schema=item_schema,
            text_dates=params.get("textDates", True),
        ))
    # only reaches here, and only runs the batch, if every item passed the check above
    ...
```

File: `app/graphql/resolvers/mutation.py`

```python
@mutation.field("genericUpdate")
async def resolve_generic_update(_, info, db_name="", schema="public", value="") -> Any:
    require_own_tenant(info, db_name)
    require_bu_access(info, schema)
    _require_generic_update_table_right(info, value)   # existing check, unchanged
    result = await resolve_generic_update_helper(db_name, schema, value)
    ...


@mutation.field("genericUpdateScript")
async def resolve_generic_update_script(_, info, db_name="", schema="public", value="") -> Any:
    require_own_tenant(info, db_name)
    require_bu_access(info, schema)
    _require_generic_update_script_right(info, value)   # existing check, unchanged
    return await resolve_generic_update_script_helper(db_name, schema, value)
```

### Step 5 — Test it

Using a real test user who is only assigned to one BU in one company:

1. Ask for data from their own BU — should work exactly as before.
2. Ask for data from a different BU in the same company — should now be rejected.
3. Ask for data from a different company entirely — should now be rejected.
4. Repeat with a token that doesn't have the new allowed-BU list (simulating an
   old/expired-and-not-yet-refreshed token) — BU-specific requests should be rejected,
   but general requests that aren't tied to a specific BU should still work.
5. Send a bundled request mixing one allowed BU and one not-allowed BU — the whole
   request should be rejected, with no data returned from either part.
6. Repeat the same checks logged in as a company-level admin — should work across every
   BU in their own company, but still be rejected for a different company.
7. Repeat logged in as the Super Admin — should work for every company and every BU,
   with no rejections.

Also add a small set of automated tests that check the logic from Step 3 directly
(company matches / doesn't match, BU is / isn't in the list, admin and super-admin
skip the relevant checks, a missing BU list is treated as "none allowed") so this
doesn't silently break later. New file: `tests/test_auth_guards.py`:

```python
from types import SimpleNamespace
import pytest
from app.core.exceptions import AuthorizationException
from app.graphql.resolvers.auth_guards import require_bu_access, require_own_tenant

def _info(**context):
    return SimpleNamespace(context=context)

def test_same_company_allowed():
    require_own_tenant(_info(user_type="B", db_name="company_a"), "company_a")

def test_different_company_rejected():
    with pytest.raises(AuthorizationException):
        require_own_tenant(_info(user_type="B", db_name="company_a"), "company_b")

def test_admin_still_blocked_from_other_company():
    with pytest.raises(AuthorizationException):
        require_own_tenant(_info(user_type="A", db_name="company_a"), "company_b")

def test_super_admin_allowed_any_company():
    require_own_tenant(_info(user_type="S", db_name=None), "any_company")

def test_assigned_bu_allowed():
    require_bu_access(_info(user_type="B", bu_codes=["shop1"]), "shop1")

def test_unassigned_bu_rejected():
    with pytest.raises(AuthorizationException):
        require_bu_access(_info(user_type="B", bu_codes=["shop1"]), "shop2")

def test_missing_bu_list_rejected():
    with pytest.raises(AuthorizationException):
        require_bu_access(_info(user_type="B"), "shop1")   # old-style token, no bu_codes at all

def test_admin_and_super_admin_allowed_any_bu():
    require_bu_access(_info(user_type="A", bu_codes=[]), "shop1")
    require_bu_access(_info(user_type="S", bu_codes=[]), "shop1")
```

### What to change, and where

- The code that creates the login token.
- The code that refreshes an existing token.
- The code that decodes an incoming request's token.
- One shared file holding reusable authorization checks — add the new check here.
- The four general-purpose read/write handlers — call the new check at the start of each.
- A short internal note for developers explaining that a request can now fail because of
  a company/BU mismatch, separate from failing because of a missing permission — nothing
  user-facing changes, so no update is needed to end-user-facing help text.
