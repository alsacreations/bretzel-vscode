#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ./scripts/release.sh [patch|minor|major|x.y.z] [--publish] [--tag]
# Examples:
#  ./scripts/release.sh patch            # bump patch, build and save vsix in dist/
#  ./scripts/release.sh minor --tag      # bump minor, build, commit & create git tag
#  VSCE_PAT=... ./scripts/release.sh patch --publish

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

FIRST_ARG="${1:-}"
# If the first arg is an option (starts with --) or absent, do not treat it as a version bump.
if [[ -z "$FIRST_ARG" || "$FIRST_ARG" == --* ]]; then
  BUMP=""
else
  BUMP="$FIRST_ARG"
  shift || true
fi

PUBLISH=false
GIT_TAG=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --publish) PUBLISH=true ;;
    --tag) GIT_TAG=true ;;
    --no-tag) GIT_TAG=false ;;
    --help) echo "Usage: $0 [version] [--publish] [--tag]"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

echo "Release script starting (bump=$BUMP, publish=$PUBLISH, git_tag=$GIT_TAG)"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required" >&2; exit 1
fi

CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")

# New behavior: do NOT modify package.json. Use the version declared in package.json.
# If a version argument is supplied, it must match package.json (or script will abort).
if [[ -n "${BUMP:-}" ]]; then
  if [[ "$BUMP" =~ ^(patch|minor|major)$ ]]; then
    echo "This release script no longer auto-bumps versions. Please set the desired version in package.json and re-run." >&2
    exit 1
  fi
  if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    if [[ "$BUMP" != "$CURRENT_VERSION" ]]; then
      echo "Provided version ($BUMP) does not match package.json version ($CURRENT_VERSION)." >&2
      echo "Update package.json to the desired version and re-run the script, or run without arguments to use package.json version." >&2
      exit 1
    fi
  else
    # ignore unexpected first argument, continue using package.json version
    :
  fi
fi

NEW_VERSION="$CURRENT_VERSION"
echo "Using package.json version: $NEW_VERSION"

NAME=$(node -e "console.log(require('./package.json').name)")
PKG_BASENAME="${NAME}-${NEW_VERSION}.vsix"
DEST_FILE="dist/${PKG_BASENAME}"
ROOT_FILE="${PKG_BASENAME}"

# Abort if the canonical VSIX filename for this version already exists
if [[ -f "$ROOT_FILE" || -f "$DEST_FILE" ]]; then
  echo "A VSIX for version $NEW_VERSION already exists:" >&2
  [[ -f "$ROOT_FILE" ]] && echo "  in repo: $ROOT_FILE" >&2
  [[ -f "$DEST_FILE" ]] && echo "  in dist/: $DEST_FILE" >&2
  echo "To proceed, change the version in package.json to a new value (e.g. 0.0.5) and re-run this script." >&2
  exit 1
fi

echo "Compiling..."
pnpm run compile

echo "Packaging VSIX..."
npx @vscode/vsce package

PKG_NAME="${NAME}-${NEW_VERSION}.vsix"
mkdir -p dist
if [[ -f "$PKG_NAME" ]]; then
  mv "$PKG_NAME" "$DEST_FILE"
  echo "Packaged: $DEST_FILE"
else
  # vsce sometimes creates with different case or path; locate any .vsix and move it to the canonical dest
  FOUND=$(ls *.vsix 2>/dev/null || true)
  if [[ -n "$FOUND" ]]; then
    # If multiple found, take the most recent
    SELECTED=$(ls -1t *.vsix | head -n1)
    mv "$SELECTED" "$DEST_FILE"
    echo "Packaged: $DEST_FILE (from $SELECTED)"
  else
    echo "VSIX not found after packaging" >&2
    exit 1
  fi
fi

if [ "$GIT_TAG" = true ]; then
  echo "Committing package.json and CHANGELOG.md (if present) and creating git tag v$NEW_VERSION"
  git add package.json CHANGELOG.md 2>/dev/null || true
  git commit -m "chore(release): v$NEW_VERSION" || echo "No changes to commit"
  git tag "v$NEW_VERSION" || echo "Tag v$NEW_VERSION already exists"
fi

if [ "$PUBLISH" = true ]; then
  if [ -z "${VSCE_PAT:-}" ]; then
    echo "VSCE_PAT is not set. Export your Personal Access Token as VSCE_PAT to publish." >&2
    exit 1
  fi
  echo "Publishing to Marketplace..."
  npx @vscode/vsce publish --pat "$VSCE_PAT"
fi

echo "Release script finished."
