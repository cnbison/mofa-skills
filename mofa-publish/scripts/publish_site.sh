#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  publish_site.sh --site-dir PATH --target github-pages|mini --slug NAME [options]

Options:
  --repo OWNER/NAME      Required for github-pages target
  --repo-root PATH       Optional local repo root to mirror the generated workflow
  --mini-host mini1|mini3
  --mini-user USER       SSH username for mini target, default: cloud
  --ssh-key PATH         Optional SSH private key for mini target
  --ssh-password-env VAR Optional env var name containing the SSH password for mini target
  --ssh-port PORT        SSH port for mini target, default: 22
  --remote-root PATH     Remote web root for mini target, default: /Users/<mini-user>/octos-web
  --cname DOMAIN
  --setup-ci
EOF
}

SITE_DIR=""
TARGET="github-pages"
SLUG=""
REPO=""
REPO_ROOT=""
MINI_HOST="mini1"
MINI_USER="cloud"
SSH_KEY=""
SSH_PASSWORD_ENV=""
SSH_PORT="22"
REMOTE_ROOT=""
CNAME=""
SETUP_CI="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --site-dir)
      SITE_DIR="${2:-}"
      shift 2
      ;;
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    --slug)
      SLUG="${2:-}"
      shift 2
      ;;
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --repo-root)
      REPO_ROOT="${2:-}"
      shift 2
      ;;
    --mini-host)
      MINI_HOST="${2:-}"
      shift 2
      ;;
    --mini-user)
      MINI_USER="${2:-}"
      shift 2
      ;;
    --ssh-key)
      SSH_KEY="${2:-}"
      shift 2
      ;;
    --ssh-password-env)
      SSH_PASSWORD_ENV="${2:-}"
      shift 2
      ;;
    --ssh-port)
      SSH_PORT="${2:-}"
      shift 2
      ;;
    --remote-root)
      REMOTE_ROOT="${2:-}"
      shift 2
      ;;
    --cname)
      CNAME="${2:-}"
      shift 2
      ;;
    --setup-ci)
      SETUP_CI="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SITE_DIR" || -z "$SLUG" ]]; then
  usage >&2
  exit 1
fi

if [[ "$SLUG" == *"/"* || "$SLUG" == *".."* ]]; then
  echo "slug must not contain '/' or '..': $SLUG" >&2
  exit 1
fi

if [[ ! -f "$SITE_DIR/index.html" ]]; then
  echo "site_dir must contain index.html: $SITE_DIR" >&2
  exit 1
fi

if [[ -n "$SSH_KEY" && ! -f "$SSH_KEY" ]]; then
  echo "ssh key not found: $SSH_KEY" >&2
  exit 1
fi

if [[ -n "$SSH_PASSWORD_ENV" ]]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "sshpass is required when --ssh-password-env is used" >&2
    exit 1
  fi
  if [[ -z "${!SSH_PASSWORD_ENV:-}" ]]; then
    echo "environment variable not set for --ssh-password-env: $SSH_PASSWORD_ENV" >&2
    exit 1
  fi
fi

write_ci_workflow_content() {
  cat <<'EOF'
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
EOF
}

write_ci_workflow_local() {
  local workflow_dir="$1/.github/workflows"
  mkdir -p "$workflow_dir"
  write_ci_workflow_content >"$workflow_dir/deploy.yml"
}

publish_ci_workflow_remote() {
  local default_branch
  local tmpfile
  local content_b64
  local existing_sha=""
  local tmprepo
  local push_message

  default_branch="$(gh repo view "$REPO" --json defaultBranchRef --jq '.defaultBranchRef.name' 2>/dev/null || true)"
  if [[ -z "$default_branch" || "$default_branch" == "null" ]]; then
    default_branch="main"
  fi
  tmpfile="$(mktemp)"
  write_ci_workflow_content >"$tmpfile"
  content_b64="$(base64 <"$tmpfile" | tr -d '\n')"
  existing_sha="$(gh api "repos/${REPO}/contents/.github/workflows/deploy.yml" --jq '.sha' 2>/dev/null || true)"
  push_message="Add GitHub Pages workflow"

  if [[ -n "$existing_sha" ]]; then
    if gh api "repos/${REPO}/contents/.github/workflows/deploy.yml" \
      -X PUT \
      -f message="Update GitHub Pages workflow" \
      -f content="$content_b64" \
      -f branch="$default_branch" \
      -f sha="$existing_sha" >/dev/null; then
      rm -f "$tmpfile"
      return 0
    fi
    push_message="Update GitHub Pages workflow"
  else
    if gh api "repos/${REPO}/contents/.github/workflows/deploy.yml" \
      -X PUT \
      -f message="Add GitHub Pages workflow" \
      -f content="$content_b64" \
      -f branch="$default_branch" >/dev/null; then
      rm -f "$tmpfile"
      return 0
    fi
  fi

  tmprepo="$(mktemp -d)"
  mkdir -p "$tmprepo/.github/workflows"
  cp "$tmpfile" "$tmprepo/.github/workflows/deploy.yml"
  (
    cd "$tmprepo"
    git init >/dev/null
    git checkout -B "$default_branch" >/dev/null
    git add .github/workflows/deploy.yml
    git -c user.name='mofa-publish' -c user.email='mofa-publish@local' commit -m "$push_message" >/dev/null
    git remote add origin "https://github.com/${REPO}.git"
    git push origin "HEAD:${default_branch}" >/dev/null
  )

  rm -f "$tmpfile"
  rm -rf "$tmprepo"
}

verify_url() {
  local url="$1"
  local attempt
  for attempt in 1 2 3; do
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
    if [[ "$code" =~ ^2[0-9][0-9]$ || "$code" =~ ^3[0-9][0-9]$ ]]; then
      echo "$url"
      return 0
    fi
    sleep 10
  done
  echo "verification failed for $url" >&2
  return 1
}

build_ssh_opts() {
  SSH_OPTS=(
    -o StrictHostKeyChecking=no
    -o ConnectTimeout=5
    -o ServerAliveInterval=15
    -o ServerAliveCountMax=3
  )

  if [[ -n "$SSH_KEY" ]]; then
    SSH_OPTS+=(
      -i "$SSH_KEY"
      -o IdentitiesOnly=yes
      -o IdentityAgent=none
      -o PreferredAuthentications=publickey
      -o PubkeyAuthentication=yes
    )
  fi

  if [[ -n "$SSH_PASSWORD_ENV" ]]; then
    SSH_OPTS+=(
      -o PreferredAuthentications=password,keyboard-interactive
      -o PubkeyAuthentication=no
      -o KbdInteractiveAuthentication=yes
      -o NumberOfPasswordPrompts=1
    )
  fi
}

run_ssh() {
  if [[ -n "$SSH_PASSWORD_ENV" ]]; then
    SSHPASS="${!SSH_PASSWORD_ENV}" sshpass -e ssh "$@"
  else
    ssh "$@"
  fi
}

run_scp() {
  if [[ -n "$SSH_PASSWORD_ENV" ]]; then
    SSHPASS="${!SSH_PASSWORD_ENV}" sshpass -e scp "$@"
  else
    scp "$@"
  fi
}

deploy_github_pages() {
  if [[ -z "$REPO" ]]; then
    echo "--repo is required for github-pages" >&2
    exit 1
  fi

  local owner="${REPO%%/*}"
  local repo_name="${REPO##*/}"
  local url
  if [[ -n "$CNAME" ]]; then
    url="https://${CNAME}/"
  elif [[ "$repo_name" == "${owner}.github.io" ]]; then
    url="https://${owner}.github.io/"
  else
    url="https://${owner}.github.io/${repo_name}/"
  fi

  if [[ "$SLUG" != "$repo_name" ]]; then
    echo "warning: slug '$SLUG' does not match repo name '$repo_name'; public Pages URL follows the repo name" >&2
  fi

  gh repo view "$REPO" --json name >/dev/null 2>&1 || gh repo create "$REPO" --public --confirm

  if [[ "$SETUP_CI" == "true" ]]; then
    publish_ci_workflow_remote
    if [[ -n "$REPO_ROOT" ]]; then
      write_ci_workflow_local "$REPO_ROOT"
    fi
  fi

  (
    cd "$SITE_DIR"
    git init >/dev/null
    git checkout -B gh-pages >/dev/null
    : > .nojekyll
    if [[ -n "$CNAME" ]]; then
      printf '%s\n' "$CNAME" > CNAME
    fi
    git add -A
    git -c user.name='mofa-publish' -c user.email='mofa-publish@local' commit -m "Deploy $SLUG" >/dev/null 2>&1 || true
    git remote add origin "https://github.com/${REPO}.git" 2>/dev/null || git remote set-url origin "https://github.com/${REPO}.git"
    git push -f origin gh-pages
  )

  gh api "repos/${REPO}/pages" -X POST -f source.branch=gh-pages -f source.path=/ >/dev/null 2>&1 || true

  verify_url "$url" >/dev/null
  printf '%s\n' "$url"
}

deploy_mini() {
  local ip domain remote_root remote_site_dir url
  local remote_host ssh_target
  local -a scp_opts

  case "$MINI_HOST" in
    mini1)
      ip="69.194.3.128"
      domain="crew.ominix.io"
      ;;
    mini3)
      ip="69.194.3.203"
      domain="octos.ominix.io"
      ;;
    *)
      echo "unsupported mini host: $MINI_HOST" >&2
      exit 1
      ;;
  esac

  remote_root="${REMOTE_ROOT:-/Users/${MINI_USER}/octos-web}"
  remote_site_dir="${remote_root%/}/sites/${SLUG}"
  remote_host="${MINI_USER}@${ip}"
  ssh_target="${MINI_USER}@${ip}"
  url="https://${domain}/sites/${SLUG}/index.html"

  build_ssh_opts
  scp_opts=("${SSH_OPTS[@]}")

  if ! run_ssh "${SSH_OPTS[@]}" -p "$SSH_PORT" "$ssh_target" "echo ok" >/dev/null; then
    echo "ssh connectivity failed for ${remote_host}:${SSH_PORT}" >&2
    if [[ -n "$SSH_KEY" ]]; then
      echo "tried explicit key: $SSH_KEY" >&2
    elif [[ -n "$SSH_PASSWORD_ENV" ]]; then
      echo "tried sshpass with env var: $SSH_PASSWORD_ENV" >&2
    else
      echo "if the host requires a specific identity, retry with --ssh-key PATH" >&2
    fi
    echo "if the remote username differs, retry with --mini-user USER" >&2
    exit 1
  fi

  run_ssh "${SSH_OPTS[@]}" -p "$SSH_PORT" "$ssh_target" "mkdir -p '$remote_site_dir'"
  run_scp "${scp_opts[@]}" -P "$SSH_PORT" -r "$SITE_DIR"/. "${remote_host}:${remote_site_dir}/"

  verify_url "$url" >/dev/null
  printf '%s\n' "$url"
}

case "$TARGET" in
  github-pages)
    deploy_github_pages
    ;;
  mini)
    deploy_mini
    ;;
  *)
    echo "unsupported target: $TARGET" >&2
    exit 1
    ;;
esac
