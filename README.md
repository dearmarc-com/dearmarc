# dearmarc deployment template

Deployment scaffold for [dearmarc](https://github.com/nehoupat/dearmarc) - weekly DMARC reports for Cloudflare zones, delivered to your inbox. The library itself is a private npm package `@nehoupat/dearmarc-core`, available with a yearly subscription. This repo contains the thin entry point and configuration files you need to run your own instance on your own Cloudflare account.

## 0. Before you start

You'll need:

- **Cloudflare account.** The Workers Free plan is enough for typical use; no paid plan needed.
- **At least one zone in that account with DMARC Management enabled.** DMARC Management is free. If it's not on yet, in the CF dashboard pick the zone, go to **Email Security > DMARC Management**, and enable it. Cloudflare needs about 7 days of traffic before reports become useful.
- **Resend account** with a verified sending domain. The free tier (3,000 emails/month) is enough for most setups. Used to send the weekly emails.
- **GitHub account** to host your deployment repo and to receive your dearmarc PAT.
- **dearmarc subscription** - email [my@dearmarc.com](mailto:my@dearmarc.com) to get a GitHub Personal Access Token (PAT) with `read:packages` scope, valid for 1 year.
- **A subdomain** where the admin UI will run, e.g. `dearmarc.example.com`. The parent zone (here `example.com`) must be in your CF account and proxied.

There are two ways to deploy: **clicking through web UIs** (default, no installs needed) or **using a terminal** (recommended if you're comfortable with the command line). Pick one - both end up with the same Worker running.

---

## Path A - Web UIs only (default)

Throughout the steps below the example domain is `example.com`. Replace with your own values.

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

Commit the changes directly to `main`.

### 5. Add the dearmarc PAT as a Dependabot secret

Still in your repo: **Settings** > **Secrets and variables** > **Dependabot** > **New repository secret**.

- Name: `NPM_TOKEN_DEARMARC`
- Value: your dearmarc PAT (`ghp_...`)

This is what Dependabot uses to pull `@nehoupat/dearmarc-core` updates from GitHub Packages on your behalf.

### 6. Connect the Worker to your repo

Cloudflare dashboard > **Workers & Pages** > **Create** > **Workers** > **Connect to Git**.

- Authorize the Cloudflare GitHub App for your account if prompted.
- Pick the repo you created in step 2.
- Build settings: keep the defaults. Cloudflare reads `wrangler.jsonc` to know what to build.
- **Build variables**: add `NPM_TOKEN` = your dearmarc PAT (`ghp_...`). Without this, the build can't install the private package.
- Click **Save and Deploy**.

The first build runs `npm install` and `wrangler deploy`. It will likely succeed but the worker will throw at runtime because the secrets aren't set yet - that's fine, fix it next.

### 7. Add runtime secrets to the worker

Worker > **Settings** > **Variables and Secrets** > **Add**:

- `CLOUDFLARE_API_KEY` (Secret) - the CF API token you created in step 1
- `RESEND_API_KEY` (Secret) - from your Resend dashboard

Trigger a redeploy: **Deployments** tab > **Retry deployment** on the latest one (or push any small commit).

### 8. Log in to the admin UI

Open `https://dearmarc.example.com/`. The custom domain is provisioned automatically from the route in `wrangler.jsonc` (give it a minute after the deploy if the certificate is still being issued).

- Enter the **same CF API token** from step 1 - it's both the deployment secret and the admin login code.
- The dashboard lists every zone the token can see, with monitoring off by default.
- Activate the zones you want to monitor. In each zone's detail set the recipient email addresses and (if you use DKIM) any custom DKIM selectors.

You're done. The cron runs every Monday 07:00 UTC; the next Monday you'll receive the first weekly report.

---

## Path B - Terminal (advanced)

Same end result as Path A, fewer clicks. You need:

- **Node.js 20+** installed locally
- A terminal where `git` and `npm` work
- The CF API token from Path A step 1 and the dearmarc PAT from your subscription email

### 1. Clone and install

```bash
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
cp .npmrc.example .npmrc
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx   # your dearmarc PAT
npm install
```

`.npmrc` is in `.gitignore` - never commit it.

### 2. Create KV namespace and R2 bucket

```bash
npx wrangler kv namespace create dearmarc
npx wrangler r2 bucket create dearmarc-images --jurisdiction=eu
```

The first command prints a 32-hex namespace ID; copy it for step 3.

### 3. Edit `wrangler.jsonc`

Same fields as Path A step 4. Replace the `CHANGE-ME` placeholders.

### 4. Set runtime secrets

```bash
npx wrangler secret put CLOUDFLARE_API_KEY    # paste CF API token
npx wrangler secret put RESEND_API_KEY        # paste Resend API key
```

### 5. Deploy

```bash
npm run deploy
```

Wrangler builds, validates secrets, deploys. The custom domain is provisioned automatically (the parent zone must be a proxied zone in your CF account).

### 6. Log in to the admin UI

Open `https://dearmarc.example.com/` and log in with the CF API token. Activate zones, set recipients. The cron runs Monday 07:00 UTC.

---

## Updates

`@nehoupat/dearmarc-core` is updated when bug fixes or new features ship. There's no fixed cadence.

**Web (Dependabot):** With `NPM_TOKEN_DEARMARC` configured (Path A step 5), Dependabot checks for updates every Tuesday and opens a PR **only when a new version is published** - if there's nothing new, you get nothing, no noise. Review and merge the PR; the connected Worker rebuilds and redeploys automatically.

**Terminal:**

```bash
npm update @nehoupat/dearmarc-core
npm run deploy
```

Your dearmarc PAT expires in 1 year. **The deployed worker keeps running after expiry** - only `npm install` will start failing until you have a renewed token.

---

## Troubleshooting

**`npm install` fails with 401 Unauthorized.** The PAT is missing, expired, or doesn't have `read:packages` scope. Check `echo $GITHUB_TOKEN` (terminal) or the `NPM_TOKEN` build variable in the Worker's settings (web).

**Admin UI login doesn't work.** The login code must match the `CLOUDFLARE_API_KEY` secret exactly. If you rotated the token in the CF dashboard, redeploy with the new value.

**Weekly email didn't arrive.** Check the worker logs: **Workers & Pages** > your worker > **Logs**. Cron logs show whether the run executed and how many zones it processed. Resend's free tier limit is 3,000 emails/month.

**Reports show the wrong week.** The Cloudflare cron parser interprets numeric weekday values with an offset of 1 vs. standard cron. Always use textual `mon`/`tue`/etc. in `triggers.crons` (the template already does).

---

## What the library does (and doesn't)

The library only makes outbound calls to:

- **Cloudflare API** (with your token) for DMARC GraphQL data
- **Resend API** (with your key) for sending emails
- **DNS-over-HTTPS** at `1.1.1.1` for DMARC/SPF/DKIM/MTA-STS/BIMI/TLSRPT lookups

**No call-home to dearmarc, no telemetry.** All your data stays in your Cloudflare account (KV + R2). License details: `node_modules/@nehoupat/dearmarc-core/doc/license-model.md`.

---

## Support

Email [my@dearmarc.com](mailto:my@dearmarc.com) for bug reports, deploy issues, or configuration questions. Custom development is not included in the subscription.
