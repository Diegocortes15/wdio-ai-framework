#!/usr/bin/env bash
#
# Reconcile src/components/*.ts against the signature table in
# references/component-detection.md — in BOTH directions (ADR-0025).
#
# Workflow Step 4 calls this instead of eyeballing the two lists. Both failure modes it
# catches have already happened silently:
#
#   * BurgerMenu.ts landed 2026-06-03 with no row. Step 4 aborts before the page is opened,
#     so the skill failed on EVERY invocation for three months and nobody noticed, because
#     the skill was never run in between.
#   * ProductCard / SortDropdown rows outlived their deleted files (removed 2026-05-24).
#     A row with no file makes the detector compose an import that does not resolve, so the
#     generated Page Object does not compile.
#
# A row whose Root signature column contains "Nested" is composed by a parent component and
# is never looked for on its own. It still needs a row (that is what makes the omission
# detectable), but it is excluded from the detection set.
#
# Usage:  check-component-signatures.sh
# Exit:   0   reconciled — the names printed as "detect:" are the detection set for Step 7
#         1   mismatch (details on stderr)
#         66  references/component-detection.md not found
#         67  src/components/ not found

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

DOC=".claude/skills/scaffold-page-object/references/component-detection.md"
DIR="src/components"

[ -f "$DOC" ] || { echo "check-component-signatures: $DOC not found" >&2; exit 66; }
[ -d "$DIR" ] || { echo "check-component-signatures: $DIR not found" >&2; exit 67; }

# Files: every *.ts basename in src/components/, minus test files.
files=$(find "$DIR" -maxdepth 1 -name '*.ts' ! -name '*.test.ts' -exec basename {} .ts \; | sort)

# Rows: first backticked cell of each table line whose second cell is an @components/ import.
# Nested rows are tagged so they can be held out of the detection set.
rows=$(awk -F'|' '
  /^\|/ && $3 ~ /@components\// {
    name = $2; sig = $4
    gsub(/[` \t]/, "", name)
    if (name == "" || name == "Component") next
    print name (sig ~ /Nested/ ? "\tnested" : "\tdetect")
  }' "$DOC" | sort)

row_names=$(printf '%s\n' "$rows" | cut -f1)

status=0

missing_row=$(comm -23 <(printf '%s\n' "$files") <(printf '%s\n' "$row_names"))
if [ -n "$missing_row" ]; then
  status=1
  while IFS= read -r n; do
    [ -n "$n" ] || continue
    echo "Found $DIR/$n.ts but no detection signature in $DOC. Add a signature row before re-running." >&2
  done <<< "$missing_row"
fi

missing_file=$(comm -13 <(printf '%s\n' "$files") <(printf '%s\n' "$row_names"))
if [ -n "$missing_file" ]; then
  status=1
  while IFS= read -r n; do
    [ -n "$n" ] || continue
    echo "$DOC lists $n but $DIR/$n.ts does not exist. Delete the row (the component was removed) before re-running." >&2
  done <<< "$missing_file"
fi

[ "$status" -eq 0 ] || exit 1

printf '%s\n' "$rows" | while IFS=$'\t' read -r name kind; do
  [ -n "$name" ] || continue
  echo "$kind: $name"
done
