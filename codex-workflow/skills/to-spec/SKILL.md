---
name: to-spec
description: Turn investigated development requirements into a bounded behavioral specification with acceptance criteria, explicit exclusions and verification requirements. Supports the to-spec stage of agent-workflow.
---

# To spec

Use the current request, verified context and applicable project constraints.
Read [the artifact contract](../agent-workflow/references/runtime.md).

1. Verify that consequential context blockers have been resolved. Keep traceable links
   to their answers. Do not promote assumptions into confirmed requirements.
2. Describe the triggering action, expected observable behavior, relevant edge cases
   and data or API contracts. Include the smallest scope that satisfies the request.
3. Write acceptance criteria that another agent can verify. Include failure and empty
   states when they affect the requested behavior; avoid speculative features.
4. State exclusions and preservation requirements. Identify relevant design decisions,
   cross-layer implications and compatibility constraints. Use an architect for actual
   design uncertainty rather than requiring one for every change.
5. Define named final checks appropriate to the change. They may be tests, a build,
   a rendered UI check or another observable check. A low-impact change does not
   require new tests that merely mirror its implementation.
6. Record the spec using the runtime. Supplement JSON with a readable design note only
   when the additional explanation helps implementation or review.

A specification is a working agreement, not an extra approval ceremony. Continue under
existing authorization unless a missing decision or an explicit user boundary requires
input. A later requirements change reopens the relevant stage and invalidates downstream
evidence through the runtime.
