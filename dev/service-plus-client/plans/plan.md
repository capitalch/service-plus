# Serving `service.kushinfotech.in` from the Cloudjiffy env `service-stage.cloudjiffy.net`

**Requirement:** the user types `service.kushinfotech.in` and the address bar *keeps
saying* `service.kushinfotech.in`, while the Cloudjiffy env serves the content.

---

## How the URL is preserved

The browser must never be handed a second address. A `CNAME` achieves that at the DNS
layer: `service.kushinfotech.in` resolves straight to the Cloudjiffy env and the
browser connects there directly, so the address bar keeps showing the name that was
typed. MilesWeb drops out of the request path entirely and only answers the DNS
question.

Cloudjiffy must also be told the hostname belongs to your environment (Phase 2) —
DNS alone is not enough on a shared IP.

---

## Verified facts (probed 2026-09-04)

| Thing | Value |
|---|---|
| `service.kushinfotech.in` **now** | A → `103.212.121.53` (MilesWeb `helix.herosite.pro`), LiteSpeed, currently `404` |
| Its TTL | **3600** — so Phase 1 matters |
| `service-stage.cloudjiffy.net` | `103.217.220.{8,9,249,250}` — a **rotating 4-IP shared pool** |
| Target env status | up, `HTTP 200`, serves `<title>Service+</title>` (the client app) |
| `/graphql/` on the target env | **200, same origin** |
| Nameservers / where to edit DNS | `in./sg./eu./us.solidhosting.pro`; SOA hostmaster `root@helix.herosite.pro` → your MilesWeb **cPanel → Zone Editor** |
| Wildcard `*.kushinfotech.in`? | No |

**Two consequences:**

1. **It must be a CNAME, not an A record.** The env has no dedicated IP — it sits
   behind a rotating pool of four shared platform addresses. Pinning any one of them in
   an A record works until the pool rotates, then breaks.
2. **No client code change is needed.** `src/lib/utils.ts:4` returns
   `window.location.origin` in production, and the env answers `/graphql/` on that same
   origin — so the app and its API move to the new hostname together, automatically.

---

## Phase 1 — Lower the TTL (do this ~1 hour ahead)

cPanel → **Zone Editor** → **Manage** for `kushinfotech.in`. Edit the existing
`service` A record and set **TTL = 300**. Leave the value alone for now.

The record's TTL is currently 3600, so without this step resolvers may keep serving the
old MilesWeb address for up to an hour after the change — and a rollback would be just
as slow. Wait out one old TTL (an hour) before Phase 3.

The concrete action — cPanel → Zone Editor →
  Manage for kushinfotech.in, find:

  service.kushinfotech.in.   3600   IN   A
  103.212.121.53
                              ^^^^

  Click Edit, change only that number to 300,
  save. Leave the value 103.212.121.53 alone.
  Nothing changes behaviour-wise — the site
  keeps working exactly as now.

---

## Phase 2 — Bind the domain in Cloudjiffy

Do this before the DNS change; it is harmless while DNS still points at MilesWeb, and
it means the env is ready the moment DNS flips.

1. Log in to the Cloudjiffy dashboard (`https://app.cloudjiffy.com`).
2. Select the environment → **Settings** → **Custom Domains** → **Bind Domains**.
3. Enter `service.kushinfotech.in` → **Bind**.

> Why this is mandatory: the env shares `103.217.220.{8,9,249,250}` with many other
> environments, and the platform resolver decides which env you meant by reading the
> HTTP `Host` header. Without the binding, a correct CNAME still lands on the shared
> resolver and returns a default / "environment not found" page.

---

## Phase 3 — Swap the DNS record

cPanel → **Zone Editor** → **Manage** for `kushinfotech.in`:

1. **Delete** the `service` **A** record (`103.212.121.53`). This is the same you edited one hour before.
2. **Add**:
   ```
   Name:   service                (cPanel may want the FQDN: service.kushinfotech.in.)
   Type:   CNAME
   TTL:    300
   Record: service-stage.cloudjiffy.net.       <- trailing dot
   ```

A hostname may not hold both an A and a CNAME. Leaving the old A record in place is the
classic cause of "it works for some people and not others" — do both steps together.

> **If cPanel refuses to add the CNAME**, it is because `service.kushinfotech.in` also
> exists as a **cPanel subdomain**, and cPanel keeps re-asserting its A record. Fix:
> cPanel → **Domains** → remove the `service` subdomain, then add the CNAME. Removing
> the subdomain does not delete its files — but note where the docroot is first, in
> case you want it back.

**Do not touch** `serviceplus`, the apex, `www`, `mail`, `MX`, or any SPF/DKIM/TXT
record. You are changing one label, so mail and the existing public site are unaffected.

---

## Phase 4 — Verify DNS before touching SSL

```bash
dig +short service.kushinfotech.in CNAME
dig +short service.kushinfotech.in @8.8.8.8
dig +short service.kushinfotech.in @1.1.1.1
curl -I http://service.kushinfotech.in
```
Expect the CNAME to be `service-stage.cloudjiffy.net.` resolving into `103.217.220.x`,
and the `Server:` header to read **`openresty`**.

The `Server:` header is the fastest diagnosis:
- `openresty` → you are on Cloudjiffy. Success.
- `LiteSpeed` → still MilesWeb: not propagated yet, or the old A record survived.

Confirm too that `curl -L` reports **0 redirects** and a final URL of
`http://service.kushinfotech.in/` — that is the whole point of the exercise.

**Do not proceed to Phase 5 until this shows openresty** — Let's Encrypt validates over
plain HTTP on port 80 and will burn a rate-limit attempt if DNS is not ready.

---

## Phase 5 — HTTPS for the custom domain

The platform's built-in wildcard certificate covers only `*.cloudjiffy.net`, so
`https://service.kushinfotech.in` will throw a name-mismatch warning until you do this.

**As actually done (2026-09-05):** no manual nginx reverse proxy and no separate
Let's Encrypt Marketplace add-on were needed. Instead:

1. Any manually-installed nginx reverse-proxy node was uninstalled, leaving the
   python server as the env's own entry point.
2. Environment → **Settings** → the env-level **SSL** button was clicked (this is
   Cloudjiffy's built-in Let's Encrypt integration, which issues/renews a cert for
   every domain already bound to the env — the default `*.cloudjiffy.net` name and
   any custom domains — rather than a separately-installed add-on).
3. Result: `https://service-stage.cloudjiffy.net` **and**
   `https://serviceplus.kushinfotech.in` both serve over valid HTTPS.

> ⚠️ **Domain name check needed:** this plan (Phases 1–3) binds and cuts over
> `service.kushinfotech.in`, but the confirmed-working custom domain above is
> `serviceplus.kushinfotech.in` (also referenced in Phase 6 as the *existing*
> public site that must not be touched). Confirm which hostname is actually meant
> before relying on this — if `service.kushinfotech.in` was intended, its SSL
> coverage still needs separate verification.

Original plan (still valid if the Marketplace add-on route is preferred instead of
the env's SSL button):
1. Environment → **Add-ons** / **Marketplace** → install **Let's Encrypt Free SSL** on
   the environment's **entry-point** node.
2. Configure:
   - **External domains:** `service.kushinfotech.in`
   - Enable **auto-renewal** (installs a cron that renews before the 90-day expiry).
   - Enable the **HTTP → HTTPS redirect** option if offered. *(This redirect is fine and
     expected — it changes the scheme, never the hostname.)*
3. Install and wait for the success message.

Verify (either route):
```bash
curl -I https://service.kushinfotech.in
echo | openssl s_client -connect service.kushinfotech.in:443 \
  -servername service.kushinfotech.in 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```
The SAN must contain `service.kushinfotech.in` and the issuer must be Let's Encrypt.
Also confirm the cert's expiry/auto-renewal is active rather than a one-time manual
issuance that will silently lapse in ~90 days.

**Rate limit:** 5 failed validations per hostname per hour. If issuance fails, diagnose
(nearly always DNS not propagated, or port 80 blocked) rather than retrying blindly.

---

## Phase 6 — Follow-ups

1. **CORS — one entry to add.** Unlike the app's own traffic (which is same-origin and
   never hits CORS), anything calling the API *cross-origin* needs listing.
   `cors_origins` (`app/core/settings/api_settings.py:30`) does **not** currently
   include `https://service.kushinfotech.in`. Add it if anything will call this host
   from another origin; if the client app is the only consumer, it is not required.
   Also confirm no `CORS_ORIGINS` env var on the node overrides the defaults.
2. **The env's native hostname keeps working.** Binding *adds* a name; it does not
   retire `service-stage.cloudjiffy.net`. Anything already pointing there is unaffected.
3. **Mixed content from the file server — check this.**
   `file_server_url_production` defaults to `http://192.168.15.85:9000`: plain HTTP on
   an RFC1918 address. Any such URL reaching the browser from an HTTPS page is blocked
   outright, and a private IP is unreachable from a client machine regardless. If file
   URLs are handed to the browser, route them through the HTTPS origin (e.g. proxied
   under `/files`); if the backend only fetches them server-side, this is a non-issue.
4. **Users log in again.** The auth token lives in `localStorage`
   (`src/features/auth/store/auth-slice.ts`), scoped per origin, so anyone moving from
   `service-stage.cloudjiffy.net` to the new hostname starts with an empty store.

---

## Phase 7 — Post-cutover checklist

- [ ] `https://service.kushinfotech.in` loads the app **and the address bar still reads
      `service.kushinfotech.in`** after the page settles.
- [ ] `curl -L` reports 0 redirects apart from the deliberate `http:` → `https:` one.
- [ ] Certificate is valid, no browser warning.
- [ ] `Server:` header reads `openresty`.
- [ ] Login works end to end (token issued, a protected GraphQL query returns data).
- [ ] Devtools Console: no CORS errors, no mixed-content blocks.
- [ ] File/image upload **and** download both work.
- [ ] **Regression:** `serviceplus.kushinfotech.in` still serves the public site, and
      mail to `@kushinfotech.in` still delivers.
- [ ] Raise the TTL back to 3600 once stable for a day or two.
- [ ] Reminder ~80 days out to confirm the Let's Encrypt auto-renewal actually ran.

## Rollback

With TTL at 300: delete the CNAME, re-add `service A 103.212.121.53`, wait ~5 minutes.
Nothing in Cloudjiffy needs undoing — a bound domain that no longer resolves to the env
is inert.
