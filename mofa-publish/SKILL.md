---
name: mofa-publish
version: 0.1.0
description: "Deploy static sites to GitHub Pages or Mac Mini hosting. Triggers: mofa publish, deploy site, publish website, 发布网站, 部署网页, github pages, deploy to mini, host website, 上线, push to pages, mofa deploy, 发布到GitHub."
requires_bins: gh,git,curl,ssh,scp
requires_env:
---

# mofa-publish

Deploys a built static site to GitHub Pages or Mac Mini local hosting. Handles the full workflow: repo creation, branch setup, Pages configuration, file transfer, and verification.

Use the bundled helper for deterministic deployments:

```bash
bash mofa-publish/scripts/publish_site.sh \
  --site-dir ./docs \
  --target github-pages \
  --slug 3b1b-calculus \
  --repo ymote/3b1b-calculus
```

## Onboarding

Required:
- `gh`
- `git`
- `curl`
- `ssh`
- `scp`

Check before running:

```bash
gh auth status
git --version
ssh -V
```

## Pipeline

```
detect → prepare → deploy → verify
```

| Step | What it does | Model |
|------|-------------|-------|
| detect | Scan site dir, find index.html, validate files | cheap |
| prepare | GitHub: create repo, setup branch. Mini: test SSH | cheap |
| deploy | GitHub: push to gh-pages. Mini: scp files | cheap |
| verify | Curl deployed URL, check HTTP 200 | cheap |

## Deploy Targets

### GitHub Pages

```
mofa publish --site-dir ./docs --target github-pages --slug my-site --repo myorg/my-site
```

**URL:** usually `https://<owner>.github.io/<repo-name>/`

Important:
- The public Pages path is derived from the repo name, not the `slug`.
- In practice, set `slug` to match the repo basename unless you have a reason not to.

Steps performed:
1. `gh repo create <repo> --public` (skips if exists)
2. `git init` + `git checkout -B gh-pages`
3. Add `.nojekyll` (prevents Jekyll processing)
4. `git add -A && git commit && git push -f origin gh-pages`
5. `gh api repos/<repo>/pages` — enable Pages on gh-pages branch
6. Optionally set CNAME for custom domain
7. Optionally publish `.github/workflows/deploy.yml` into the GitHub repo for CI/CD, and mirror it into `repo_root` if provided

### Mac Mini

```
mofa publish --site-dir ./docs --target mini --slug my-site --mini-host mini1
```

**URL:** `https://crew.ominix.io/sites/<slug>/` (mini1) or `https://octos.ominix.io/sites/<slug>/` (mini3)

Steps performed:
1. Test SSH connectivity
2. `mkdir -p <remote_root>/sites/<slug>/` on remote
3. `scp -r <site_dir>/.` to remote directory so dotfiles are not skipped
4. Curl the live URL to verify

No Caddy config change needed — `file_server` already serves everything under the web root.

Optional Mini-specific flags:
- `--mini-user <user>` if the SSH username is not `cloud`
- `--ssh-key ~/.ssh/<key>` to force a specific identity and avoid agent/keychain auth spray
- `--ssh-password-env VAR` to use `sshpass` with the password stored in environment variable `VAR`
- `--ssh-port <port>` for non-standard SSH ports
- `--remote-root <path>` if the Caddy-served web root is not `/Users/<mini-user>/octos-web`

Example with explicit SSH identity:

```bash
bash mofa-publish/scripts/publish_site.sh \
  --site-dir ./docs \
  --target mini \
  --mini-host mini1 \
  --mini-user cloud \
  --ssh-key ~/.ssh/id_ed25519 \
  --slug my-site
```

Example with password auth via `sshpass`:

```bash
export MOFA_PUBLISH_SSH_PASSWORD='your-password'

bash mofa-publish/scripts/publish_site.sh \
  --site-dir ./docs \
  --target mini \
  --mini-host mini1 \
  --mini-user cloud \
  --ssh-password-env MOFA_PUBLISH_SSH_PASSWORD \
  --slug my-site
```

If the site is a dynamic app instead of a static export, you need a different Mini setup:
- run the app as a long-lived process on a localhost port
- add a `reverse_proxy` rule in Caddy
- set `basePath` in the app if you want it mounted under `/sites/<slug>/`

Recommended:
- static exports (`quarto`, `astro build`, `next build` with `output: 'export'`) → keep the current `file_server` path
- dynamic Node apps (`next start`, custom API server) → use a dedicated subdomain and reverse proxy

### Available Hosts

| Host | IP | Domain | Web Root |
|------|-----|--------|----------|
| mini1 | 69.194.3.128 | crew.ominix.io | /Users/cloud/octos-web |
| mini3 | 69.194.3.203 | octos.ominix.io | /Users/cloud/octos-web |

If SSH fails before deployment:
- verify the username with `--mini-user`
- pass `--ssh-key` to force the exact private key the server accepts
- or pass `--ssh-password-env` if the host is configured for password auth
- if the server still rejects the key or password, the helper is working but the remote account setup is not

## Caddy Proxying On Mini

Current Mini deploy assumes static files under `/Users/cloud/octos-web/sites/<slug>/`, served directly by Caddy.

### Recommended proxy shape: dedicated subdomain

Run the app on the Mini, for example on `127.0.0.1:3100`, then add a Caddy block like:

```caddyfile
mofa.crew.ominix.io {
  reverse_proxy 127.0.0.1:3100
}
```

This is the cleanest option because the app can live at `/` and does not need path-prefix rewriting.

### Path proxy shape: mount under `/sites/<slug>/`

If you must keep the site under the shared domain path, Caddy needs a path handler:

```caddyfile
crew.ominix.io {
  handle_path /sites/mofa/* {
    reverse_proxy 127.0.0.1:3100
  }

  handle {
    root * /Users/cloud/octos-web
    file_server
  }
}
```

Requirements for the app in this mode:
- Next.js must set `basePath: '/sites/mofa'`
- assets and links must respect that base path
- static-export sites do not need proxying at all

Operationally, proxy mode also requires a process manager. On macOS Mini that usually means:
- `launchd` plist for `next start --hostname 127.0.0.1 --port 3100`
- logs redirected to a known file
- Caddy reloaded after config change

The repo does not contain the Mini Caddyfile itself, so this skill can document the shape but cannot apply the remote Caddy change from here.

## Dual Deploy Pattern

Deploy to both targets for redundancy:

```bash
# Public (GitHub Pages)
crew chat -m "mofa publish --site-dir ./docs --target github-pages --slug 3b1b-calculus --repo ymote/3b1b-calculus"

# Private (Mac Mini)
crew chat -m "mofa publish --site-dir ./docs --target mini --slug 3b1b-calculus"
```

Result:
- `https://ymote.github.io/3b1b-calculus/` (public)
- `https://crew.ominix.io/sites/3b1b-calculus/` (private, fast)

## GitHub Actions Workflow (optional)

When `setup_ci` is true, publishes `.github/workflows/deploy.yml` to the target GitHub repo. If `repo_root` is provided, it also writes the same file locally:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs
      - uses: actions/deploy-pages@v4
```

This enables auto-deploy on push to the repo's default branch. Providing `repo_root` is optional and only mirrors the generated workflow locally.

## Composability

```
mofa-youtube → mofa-site → mofa-publish
                               ├──▶ GitHub Pages
                               └──▶ Mac Mini
```

Also works standalone with any pre-built static site (Astro, Next.js, Hugo, Jekyll, plain HTML).

## Supported Site Types

The `detect` step auto-detects the built site directory:

| Framework | Output Dir | Detection |
|-----------|-----------|-----------|
| Quarto | `docs/` | `docs/index.html` exists |
| Astro | `dist/` | `dist/index.html` exists |
| Next.js (export) | `out/` | `out/index.html` exists |
| Plain HTML | `.` or custom | `index.html` in specified dir |

## Security

- GitHub auth: uses `gh` CLI (reads `~/.config/gh/hosts.yml`)
- Mac Mini SSH: credentials from crew profiles, not hardcoded
- No secrets stored in pipeline files

## Bundled Assets

- `scripts/publish_site.sh`
- `examples/Caddyfile.proxy.example`
