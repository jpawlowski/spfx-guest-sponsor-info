#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# shellcheck source=scripts/colors.sh
source "$(dirname "${BASH_SOURCE[0]}")/colors.sh"

usage() {
  cat <<'EOF'
Usage: ./scripts/open-qa-workbench.sh [options]

Open the hosted SharePoint workbench with reproducible visual-QA overrides.

Options:
  --live                     Disable URL-forced mock mode and use live data instead
  --viewport <preset>       phone | phone-landscape | tablet | desktop-touch
  --hint <value>            none | teamsAccessPending | versionMismatch |
                            sponsorUnavailable | noSponsors
  --count <1-5>             Number of mock sponsors to render
  --no-long                 Disable the long-content stress case for the first mock sponsor
  --print-only              Print the URL without opening a browser
  -h, --help                Show this help text
EOF
}

load_env_file() {
  if [[ -f ".env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source ".env"
    set +a
  fi
}

require_tenant_domain() {
  if [[ -n "${SPFX_SERVE_TENANT_DOMAIN:-}" ]]; then
    return
  fi

  important "SPFX_SERVE_TENANT_DOMAIN is not set." \
    "Set it in your host environment or in .env before opening the hosted workbench." \
    "" \
    "Example:" \
    "  echo 'SPFX_SERVE_TENANT_DOMAIN=contoso.sharepoint.com' >> .env"
  exit 1
}

validate_choice() {
  local label="$1"
  local value="$2"
  shift 2

  local allowed
  for allowed in "$@"; do
    if [[ "${value}" == "${allowed}" ]]; then
      return
    fi
  done

  echo "${C_RED}ERROR:${C_RST} Invalid ${label}: ${value}" >&2
  exit 1
}

validate_count() {
  local value="$1"
  if [[ ! "${value}" =~ ^[1-5]$ ]]; then
    echo "${C_RED}ERROR:${C_RST} --count must be an integer from 1 to 5." >&2
    exit 1
  fi
}

mock_mode=true
viewport="phone"
hint_value="none"
mock_count="2"
long_content=true
print_only=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --live)
      mock_mode=false
      shift
      ;;
    --viewport)
      viewport="${2:-}"
      shift 2
      ;;
    --hint)
      hint_value="${2:-}"
      shift 2
      ;;
    --count)
      mock_count="${2:-}"
      shift 2
      ;;
    --no-long)
      long_content=false
      shift
      ;;
    --print-only)
      print_only=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "${C_RED}ERROR:${C_RST} Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

validate_choice "viewport preset" "${viewport}" phone phone-landscape tablet desktop-touch
validate_choice "hint" "${hint_value}" none teamsAccessPending versionMismatch sponsorUnavailable noSponsors
validate_count "${mock_count}"

load_env_file
require_tenant_domain

# The manifest URL must stay percent-encoded because SharePoint expects it as a
# literal query-string value inside workbench.aspx.
params=(
  "loadSPFX=true"
  "debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js"
  "gsi-qa-viewport=${viewport}"
)

if [[ "${mock_mode}" == true ]]; then
  params+=(
    "gsi-qa-mock=1"
    "gsi-qa-count=${mock_count}"
    "gsi-qa-hint=${hint_value}"
  )

  if [[ "${long_content}" == true ]]; then
    params+=("gsi-qa-long=1")
  fi
fi

query_string=""
for param in "${params[@]}"; do
  if [[ -n "${query_string}" ]]; then
    query_string+="&"
  fi
  query_string+="${param}"
done

workbench_url="https://${SPFX_SERVE_TENANT_DOMAIN}/_layouts/15/workbench.aspx?${query_string}"

hint "QA URL:" "  ${C_BLD}${workbench_url}${C_RST}"

if [[ "${print_only}" == true || -z "${BROWSER:-}" ]]; then
  if [[ -z "${BROWSER:-}" && "${print_only}" != true ]]; then
    important "BROWSER is not set in this terminal, so the URL was only printed." \
      "Open it manually in your host browser after accepting https://localhost:4321 once."
  fi
  exit 0
fi

"${BROWSER}" "${workbench_url}" >/dev/null 2>&1 &

next_steps "If this is your first dev-server session, accept ${C_BLD}https://localhost:4321${C_RST} once first." \
  "Use ${C_BLD}--live${C_RST} when you want the same forced touch viewport with real guest data." \
  "Use ${C_BLD}--print-only${C_RST} if you want to paste the URL into another browser profile."
