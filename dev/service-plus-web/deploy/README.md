# Deploying service-plus-web to milesweb.in

`service-plus-web` builds to a **static export** (`next build` → `./out`), which is exactly
what a MilesWeb shared cPanel/Apache plan expects: drop the files in a document root and it
just works — no Node process to keep alive. Because it's a static site, the browser holds
`NEXT_PUBLIC_WEBSITE_KEY` and `NEXT_PUBLIC_API_BASE_URL` (see plans/plan.md §4 for why that's
an acceptable coarse gate, not a real secret, for this POC).

## One-time setup

1. **Point a domain or subdomain at MilesWeb.**
   - Full domain: deploy to `public_html/`.
   - Subdomain (recommended for this POC, e.g. `beta.yourdomain.in`): create the subdomain in
     cPanel first — it gets its own document root, usually `public_html/beta` or
     `~/beta.yourdomain.in`.
   - If you deploy under a **subfolder** of an existing site instead of a subdomain root, set
     `basePath`/`assetPrefix` in `next.config.ts` to that subfolder before building.

2. **Get access to that document root** — either:
   - **SSH** (preferred): MilesWeb's higher-tier plans include SSH. Add your public key under
     cPanel → SSH Access, and confirm the port (cPanel's SSH is often on a non-standard port,
     not 22 — check cPanel → SSH Access → "Manage SSH Keys" / your welcome email).
   - **FTP**: create an FTP account in cPanel scoped to the target document root if SSH isn't
     available on your plan.

3. **Copy the deploy config:**
   ```bash
   cp deploy/.env.deploy.example deploy/.env.deploy
   ```
   Fill in `deploy/.env.deploy` (gitignored — never commit it):
   - `DEPLOY_METHOD=ssh` or `ftp`
   - SSH: `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_PORT`, `DEPLOY_REMOTE_PATH`
     (absolute path to the document root), and `DEPLOY_SSH_KEY` if not using the default key.
   - FTP: `DEPLOY_FTP_HOST`, `DEPLOY_FTP_USER`, `DEPLOY_FTP_PASSWORD`, `DEPLOY_FTP_REMOTE_PATH`.
   - `DEPLOY_SITE_URL`: the public URL to smoke-check after deploy (e.g.
     `https://beta.yourdomain.in`).

4. **Set the app's own env vars** — copy `.env.example` to `.env.local` (or `.env.production`)
   and fill in:
   - `NEXT_PUBLIC_API_BASE_URL` — the production `service-plus-server` URL (https).
   - `NEXT_PUBLIC_WEBSITE_KEY` — must match `WEBSITE_API_KEY` in `service-plus-server`'s `.env`
     for that environment.

5. **On `service-plus-server`**, add the milesweb origin to `cors_origins` (via `CORS_ORIGINS`
   in its `.env`) before the site can call the API from a browser, e.g.:
   ```
   CORS_ORIGINS=["https://beta.yourdomain.in"]
   ```

## Deploying

```bash
./deploy/build-and-deploy-milesweb.sh
```

This installs dependencies, runs `pnpm build` (static export to `./out`), writes an
`.htaccess` (forces https, long-caches `/_next/` assets, sets the 404 page), syncs `./out/` to
the configured remote path (rsync over SSH, or `lftp mirror` for FTP), and finally curls
`DEPLOY_SITE_URL` to confirm the deploy is live.

Re-running the script is safe — `rsync --delete` / `lftp mirror --delete` keep the remote
directory in sync with the latest build, removing files that no longer exist locally.

## Troubleshooting

- **`pnpm not found`**: install it locally (`corepack enable` or `npm i -g pnpm`) — the script
  needs it on `PATH` to build.
- **`lftp not found`**: only needed for `DEPLOY_METHOD=ftp`; install via `apt install lftp` on
  Kubuntu, or switch to SSH if your plan supports it.
- **Blank page / API calls failing after deploy**: open the browser console — a CORS error
  means the site's origin isn't yet in `service-plus-server`'s `CORS_ORIGINS`; a 401 means
  `NEXT_PUBLIC_WEBSITE_KEY` doesn't match the server's `WEBSITE_API_KEY`.
- **404s on refresh for a route other than `/`**: this POC only has one route (`/`), so this
  shouldn't come up yet — revisit `.htaccess` rewrite rules once more routes are added.
