#!/usr/bin/env bash
#
# Typecheck generated files against the project's own tsconfig, path aliases included.
#
# A bare `npx tsc --noEmit <file>` does NOT pick up the project's tsconfig.json: it falls
# back to TypeScript defaults with no `paths`, so `@fixtures/test` and `@pages/*` blow up
# with bogus "Cannot find module" errors. This writes a throwaway tsconfig that extends the
# real one, runs tsc through it, and always cleans up — including on failure or interrupt.
#
# Usage:  typecheck-spec.sh <file> [<file> ...]     # paths relative to the repo root
# Exit:   0        clean
#         tsc's    type errors (printed verbatim to stdout)
#         64       bad usage
#         66       no tsconfig.json at the repo root
#         69       TypeScript is not installed locally (run `npm install`)
#
# tsc is resolved from node_modules/.bin ONLY. Never `npx tsc`: with node_modules absent or
# stale, npx silently fetches `tsc@2.0.4` from the registry — a deprecated squatter package
# that is not the TypeScript compiler. A run that "typechecks" through that package proves
# nothing, and the skill would record a PASS it never earned.

set -uo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $(basename "$0") <file> [<file> ...]" >&2
  exit 64
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

if [ ! -f tsconfig.json ]; then
  echo "typecheck-spec: no tsconfig.json at repo root ($ROOT)" >&2
  exit 66
fi

TSC="node_modules/.bin/tsc"
if [ ! -x "$TSC" ]; then
  echo "typecheck-spec: $TSC not found. Run 'npm install' first." >&2
  exit 69
fi

SCRATCH=".tsconfig.scratch.json"
trap 'rm -f "$SCRATCH"' EXIT INT TERM

{
  printf '{\n  "extends": "./tsconfig.json",\n  "include": ['
  sep=""
  for f in "$@"; do
    printf '%s"%s"' "$sep" "$f"
    sep=", "
  done
  printf '],\n  "exclude": []\n}\n'
} > "$SCRATCH"

"$TSC" --noEmit -p "$SCRATCH"
