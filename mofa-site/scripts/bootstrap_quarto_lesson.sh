#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bootstrap_quarto_lesson.sh --out-dir PATH --title TITLE [--description TEXT] [--theme THEME] [--language LANG]

Creates a Phase 1 `quarto-lesson` scaffold for mofa-site.
EOF
}

OUT_DIR=""
TITLE=""
DESCRIPTION="Interactive lesson site."
THEME="cosmo"
LANGUAGE="en"

escape_sed_replacement() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

escape_yaml_double_quoted() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    --title)
      TITLE="${2:-}"
      shift 2
      ;;
    --description)
      DESCRIPTION="${2:-}"
      shift 2
      ;;
    --theme)
      THEME="${2:-}"
      shift 2
      ;;
    --language)
      LANGUAGE="${2:-}"
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

if [[ -z "$OUT_DIR" || -z "$TITLE" ]]; then
  usage >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR%/scripts}/templates/quarto-lesson"
TITLE_YAML="$(escape_yaml_double_quoted "$TITLE")"
TITLE_TPL="$(escape_sed_replacement "$TITLE")"
TITLE_YAML_TPL="$(escape_sed_replacement "$TITLE_YAML")"
DESCRIPTION_TPL="$(escape_sed_replacement "$DESCRIPTION")"

mkdir -p "$OUT_DIR/lessons" "$OUT_DIR/images"
cp "$TEMPLATE_DIR/styles.css" "$OUT_DIR/styles.css"
cp "$TEMPLATE_DIR/lesson.qmd.example" "$OUT_DIR/lessons/example-lesson.qmd"

cat >"$OUT_DIR/_quarto.yml" <<EOF
project:
  type: website
  output-dir: docs

website:
  title: "$TITLE_YAML"
  navbar:
    left:
      - href: index.qmd
        text: Home
EOF

if [[ "$LANGUAGE" == "bilingual" ]]; then
  cat >>"$OUT_DIR/_quarto.yml" <<'EOF'
      - href: index-zh.qmd
        text: 中文版
EOF
fi

cat >>"$OUT_DIR/_quarto.yml" <<EOF
      - href: lessons.qmd
        text: Lessons

format:
  html:
    theme: $THEME
    css: styles.css
    toc: true
    include-in-header:
      text: |
        <script src="https://d3js.org/d3.v7.min.js"></script>
EOF

sed \
  -e "s/{{title_yaml}}/$TITLE_YAML_TPL/g" \
  -e "s/{{title}}/$TITLE_TPL/g" \
  -e "s/{{description}}/$DESCRIPTION_TPL/g" \
  "$TEMPLATE_DIR/index.qmd.tmpl" >"$OUT_DIR/index.qmd"

cp "$TEMPLATE_DIR/lessons.qmd.tmpl" "$OUT_DIR/lessons.qmd"

if [[ "$LANGUAGE" == "bilingual" ]]; then
cat >"$OUT_DIR/index-zh.qmd" <<EOF
---
title: "${TITLE_YAML}"
---

# ${TITLE}

这是一个双语课程站点首页。请补充中文导语和导航说明。

[查看课程列表](lessons.qmd)
EOF
fi

echo "Created Quarto lesson scaffold at: $OUT_DIR"
