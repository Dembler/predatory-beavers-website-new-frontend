---
name: to-tickets
description: Decompose a current specification into local implementation tickets with acceptance criteria, source ownership, verification and an acyclic dependency graph. Does not publish issues to an external tracker.
---

# To tickets

Read the current specification and
[the plan contract](../agent-workflow/references/runtime.md).

1. Prefer a few coherent, reviewable changes. A small task may have one ticket.
   Split by independently verifiable outcomes or genuinely separate write scopes.
2. Give every ticket a stable ID, clear title, bounded relative source paths,
   dependencies, acceptance criteria and named checks.
3. Include source paths needed to judge correctness, such as directly relevant tests
   and shared contracts. Keep paths inside the run's declared scope. If a newly
   discovered dependency lies outside it, explicitly revise scope and plan; do not
   silently leave relevant code outside snapshots.
4. Build a DAG. A task becomes ready only when its dependencies are approved for their
   current content. Avoid creating dependencies only to mimic human job titles.
5. Plan concurrency around file ownership. Overlapping changes run sequentially in a
   shared workspace; separate worktrees need an explicit integration and verification
   step in the target workspace.
6. Store the plan locally through the runtime. Do not create tracker issues, branches,
   commits, pipelines or other external artifacts merely because a ticket exists.

Include regression checks that test behavior, not the implementation's phrasing. Keep
final integration and any required UI/runtime acceptance in the overall verification
plan rather than assuming independent task checks prove the combined result.
