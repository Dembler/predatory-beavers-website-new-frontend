---
name: agent-workflow
description: Run or resume feature delivery through requirements discovery, specification, local tickets, implementation, verification, and independent review with durable state. Use for a requested staged development workflow; keep routine edits lightweight.
---

# Agent workflow

Coordinate `grill-with-docs → to-spec → to-tickets → implement → code-review`.
Carry the user's original objective through the stages. A later correction steers the
active objective. Do not turn stage boundaries into permission requests. Respect a
request to stop after a particular stage.

## Start or resume

1. Read project instructions and inspect the existing working tree. Preserve unrelated
   work. Identify the real workspace and the smallest sufficient source scopes.
2. Use [the runtime](scripts/workflow.py) and its
   [CLI and JSON contracts](references/runtime.md). Choose an explicit run directory
   under the project's ignored artifacts directory, or outside the source tree.
   The runtime excludes its own run directory from snapshots; prefer to keep evidence
   outside the selected code paths so the ownership boundary stays clear.
3. On resume, inspect `status`, the recorded artifacts, live source snapshots and open
   review findings. Continue from the valid checkpoint rather than repeating discovery.
4. Choose `light`, `standard`, or `full` by uncertainty and change risk. Light mode
   uses short artifacts and usually one ticket; it preserves the verification gates.
   Standard adds independent exploration where useful. Full adds architecture and QA
   work when the feature actually needs them. Modes do not require a fixed agent count.
5. Read only the current stage skill and the relevant runtime reference. Do not preload
   all stage instructions, whole conversation histories, or every project skill.

## Execute

- Use [grill-with-docs](../grill-with-docs/SKILL.md) to establish requirements and sources.
- Use [to-spec](../to-spec/SKILL.md) to define observable behavior and acceptance.
- Use [to-tickets](../to-tickets/SKILL.md) for bounded tasks, dependencies and ownership.
- Use [implement](../implement/SKILL.md) to deliver ready tasks and run verification.
- Use [code-review](../code-review/SKILL.md) for independent task and final review.

The primary agent normally remains Team Lead. Keep an architect available across
related design decisions when useful. Spawn implementers for bounded tasks and reviewers
with independent contexts. Preserve unresolved findings across review iterations.
Use advertised `workflow-*` roles when present; otherwise use available explorer/worker/
default roles with the corresponding instructions from
[orchestration](references/orchestration.md). Do not invent a registered role or claim
an agent ran without a real spawn result.

## Evidence and completion

- Record actual agent identifiers as owners and reviewers. A different label on the
  same agent does not make its review independent.
- Claim before editing. Serialize overlapping write scopes. Use isolated working
  copies if concurrent tasks need to modify the same files.
- Execute checks explicitly with the runtime. A configured command or an agent's
  statement that tests passed is not execution evidence.
- Review the version that was checked. If code changes, refresh affected checks and
  reviews. Run the configured final checks on the combined source state, then final
  independent review, then `complete`.
- A review rejection returns to implementation; a requirements mistake returns to the
  affected earlier stage with a reason. After repeated failures, reassess the cause and
  plan rather than making an unlimited retry loop.
- Preserve review finding history in the run. Before recording a follow-up verdict,
  inspect prior findings and explain how each was resolved or why it remains open.
- The runtime validates declared identities and evidence freshness. Codex is responsible
  for real delegation, relevant checks, source interpretation and acceptance criteria;
  the script does not launch models or prove semantic correctness.

Report what was delivered, what actually ran, unresolved limitations, and where the
run artifacts are stored. Separate local verification from live operational acceptance.
