# Deploying service-plus-portal to milesweb.in

`service-plus-portal` builds to a **static export** (`next build` → `./out`), which is exactly
what a MilesWeb shared cPanel/Apache plan expects: drop the files in a document root and it
just works — no Node process to keep alive. Because it's a static site, the browser holds
`NEXT_PUBLIC_WEBSITE_KEY` and `NEXT_PUBLIC_API_BASE_URL`. The key is a coarse gate, not a real
secret: the sales-enquiry endpoint relies on rate limiting, validation and a honeypot field.

## One-time setup

1. **Point the domain at MilesWeb** (planned: `myserviceplus.in`).
   - Add it in cPanel as an **addon domain** with its own document root, and issue the AutoSSL
     certificate.
   - If you deploy under a **subfolder** of an existing site instead of a domain root, set
     `basePath`/`assetPrefix` in `next.config.ts` to that subfolder before building.

2. **Get access to that document root** — either:
   - **SSH** (preferred): MilesWeb's higher-tier plans include SSH. Add your public key under
     cPanel → SSH Access, and confirm the port (cPanel's SSH is often on a non-standard port,
     not 22 — check cPanel → SSH Access → "Manage SSH Keys" / your welcome email).
   - **FTP**: create an FTP account in cPanel scoped to the target document root if SSH isn't
     available on your plan.

3. **Create the deploy config** `deploy/.env.deploy` (gitignored — never commit it). The
   simplest start is a copy of `service-plus-web`'s `deploy/.env.deploy.example`; the keys are
   identical:
   - `DEPLOY_METHOD=ssh` or `ftp`
   - SSH: `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_PORT`, `DEPLOY_REMOTE_PATH`
     (absolute path to the document root), and `DEPLOY_SSH_KEY` if not using the default key.
   - FTP: `DEPLOY_FTP_HOST`, `DEPLOY_FTP_USER`, `DEPLOY_FTP_PASSWORD`, `DEPLOY_FTP_REMOTE_PATH`.
   - `DEPLOY_SITE_URL`: the public URL to smoke-check after deploy (e.g.
     `https://myserviceplus.in`).

4. **Set the app's own env vars** in `.env.production` (or `.env.local` for `pnpm dev`) in the
   package root. Both are gitignored:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE_URL` | the `service-plus-server` URL the enquiry form posts to (https in production; `http://localhost:8000` locally) |
   | `NEXT_PUBLIC_WEBSITE_KEY` | must equal `WEBSITE_API_KEY` in that server's `.env` |
   | `NEXT_PUBLIC_APP_URL` | the Service+ app the **Login** button opens (defaults to `https://serviceplus.cloudjiffy.net`) |

5. **On `service-plus-server`**:
   - add the portal's origins to `cors_origins` (via `CORS_ORIGINS` in its `.env`), e.g.
     `CORS_ORIGINS=["https://myserviceplus.in","https://www.myserviceplus.in"]`;
   - set `CONTACT_NOTIFY_EMAIL`, the inbox that receives plan enquiries;
   - run `scripts/sales_enquiry.sql` once against the `service_plus_client` database. Without
     that table every enquiry fails with a 500.

## Deploying

```bash
./deploy/build-and-deploy-milesweb.sh
```

This installs dependencies, runs `pnpm build` (static export to `./out`), writes an
`.htaccess` (forces https, long-caches `/_next/` assets, sets the 404 page), syncs `./out/` to
the configured remote path (rsync over SSH, or `lftp mirror` for FTP), and finally smoke-checks
`DEPLOY_SITE_URL` — the homepage, `/pricing/`, `/contact/`, `/sitemap.xml`, and the
`Cache-Control` header on a hashed asset — failing the deploy if anything is off.

Re-running the script is safe — `rsync --delete` / `lftp mirror --delete` keep the remote
directory in sync with the latest build, removing files that no longer exist locally.

**Use the script, not a manual zip upload.** `.htaccess` is a dotfile, and cPanel's File
Manager zip extraction (like many FTP clients) silently skips dotfiles — you get a site that
loads but has no https redirect, no asset caching, and the host's default 404 page instead of
the app's. `rsync` and `lftp mirror` both transfer it correctly.

## Routing on shared hosting

`next.config.ts` sets **`trailingSlash: true`, and it must stay set.** MilesWeb's LiteSpeed has
Apache `MultiViews` off, so it never maps an extension-less URL like `/pricing` to
`pricing.html` — it serves exact filenames and a directory's `index.html`, nothing else.
`trailingSlash` makes the export emit `pricing/index.html`, which the server's own
trailing-slash redirect resolves.

Without it every route except `/` returns 404 on direct load or refresh, while in-app
navigation keeps working (the client router renders the route without ever requesting that
path from the server) — so the breakage is invisible unless you test a deep link directly.

## Troubleshooting

- **`pnpm not found`**: install it locally (`corepack enable` or `npm i -g pnpm`) — the script
  needs it on `PATH` to build.
- **`lftp not found`**: only needed for `DEPLOY_METHOD=ftp`; install via `apt install lftp` on
  Kubuntu, or switch to SSH if your plan supports it.
- **Enquiry form shows "could not send"**: open the browser console — a CORS error means the
  site's origin isn't yet in `service-plus-server`'s `CORS_ORIGINS`; a 401 means
  `NEXT_PUBLIC_WEBSITE_KEY` doesn't match the server's `WEBSITE_API_KEY`; a 500 usually means
  `scripts/sales_enquiry.sql` hasn't been run on that server's `service_plus_client` DB.
- **404s on refresh for a route other than `/`**: check that `trailingSlash: true` is still in
  `next.config.ts` and that the deployed tree has `pricing/index.html` rather than a flat
  `pricing.html` — see "Routing on shared hosting" above.
- **Host's default 404 page instead of the app's**: the `.htaccess` didn't make it to the
  document root — redeploy with the script rather than a zip upload.
