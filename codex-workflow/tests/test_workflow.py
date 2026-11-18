"""Black-box contract tests for the agent workflow runtime.

The tests deliberately invoke the public CLI in isolated temporary directories.
They describe observable workflow rules and avoid depending on runtime helpers or
private state layout.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import unittest
import uuid
from pathlib import Path
from typing import Any

SCRIPT = (
    Path(__file__).resolve().parents[1] / "skills" / "agent-workflow" / "scripts" / "workflow.py"
)


class WorkflowCliTestCase(unittest.TestCase):
    maxDiff = None

    def setUp(self) -> None:
        temporary_root = Path(__file__).resolve().parents[1] / ".test-runs"
        temporary_root.mkdir(exist_ok=True)
        self.root = temporary_root / f"run-{uuid.uuid4().hex}"
        self.root.mkdir()
        self.addCleanup(shutil.rmtree, self.root, True)
        self.workspace = self.root / "workspace"
        self.workspace.mkdir()
        (self.workspace / "src").mkdir()
        self.run_dir = self.root / "run"

    def invoke(
        self,
        *args: str,
        run_dir: Path | None = None,
        expected: int | tuple[int, ...] = 0,
        invocation_cwd: Path | None = None,
    ) -> tuple[subprocess.CompletedProcess[str], dict[str, Any]]:
        command = [
            sys.executable,
            os.fspath(SCRIPT),
            "--run",
            os.fspath(run_dir or self.run_dir),
            *map(str, args),
        ]
        result = subprocess.run(
            command,
            cwd=invocation_cwd or self.workspace,
            text=True,
            capture_output=True,
            timeout=10,
        )
        expected_codes = (expected,) if isinstance(expected, int) else expected
        self.assertIn(
            result.returncode,
            expected_codes,
            msg=(f"command: {command!r}\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"),
        )
        stream = result.stdout if result.returncode in (0, 1) else result.stderr
        try:
            payload = json.loads(stream)
        except json.JSONDecodeError as error:
            self.fail(
                f"CLI did not emit one JSON document: {error}\n"
                f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
            )
        self.assertIsInstance(payload, dict)
        return result, payload

    def write_json(self, name: str, value: Any) -> Path:
        path = self.root / name
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def init(
        self,
        *,
        run_dir: Path | None = None,
        scopes: tuple[str, ...] = ("src",),
        mode: str = "full",
    ) -> dict[str, Any]:
        arguments = [
            "init",
            "--workspace",
            os.fspath(self.workspace),
            "--goal",
            "Exercise the workflow contract",
            "--mode",
            mode,
        ]
        for scope in scopes:
            arguments.extend(("--scope", scope))
        return self.invoke(*arguments, run_dir=run_dir)[1]

    def context_payload(
        self,
        *,
        blockers: list[str] | None = None,
        open_questions: list[str] | None = None,
    ) -> dict[str, Any]:
        return {
            "summary": "Implement the requested behavior",
            "requirements": ["Keep evidence for every gate"],
            "sources": ["User request"],
            "assumptions": [],
            "open_questions": open_questions or [],
            "blockers": blockers or [],
        }

    def spec_payload(self, *, final_checks: list[str] | None = None) -> dict[str, Any]:
        return {
            "title": "Workflow change",
            "requirements": ["Implement the planned change"],
            "acceptance_criteria": ["All checks pass"],
            "out_of_scope": [],
            "final_checks": final_checks if final_checks is not None else ["integration"],
        }

    def task(
        self,
        task_id: str,
        scope: list[str],
        *,
        depends_on: list[str] | None = None,
        checks: list[str] | None = None,
    ) -> dict[str, Any]:
        return {
            "id": task_id,
            "title": f"Implement {task_id}",
            "scope": scope,
            "depends_on": depends_on or [],
            "acceptance_criteria": [f"{task_id} is complete"],
            "checks": checks if checks is not None else [f"{task_id}-unit"],
        }

    def advance_to_plan(self, tasks: list[dict[str, Any]]) -> None:
        self.init()
        context = self.write_json("context.json", self.context_payload())
        self.invoke("context", "--file", os.fspath(context))
        spec = self.write_json("spec.json", self.spec_payload())
        self.invoke("spec", "--file", os.fspath(spec))
        plan = self.write_json("plan.json", {"tasks": tasks})
        self.invoke("plan", "--file", os.fspath(plan))

    def advance_to_implementation(self, tasks: list[dict[str, Any]]) -> None:
        self.advance_to_plan(tasks)
        self.invoke("ready")

    def source(self, relative_path: str, content: str) -> Path:
        path = self.workspace / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def run_check(
        self,
        name: str,
        *,
        task_id: str | None = None,
        command: list[str] | None = None,
        expected: int | tuple[int, ...] = 0,
        timeout: float = 3,
        run_dir: Path | None = None,
        invocation_cwd: Path | None = None,
    ) -> dict[str, Any]:
        arguments = ["check", "--name", name]
        if task_id is not None:
            arguments.extend(("--task", task_id))
        arguments.extend(("--timeout", str(timeout), "--"))
        arguments.extend(command or [sys.executable, "-c", "raise SystemExit(0)"])
        return self.invoke(
            *arguments,
            run_dir=run_dir,
            expected=expected,
            invocation_cwd=invocation_cwd,
        )[1]

    def snapshot(self, task_id: str | None = None, *, run_dir: Path | None = None) -> str:
        arguments = ["snapshot"]
        if task_id is not None:
            arguments.extend(("--task", task_id))
        payload = self.invoke(*arguments, run_dir=run_dir)[1]
        snapshot = payload.get("snapshot")
        self.assertIsInstance(snapshot, str)
        self.assertTrue(snapshot)
        return snapshot

    def review(
        self,
        snapshot: str,
        *,
        reviewer: str = "reviewer",
        verdict: str = "approve",
        task_id: str | None = None,
        findings: list[str] | None = None,
        expected: int = 0,
        filename: str = "review.json",
        run_dir: Path | None = None,
    ) -> dict[str, Any]:
        review_file = self.write_json(
            filename,
            {
                "reviewer": reviewer,
                "verdict": verdict,
                "snapshot": snapshot,
                "findings": findings or [],
                "summary": "Independent review",
            },
        )
        arguments = ["review", "--file", os.fspath(review_file)]
        if task_id is not None:
            arguments.extend(("--task", task_id))
        return self.invoke(
            *arguments,
            run_dir=run_dir,
            expected=expected,
        )[1]

    def approve_task(
        self,
        task_id: str,
        *,
        owner: str = "implementer",
        reviewer: str = "reviewer",
        check_name: str | None = None,
        change: tuple[str, str] | None = None,
    ) -> str:
        self.invoke("claim", "--task", task_id, "--owner", owner)
        if change is not None:
            self.source(*change)
        self.invoke("submit", "--task", task_id, "--owner", owner)
        self.run_check(check_name or f"{task_id}-unit", task_id=task_id)
        snapshot = self.snapshot(task_id)
        self.review(snapshot, reviewer=reviewer, task_id=task_id)
        return snapshot

    def status(self, *, run_dir: Path | None = None) -> dict[str, Any]:
        return self.invoke("status", run_dir=run_dir)[1]

    def assert_stage(self, expected: str, *, run_dir: Path | None = None) -> None:
        payload = self.status(run_dir=run_dir)
        actual = payload.get("stage")
        if actual is None and isinstance(payload.get("state"), dict):
            actual = payload["state"].get("stage")
        self.assertEqual(expected, actual, payload)


class WorkflowContractTests(WorkflowCliTestCase):
    def test_happy_path_runs_all_five_gates_and_completes(self) -> None:
        task = self.task("TASK-1", ["src/feature.txt"])
        self.init()
        self.assert_stage("grill-with-docs")

        context = self.write_json("context.json", self.context_payload())
        self.invoke("context", "--file", os.fspath(context))
        self.assert_stage("to-spec")

        spec = self.write_json("spec.json", self.spec_payload())
        self.invoke("spec", "--file", os.fspath(spec))
        self.assert_stage("to-tickets")

        plan = self.write_json("plan.json", {"tasks": [task]})
        self.invoke("plan", "--file", os.fspath(plan))
        self.invoke("ready")
        self.assert_stage("implement")

        self.approve_task(
            "TASK-1",
            change=("src/feature.txt", "implemented\n"),
        )
        self.assert_stage("code-review")

        self.run_check("integration")
        final_snapshot = self.snapshot()
        self.review(final_snapshot)
        self.invoke("complete")
        self.assert_stage("complete")

    def test_blockers_and_skipping_a_phase_are_rejected(self) -> None:
        self.init()
        spec = self.write_json("premature-spec.json", self.spec_payload())
        self.invoke("spec", "--file", os.fspath(spec), expected=2)
        self.assert_stage("grill-with-docs")

        blocked = self.write_json(
            "blocked-context.json",
            self.context_payload(blockers=["Decision is missing"]),
        )
        self.invoke("context", "--file", os.fspath(blocked))
        self.assert_stage("to-spec")
        self.invoke("spec", "--file", os.fspath(spec), expected=2)

        self.invoke(
            "reopen",
            "--reason",
            "The missing decision is now resolved",
            "--stage",
            "grill-with-docs",
        )
        resolved = self.write_json("resolved-context.json", self.context_payload())
        self.invoke("context", "--file", os.fspath(resolved))
        self.invoke("spec", "--file", os.fspath(spec))

    def test_plan_rejects_unknown_dependencies_cycles_and_path_escape(self) -> None:
        invalid_plans = {
            "unknown": [self.task("TASK-1", ["src/a.txt"], depends_on=["MISSING"])],
            "cycle": [
                self.task("TASK-1", ["src/a.txt"], depends_on=["TASK-2"]),
                self.task("TASK-2", ["src/b.txt"], depends_on=["TASK-1"]),
            ],
            "escape": [self.task("TASK-1", ["../outside.txt"])],
        }

        for name, tasks in invalid_plans.items():
            with self.subTest(name=name):
                run_dir = self.root / f"run-{name}"
                self.init(run_dir=run_dir)
                context = self.write_json(f"context-{name}.json", self.context_payload())
                self.invoke("context", "--file", os.fspath(context), run_dir=run_dir)
                spec = self.write_json(f"spec-{name}.json", self.spec_payload())
                self.invoke("spec", "--file", os.fspath(spec), run_dir=run_dir)
                plan = self.write_json(f"plan-{name}.json", {"tasks": tasks})
                self.invoke(
                    "plan",
                    "--file",
                    os.fspath(plan),
                    run_dir=run_dir,
                    expected=2,
                )
                self.assert_stage("to-tickets", run_dir=run_dir)

    def test_overlapping_active_claims_are_rejected(self) -> None:
        tasks = [
            self.task("TASK-1", ["src/component"]),
            self.task("TASK-2", ["src/component/file.py"]),
        ]
        self.advance_to_implementation(tasks)
        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.invoke(
            "claim",
            "--task",
            "TASK-2",
            "--owner",
            "bob",
            expected=2,
        )

    @unittest.skipUnless(os.name == "nt", "case-insensitive path identity is Windows-specific")
    def test_windows_case_variants_cannot_be_claimed_concurrently(self) -> None:
        tasks = [
            self.task("TASK-UPPER", ["src/X.py"]),
            self.task("TASK-LOWER", ["SRC/x.py"]),
        ]
        self.advance_to_implementation(tasks)
        self.invoke("claim", "--task", "TASK-UPPER", "--owner", "alice")
        self.invoke(
            "claim",
            "--task",
            "TASK-LOWER",
            "--owner",
            "bob",
            expected=2,
        )

    def test_dependency_requires_current_approved_evidence(self) -> None:
        tasks = [
            self.task("TASK-1", ["src/base.txt"]),
            self.task(
                "TASK-2",
                ["src/dependent.txt"],
                depends_on=["TASK-1"],
            ),
        ]
        self.advance_to_implementation(tasks)
        self.invoke(
            "claim",
            "--task",
            "TASK-2",
            "--owner",
            "bob",
            expected=2,
        )

        self.approve_task(
            "TASK-1",
            owner="alice",
            change=("src/base.txt", "approved version\n"),
        )
        ready = self.invoke("ready")[1]
        self.assertIn("TASK-2", ready.get("ready", []), ready)

        # A dependency approval is evidence for an exact source snapshot.
        self.source("src/base.txt", "changed after approval\n")
        self.invoke(
            "claim",
            "--task",
            "TASK-2",
            "--owner",
            "bob",
            expected=2,
        )

        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")
        self.run_check("TASK-1-unit", task_id="TASK-1")
        self.review(
            self.snapshot("TASK-1"),
            reviewer="reviewer-2",
            task_id="TASK-1",
            filename="dependency-reapproval.json",
        )
        self.invoke("claim", "--task", "TASK-2", "--owner", "bob")

    def test_upstream_reapproval_invalidates_downstream_evidence(self) -> None:
        tasks = [
            self.task("TASK-A", ["src/a.txt"]),
            self.task("TASK-B", ["src/b.txt"], depends_on=["TASK-A"]),
        ]
        self.advance_to_implementation(tasks)
        self.approve_task(
            "TASK-A",
            owner="alice",
            change=("src/a.txt", "A version one\n"),
        )
        self.approve_task(
            "TASK-B",
            owner="bob",
            change=("src/b.txt", "B based on A version one\n"),
        )
        self.assert_stage("code-review")

        self.source("src/a.txt", "A version two\n")
        self.invoke("claim", "--task", "TASK-A", "--owner", "alice")
        self.invoke("submit", "--task", "TASK-A", "--owner", "alice")
        self.run_check("TASK-A-unit", task_id="TASK-A")
        self.review(
            self.snapshot("TASK-A"),
            reviewer="reviewer-2",
            task_id="TASK-A",
            filename="upstream-reapproval.json",
        )

        self.assert_stage("implement")
        # If B's old approval still counted, an approved task could not be claimed.
        self.invoke("claim", "--task", "TASK-B", "--owner", "bob")

    def test_failed_task_check_blocks_review(self) -> None:
        self.advance_to_implementation([self.task("TASK-1", ["src/a.txt"])])
        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.source("src/a.txt", "work\n")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")
        self.run_check(
            "TASK-1-unit",
            task_id="TASK-1",
            command=[sys.executable, "-c", "raise SystemExit(7)"],
            expected=1,
        )
        snapshot = self.snapshot("TASK-1")
        self.review(snapshot, task_id="TASK-1", expected=2)

    def test_nonzero_and_timeout_are_recorded_and_release_check_lock(self) -> None:
        self.advance_to_implementation([self.task("TASK-1", ["src/a.txt"])])
        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")

        nonzero = self.run_check(
            "TASK-1-unit",
            task_id="TASK-1",
            command=[sys.executable, "-c", "raise SystemExit(9)"],
            expected=1,
        )
        self.assertTrue(nonzero)
        timed_out = self.run_check(
            "TASK-1-unit",
            task_id="TASK-1",
            command=[sys.executable, "-c", "import time; time.sleep(2)"],
            timeout=0.05,
            expected=1,
        )
        self.assertTrue(timed_out)

        # A successful check after both failures proves the workspace lock was released.
        self.run_check("TASK-1-unit", task_id="TASK-1")
        state = json.loads((self.run_dir / "state.json").read_text(encoding="utf-8"))
        serialized = json.dumps(state)
        self.assertIn("9", serialized)
        self.assertRegex(serialized.lower(), r"timeout|timed.out")

    def test_task_owner_cannot_review_own_submission(self) -> None:
        self.advance_to_implementation([self.task("TASK-1", ["src/a.txt"])])
        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.source("src/a.txt", "work\n")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")
        self.run_check("TASK-1-unit", task_id="TASK-1")
        snapshot = self.snapshot("TASK-1")
        self.review(snapshot, reviewer="alice", task_id="TASK-1", expected=2)
        self.review(
            snapshot,
            reviewer="bob",
            task_id="TASK-1",
            filename="independent-review.json",
        )

    def test_source_change_invalidates_task_review(self) -> None:
        self.advance_to_implementation([self.task("TASK-1", ["src/a.txt"])])
        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.source("src/a.txt", "submitted\n")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")
        self.run_check("TASK-1-unit", task_id="TASK-1")
        submitted_snapshot = self.snapshot("TASK-1")
        self.source("src/a.txt", "changed after review\n")
        self.review(
            submitted_snapshot,
            reviewer="carol",
            task_id="TASK-1",
            filename="stale-task-review.json",
            expected=2,
        )

    def test_same_owner_can_recover_a_stale_submission(self) -> None:
        self.advance_to_implementation([self.task("TASK-1", ["src/a.txt"])])
        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.source("src/a.txt", "submitted version\n")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")
        stale_snapshot = self.snapshot("TASK-1")

        self.source("src/a.txt", "corrected after submit\n")
        self.review(
            stale_snapshot,
            reviewer="bob",
            task_id="TASK-1",
            filename="stale-submission-review.json",
            expected=2,
        )

        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")
        self.run_check("TASK-1-unit", task_id="TASK-1")
        self.review(
            self.snapshot("TASK-1"),
            reviewer="bob",
            task_id="TASK-1",
            filename="recovered-submission-review.json",
        )

    def test_reassignment_is_explicit_and_prior_owner_cannot_review(self) -> None:
        self.advance_to_implementation([self.task("TASK-1", ["src/a.txt"])])
        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.invoke(
            "reassign",
            "--task",
            "TASK-1",
            "--owner",
            "bob",
            "--reason",
            "The original agent is no longer available",
        )
        self.invoke("claim", "--task", "TASK-1", "--owner", "bob")
        self.source("src/a.txt", "implemented by the new owner\n")
        self.invoke("submit", "--task", "TASK-1", "--owner", "bob")
        self.run_check("TASK-1-unit", task_id="TASK-1")
        snapshot = self.snapshot("TASK-1")
        self.review(
            snapshot,
            reviewer="alice",
            task_id="TASK-1",
            filename="prior-owner-review.json",
            expected=2,
        )
        self.review(
            snapshot,
            reviewer="carol",
            task_id="TASK-1",
            filename="independent-transfer-review.json",
        )

    def test_review_history_survives_approval_reassignment_and_reopen(self) -> None:
        self.advance_to_implementation([self.task("TASK-1", ["src/a.txt"])])
        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.source("src/a.txt", "first attempt\n")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")
        self.run_check("TASK-1-unit", task_id="TASK-1")
        self.review(
            self.snapshot("TASK-1"),
            reviewer="reviewer-one",
            verdict="changes_requested",
            task_id="TASK-1",
            findings=["Retain this concrete finding"],
            filename="history-rejection.json",
        )

        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.source("src/a.txt", "approved follow-up\n")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")
        self.run_check("TASK-1-unit", task_id="TASK-1")
        self.review(
            self.snapshot("TASK-1"),
            reviewer="reviewer-two",
            task_id="TASK-1",
            filename="history-approval.json",
        )

        self.invoke(
            "reassign",
            "--task",
            "TASK-1",
            "--owner",
            "bob",
            "--reason",
            "Continue with a replacement implementer",
        )
        self.invoke("claim", "--task", "TASK-1", "--owner", "bob")
        self.source("src/a.txt", "replacement follow-up\n")
        self.invoke("submit", "--task", "TASK-1", "--owner", "bob")
        self.run_check("TASK-1-unit", task_id="TASK-1")
        self.review(
            self.snapshot("TASK-1"),
            reviewer="reviewer-three",
            task_id="TASK-1",
            filename="history-transfer-approval.json",
        )
        self.invoke(
            "reopen",
            "--reason",
            "Exercise history preservation",
            "--stage",
            "implement",
        )

        state = json.loads((self.run_dir / "state.json").read_text(encoding="utf-8"))
        history = state.get("review_history")
        self.assertIsInstance(history, list)
        self.assertGreaterEqual(len(history), 3)
        serialized = json.dumps(history, ensure_ascii=False)
        for evidence in (
            "reviewer-one",
            "reviewer-two",
            "reviewer-three",
            "changes_requested",
            "approve",
            "Retain this concrete finding",
        ):
            self.assertIn(evidence, serialized)

    def test_source_change_invalidates_final_check_and_completion(self) -> None:
        self.advance_to_implementation([self.task("TASK-1", ["src/a.txt"])])
        self.approve_task(
            "TASK-1",
            owner="alice",
            change=("src/a.txt", "approved\n"),
        )
        self.run_check("integration")
        reviewed_snapshot = self.snapshot()
        self.review(reviewed_snapshot, reviewer="final-reviewer")

        self.source("src/a.txt", "changed after final review\n")
        self.invoke("complete", expected=2)

        stale_review = self.write_json(
            "stale-final-review.json",
            {
                "reviewer": "second-reviewer",
                "verdict": "approve",
                "snapshot": reviewed_snapshot,
                "findings": [],
            },
        )
        self.invoke("review", "--file", os.fspath(stale_review), expected=2)

    def test_workspace_check_lock_is_shared_across_runs(self) -> None:
        first_run = self.root / "run-one"
        second_run = self.root / "run-two"
        task = self.task("TASK-1", ["src/a.txt"])
        for run_dir in (first_run, second_run):
            self.init(run_dir=run_dir)
            context = self.write_json(
                f"context-{run_dir.name}.json",
                self.context_payload(),
            )
            self.invoke("context", "--file", os.fspath(context), run_dir=run_dir)
            spec = self.write_json(
                f"spec-{run_dir.name}.json",
                self.spec_payload(),
            )
            self.invoke("spec", "--file", os.fspath(spec), run_dir=run_dir)
            plan = self.write_json(f"plan-{run_dir.name}.json", {"tasks": [task]})
            self.invoke("plan", "--file", os.fspath(plan), run_dir=run_dir)
            self.invoke("ready", run_dir=run_dir)
            self.invoke(
                "claim",
                "--task",
                "TASK-1",
                "--owner",
                run_dir.name,
                run_dir=run_dir,
            )
            self.invoke(
                "submit",
                "--task",
                "TASK-1",
                "--owner",
                run_dir.name,
                run_dir=run_dir,
            )

        long_check_command = [
            sys.executable,
            os.fspath(SCRIPT),
            "--run",
            os.fspath(first_run),
            "check",
            "--name",
            "TASK-1-unit",
            "--task",
            "TASK-1",
            "--timeout",
            "5",
            "--",
            sys.executable,
            "-c",
            "import time; time.sleep(1)",
        ]
        first = subprocess.Popen(
            long_check_command,
            cwd=self.workspace,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        self.addCleanup(lambda: first.poll() is None and first.kill())
        time.sleep(0.2)

        self.run_check(
            "TASK-1-unit",
            task_id="TASK-1",
            run_dir=second_run,
            expected=2,
        )
        stdout, stderr = first.communicate(timeout=5)
        self.assertEqual(0, first.returncode, f"stdout={stdout}\nstderr={stderr}")

    def test_check_runs_in_workspace_when_cli_is_launched_elsewhere(self) -> None:
        self.advance_to_implementation([self.task("TASK-1", ["src/a.txt"])])
        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.source("src/a.txt", "work\n")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")

        cwd_assertion = (
            "from pathlib import Path; import sys; "
            f"sys.exit(0 if Path.cwd().resolve() == Path({os.fspath(self.workspace)!r}).resolve() else 9)"
        )
        self.run_check(
            "TASK-1-unit",
            task_id="TASK-1",
            command=[sys.executable, "-c", cwd_assertion],
            invocation_cwd=self.root,
        )

    def test_final_changes_requested_returns_approved_task_to_implementation(self) -> None:
        self.advance_to_implementation([self.task("TASK-1", ["src/a.txt"])])
        self.approve_task(
            "TASK-1",
            owner="alice",
            change=("src/a.txt", "first approved version\n"),
        )
        self.run_check("integration")
        self.review(
            self.snapshot(),
            reviewer="final-reviewer",
            verdict="changes_requested",
            findings=["Adjust the integrated behavior"],
            filename="final-changes-requested.json",
        )
        self.assert_stage("implement")

        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.source("src/a.txt", "fixed integrated version\n")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")
        self.run_check("TASK-1-unit", task_id="TASK-1")
        self.review(
            self.snapshot("TASK-1"),
            reviewer="task-reviewer-2",
            task_id="TASK-1",
            filename="fixed-task-review.json",
        )
        self.run_check("integration")
        self.review(
            self.snapshot(),
            reviewer="final-reviewer-2",
            filename="fixed-final-review.json",
        )
        self.invoke("complete")
        self.assert_stage("complete")

    def test_changes_requested_and_reopen_are_explicit_returns(self) -> None:
        self.advance_to_implementation([self.task("TASK-1", ["src/a.txt"])])
        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.source("src/a.txt", "first attempt\n")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")
        self.run_check("TASK-1-unit", task_id="TASK-1")
        snapshot = self.snapshot("TASK-1")
        self.review(
            snapshot,
            reviewer="bob",
            verdict="changes_requested",
            task_id="TASK-1",
            findings=["Fix the edge case"],
        )
        self.assert_stage("implement")

        self.invoke("claim", "--task", "TASK-1", "--owner", "alice")
        self.source("src/a.txt", "second attempt\n")
        self.invoke("submit", "--task", "TASK-1", "--owner", "alice")
        self.run_check("TASK-1-unit", task_id="TASK-1")
        self.review(
            self.snapshot("TASK-1"),
            reviewer="bob",
            task_id="TASK-1",
            filename="approved-review.json",
        )
        self.assert_stage("code-review")

        self.invoke(
            "reopen",
            "--reason",
            "Acceptance criterion changed",
            "--stage",
            "to-spec",
        )
        self.assert_stage("to-spec")
        self.invoke("complete", expected=2)


if __name__ == "__main__":
    unittest.main()
