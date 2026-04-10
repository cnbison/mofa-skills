#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bootstrap_template.sh --template TEMPLATE --out-dir PATH --site-name NAME [options]

Options:
  --description TEXT   Site description
  --base-path PATH     Public base path, default "/"
  --accent HEX         Accent color, default "#2563eb"
  --locale CODE        Default locale, default "en"

Templates:
  quarto-lesson
  astro-site
  nextjs-app
  react-vite
EOF
}

TEMPLATE=""
OUT_DIR=""
SITE_NAME=""
DESCRIPTION="Generated site scaffold."
BASE_PATH="/"
ACCENT="#2563eb"
LOCALE="en"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --template)
      TEMPLATE="${2:-}"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    --site-name)
      SITE_NAME="${2:-}"
      shift 2
      ;;
    --description)
      DESCRIPTION="${2:-}"
      shift 2
      ;;
    --base-path)
      BASE_PATH="${2:-}"
      shift 2
      ;;
    --accent)
      ACCENT="${2:-}"
      shift 2
      ;;
    --locale)
      LOCALE="${2:-}"
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

if [[ -z "$TEMPLATE" || -z "$OUT_DIR" || -z "$SITE_NAME" ]]; then
  usage >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR%/scripts}"
TEMPLATE_DIR="$ROOT_DIR/templates/$TEMPLATE"

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "Unknown template: $TEMPLATE" >&2
  exit 1
fi

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

escape_replacement() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

SITE_SLUG="$(slugify "$SITE_NAME")"
SITE_NAME_ESCAPED="$(escape_replacement "$SITE_NAME")"
DESCRIPTION_ESCAPED="$(escape_replacement "$DESCRIPTION")"
BASE_PATH_ESCAPED="$(escape_replacement "$BASE_PATH")"
ACCENT_ESCAPED="$(escape_replacement "$ACCENT")"
LOCALE_ESCAPED="$(escape_replacement "$LOCALE")"
SITE_SLUG_ESCAPED="$(escape_replacement "$SITE_SLUG")"

mkdir -p "$OUT_DIR"

while IFS= read -r src; do
  rel="${src#"$TEMPLATE_DIR"/}"
  dest="$OUT_DIR/$rel"
  if [[ "$src" == *.tmpl ]]; then
    dest="${dest%.tmpl}"
    mkdir -p "$(dirname "$dest")"
    sed \
      -e "s/{{site_name}}/$SITE_NAME_ESCAPED/g" \
      -e "s/{{site_slug}}/$SITE_SLUG_ESCAPED/g" \
      -e "s/{{site_description}}/$DESCRIPTION_ESCAPED/g" \
      -e "s/{{base_path}}/$BASE_PATH_ESCAPED/g" \
      -e "s/{{accent_hex}}/$ACCENT_ESCAPED/g" \
      -e "s/{{locale}}/$LOCALE_ESCAPED/g" \
      "$src" >"$dest"
  else
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
  fi
done < <(find "$TEMPLATE_DIR" -type f | sort)

echo "Created $TEMPLATE scaffold at: $OUT_DIR"
