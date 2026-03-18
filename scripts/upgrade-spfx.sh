#!/usr/bin/env bash
# Guided SPFx version upgrade.
#
# Usage:
#   scripts/upgrade-spfx.sh <new-spfx-version>
#
# Example:
#   scripts/upgrade-spfx.sh 1.23.0
#
# SPFx is NOT upgraded with 'npm update'. The @microsoft/sp-* packages form a
# tightly coupled suite that must all move to exactly the same version at once,
# and the Yeoman generator must also be updated to regenerate scaffolded config.
#
# This script guides you through the process and checks preconditions, but some
# steps (reviewing generated config diffs) require human judgment.

set -euo pipefail

NEW_VERSION="${1:-}"
if [[ -z "${NEW_VERSION}" ]]; then
  echo "Usage: $0 <new-spfx-version>  (e.g. 1.23.0)" >&2
  exit 1
fi

# Strip leading 'v' if provided.
NEW_VERSION="${NEW_VERSION#v}"

echo "═══════════════════════════════════════════════════════════"
echo "  SPFx upgrade guide → ${NEW_VERSION}"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Step 1: Check for a clean working tree ────────────────────────────────
echo "[ 1/6 ] Checking working tree..."
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "  ERROR: You have uncommitted changes. Commit or stash them first." >&2
  exit 1
fi
echo "  ✓ Working tree is clean."
echo ""

# ── Step 2: Verify the target SPFx version exists on npm ─────────────────
echo "[ 2/6 ] Verifying SPFx ${NEW_VERSION} exists on npm..."
if ! npm view "@microsoft/sp-core-library@${NEW_VERSION}" version >/dev/null 2>&1; then
  echo "  ERROR: @microsoft/sp-core-library@${NEW_VERSION} not found on npm." >&2
  echo "  Check available versions: npm view @microsoft/sp-core-library versions" >&2
  exit 1
fi
echo "  ✓ Version ${NEW_VERSION} exists."
echo ""

# ── Step 3: Check Node.js compatibility ──────────────────────────────────
echo "[ 3/6 ] Node.js compatibility..."
echo "  Current Node: $(node --version)"
echo "  → Check the SPFx ${NEW_VERSION} release notes for the required Node range:"
echo "    https://learn.microsoft.com/sharepoint/dev/spfx/compatibility"
echo "  If a different Node version is required, update:"
echo "    - .devcontainer/devcontainer.json  (NODE_VERSION build arg)"
echo "    - .devcontainer/Dockerfile         (NODE_VERSION ARG default)"
echo "    - package.json                     (engines.node field)"
echo "    - .github/workflows/ci.yml         (node-version)"
echo "    - .github/workflows/release.yml    (node-version)"
echo "    - .nvmrc"
echo ""

# ── Step 4: Install updated packages ─────────────────────────────────────
echo "[ 4/6 ] Installing SPFx ${NEW_VERSION} packages..."
SPFX_DEPS=(
  "@microsoft/sp-component-base@${NEW_VERSION}"
  "@microsoft/sp-core-library@${NEW_VERSION}"
  "@microsoft/sp-http@${NEW_VERSION}"
  "@microsoft/sp-lodash-subset@${NEW_VERSION}"
  "@microsoft/sp-office-ui-fabric-core@${NEW_VERSION}"
  "@microsoft/sp-property-pane@${NEW_VERSION}"
  "@microsoft/sp-webpart-base@${NEW_VERSION}"
)
SPFX_DEV_DEPS=(
  "@microsoft/eslint-config-spfx@${NEW_VERSION}"
  "@microsoft/eslint-plugin-spfx@${NEW_VERSION}"
  "@microsoft/sp-module-interfaces@${NEW_VERSION}"
  "@microsoft/spfx-heft-plugins@${NEW_VERSION}"
  "@microsoft/spfx-web-build-rig@${NEW_VERSION}"
)

npm install "${SPFX_DEPS[@]}"
npm install --save-dev "${SPFX_DEV_DEPS[@]}"

# Install matching Rushstack packages (versions are coordinated with SPFx).
echo ""
echo "  Rushstack packages are managed by @microsoft/spfx-web-build-rig."
echo "  Run 'npm install' to let npm resolve compatible versions from the lockfile."
npm install
echo "  ✓ Packages installed."
echo ""

# ── Step 5: Run yo to regenerate scaffolded config ───────────────────────
echo "[ 5/6 ] Regenerating config via Yeoman..."
echo "  The Yeoman generator updates config files (tsconfig, heft configs, etc.)."
echo "  You will be asked whether to overwrite each file — review diffs carefully."
echo ""
echo "  Install the updated generator first:"
echo "    npm install --global @microsoft/generator-sharepoint@${NEW_VERSION}"
echo "  Then run:"
echo "    yo @microsoft/sharepoint --skip-install"
echo ""
echo "  → Also update the generator version pinned in .devcontainer/Dockerfile:"
echo "    npm install --global yo @microsoft/generator-sharepoint@${NEW_VERSION}"
echo ""

# ── Step 6: Verify the build ─────────────────────────────────────────────
echo "[ 6/6 ] Verify the upgrade..."
echo "  Run the full build and test suite to confirm everything works:"
echo "    npm test"
echo "    npm run lint"
echo "    npm run build    (produces the .sppkg)"
echo ""
echo "  If the build passes, commit with:"
echo "    git add package.json package-lock.json config/"
echo "    git commit -m \"chore: upgrade SPFx to ${NEW_VERSION}\""
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Upgrade preparation complete. Manual steps remain — see above."
echo "═══════════════════════════════════════════════════════════"
