# Workflow runtime contract

`scripts/workflow.py` is a Python 3.11+ standard-library CLI. It persists the
five stages `grill-with-docs -> to-spec -> to-tickets -> implement ->
code-review` and a terminal `complete` stage. All successful commands print
one JSON object to stdout. Validation and gate errors print JSON to stderr and
exit 2. A completed check exits 0 when it passes and 1 when it fails, times
out, cannot launch, or observes a changing snapshot. Unexpected internal
errors exit 3 and interruption exits 130. Parser usage errors are also JSON on
stderr with `error: "usage_error"` and exit 2; help remains ordinary text.

The global `--run RUN_DIRECTORY` option comes before the subcommand:

```text
python scripts/workflow.py --run RUN init --workspace WORKSPACE --goal TEXT --mode light|standard|full --scope REL [--scope REL ...]
python scripts/workflow.py --run RUN status
python scripts/workflow.py --run RUN context --file context.json
python scripts/workflow.py --run RUN spec --file spec.json
python scripts/workflow.py --run RUN plan --file plan.json
python scripts/workflow.py --run RUN ready
python scripts/workflow.py --run RUN claim --task ID --owner IDENTITY
python scripts/workflow.py --run RUN submit --task ID --owner IDENTITY
python scripts/workflow.py --run RUN reassign --task ID --owner NEW_IDENTITY --reason TEXT
python scripts/workflow.py --run RUN snapshot [--task ID]
python scripts/workflow.py --run RUN check --name NAME [--task ID] --timeout SECONDS -- EXECUTABLE [ARG ...]
python scripts/workflow.py --run RUN review --file review.json [--task ID]
python scripts/workflow.py --run RUN complete
python scripts/workflow.py --run RUN reopen --reason TEXT --stage grill-with-docs|to-spec|to-tickets|implement [--scope REL ...]
```

`--scope` paths are workspace-relative files or directories. Absolute paths,
`..`, symlink components, VCS/build/cache directories, and escapes are
rejected. Duplicate and overlapping ownership checks follow filesystem case
rules, including case-insensitive comparison on Windows. A run directory below
a selected scope is recorded as an exact
automatic exclusion, so changes to workflow evidence do not change source
snapshots. A scope cannot be inside the run directory. Snapshots hash sorted
relative paths, object kinds, and file bytes, including untracked files and
missing selected paths. Task snapshots additionally hash transitive dependency
snapshots. This makes downstream evidence stale when upstream content changes
without granting downstream tasks ownership of upstream paths.

## Artifact JSON

The context file has this exact top-level shape. `sources` accepts either a
non-empty pointer string or a structured source object.

```json
{
  "summary": "Current behavior and desired outcome",
  "requirements": ["R1: Preserve drafts"],
  "sources": [
    {"reference": "docs/requirements.md", "claim": "Drafts survive navigation"},
    "src/existing_behavior.py"
  ],
  "assumptions": [],
  "open_questions": [],
  "blockers": []
}
```

Recording context advances to `to-spec`. A non-empty `blockers` array prevents
the spec gate; resolve it through an explicit `reopen`. Open questions remain
visible evidence but are not themselves a runtime blocker.

```json
{
  "title": "Preserve request draft",
  "requirements": ["Keep entered text across navigation"],
  "acceptance_criteria": ["Returning to the form restores the text"],
  "out_of_scope": ["Cross-device synchronization"],
  "final_checks": ["focused tests"]
}
```

Recording a valid spec advances to `to-tickets`. At least one named final check
is mandatory. Check names are declarations only and never contain a command.

```json
{
  "tasks": [
    {
      "id": "TASK-01",
      "title": "Persist the draft",
      "scope": ["src/drafts", "tests/test_drafts.py"],
      "depends_on": [],
      "acceptance_criteria": ["Draft round trip passes"],
      "checks": ["task tests"]
    }
  ]
}
```

Recording a plan validates unique IDs, existing dependencies, an acyclic DAG,
non-empty checks and acceptance criteria, and task paths contained by the
initial scope. It advances to `implement`. `ready` returns dependency-ready
task IDs and does not mutate or advance the run.

A task has one active declarative owner identity. The runtime does not
authenticate that string. `claim` rejects a different owner and rejects scope
overlap with every running task. Dependencies must have current approvals.
The current owner can claim a submitted task to withdraw it for more work.
After a final `changes_requested`, the same owner can also claim an approved
task to reopen it; this clears that task approval and returns the run to
`implement` without replacing the plan.
`reassign` explicitly transfers abandoned work with a recorded reason, clears
its checks/submission/approval, and returns it to `pending`; every old owner
remains an implementer for reviewer-independence checks. `submit` records the
task snapshot and moves `running` to `submitted`.

Reassigning a task that is still marked `running` is an explicit operator
takeover. First establish that the prior agent no longer writes the scope; the
runtime records the transfer but cannot stop an external agent process.

Use the exact digest printed by `snapshot` in a review file:

```json
{
  "reviewer": "reviewer-01",
  "verdict": "approve",
  "snapshot": "64-character digest from snapshot",
  "findings": [],
  "summary": "Criteria and tests are satisfied"
}
```

`snapshot` is the digest string in CLI output; `snapshot_details` contains its
algorithm, scopes, counts, own-content digest, and dependency digests where
applicable.

`findings` accepts non-empty strings or non-empty JSON objects. Verdict is
`approve` or `changes_requested`; the latter requires at least one finding.
Task approval requires `submitted` state, a reviewer different from the task
owner, the exact current submitted snapshot, and every configured task check
passed on that snapshot. A rejection moves the task to `changes_requested`.
After three consecutive rejection cycles it moves to `blocked_replan`, and an
explicit `reopen` with a reason is required. Reopening `implement` resets the
blocked cycle and preserves the plan.

Every accepted task and final review is appended to top-level
`review_history` with its target, timestamp, reviewer, verdict, snapshot, full
findings, and optional summary. This ledger is intentionally not truncated or
cleared by reassignment, replanning, or reopen. `last_review` and
`final_review` are only current-gate pointers; the ledger is the durable audit
record.

When every task and dependency approval is current, the stage becomes
`code-review`. A final check omits `--task`; a final review omits `--task`.
The final reviewer must differ from every implementer. Final approval requires
all declared final checks passed on the exact full snapshot. `complete` repeats
all freshness checks and succeeds only with current task approvals, current
final checks, and current independent final approval. Any selected source
change invalidates affected evidence. `reopen` is permitted from `complete`.

## Explicit checks

Commands are supplied only on the `check` command line after `--`. The runtime
does not read or execute commands from context, spec, plan, review, state, or
extensions. It calls the argv with `shell=False` in the workspace. For example:

```text
python scripts/workflow.py --run .artifacts/run-17 check --name "task tests" --task TASK-01 --timeout 120 -- python -m pytest tests/test_drafts.py
python scripts/workflow.py --run .artifacts/run-17 check --name "focused tests" --timeout 300 -- python -m pytest
```

On Windows, prefer a durable verifier script or module over a long `python -c`
payload so PowerShell quoting cannot alter embedded quotes before argv reaches
Python.

Task checks may run while a task is `running` or `submitted`; their snapshot
must still equal the submitted and reviewed snapshot at approval. Up to the
last 8 MiB of child stdout and stderr are forwarded after the check. They and
the raw argv are not stored. State stores outcome, return code,
timeout flag, duration, retained byte counts, output hashes, command hash, and the
before/after snapshot. A nonzero exit, timeout, launch error, or workspace
change is durable failure evidence. Locks are released in `finally` paths.
An interrupt terminates the owned child tree, records durable `interrupted`
evidence, and exits 130. If child-tree cleanup cannot be confirmed after a
timeout or interrupt, the workspace lock remains in place for explicit
recovery.

## Reopen and scope revision

Reopening an earlier stage invalidates its downstream artifacts and always
requires a reason. Reopening `to-tickets` keeps context and spec; reopening
`to-spec` keeps context; reopening `grill-with-docs` clears context too.
Reopening `implement` keeps tasks and their evidence but clears final evidence.

Discovery can replace the complete initial scope while reopening one of the
first three stages:

```text
python scripts/workflow.py --run .artifacts/run-17 reopen --stage to-spec --reason "Discovery found shared draft storage" --scope src --scope tests
```

`--scope` is forbidden with `--stage implement`. The prior scope is retained in
bounded `scope_history`. Omitting `--scope` retains the current scope.

## Durable state and lock recovery

The run owns `state.json` and `state.lock`. State is written to a new file,
flushed, atomically replaced, and carries a monotonically increasing
`revision`. The last 200 mutation events are retained with monotonic sequence
numbers. The stable top-level state fields are:

```text
version revision run_dir workspace goal mode stage initial_scope run_exclusion
initial_snapshot context spec plan tasks task_checks final_checks final_review
review_history final_rejection_count needs_replan reopen_history scope_history events
next_event_sequence created_at updated_at
```

Each task contains its plan fields plus `status`, active `owner`, bounded
`owner_history`, `submitted_snapshot`, `approval`, `last_review`, and
`rejection_count`.

State mutation uses an `O_EXCL` lock containing owner, random token, PID, and
creation time. Checks also use a cross-run workspace lock at
`<system-temp>/codex-workflow-locks/<sha256-absolute-workspace>.check.lock` with
workspace metadata. The process removes only a lock whose on-disk token still
matches its own token. It never guesses that an existing lock is stale.
One run's state lock remains held during its check, so other mutations in that
run serialize behind the explicit process. A timed-out check terminates its
owned process tree; if termination cannot be confirmed, the workspace lock is
deliberately retained for explicit recovery.

After a crash, inspect the JSON lock and verify the recorded PID is no longer
running. Preserve evidence by renaming the lock to a timestamped diagnostic
name, then retry the command. Never remove or rename a lock while its PID is
active. If PID status cannot be established, stop and investigate rather than
forcing recovery.
