#!/usr/bin/env bash
#
# Resolve and sync the branch this run will branch from (workflow Step 1.5).
#
# Two failure modes this prevents, both seen in real runs:
#   - Branching a new ticket off a PREVIOUS ticket's branch, stacking it on unmerged work
#     and targeting the wrong base (forced SW-11 to stop and ask).
#   - Branching off a STALE base, so the "does this feature already exist?" checks wrongly
#     conclude the feature is new and fork a colliding copy (the SW-7/SW-8 collision).
#
# Deciding what to do when the current branch is a leftover ticket branch needs a human, so
# this reports that case rather than guessing. Everything else is mechanical.
#
# Usage:  sync-base-branch.sh
# Output: the resolved base branch name on stdout (exit 0)
# Exit:   0   base resolved, clean, and up to date with its remote
#         10  on a previous ticket's branch — ask the user which base to use, then re-run
#         11  working tree is dirty — commit or stash first
#         12  local base has diverged from its remote — reconcile, then re-run

set -uo pipefail

current=$(git branch --show-current 2>/dev/null)
if [ -z "$current" ]; then
  echo "sync-base-branch: detached HEAD — check out the integration base first." >&2
  exit 12
fi

# A branch named like SW-123-feature is a prior run's, never a valid base.
if printf '%s' "$current" | grep -qE '^[A-Z][A-Z0-9]*-[0-9]+-'; then
  echo "sync-base-branch: '$current' is a previous ticket's branch, not a valid base." >&2
  echo "Ask which branch this ticket should branch from, check it out, then re-run." >&2
  exit 10
fi

dirty=$(git status --porcelain)
if [ -n "$dirty" ]; then
  # Name what is dirty, and separate the two cases, because the right action is opposite.
  #
  # This is almost always the wreckage of a PREVIOUS aborted run. A run that stops after Step 5
  # has already written files and, per ADR-0020, opens no PR -- so the spec it generated or the
  # committed file it edited in place stays on disk. The next run then dies here, and a bare
  # "working tree is dirty" tells you neither what nor why.
  modified=$(echo "$dirty" | grep -v '^??' | sed 's/^...//')
  untracked=$(echo "$dirty" | grep '^??' | sed 's/^...//')

  echo "sync-base-branch: working tree is dirty — commit or stash before running /from-issue." >&2
  if [ -n "$modified" ]; then
    echo "" >&2
    echo "  already committed, now modified — read the diff before discarding:" >&2
    echo "$modified" | sed 's/^/    /' >&2
  fi
  if [ -n "$untracked" ]; then
    echo "" >&2
    echo "  untracked — a generated file nothing has committed yet:" >&2
    echo "$untracked" | sed 's/^/    /' >&2
  fi
  echo "" >&2
  echo "  An earlier /from-issue run that aborted after Step 5 leaves exactly this." >&2
  exit 11
fi

# Purely local base (no remote counterpart) is fine; nothing to sync against.
if git ls-remote --exit-code --heads origin "$current" >/dev/null 2>&1; then
  git fetch --quiet origin "$current" || {
    echo "sync-base-branch: could not fetch origin/$current." >&2
    exit 12
  }
  if ! git merge --ff-only "origin/$current" >/dev/null 2>&1; then
    echo "sync-base-branch: '$current' is not a clean fast-forward of origin/$current." >&2
    echo "Reconcile them, then re-run. Never force or auto-merge here." >&2
    exit 12
  fi
fi

printf '%s\n' "$current"
