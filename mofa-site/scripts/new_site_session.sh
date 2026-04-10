#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  new_site_session.sh "/new site learning|astro|nextjs|react" [options]

Options:
  --site-name NAME      Override the default site name for the preset
  --description TEXT    Override the default description for the preset
  --format FMT          json | prompt | bootstrap (default: json)
EOF
}

COMMAND="${1:-}"
SITE_NAME=""
DESCRIPTION=""
FORMAT="json"

if [[ -z "$COMMAND" ]]; then
  usage >&2
  exit 1
fi
shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --site-name)
      SITE_NAME="${2:-}"
      shift 2
      ;;
    --description)
      DESCRIPTION="${2:-}"
      shift 2
      ;;
    --format)
      FORMAT="${2:-}"
      shift 2
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

normalize_command() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[[:space:]]+/ /g; s/^ +//; s/ +$//'
}

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

TOKEN="$(normalize_command "$COMMAND")"
TOKEN="${TOKEN#"/new site "}"

case "$TOKEN" in
  learning|lesson|course|math|physics)
    PRESET="learning"
    TEMPLATE="quarto-lesson"
    SITE_KIND="course"
    DEFAULT_SITE_NAME="Physics Learning Studio"
    DEFAULT_DESCRIPTION="A lesson-driven math and physics site with chapters, visuals, and interactive explanations."
    ACCENT="#2563eb"
    LOCALE="en"
    REFERENCE="/Users/yuechen/home/sophie/3b1b-calculus"
    ;;
  astro|docs|documentation|guide)
    PRESET="astro"
    TEMPLATE="astro-site"
    SITE_KIND="docs"
    DEFAULT_SITE_NAME="Origin Guide"
    DEFAULT_DESCRIPTION="A structured content site for guides, docs, and polished multi-page editorial content."
    ACCENT="#d97706"
    LOCALE="en"
    REFERENCE="/Users/yuechen/home/origin2025"
    ;;
  next|nextjs|app|product|event)
    PRESET="nextjs"
    TEMPLATE="nextjs-app"
    SITE_KIND="product"
    DEFAULT_SITE_NAME="Vision Forum"
    DEFAULT_DESCRIPTION="A static-export Next.js shell for event sites, product narratives, and app-like landing flows."
    ACCENT="#0f766e"
    LOCALE="en"
    REFERENCE="/Users/yuechen/home/ai-vision-forum-paris-2026"
    ;;
  react|vite|prototype|tool)
    PRESET="react"
    TEMPLATE="react-vite"
    SITE_KIND="tool"
    DEFAULT_SITE_NAME="React Lab"
    DEFAULT_DESCRIPTION="A fast prototype shell for lightweight UI experiments and interactive front-end loops."
    ACCENT="#be123c"
    LOCALE="en"
    REFERENCE="/Users/yuechen/home/adora-website"
    ;;
  *)
    echo "Unsupported session command: $COMMAND" >&2
    echo "Use one of: /new site learning, /new site astro, /new site nextjs, /new site react" >&2
    exit 1
    ;;
esac

SITE_NAME="${SITE_NAME:-$DEFAULT_SITE_NAME}"
DESCRIPTION="${DESCRIPTION:-$DEFAULT_DESCRIPTION}"
SLUG="$(slugify "$SITE_NAME")"

OPTIMIZED_PROMPT="$(cat <<EOF
Command: /new site $PRESET
Template: $TEMPLATE
Site kind: $SITE_KIND
Reference pattern: $REFERENCE

Generate a website scaffold using the selected template family, not copied page content.
Site name: $SITE_NAME
Description: $DESCRIPTION
Locale: $LOCALE
Accent: $ACCENT

Hard requirements:
- preserve the selected framework and its build output expectations
- extract structure and design-token patterns from the reference source
- remove private branding, logos, event copy, and site-specific business logic
- produce a clean starter that can be tuned further in mofa-site studio
EOF
)"

if [[ "$TEMPLATE" == "quarto-lesson" ]]; then
  BOOTSTRAP_COMMAND="$(cat <<EOF
bash mofa-site/scripts/bootstrap_quarto_lesson.sh \
  --out-dir ./skill-output/$SLUG \
  --title "$SITE_NAME" \
  --description "$DESCRIPTION"
EOF
)"
else
  BOOTSTRAP_COMMAND="$(cat <<EOF
bash mofa-site/scripts/bootstrap_template.sh \
  --template $TEMPLATE \
  --out-dir ./skill-output/$SLUG \
  --site-name "$SITE_NAME" \
  --description "$DESCRIPTION" \
  --accent "$ACCENT" \
  --locale "$LOCALE"
EOF
)"
fi

case "$FORMAT" in
  prompt)
    printf '%s\n' "$OPTIMIZED_PROMPT"
    ;;
  bootstrap)
    printf '%s\n' "$BOOTSTRAP_COMMAND"
    ;;
  json)
    cat <<EOF
{
  "session_command": "/new site $PRESET",
  "template": "$(json_escape "$TEMPLATE")",
  "site_kind": "$(json_escape "$SITE_KIND")",
  "site_name": "$(json_escape "$SITE_NAME")",
  "description": "$(json_escape "$DESCRIPTION")",
  "accent": "$(json_escape "$ACCENT")",
  "locale": "$(json_escape "$LOCALE")",
  "reference": "$(json_escape "$REFERENCE")",
  "bootstrap_command": "$(json_escape "$BOOTSTRAP_COMMAND")",
  "optimized_prompt": "$(json_escape "$OPTIMIZED_PROMPT")"
}
EOF
    ;;
  *)
    echo "Unsupported format: $FORMAT" >&2
    exit 1
    ;;
esac
