# 0045 — Refinement may read the running app, but only for a reference that already exists (scopes ADR-0013)

**Date:** 2026-09-26
**Status:** Proposed
**Confidence:** Medium. The boundary is clear and the mechanics are the ones `/scaffold-page-object`
already uses, but no ticket has been refined this way yet — the first one will say whether the rule
holds under pressure, which is when a person wants the app to settle a question it should not settle.
**Review by:** after the first two tickets refined with a device in the loop.
**Enforced by:** Nothing automated. Three visible markers instead: an observation is recorded in
`assumptions[]` tagged `observed` and shown at the approval gate; rubric item 11 keeps such a criterion
`observed` until a person promotes it; and the write-back adds an `OBSERVED` lozenge plus the reading's
date, platform and build in the audit comment, so the ticket itself says where that line came from.

## Context

ADR-0013 made `/refine-ticket` shift-left and, in this repository's copy of the skill, `sources.md`
stated it plainly: _"Not a source: the live app."_ The reason is good — a ticket must be refinable
before its feature exists, and a skill that asks the application what the requirement is writes the
specification from the implementation, defects included.

It also covered only half of what refinement actually does. Diego's experience of the practice: a
business analyst refining with the team opens the product to check something the ticket **points at** —
"the same error as the login screen", "reuse the cart's empty state", "this button, on the new page".
That question is not about new behaviour. The app is the reference the ticket is naming, and the
skill's only alternatives were to ask a person to describe from memory what the app displays, or to
assume.

The port also produced a reason the web repository never had: **the two builds disagree**. The listed
account is `bod@example.com` on Android and `bob@example.com` on iOS, product names differ, and
`alice@example.com` is locked out on one platform and signs in on the other (OR-7). A refinement
observation that does not name a platform is wrong half the time.

## Decision

`/refine-ticket` may drive the running application, under a boundary drawn by one question: **does the
thing the ticket references already exist?**

- **It exists** — the skill may ask the user for permission, open that screen on the exploration Appium
  server through `wdio-mcp`, read it, and record what it saw.
- **It does not exist** — the gap is about new behaviour and the app is not consulted at all. The skill
  asks the user or reads a document, as before.

Four rules bound the reading:

1. **It is an observation, not a requirement.** It carries date, platform and build, and it reaches the
   approval gate marked `observed`. It becomes an acceptance criterion only when a person says the
   behaviour is intended.
2. **Every observation names its platform**, and an AC that covers both platforms is observed on both.
   A disagreement between them is a gap for the author, never a choice the skill makes.
3. **Read, never act.** No form submissions, no state a team cares about. Refinement changes a ticket.
4. **The app never overrides a document or the ticket.** A contradiction is a finding to report
   (ADR-0030), not an input to absorb.

Selectors still never enter a ticket, and a missing device is still not a failure: the skill says the
reference could not be verified and asks.

## Consequences

- The refinement loop can close a class of gap it previously had to hand back to a person, and the
  answer is the product itself rather than someone's recollection of it.
- **The risk this record accepts:** a skill that can look at the app will tend to describe the app.
  Left unbounded, refinement becomes characterization — acceptance criteria that cannot fail, because
  they were copied from the behaviour under test. The three markers above exist to make that visible
  rather than to prevent it; prevention is the author's judgment at the approval gate.
- Refinement now has a device dependency it did not have, though an optional one. On a machine with no
  emulator or simulator, `/refine-ticket` behaves exactly as it did before this record.
- A refinement session and a test run cannot share an Appium server: the exploration server is a
  separate port, and starting a suite kills an open exploration session.
- Shift-left survives as the default, not as an absolute. The skill still refines a ticket for a
  feature nobody has built.

## Alternatives considered

- **Keep the prohibition.** Rejected: it forces a person to retype what the app already shows, and the
  described practice (a BA checking an existing screen mid-refinement) is the normal way this work is
  done.
- **Let the skill read the app for any gap.** Rejected: that is how today's defects become tomorrow's
  acceptance criteria, and it makes tests that cannot fail.
- **Observe, but only ever as a comment on the ticket, never as a criterion.** Rejected as too weak: a
  fact good enough to guide the implementation is good enough to be a criterion — provided a person
  promoted it and the ticket says it was observed.
- **Let the skill pick the platform when the two disagree.** Rejected: a disagreement between builds is
  information for the author, and picking one silently discards it.
