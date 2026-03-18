#!/usr/bin/env bash
# Stamp a SemVer tag into package.json and config/package-solution.json.
#
# Usage:
#   scripts/set-version.sh v1.2.3           # stamp only (for CI)
#   scripts/set-version.sh v1.2.3 --commit  # stamp + git commit + git tag
#
# Both forms are accepted; a leading "v" is stripped automatically.
# SPFx requires a four-part version (major.minor.patch.build), so ".0" is
# appended for package-solution.json.
#
# Recommended release workflow (run locally, then push):
#   ./scripts/set-version.sh v1.2.3 --commit
#   git push && git push --tags
# The pushed tag triggers the release GitHub Actions workflow automatically.

set -euo pipefail

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  echo "Usage: $0 <tag> [--commit]  (e.g. v1.2.3 --commit)" >&2
  exit 1
fi

DO_COMMIT=false
if [[ "${2:-}" == "--commit" ]]; then
  DO_COMMIT=true
fi

SEMVER="${TAG#v}"       # strip leading "v" if present
VTAG="v${SEMVER}"      # ensure "v" prefix for the git tag
SPFX_VER="${SEMVER}.0"  # SPFx requires four-part version (major.minor.patch.build)

echo "Stamping version: semver=${SEMVER}  spfx=${SPFX_VER}"

npm version "$SEMVER" --no-git-tag-version

SPFX_VER="$SPFX_VER" node -e "
const fs  = require('fs');
const ver = process.env.SPFX_VER;
const p   = 'config/package-solution.json';
const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
obj.solution.version = ver;
obj.solution.features.forEach(f => { f.version = ver; });
fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
console.log('config/package-solution.json → ' + ver);
"

if [[ "${DO_COMMIT}" == "true" ]]; then
  git add package.json config/package-solution.json
  git commit -m "chore: release ${VTAG}"
  git tag -a "${VTAG}" -m "Release ${VTAG}"
  echo ""
  echo "Created commit and tag ${VTAG}."
  echo "Push with:  git push && git push --tags"
fi
