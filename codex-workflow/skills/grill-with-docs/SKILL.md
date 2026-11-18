---
name: grill-with-docs
description: Clarify a development request against project code and relevant primary documentation, exposing contradictions and consequential unknowns before writing a specification. Produces a source-backed context artifact for agent-workflow.
---

# Grill with docs

Establish the problem, expected user outcome, constraints and evidence. This stage can
be invoked alone or through [agent-workflow](../agent-workflow/SKILL.md).

1. Read applicable project instructions, relevant existing behavior and the user's
   supplied materials. Delegate independent, narrowly scoped code questions when useful.
2. Resolve facts available in the workspace yourself. Consult primary documentation
   when the answer depends on an external contract, version or uncertain behavior.
   Record the source path or URL and the specific claim it supports.
3. Separate confirmed requirements, assumptions and open questions. Preserve the user's
   wording for consequential constraints. Do not silently make a preference mandatory.
4. Ask only questions whose answers materially change behavior, scope, architecture or
   acceptance. Continue independent investigation while waiting. A consequential
   unanswered question remains a blocker; elapsed time is not an answer.
5. Save the structured context artifact using the
   [runtime contract](../agent-workflow/references/runtime.md). Include provenance and
   unresolved blockers. Do not copy secrets, raw logs or entire files into the artifact.

For a small, unambiguous request, a brief context is sufficient and no user interview
is necessary. Do not invent questions just to exercise this stage. When invoked alone,
finish with the findings and remaining questions; the coordinator otherwise continues
to `to-spec` once consequential blockers are resolved.
