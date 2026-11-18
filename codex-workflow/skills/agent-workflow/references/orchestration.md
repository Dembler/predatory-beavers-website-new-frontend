# Roles and handoffs

The primary agent is normally the persistent lead. Use the roles below only when they
save time or add independent evidence; the light path need not spawn a complete team.

| Role | Responsibility | Boundary |
| --- | --- | --- |
| `workflow-team-lead` | Scope, stage transitions, task ownership, integration and delivery | Does not manufacture check/review evidence |
| `workflow-researcher` | Bounded code/document questions, sources, contradictions | No product edits or assumed requirements |
| `workflow-architect` | Consequential design decisions and shared contracts | No speculative redesign |
| `workflow-implementer` | Claimed task within assigned write scope | No self-approval or unrelated edits |
| `workflow-reviewer` | Independent behavioral/architecture review | No edits to reviewed source |
| `workflow-qa` | Execute the relevant end-to-end or UI scenario | No product fixes; distinguish synthetic from live evidence |

Agent roles inherit the parent/provider defaults. Do not pin a different model or
reasoning effort just to instantiate this workflow. Existing project-specialist roles
can substitute when they better match the actual work.

## Minimal handoff

Send the objective, task ID, workspace, run path, actual owner, owned paths, relevant
requirements and acceptance criteria, dependency/source references and open findings.
The result should contain changed paths, actual checks, unresolved issues and pointers
to durable evidence. Return concise references for large artifacts rather than copying
them through the lead's context.

Keep original documents and source files accessible. Context filtering selects material
for the task; it does not erase contradicting evidence or convert a summary into the
source of truth. A reviewer should receive the user's requirement and actual code even
if the implementer believes a design decision was already settled.

## State, retries and integration

Use runtime state as the durable task ledger. One process owns each state update; one
owner claims each task. Code checks additionally use a workspace resource lock. This
version holds the run's state lock during a check; retry other state mutations for that
run after the check finishes. Already-claimed independent implementation and read-only
analysis can continue. A lock file left after abrupt termination needs deliberate
recovery after establishing that its owner/process is no longer active.
Do not clear it merely because a timestamp looks old.

Reopen the earliest affected stage when requirements change. Keep previous review
findings until they are explicitly resolved. A repeated-failure threshold forces a
recorded reassessment rather than automatic retries with no new information.

In a shared tree, a task's declared scope must include its verification-relevant code.
Disjoint paths are not proof that semantics are independent: shared contracts belong
in the dependency plan. For worktrees, task approval is provisional until changes are
integrated and checked/reviewed in the target workspace. No automatic merge or push is
implied by an approved local task.
