#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# shellcheck source=scripts/colors.sh
source "$(dirname "${BASH_SOURCE[0]}")/colors.sh"

DEFAULT_SOURCE="submission/partner-center/test-instructions.md"
TOOLS_DIR=".cache/partner-center-pdf-tooling"
OUTPUT_DIR=".cache/partner-center"
MARKED_VERSION="18.0.3"
PLAYWRIGHT_VERSION="1.59.1"

DRY_RUN=false
SOURCE_PATH="${DEFAULT_SOURCE}"
OUTPUT_PATH=""

show_help() {
  cat <<'EOF'
Usage: scripts/export-partner-center-pdf.sh [OPTIONS] [<source.md>] [<output.pdf>]

Render a local PDF from the Partner Center markdown instructions.

Defaults:
  source: submission/partner-center/test-instructions.md
  output: .cache/partner-center/<source-basename>.pdf

Options:
  -h, --help  Show this help and exit.
  --dry-run   Print the actions without downloading tooling or writing files.

Examples:
  scripts/export-partner-center-pdf.sh
  scripts/export-partner-center-pdf.sh submission/partner-center/test-instructions.md
  scripts/export-partner-center-pdf.sh submission/partner-center/test-instructions.md .cache/partner-center/reviewer-guide.pdf
EOF
}

maybe() {
  if $DRY_RUN; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi

  "$@"
}

resolve_repo_path() {
  local raw_path="$1"

  if [[ "$raw_path" = /* ]]; then
    printf '%s\n' "$raw_path"
  else
    printf '%s/%s\n' "$PWD" "${raw_path#./}"
  fi
}

tooling_manifest() {
  cat <<EOF
{
  "name": "partner-center-pdf-tooling",
  "private": true,
  "dependencies": {
    "marked": "${MARKED_VERSION}",
    "playwright": "${PLAYWRIGHT_VERSION}"
  }
}
EOF
}

ensure_tooling() {
  local manifest_path="${TOOLS_DIR}/package.json"
  local desired_json current_json=""
  local manifest_changed=false

  desired_json="$(tooling_manifest)"

  maybe mkdir -p "${TOOLS_DIR}"

  if [[ -f "${manifest_path}" ]]; then
    current_json="$(<"${manifest_path}")"
  fi

  if [[ ! -f "${manifest_path}" || "${current_json}" != "${desired_json}" ]]; then
    manifest_changed=true
    if $DRY_RUN; then
      echo "[dry-run] write ${manifest_path}"
    else
      printf '%s\n' "${desired_json}" >"${manifest_path}"
    fi
  fi

  if $manifest_changed || [[ ! -d "${TOOLS_DIR}/node_modules/marked" ]] || [[ ! -d "${TOOLS_DIR}/node_modules/playwright" ]]; then
    echo "${C_CYN}Installing local PDF helper packages in ${TOOLS_DIR}${C_RST}"
    maybe npm install --prefix "${TOOLS_DIR}" --silent
  fi

  # Keep the downloaded browser under .cache so nothing ends up in git state.
  if ! compgen -G "${TOOLS_DIR}/ms-playwright/chromium-*" >/dev/null; then
    echo "${C_CYN}Installing local Chromium browser for PDF rendering${C_RST}"
    maybe env PLAYWRIGHT_BROWSERS_PATH="${PWD}/${TOOLS_DIR}/ms-playwright" \
      "${PWD}/${TOOLS_DIR}/node_modules/.bin/playwright" install chromium
  fi
}

render_pdf() {
  local source_path="$1"
  local output_path="$2"
  local absolute_source absolute_output output_parent

  absolute_source="$(resolve_repo_path "${source_path}")"
  absolute_output="$(resolve_repo_path "${output_path}")"
  output_parent="$(dirname "${absolute_output}")"

  if [[ ! -f "${absolute_source}" ]]; then
    echo "${C_RED}Source markdown file not found:${C_RST} ${source_path}" >&2
    exit 1
  fi

  maybe mkdir -p "${output_parent}"

  if $DRY_RUN; then
    echo "[dry-run] render ${absolute_source} -> ${absolute_output}"
    return 0
  fi

  (
    cd "${TOOLS_DIR}"

    SOURCE_MD="${absolute_source}" \
      OUTPUT_PDF="${absolute_output}" \
      PLAYWRIGHT_BROWSERS_PATH="${PWD}/ms-playwright" \
      node <<'NODE'
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { marked } = require('marked');
const { chromium } = require('playwright');

const sourcePath = process.env.SOURCE_MD;
const outputPath = process.env.OUTPUT_PDF;

if (!sourcePath || !outputPath) {
  throw new Error('SOURCE_MD and OUTPUT_PDF are required.');
}

const markdown = fs.readFileSync(sourcePath, 'utf8');
const titleMatch = markdown.match(/^#\s+(.+)$/m);
const documentTitle = titleMatch ? titleMatch[1].trim() : path.basename(sourcePath, path.extname(sourcePath));
const baseHref = pathToFileURL(path.dirname(sourcePath) + path.sep).href;
const htmlBody = marked.parse(markdown);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${documentTitle}</title>
  <base href="${baseHref}" />
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    :root { color-scheme: light; }
    body {
      color: #1f2937;
      font-family: Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.45;
      margin: 0;
    }
    h1, h2, h3 {
      color: #111827;
      margin-bottom: 0.4em;
      margin-top: 1.15em;
      page-break-after: avoid;
    }
    h1 { font-size: 20pt; }
    h2 {
      border-bottom: 1px solid #d1d5db;
      font-size: 15pt;
      padding-bottom: 0.15em;
    }
    h3 { font-size: 12pt; }
    p, ul, ol { margin: 0.45em 0; }
    ul, ol { padding-left: 1.4em; }
    li { margin: 0.2em 0; }
    code {
      background: #f3f4f6;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 9pt;
      padding: 0.1em 0.3em;
    }
    pre {
      background: #f3f4f6;
      border-radius: 8px;
      overflow: hidden;
      padding: 0.8em;
      white-space: pre-wrap;
    }
    pre code {
      background: transparent;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #d1d5db;
      color: #4b5563;
      margin: 0.8em 0;
      padding-left: 1em;
    }
    table {
      border-collapse: collapse;
      margin: 0.8em 0;
      width: 100%;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 0.45em;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f9fafb; }
    hr {
      border: 0;
      border-top: 1px solid #d1d5db;
      margin: 1.2em 0;
    }
    img {
      height: auto;
      max-width: 100%;
    }
  </style>
</head>
<body>${htmlBody}</body>
</html>`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'screen' });
  await page.pdf({
    path: outputPath,
    format: 'A4',
    margin: {
      top: '18mm',
      right: '16mm',
      bottom: '18mm',
      left: '16mm',
    },
    printBackground: true,
  });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
  )

  echo "${C_GRN}Generated PDF:${C_RST} ${C_CYN}${absolute_output}${C_RST}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      show_help
      exit 0
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    -*)
      echo "${C_RED}Unknown option:${C_RST} $1" >&2
      echo "Run '$0 --help' for usage." >&2
      exit 1
      ;;
    *)
      if [[ "${SOURCE_PATH}" == "${DEFAULT_SOURCE}" ]]; then
        SOURCE_PATH="$1"
      elif [[ -z "${OUTPUT_PATH}" ]]; then
        OUTPUT_PATH="$1"
      else
        echo "${C_RED}Unexpected argument:${C_RST} $1" >&2
        echo "Run '$0 --help' for usage." >&2
        exit 1
      fi
      ;;
  esac
  shift
done

if [[ -z "${OUTPUT_PATH}" ]]; then
  output_name="$(basename "${SOURCE_PATH%.md}").pdf"
  OUTPUT_PATH="${OUTPUT_DIR}/${output_name}"
fi

ensure_tooling
render_pdf "${SOURCE_PATH}" "${OUTPUT_PATH}"

if ! $DRY_RUN; then
  next_steps \
    "Attach ${C_BLD}${OUTPUT_PATH}${C_RST} to the Partner Center submission." \
    "The generated PDF and helper tooling stay under ${C_BLD}.cache/${C_RST}, which is already git-ignored."
fi
