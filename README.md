# dearmarc deployment template

Deployment scaffold for [dearmarc](https://github.com/dearmarc-com/dearmarc) - weekly DMARC reports for Cloudflare zones, delivered to your inbox. The library itself is a private npm package `@dearmarc-com/dearmarc-core`, available with a yearly subscription. This repo contains the thin entry point and configuration files you need to run your own instance on your own Cloudflare account.

## 0. Before you start

You'll need:

- **Cloudflare account.** The Workers Free plan is enough for typical use; no paid plan needed.
- **At least one zone in that account with DMARC Management enabled.** DMARC Management is free. If it's not on yet, in the CF dashboard pick the zone, go to **Email Security > DMARC Management**, and enable it. Cloudflare needs about 7 days of traffic before reports become useful.
- **Resend account** with a verified sending domain. The free tier (3,000 emails/month) is enough for most setups. Used to send the weekly emails.
- **GitHub account** to host your deployment repo and to receive your dearmarc PAT.
- **dearmarc subscription** - email [my@dearmarc.com](mailto:my@dearmarc.com) to get a GitHub Personal Access Token (PAT) with `read:packages` scope, valid for 1 year.
- **A subdomain** where the admin UI will run, e.g. `dearmarc.example.com`. The parent zone (here `example.com`) must be in your CF account and proxied.

Throughout the steps below the example domain is `example.com`. Replace with your own values.

---

## Common setup (do these first, regardless of path)

### 1. Create a Cloudflare API token

Open [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) > **Create Token** > **Custom token**.

Configure:

- **Token name:** `dearmarc DMARC analytics`
- **Permissions:** `Zone` > `Analytics` > `Read`
- **Zone resources:** `Include` > `All zones from an account` > pick the account where your zones live. (Alternatively use `Include` > `Specific zone` and add the row multiple times if you want to whitelist only some zones.)
- **Client IP Address Filtering:** leave blank. Cloudflare's outbound IPs aren't fully published and they change over time; the token won't be used from outside CF anyway.
- **TTL:** leave blank.

Click **Continue to summary** > **Create Token**, copy the token, and save it in your password manager. You'll use it twice: as a deployment secret and as the admin login code.

### 2. Create your repo from this template

Click the green **Use this template** button at the top of this page > **Create a new repository**. Make it **Private**, name it whatever you like (e.g. `dearmarc`).

---

There are two ways to continue: **clicking through web UIs** (default, no installs needed) or **using a terminal** (recommended if you're comfortable with the command line). Pick one - both end up with the same Worker running.

## Path A - Web UIs only (default)

### 3. Create the KV namespace and R2 bucket in Cloudflare

In the Cloudflare dashboard:

**KV namespace:** **Storage & Databases** > **Workers KV** > **Create Instance**.
- Namespace name: `dearmarc`
- Click **Create**.
- Open the new namespace and switch to the **Metrics** tab - the namespace ID is shown there. Copy it for the next step.

**R2 bucket:** **Storage & Databases** > **R2 Object Storage** > **Overview** > **Create bucket**.
- Bucket name: `dearmarc-images`
- **Specify jurisdiction:** European Union (for GDPR)
- **Storage Class:** Standard
- Click **Create bucket**.

If R2 isn't enabled on the account yet, the dashboard prompts you to subscribe first. R2 has a free tier - dearmarc's chart PNGs (a few KB each) fit well under it, so no charges in normal use.

### 4. Edit wrangler.jsonc on GitHub

In your new repo, open `wrangler.jsonc` and click the pencil icon to edit. Replace each `CHANGE-ME` placeholder:

| Field | Example value |
|---|---|
| `name` | `dearmarc` |
| `vars.PUBLIC_URL` | `https://dearmarc.example.com` |
| `vars.MAIL_FROM` | `DMARC reports <reports@example.com>` |
| `kv_namespaces[0].id` | the namespace ID from step 3 |
| `routes[0].pattern` | `dearmarc.example.com` |

**Do NOT rename the binding names** `kv_namespaces[0].binding` (`CACHE`), `r2_buckets[0].binding` (`IMAGES`), or `r2_buckets[0].bucket_name` (`dearmarc-images`). The worker code uses these exact names - renaming them breaks the runtime.

Commit the changes directly to `main`.

### 5. Add the dearmarc PAT as a Dependabot secret

Still in your repo: **Settings** > **Secrets and variables** > **Dependabot** > **New repository secret**.

- Name: `NPM_TOKEN_DEARMARC`
- Value: your dearmarc PAT (`ghp_...`)

This is what Dependabot uses to pull `@dearmarc-com/dearmarc-core` updates from GitHub Packages on your behalf.

### 6. Connect the Worker to your repo

Cloudflare dashboard > **Compute** > **Workers & Pages** > **Create application** > **Connect GitHub**.

- Authorize the Cloudflare GitHub App for your account if prompted.
- Pick the repo you created in step 2.
- Build settings: keep the defaults. Cloudflare reads `wrangler.jsonc` to know what to build.
- Expand **Advanced settings** > **Build variables** > **Add variable**:
  - Name: `NPM_TOKEN`
  - Value: your dearmarc PAT (`ghp_...`)
  - **Tick the Encrypt checkbox** - the PAT is sensitive, don't leave it in plaintext.
- Click **Deploy**.

The form saves and deploys in one step. The first build runs `npm install` and `wrangler deploy` - it succeeds, but the worker will throw at runtime because the runtime secrets aren't set yet. That's fine, fix it next.

### 7. Add runtime secrets to the worker

Worker > **Settings** > **Variables and Secrets** > **Add**:

- `CLOUDFLARE_API_KEY` (Secret) - the CF API token you created in step 1
- `RESEND_API_KEY` (Secret) - from your Resend dashboard

Click **Deploy** in the form - the worker redeploys with the new secrets in one step.

### 8. Log in to the admin UI

Open `https://dearmarc.example.com/`. The custom domain is provisioned automatically from the route in `wrangler.jsonc` (give it a minute after the deploy if the certificate is still being issued).

- Enter the **same CF API token** from step 1 - it's both the deployment secret and the admin login code.
- The dashboard lists every zone the token can see, with monitoring off by default.
- Activate the zones you want to monitor. In each zone's detail set the recipient email addresses and (if you use DKIM) any custom DKIM selectors.

You're done. The cron runs every Monday 07:00 UTC; the next Monday you'll receive the first weekly report.

---

## Path B - Terminal (advanced)

Same end result as Path A, fewer clicks. Extra requirement:

- **Node.js 20+** installed locally
- A terminal where `git` and `npm` work

### 3. Clone and install

Clone the repo you created in step 2:

```bash
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
export NPM_TOKEN=ghp_xxxxxxxxxxxxx   # your dearmarc PAT
npm install
```

The committed `.npmrc` reads the token from the `NPM_TOKEN` env var - no file edit needed.

### 4. Edit `wrangler.jsonc`

Same fields as Path A step 4 - replace the `CHANGE-ME` placeholders for `name`, `vars.PUBLIC_URL`, `vars.MAIL_FROM`, and `routes[0].pattern`. Leave `kv_namespaces[0].id` as a placeholder for now - we'll fill it in after the namespace exists.

Wrangler validates the config before any resource command, so the file must be free of invalid placeholder values like `dearmarc.CHANGE-ME.com` before the next step.

### 5. Create KV namespace and R2 bucket

```bash
npx wrangler kv namespace create dearmarc
```

Wrangler creates the namespace and asks **"Would you like Wrangler to add it on your behalf?"** → answer **N**. The template already has the correct `kv_namespaces[0]` entry with binding `CACHE`; saying yes would append a duplicate entry with a different binding name and the deploy would fail.

Copy the 32-hex namespace ID from the output (looks like `ba850148de8a4582bfcebf1025dff3a0`) and paste it into `wrangler.jsonc` at `kv_namespaces[0].id`, replacing the `CHANGE-ME-PASTE-...` placeholder.

```bash
npx wrangler r2 bucket create dearmarc-images --jurisdiction=eu
```

Same prompt - answer **N**. The template already has the correct `r2_buckets[0]` entry with binding `IMAGES` and bucket name `dearmarc-images`, no edit needed.

### 6. Set runtime secrets

```bash
npx wrangler secret put CLOUDFLARE_API_KEY    # paste CF API token
npx wrangler secret put RESEND_API_KEY        # paste Resend API key
```

For the **first** secret, wrangler asks **"There doesn't seem to be a Worker called X. Do you want to create..."** → answer **y**. Wrangler creates an empty Worker shell with that name and stores the secret in it. The next `wrangler deploy` (step 7) ships the actual code into the same Worker, picking up the secrets you just set.

### 7. Deploy

```bash
npm run deploy
```

Wrangler builds, validates secrets, deploys. The custom domain is provisioned automatically (the parent zone must be a proxied zone in your CF account).

### 8. Log in to the admin UI

Open `https://dearmarc.example.com/` and log in with the CF API token. Activate zones, set recipients. The cron runs Monday 07:00 UTC.

### 9. (Optional) Connect to Git for auto-deploy

Path B leaves the Worker in manual-deploy mode - you run `npm run deploy` locally after every change. To enable auto-deploy on push (same behaviour as Path A):

Cloudflare dashboard > **Compute** > **Workers & Pages** > open your Worker > **Settings** > **Builds** > **Connect**.

- Authorize the Cloudflare GitHub App if prompted.
- Pick the repo you created in step 2.
- Build settings: keep defaults.
- **Build variables**: add `NPM_TOKEN` (Encrypted) = your dearmarc PAT.
- Save.

Every push to `main` now triggers a rebuild + redeploy. Manual `npm run deploy` still works for ad-hoc deploys; the two coexist.

---

## Updates

`@dearmarc-com/dearmarc-core` is updated when bug fixes or new features ship. There's no fixed cadence.

**Web (Dependabot):** With `NPM_TOKEN_DEARMARC` configured (Path A step 5), Dependabot checks for updates every Tuesday and opens a PR **only when a new version is published** - if there's nothing new, you get nothing, no noise. Review and merge the PR; the connected Worker rebuilds and redeploys automatically.

**Terminal:**

```bash
npm update @dearmarc-com/dearmarc-core
npm run deploy
```

Your dearmarc PAT expires in 1 year. **The deployed worker keeps running after expiry** - only `npm install` will start failing until you have a renewed token.

---

## Troubleshooting

**`npm install` fails with 401 Unauthorized.** The PAT is missing, expired, or doesn't have `read:packages` scope. Check `echo $NPM_TOKEN` (terminal) or the `NPM_TOKEN` build variable in the Worker's settings (web).

**Admin UI login doesn't work.** The login code must match the `CLOUDFLARE_API_KEY` secret exactly. If you rotated the token in the CF dashboard, redeploy with the new value.

**Weekly email didn't arrive.** Check the worker logs: **Workers & Pages** > your worker > **Logs**. Cron logs show whether the run executed and how many zones it processed. Resend's free tier limit is 3,000 emails/month.

**Reports show the wrong week.** The Cloudflare cron parser interprets numeric weekday values with an offset of 1 vs. standard cron. Always use textual `mon`/`tue`/etc. in `triggers.crons` (the template already does).

---

## What the library does (and doesn't)

The library only makes outbound calls to:

- **Cloudflare API** (with your token) for DMARC GraphQL data
- **Resend API** (with your key) for sending emails
- **DNS-over-HTTPS** at `1.1.1.1` for DMARC/SPF/DKIM/MTA-STS/BIMI/TLSRPT lookups

**No call-home to dearmarc, no telemetry.** All your data stays in your Cloudflare account (KV + R2). License details: `node_modules/@dearmarc-com/dearmarc-core/doc/license-model.md`.

---

## Support

Email [my@dearmarc.com](mailto:my@dearmarc.com) for bug reports, deploy issues, or configuration questions. Custom development is not included in the subscription.
