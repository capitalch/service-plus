# Point `service.kushinfotech.in` → Cloudjiffy env `service-stage.cloudjiffy.net`

Goal: the browser keeps showing `service.kushinfotech.in`. Achieved with a DNS `CNAME`
plus a domain binding in Cloudjiffy — not a redirect (a redirect always rewrites the
address bar).

**Must be a CNAME, not an A record:** `service-stage.cloudjiffy.net` sits behind a
rotating shared pool (`103.217.220.{8,9,249,250}`). A pinned A record breaks when the
pool rotates.

---

## Step 1 — Lower the TTL (~1 hour before the switch)

cPanel → **Zone Editor** → **Manage** for `kushinfotech.in`. Find:

```
service.kushinfotech.in.   3600   IN   A   103.212.121.53
                           ^^^^
```

Edit → change **only** `3600` to `300` → Save. Leave the value `103.212.121.53` alone.
No behaviour change; the site keeps working.

**Then wait ~1 hour.** Copies already cached under the old 3600 don't shorten
retroactively — one full old TTL must elapse before every resolver holds the 300.

## Step 2 — Bind the domain in Cloudjiffy

1. Log in to `https://app.cloudjiffy.com`.
2. Environment → **Settings** → **Custom Domains** → **Bind Domains**.
3. Enter `service.kushinfotech.in` → **Bind**.

Mandatory: the env shares its IPs with many others, and the platform resolver picks the
env by reading the HTTP `Host` header. Without the binding, a correct CNAME still lands
on a default / "environment not found" page.

## Step 3 — Swap the DNS record

cPanel → **Zone Editor** → **Manage** for `kushinfotech.in`. Do both parts together:

1. **Delete** the `service` **A** record (`103.212.121.53`) — the one edited in Step 1.
2. **Add**:
   ```
   Name:   service            (cPanel may want the FQDN: service.kushinfotech.in.)
   Type:   CNAME
   TTL:    300
   Record: service-stage.cloudjiffy.net.      <- trailing dot
   ```

A hostname cannot hold both an A and a CNAME. A leftover A record is the classic cause
of "works for some people, not others".

**If cPanel refuses the CNAME:** `service.kushinfotech.in` also exists as a cPanel
**subdomain**, which keeps re-asserting its A record. cPanel → **Domains** → remove the
`service` subdomain → then add the CNAME.

Do not touch the apex, `www`, `mail`, `MX`, or any SPF/DKIM/TXT record.

## Step 4 — Verify DNS before doing SSL

```bash
dig +short service.kushinfotech.in CNAME     # → service-stage.cloudjiffy.net.
dig +short service.kushinfotech.in @8.8.8.8  # → 103.217.220.x
curl -I http://service.kushinfotech.in       # → Server: openresty
```

`Server:` is the fastest diagnosis — `openresty` = Cloudjiffy (good), `LiteSpeed` =
still MilesWeb (not propagated, or the old A record survived).

Do not start Step 5 until this shows `openresty`: Let's Encrypt validates over plain
HTTP on port 80 and a premature attempt burns a rate-limit slot (5 failures/hostname/hour).

## Step 5 — HTTPS (Let's Encrypt)

1. In the Cloudjiffy env: **Add-ons** → **Add-ons** → **Let's Encrypt** → **Add**.
2. In the pop-up: select **Add certificate for custom domain**, enter
   `service.kushinfotech.in`.
3. **If Let's Encrypt doesn't appear:** add a **load balancer** to the env topology,
   then retry — it will work. This also assigns the env a static IP.
4. Enable auto-update in the add-on if the option is present; otherwise **renew every
   3 months from this same add-on**.

Verify:
```bash
curl -I https://service.kushinfotech.in
echo | openssl s_client -connect service.kushinfotech.in:443 \
  -servername service.kushinfotech.in 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```
SAN must contain `service.kushinfotech.in`; issuer must be Let's Encrypt.

---

## Final checks

- [ ] `https://service.kushinfotech.in` loads the app and the address bar still reads
      `service.kushinfotech.in`.
- [ ] `curl -L` shows no redirects other than `http:` → `https:`.
- [ ] Valid certificate, no browser warning.
- [ ] Login works; a protected GraphQL query returns data.
- [ ] Console: no CORS errors, no mixed-content blocks.
- [ ] File/image upload and download both work.
- [ ] Mail to `@kushinfotech.in` still delivers.
- [ ] Raise the CNAME's TTL back to 3600 after a stable day or two.
- [ ] Calendar reminder at ~80 days for the certificate renewal.

## Rollback

Delete the CNAME, re-add `service A 103.212.121.53`. With TTL 300 it takes ~5 minutes.
Nothing in Cloudjiffy needs undoing — a bound domain that no longer resolves is inert.
