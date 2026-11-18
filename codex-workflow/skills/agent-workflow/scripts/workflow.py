#!/usr/bin/env python3
"""Durable, standard-library-only workflow gates for Codex feature work."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import secrets
import subprocess
import sys
import tempfile
import time
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, NoReturn

STATE_VERSION = 1
STATE_NAME = "state.json"
STATE_LOCK_NAME = "state.lock"
MAX_EVENTS = 200
MAX_CAPTURE_BYTES = 8 * 1024 * 1024
REJECTION_LIMIT = 3
STAGES = ("grill-with-docs", "to-spec", "to-tickets", "implement", "code-review", "complete")
REOPEN_STAGES = STAGES[:4]
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
CHECK_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._ :/+()-]{0,127}$")
DRIVE_RE = re.compile(r"^[A-Za-z]:")
EXCLUDED_DIR_NAMES = frozenset(
    {
        ".git",
        ".cache",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
        "__pycache__",
        "build",
        "cache",
        "dist",
        "node_modules",
    }
)
EXCLUDED_DIR_IDENTITIES = frozenset(
    name.casefold() if os.name == "nt" else name for name in EXCLUDED_DIR_NAMES
)


class WorkflowError(Exception):
    """Expected validation, gate, or lock error."""


class WorkflowArgumentParser(argparse.ArgumentParser):
    """Keep command-line usage errors machine-readable like gate errors."""

    def error(self, message: str) -> NoReturn:
        _emit({"ok": False, "error": "usage_error", "message": message}, stream=sys.stderr)
        raise SystemExit(2)


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _emit(payload: dict[str, Any], *, stream: Any = sys.stdout) -> None:
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True), file=stream, flush=True)


def _fail(message: str, *, code: str = "workflow_error") -> NoReturn:
    raise WorkflowError(f"{code}: {message}")


def _expect_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail(f"{label} must be a JSON object", code="invalid_json")
    return value


def _expect_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        _fail(f"{label} must be a non-empty string", code="invalid_json")
    return value.strip()


def _string_list(value: Any, label: str, *, nonempty: bool = False) -> list[str]:
    if not isinstance(value, list):
        _fail(f"{label} must be an array", code="invalid_json")
    result = [_expect_string(item, f"{label}[{index}]") for index, item in enumerate(value)]
    if nonempty and not result:
        _fail(f"{label} must not be empty", code="invalid_json")
    if len(result) != len(set(result)):
        _fail(f"{label} contains duplicates", code="invalid_json")
    return result


def _keys_exact(obj: dict[str, Any], required: set[str], optional: set[str], label: str) -> None:
    missing = required - obj.keys()
    extra = obj.keys() - required - optional
    if missing:
        _fail(f"{label} is missing keys: {', '.join(sorted(missing))}", code="invalid_json")
    if extra:
        _fail(f"{label} has unsupported keys: {', '.join(sorted(extra))}", code="invalid_json")


def _read_json_file(path_text: str, label: str) -> dict[str, Any]:
    path = Path(path_text).expanduser()
    try:
        raw = path.read_text(encoding="utf-8-sig")
    except OSError as exc:
        _fail(f"cannot read {label} file {path}: {exc}", code="file_error")
    try:
        return _expect_object(json.loads(raw), label)
    except json.JSONDecodeError as exc:
        _fail(f"invalid JSON in {path}: line {exc.lineno}, column {exc.colno}", code="invalid_json")


def _normalize_rel(raw: Any, label: str = "path") -> str:
    text = _expect_string(raw, label).replace("\\", "/")
    if text.startswith("/") or DRIVE_RE.match(text):
        _fail(f"{label} must be relative to the workspace: {raw!r}", code="unsafe_path")
    parts: list[str] = []
    for part in text.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            _fail(f"{label} must not contain '..': {raw!r}", code="unsafe_path")
        if "\x00" in part:
            _fail(f"{label} contains a NUL byte", code="unsafe_path")
        parts.append(part)
    return "/".join(parts) or "."


def _path_identity(rel: str) -> str:
    return rel.casefold() if os.name == "nt" else rel


def _ensure_unique_paths(paths: Sequence[str], label: str) -> None:
    identities = [_path_identity(path) for path in paths]
    if len(identities) != len(set(identities)):
        _fail(f"{label} contains duplicate filesystem paths", code="invalid_scope")


def _is_under(path: str, root: str) -> bool:
    path_id = _path_identity(path)
    root_id = _path_identity(root)
    return root_id == "." or path_id == root_id or path_id.startswith(root_id + "/")


def _overlap(left: str, right: str) -> bool:
    return _is_under(left, right) or _is_under(right, left)


def _path_for(workspace: Path, rel: str) -> Path:
    return workspace if rel == "." else workspace.joinpath(*rel.split("/"))


def _relative_if_inside(path: Path, root: Path) -> str | None:
    try:
        rel = path.resolve(strict=False).relative_to(root.resolve(strict=True))
    except (OSError, ValueError):
        return None
    return _normalize_rel(rel.as_posix(), "run directory")


def _validate_safe_path(workspace: Path, rel: str, label: str) -> None:
    candidate = _path_for(workspace, rel)
    try:
        candidate.resolve(strict=False).relative_to(workspace)
    except (OSError, ValueError):
        _fail(f"{label} escapes the workspace through a symlink: {rel}", code="unsafe_path")

    cursor = workspace
    if rel != ".":
        for part in rel.split("/"):
            cursor = cursor / part
            if cursor.is_symlink():
                _fail(f"{label} contains a symlink component: {rel}", code="unsafe_path")
            if not cursor.exists():
                break


def _validate_scope_name(rel: str, label: str) -> None:
    if rel != "." and any(
        _path_identity(part) in EXCLUDED_DIR_IDENTITIES for part in rel.split("/")
    ):
        _fail(f"{label} selects an excluded build/cache/VCS directory: {rel}", code="invalid_scope")


def _load_state(run_dir: Path) -> dict[str, Any]:
    path = run_dir / STATE_NAME
    try:
        raw = path.read_text(encoding="utf-8")
        state = _expect_object(json.loads(raw), "state")
    except FileNotFoundError:
        _fail(f"run is not initialized: {run_dir}", code="not_initialized")
    except (OSError, json.JSONDecodeError) as exc:
        _fail(f"cannot load state {path}: {exc}", code="state_error")
    if state.get("version") != STATE_VERSION:
        _fail(f"unsupported state version: {state.get('version')!r}", code="state_error")
    return state


def _fsync_directory(path: Path) -> None:
    try:
        descriptor = os.open(path, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(descriptor)
    except OSError:
        pass
    finally:
        os.close(descriptor)


def _write_json_exclusive(path: Path, payload: dict[str, Any]) -> None:
    data = (json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(
        "utf-8"
    )
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    descriptor = os.open(path, flags, 0o600)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        try:
            path.unlink()
        except OSError:
            pass
        raise


def _write_state_atomic(run_dir: Path, state: dict[str, Any]) -> None:
    token = secrets.token_hex(12)
    temporary = run_dir / f".{STATE_NAME}.{os.getpid()}.{token}.tmp"
    _write_json_exclusive(temporary, state)
    try:
        os.replace(temporary, run_dir / STATE_NAME)
        _fsync_directory(run_dir)
    finally:
        if temporary.exists():
            try:
                temporary.unlink()
            except OSError:
                pass


def _read_lock(path: Path) -> dict[str, Any] | None:
    try:
        return _expect_object(json.loads(path.read_text(encoding="utf-8")), "lock")
    except (OSError, json.JSONDecodeError, WorkflowError):
        return None


@contextmanager
def _exclusive_lock(
    path: Path, *, owner: str, workspace: str | None = None
) -> Iterator[dict[str, Any]]:
    token = secrets.token_hex(16)
    metadata: dict[str, Any] = {
        "owner": owner,
        "token": token,
        "pid": os.getpid(),
        "created_at": _now(),
    }
    if workspace is not None:
        metadata["workspace"] = workspace
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        _write_json_exclusive(path, metadata)
    except FileExistsError:
        existing = _read_lock(path)
        detail = (
            json.dumps(existing, ensure_ascii=False, sort_keys=True)
            if existing
            else "unreadable metadata"
        )
        _fail(
            f"lock exists at {path}; owner must recover it explicitly after checking the PID ({detail})",
            code="locked",
        )
    try:
        yield metadata
    finally:
        if not metadata.get("retain"):
            current = _read_lock(path)
            if current is not None and current.get("token") == token:
                try:
                    path.unlink()
                    _fsync_directory(path.parent)
                except FileNotFoundError:
                    pass


@contextmanager
def _state_lock(run_dir: Path, owner: str) -> Iterator[None]:
    with _exclusive_lock(run_dir / STATE_LOCK_NAME, owner=owner):
        yield


def _event(state: dict[str, Any], kind: str, details: dict[str, Any] | None = None) -> None:
    sequence = int(state.get("next_event_sequence", 1))
    event = {"sequence": sequence, "at": _now(), "kind": kind}
    if details:
        event["details"] = details
    events = list(state.get("events", []))
    events.append(event)
    state["events"] = events[-MAX_EVENTS:]
    state["next_event_sequence"] = sequence + 1


def _commit(
    run_dir: Path, state: dict[str, Any], kind: str, details: dict[str, Any] | None = None
) -> None:
    state["revision"] = int(state.get("revision", 0)) + 1
    state["updated_at"] = _now()
    _event(state, kind, details)
    _write_state_atomic(run_dir, state)


def _workspace(state: dict[str, Any]) -> Path:
    path = Path(_expect_string(state.get("workspace"), "state.workspace"))
    try:
        resolved = path.resolve(strict=True)
    except OSError as exc:
        _fail(f"workspace is unavailable: {exc}", code="workspace_error")
    if not resolved.is_dir():
        _fail(f"workspace is not a directory: {resolved}", code="workspace_error")
    return resolved


def _is_excluded(rel: str, state: dict[str, Any]) -> bool:
    if any(_path_identity(part) in EXCLUDED_DIR_IDENTITIES for part in rel.split("/")):
        return True
    run_exclusion = state.get("run_exclusion")
    return isinstance(run_exclusion, str) and _is_under(rel, run_exclusion)


def _read_stable_file(path: Path, rel: str) -> bytes:
    for _ in range(2):
        try:
            before = path.stat()
            data = path.read_bytes()
            after = path.stat()
        except OSError as exc:
            _fail(f"cannot snapshot {rel}: {exc}", code="snapshot_error")
        identity_before = (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
        identity_after = (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
        if identity_before == identity_after and len(data) == after.st_size:
            return data
    _fail(f"file changed while being read: {rel}", code="snapshot_race")


def _collect_snapshot_entries(
    workspace: Path, scopes: Sequence[str], state: dict[str, Any]
) -> tuple[dict[str, tuple[str, bytes | None]], int]:
    entries: dict[str, tuple[str, bytes | None]] = {}
    total_bytes = 0

    def visit(path: Path, rel: str) -> None:
        nonlocal total_bytes
        if _is_excluded(rel, state):
            return
        if path.is_symlink():
            _fail(f"symlink encountered in snapshot: {rel}", code="unsafe_path")
        if not path.exists():
            entries.setdefault(rel, ("missing", None))
            return
        if path.is_file():
            data = _read_stable_file(path, rel)
            previous = entries.get(rel)
            if previous is None:
                entries[rel] = ("file", data)
                total_bytes += len(data)
            return
        if not path.is_dir():
            _fail(f"unsupported filesystem object in snapshot: {rel}", code="snapshot_error")
        entries.setdefault(rel, ("directory", None))
        try:
            children = sorted(path.iterdir(), key=lambda item: item.name)
        except OSError as exc:
            _fail(f"cannot enumerate {rel}: {exc}", code="snapshot_error")
        for child in children:
            child_rel = child.name if rel == "." else f"{rel}/{child.name}"
            visit(child, child_rel)

    for scope in sorted(set(scopes)):
        _validate_safe_path(workspace, scope, "snapshot scope")
        visit(_path_for(workspace, scope), scope)
    return entries, total_bytes


def _snapshot(state: dict[str, Any], scopes: Sequence[str]) -> dict[str, Any]:
    workspace = _workspace(state)
    normalized = sorted(set(_normalize_rel(scope, "snapshot scope") for scope in scopes))
    entries, total_bytes = _collect_snapshot_entries(workspace, normalized, state)
    digest = hashlib.sha256()
    digest.update(b"codex-workflow-snapshot-v1\0")
    for scope in normalized:
        digest.update(b"S\0" + scope.encode("utf-8") + b"\0")
    for rel in sorted(entries):
        kind, data = entries[rel]
        digest.update(kind[:1].upper().encode("ascii") + b"\0")
        digest.update(rel.encode("utf-8") + b"\0")
        if data is not None:
            digest.update(str(len(data)).encode("ascii") + b"\0")
            digest.update(data)
    return {
        "algorithm": "sha256",
        "digest": digest.hexdigest(),
        "scopes": normalized,
        "entries": len(entries),
        "bytes": total_bytes,
    }


def _task(state: dict[str, Any], task_id: str) -> dict[str, Any]:
    tasks = state.get("tasks")
    if not isinstance(tasks, dict) or task_id not in tasks:
        _fail(f"unknown task: {task_id}", code="unknown_task")
    return _expect_object(tasks[task_id], f"task {task_id}")


def _task_snapshot(
    state: dict[str, Any], task: dict[str, Any], stack: tuple[str, ...] = ()
) -> dict[str, Any]:
    """Hash task-owned content plus transitive dependency content snapshots.

    Dependencies remain separate write scopes. Including their digests here only
    makes downstream checks and reviews stale when an upstream result changes.
    """
    task_id = task["id"]
    if task_id in stack:
        _fail(f"task dependency cycle reached {task_id}", code="state_error")
    own = _snapshot(state, task["scope"])
    dependency_snapshots: dict[str, str] = {}
    digest = hashlib.sha256()
    digest.update(b"codex-workflow-task-snapshot-v1\0")
    digest.update(task_id.encode("utf-8") + b"\0")
    digest.update(own["digest"].encode("ascii") + b"\0")
    for dependency_id in sorted(task["depends_on"]):
        dependency = _task(state, dependency_id)
        dependency_snapshot = _task_snapshot(state, dependency, stack + (task_id,))
        dependency_snapshots[dependency_id] = dependency_snapshot["digest"]
        digest.update(dependency_id.encode("utf-8") + b"\0")
        digest.update(dependency_snapshot["digest"].encode("ascii") + b"\0")
    return {
        **own,
        "digest": digest.hexdigest(),
        "content_digest": own["digest"],
        "dependency_snapshots": dependency_snapshots,
    }


def _task_approval_current(state: dict[str, Any], task_id: str) -> bool:
    task = _task(state, task_id)
    if task.get("status") != "approved" or not isinstance(task.get("approval"), dict):
        return False
    return task["approval"].get("snapshot") == _task_snapshot(state, task)["digest"]


def _dependencies_current(state: dict[str, Any], task: dict[str, Any]) -> bool:
    visited: set[str] = set()

    def current(task_id: str) -> bool:
        if task_id in visited:
            return True
        visited.add(task_id)
        dependency = _task(state, task_id)
        if not _task_approval_current(state, task_id):
            return False
        return all(current(parent) for parent in dependency["depends_on"])

    return all(current(task_id) for task_id in task["depends_on"])


def _all_tasks_current(state: dict[str, Any]) -> bool:
    tasks = state.get("tasks")
    return bool(tasks) and all(
        _task_approval_current(state, task_id) and _dependencies_current(state, task)
        for task_id, task in tasks.items()
    )


def _configured_check_current(evidence: Any, snapshot: str) -> bool:
    return (
        isinstance(evidence, dict)
        and evidence.get("outcome") == "passed"
        and evidence.get("snapshot") == snapshot
    )


def _task_checks_current(
    state: dict[str, Any], task_id: str, task: dict[str, Any], snapshot: str
) -> bool:
    evidence = state.get("task_checks", {}).get(task_id, {})
    return all(_configured_check_current(evidence.get(name), snapshot) for name in task["checks"])


def _final_checks_current(state: dict[str, Any], snapshot: str) -> bool:
    evidence = state.get("final_checks", {})
    names = state.get("spec", {}).get("final_checks", [])
    return all(_configured_check_current(evidence.get(name), snapshot) for name in names)


def _require_stage(state: dict[str, Any], allowed: Sequence[str], action: str) -> None:
    stage = state.get("stage")
    if stage not in allowed:
        _fail(
            f"{action} is not allowed in stage {stage!r}; expected {', '.join(allowed)}",
            code="wrong_stage",
        )


def _validate_context(payload: dict[str, Any]) -> dict[str, Any]:
    required = {"summary", "requirements", "sources", "assumptions", "open_questions", "blockers"}
    _keys_exact(payload, required, set(), "context")
    sources_raw = payload["sources"]
    if not isinstance(sources_raw, list):
        _fail("context.sources must be an array", code="invalid_json")
    sources: list[str | dict[str, str]] = []
    for index, item in enumerate(sources_raw):
        if isinstance(item, str):
            sources.append(_expect_string(item, f"context.sources[{index}]"))
        elif isinstance(item, dict):
            _keys_exact(item, {"reference", "claim"}, set(), f"context.sources[{index}]")
            sources.append(
                {
                    "reference": _expect_string(
                        item["reference"], f"context.sources[{index}].reference"
                    ),
                    "claim": _expect_string(item["claim"], f"context.sources[{index}].claim"),
                }
            )
        else:
            _fail(
                f"context.sources[{index}] must be a string or source object", code="invalid_json"
            )
    return {
        "summary": _expect_string(payload["summary"], "context.summary"),
        "requirements": _string_list(
            payload["requirements"], "context.requirements", nonempty=True
        ),
        "sources": sources,
        "assumptions": _string_list(payload["assumptions"], "context.assumptions"),
        "open_questions": _string_list(payload["open_questions"], "context.open_questions"),
        "blockers": _string_list(payload["blockers"], "context.blockers"),
    }


def _validate_check_names(value: Any, label: str) -> list[str]:
    names = _string_list(value, label, nonempty=True)
    for name in names:
        if not CHECK_RE.fullmatch(name):
            _fail(f"{label} contains an invalid check name: {name!r}", code="invalid_json")
    return names


def _validate_spec(payload: dict[str, Any]) -> dict[str, Any]:
    required = {"title", "requirements", "acceptance_criteria", "out_of_scope", "final_checks"}
    _keys_exact(payload, required, set(), "spec")
    return {
        "title": _expect_string(payload["title"], "spec.title"),
        "requirements": _string_list(payload["requirements"], "spec.requirements", nonempty=True),
        "acceptance_criteria": _string_list(
            payload["acceptance_criteria"], "spec.acceptance_criteria", nonempty=True
        ),
        "out_of_scope": _string_list(payload["out_of_scope"], "spec.out_of_scope"),
        "final_checks": _validate_check_names(payload["final_checks"], "spec.final_checks"),
    }


def _validate_plan(
    payload: dict[str, Any], state: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any]]:
    _keys_exact(payload, {"tasks"}, set(), "plan")
    raw_tasks = payload["tasks"]
    if not isinstance(raw_tasks, list) or not raw_tasks:
        _fail("plan.tasks must be a non-empty array", code="invalid_json")
    initial_scope = state["initial_scope"]
    validated: list[dict[str, Any]] = []
    runtime: dict[str, Any] = {}
    for index, item in enumerate(raw_tasks):
        obj = _expect_object(item, f"plan.tasks[{index}]")
        required = {"id", "title", "scope", "depends_on", "acceptance_criteria", "checks"}
        _keys_exact(obj, required, set(), f"plan.tasks[{index}]")
        task_id = _expect_string(obj["id"], f"plan.tasks[{index}].id")
        if not ID_RE.fullmatch(task_id):
            _fail(f"invalid task id: {task_id!r}", code="invalid_plan")
        if task_id in runtime:
            _fail(f"duplicate task id: {task_id}", code="invalid_plan")
        scope_raw = obj["scope"]
        if not isinstance(scope_raw, list) or not scope_raw:
            _fail(f"task {task_id} scope must be a non-empty array", code="invalid_plan")
        scopes: list[str] = []
        for scope_index, raw_scope in enumerate(scope_raw):
            rel = _normalize_rel(raw_scope, f"task {task_id} scope[{scope_index}]")
            if not any(_is_under(rel, root) for root in initial_scope):
                _fail(f"task {task_id} scope is outside initial scope: {rel}", code="invalid_plan")
            _validate_scope_name(rel, f"task {task_id} scope")
            _validate_safe_path(_workspace(state), rel, f"task {task_id} scope")
            scopes.append(rel)
        _ensure_unique_paths(scopes, f"task {task_id} scope")
        depends_on = _string_list(obj["depends_on"], f"task {task_id}.depends_on")
        if task_id in depends_on:
            _fail(f"task {task_id} cannot depend on itself", code="invalid_plan")
        task = {
            "id": task_id,
            "title": _expect_string(obj["title"], f"task {task_id}.title"),
            "scope": scopes,
            "depends_on": depends_on,
            "acceptance_criteria": _string_list(
                obj["acceptance_criteria"], f"task {task_id}.acceptance_criteria", nonempty=True
            ),
            "checks": _validate_check_names(obj["checks"], f"task {task_id}.checks"),
        }
        validated.append(task)
        runtime[task_id] = {
            **task,
            "status": "pending",
            "owner": None,
            "owner_history": [],
            "submitted_snapshot": None,
            "approval": None,
            "last_review": None,
            "rejection_count": 0,
        }

    known = set(runtime)
    for task in validated:
        unknown = set(task["depends_on"]) - known
        if unknown:
            _fail(
                f"task {task['id']} has unknown dependencies: {', '.join(sorted(unknown))}",
                code="invalid_plan",
            )

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(task_id: str) -> None:
        if task_id in visiting:
            _fail(f"plan dependency cycle reaches {task_id}", code="invalid_plan")
        if task_id in visited:
            return
        visiting.add(task_id)
        for dependency in runtime[task_id]["depends_on"]:
            visit(dependency)
        visiting.remove(task_id)
        visited.add(task_id)

    for task_id in runtime:
        visit(task_id)
    return {"tasks": validated}, runtime


def _validate_review(payload: dict[str, Any]) -> dict[str, Any]:
    _keys_exact(payload, {"reviewer", "verdict", "snapshot", "findings"}, {"summary"}, "review")
    verdict = _expect_string(payload["verdict"], "review.verdict")
    if verdict not in ("approve", "changes_requested"):
        _fail("review.verdict must be 'approve' or 'changes_requested'", code="invalid_json")
    findings = payload["findings"]
    if not isinstance(findings, list):
        _fail("review.findings must be an array", code="invalid_json")
    normalized_findings: list[str | dict[str, Any]] = []
    for index, finding in enumerate(findings):
        if isinstance(finding, str):
            normalized_findings.append(_expect_string(finding, f"review.findings[{index}]"))
        elif isinstance(finding, dict) and finding:
            normalized_findings.append(finding)
        else:
            _fail(
                f"review.findings[{index}] must be a non-empty string or object",
                code="invalid_json",
            )
    if verdict == "changes_requested" and not normalized_findings:
        _fail("changes_requested review requires at least one finding", code="invalid_json")
    result: dict[str, Any] = {
        "reviewer": _expect_string(payload["reviewer"], "review.reviewer"),
        "verdict": verdict,
        "snapshot": _expect_string(payload["snapshot"], "review.snapshot"),
        "findings": normalized_findings,
    }
    if "summary" in payload:
        result["summary"] = _expect_string(payload["summary"], "review.summary")
    return result


def _state_summary(state: dict[str, Any]) -> dict[str, Any]:
    task_summaries: dict[str, Any] = {}
    for task_id, task in state.get("tasks", {}).items():
        snapshot = _task_snapshot(state, task)
        task_summaries[task_id] = {
            "status": task["status"],
            "owner": task["owner"],
            "depends_on": task["depends_on"],
            "scope": task["scope"],
            "current_snapshot": snapshot["digest"],
            "approval_current": _task_approval_current(state, task_id),
            "rejection_count": task["rejection_count"],
        }
    full = _snapshot(state, state["initial_scope"])
    final_review = state.get("final_review")
    final_review_current = (
        isinstance(final_review, dict)
        and final_review.get("verdict") == "approve"
        and final_review.get("snapshot") == full["digest"]
    )
    return {
        "ok": True,
        "run": state["run_dir"],
        "workspace": state["workspace"],
        "goal": state["goal"],
        "mode": state["mode"],
        "stage": state["stage"],
        "revision": state["revision"],
        "needs_replan": state.get("needs_replan", False),
        "initial_scope": state["initial_scope"],
        "current_snapshot": full["digest"],
        "tasks": task_summaries,
        "all_tasks_current": _all_tasks_current(state) if state.get("tasks") else False,
        "final_review_current": final_review_current,
        "updated_at": state["updated_at"],
    }


def _cmd_init(args: argparse.Namespace, run_dir: Path) -> dict[str, Any]:
    run_dir.mkdir(parents=True, exist_ok=True)
    with _state_lock(run_dir, "init"):
        if (run_dir / STATE_NAME).exists():
            _fail(f"run is already initialized: {run_dir}", code="already_initialized")
        workspace = Path(args.workspace).expanduser().resolve(strict=True)
        if not workspace.is_dir():
            _fail(f"workspace is not a directory: {workspace}", code="workspace_error")
        scopes = [_normalize_rel(scope, "--scope") for scope in args.scope]
        _ensure_unique_paths(scopes, "--scope")
        for rel in scopes:
            _validate_scope_name(rel, "--scope")
            _validate_safe_path(workspace, rel, "--scope")
        run_resolved = run_dir.resolve(strict=True)
        if run_resolved == workspace:
            _fail("run directory cannot equal the workspace", code="invalid_run")
        run_exclusion = _relative_if_inside(run_resolved, workspace)
        if run_exclusion is not None:
            if any(_is_under(scope, run_exclusion) for scope in scopes):
                _fail("an initial scope cannot be inside the run directory", code="invalid_scope")
            if not any(_is_under(run_exclusion, scope) for scope in scopes):
                run_exclusion = None
        created = _now()
        state: dict[str, Any] = {
            "version": STATE_VERSION,
            "revision": 0,
            "run_dir": str(run_resolved),
            "workspace": str(workspace),
            "goal": _expect_string(args.goal, "--goal"),
            "mode": args.mode,
            "stage": "grill-with-docs",
            "initial_scope": sorted(scopes),
            "run_exclusion": run_exclusion,
            "context": None,
            "spec": None,
            "plan": None,
            "tasks": {},
            "task_checks": {},
            "final_checks": {},
            "final_review": None,
            "review_history": [],
            "final_rejection_count": 0,
            "needs_replan": False,
            "reopen_history": [],
            "scope_history": [],
            "events": [],
            "next_event_sequence": 1,
            "created_at": created,
            "updated_at": created,
        }
        initial = _snapshot(state, scopes)
        state["initial_snapshot"] = initial
        _commit(run_dir, state, "initialized", {"mode": args.mode, "snapshot": initial["digest"]})
        return _state_summary(state)


def _cmd_context(args: argparse.Namespace, run_dir: Path) -> dict[str, Any]:
    payload = _validate_context(_read_json_file(args.file, "context"))
    with _state_lock(run_dir, "context"):
        state = _load_state(run_dir)
        _require_stage(state, ("grill-with-docs",), "context")
        state["context"] = payload
        state["stage"] = "to-spec"
        _commit(run_dir, state, "context_recorded", {"blockers": len(payload["blockers"])})
        return _state_summary(state)


def _cmd_spec(args: argparse.Namespace, run_dir: Path) -> dict[str, Any]:
    payload = _validate_spec(_read_json_file(args.file, "spec"))
    with _state_lock(run_dir, "spec"):
        state = _load_state(run_dir)
        _require_stage(state, ("to-spec",), "spec")
        context = _expect_object(state.get("context"), "state.context")
        blockers = context.get("blockers", [])
        if blockers:
            _fail(
                f"context has unresolved blockers ({len(blockers)}); reopen and resolve them",
                code="blocked",
            )
        state["spec"] = payload
        state["stage"] = "to-tickets"
        _commit(run_dir, state, "spec_recorded", {"final_checks": payload["final_checks"]})
        return _state_summary(state)


def _cmd_plan(args: argparse.Namespace, run_dir: Path) -> dict[str, Any]:
    raw = _read_json_file(args.file, "plan")
    with _state_lock(run_dir, "plan"):
        state = _load_state(run_dir)
        _require_stage(state, ("to-tickets",), "plan")
        plan, tasks = _validate_plan(raw, state)
        state["plan"] = plan
        state["tasks"] = tasks
        state["task_checks"] = {task_id: {} for task_id in tasks}
        state["final_checks"] = {}
        state["final_review"] = None
        state["final_rejection_count"] = 0
        state["needs_replan"] = False
        state["stage"] = "implement"
        _commit(run_dir, state, "plan_recorded", {"tasks": list(tasks)})
        return _state_summary(state)


def _ready_tasks(state: dict[str, Any]) -> list[str]:
    if state.get("needs_replan"):
        return []
    ready: list[str] = []
    for task_id, task in state.get("tasks", {}).items():
        status = task.get("status")
        if status == "approved" and not _task_approval_current(state, task_id):
            status = "pending"
        if status in ("pending", "changes_requested") and _dependencies_current(state, task):
            ready.append(task_id)
    return ready


def _cmd_ready(args: argparse.Namespace, run_dir: Path) -> dict[str, Any]:
    state = _load_state(run_dir)
    _require_stage(state, ("implement", "code-review"), "ready")
    return {
        "ok": True,
        "stage": state["stage"],
        "ready": _ready_tasks(state),
        "needs_replan": state.get("needs_replan", False),
        "revision": state["revision"],
    }


def _cmd_claim(args: argparse.Namespace, run_dir: Path) -> dict[str, Any]:
    owner = _expect_string(args.owner, "--owner")
    with _state_lock(run_dir, f"claim:{args.task}"):
        state = _load_state(run_dir)
        _require_stage(state, ("implement", "code-review"), "claim")
        if state.get("needs_replan"):
            _fail(
                "workflow requires explicit reopen/replan after repeated review rejection",
                code="needs_replan",
            )
        task = _task(state, args.task)
        if task.get("owner") not in (None, owner):
            _fail(
                f"task {args.task} is assigned to {task['owner']!r}; use explicit reassign",
                code="owner_mismatch",
            )
        if task.get("status") == "approved" and not _task_approval_current(state, args.task):
            task["status"] = "pending"
            task["approval"] = None
        if task.get("status") == "running" and task.get("owner") == owner:
            return {
                "ok": True,
                "task": args.task,
                "owner": owner,
                "status": "running",
                "revision": state["revision"],
            }
        prior_status = task.get("status")
        if prior_status not in ("pending", "changes_requested", "submitted", "approved"):
            _fail(
                f"task {args.task} cannot be claimed from status {task.get('status')!r}",
                code="invalid_transition",
            )
        if not _dependencies_current(state, task):
            _fail(
                f"task {args.task} has dependencies that are not approved and current",
                code="dependency_not_ready",
            )
        for other_id, other in state["tasks"].items():
            if other_id == args.task or other.get("status") != "running":
                continue
            if any(_overlap(left, right) for left in task["scope"] for right in other["scope"]):
                _fail(f"task {args.task} overlaps running task {other_id}", code="scope_conflict")
        task["owner"] = owner
        if owner not in task["owner_history"]:
            task["owner_history"].append(owner)
        task["status"] = "running"
        task["approval"] = None
        if prior_status in ("submitted", "approved"):
            task["submitted_snapshot"] = None
        state["stage"] = "implement"
        state["final_review"] = None
        if prior_status == "submitted":
            event = "task_withdrawn"
        elif prior_status == "approved":
            event = "task_reopened"
        else:
            event = "task_claimed"
        _commit(run_dir, state, event, {"task": args.task, "owner": owner})
        return {
            "ok": True,
            "task": args.task,
            "owner": owner,
            "status": "running",
            "revision": state["revision"],
        }


def _cmd_reassign(args: argparse.Namespace, run_dir: Path) -> dict[str, Any]:
    owner = _expect_string(args.owner, "--owner")
    reason = _expect_string(args.reason, "--reason")
    with _state_lock(run_dir, f"reassign:{args.task}"):
        state = _load_state(run_dir)
        _require_stage(state, ("implement", "code-review"), "reassign")
        if state.get("needs_replan"):
            _fail(
                "workflow requires explicit reopen/replan before reassignment", code="needs_replan"
            )
        task = _task(state, args.task)
        previous = task.get("owner")
        if previous == owner:
            _fail(f"task {args.task} is already assigned to {owner!r}", code="invalid_transition")
        history = task.setdefault("owner_history", [])
        if previous and previous not in history:
            history.append(previous)
        if owner not in history:
            history.append(owner)
        task["owner"] = owner
        task["status"] = "pending"
        task["submitted_snapshot"] = None
        task["approval"] = None
        task["last_review"] = None
        task["rejection_count"] = 0
        state["task_checks"][args.task] = {}
        state["final_checks"] = {}
        state["final_review"] = None
        state["stage"] = "implement"
        _commit(
            run_dir,
            state,
            "task_reassigned",
            {"task": args.task, "from": previous, "to": owner, "reason": reason},
        )
        return {
            "ok": True,
            "task": args.task,
            "owner": owner,
            "previous_owner": previous,
            "status": "pending",
            "revision": state["revision"],
        }


def _cmd_submit(args: argparse.Namespace, run_dir: Path) -> dict[str, Any]:
    owner = _expect_string(args.owner, "--owner")
    with _state_lock(run_dir, f"submit:{args.task}"):
        state = _load_state(run_dir)
        _require_stage(state, ("implement",), "submit")
        task = _task(state, args.task)
        if task.get("owner") != owner:
            _fail(
                f"task {args.task} owner is {task.get('owner')!r}, not {owner!r}",
                code="owner_mismatch",
            )
        if task.get("status") != "running":
            _fail(f"task {args.task} must be running before submit", code="invalid_transition")
        if not _dependencies_current(state, task):
            _fail(
                f"task {args.task} dependencies are no longer current", code="dependency_not_ready"
            )
        snapshot = _task_snapshot(state, task)
        task["submitted_snapshot"] = snapshot["digest"]
        task["status"] = "submitted"
        task["approval"] = None
        _commit(
            run_dir, state, "task_submitted", {"task": args.task, "snapshot": snapshot["digest"]}
        )
        return {
            "ok": True,
            "task": args.task,
            "status": "submitted",
            "snapshot": snapshot["digest"],
            "snapshot_details": snapshot,
            "revision": state["revision"],
        }


def _cmd_snapshot(args: argparse.Namespace, run_dir: Path) -> dict[str, Any]:
    state = _load_state(run_dir)
    if args.task:
        task = _task(state, args.task)
        snapshot = _task_snapshot(state, task)
        target = {"kind": "task", "task": args.task}
    else:
        snapshot = _snapshot(state, state["initial_scope"])
        target = {"kind": "full"}
    return {
        "ok": True,
        **target,
        "snapshot": snapshot["digest"],
        "snapshot_details": snapshot,
        "revision": state["revision"],
    }


def _resource_lock_path(workspace: Path) -> Path:
    normalized = os.path.normcase(str(workspace.resolve(strict=True)))
    key = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return Path(tempfile.gettempdir()) / "codex-workflow-locks" / f"{key}.check.lock"


def _terminate_process_tree(process: subprocess.Popen[bytes]) -> bool:
    """Terminate only the subprocess tree created for one explicit check."""
    try:
        if os.name == "nt":
            killer = subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                shell=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=15,
                check=False,
            )
            process.wait(timeout=5)
            return killer.returncode == 0 or process.returncode is not None
        os.killpg(process.pid, 15)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, 9)
            process.wait(timeout=5)
        return process.returncode is not None
    except (OSError, subprocess.SubprocessError):
        return process.poll() is not None


def _run_check(
    command: list[str], timeout: float, workspace: Path
) -> tuple[dict[str, Any], bytes, bytes]:
    started = time.monotonic()
    stdout = b""
    stderr = b""
    result: dict[str, Any]
    try:
        popen_options: dict[str, Any] = {}
        if os.name == "nt":
            popen_options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            popen_options["start_new_session"] = True
        process = subprocess.Popen(
            command,
            shell=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=workspace,
            **popen_options,
        )
        cleanup_confirmed = True
        try:
            captured_stdout, captured_stderr = process.communicate(timeout=timeout)
            outcome = "passed" if process.returncode == 0 else "failed"
            timed_out = False
            interrupted = False
        except subprocess.TimeoutExpired:
            cleanup_confirmed = _terminate_process_tree(process)
            try:
                captured_stdout, captured_stderr = process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                captured_stdout, captured_stderr = b"", b""
                cleanup_confirmed = False
            outcome = "timeout" if cleanup_confirmed else "cleanup_unconfirmed"
            timed_out = True
            interrupted = False
        except KeyboardInterrupt:
            cleanup_confirmed = _terminate_process_tree(process)
            try:
                captured_stdout, captured_stderr = process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                captured_stdout, captured_stderr = b"", b""
                cleanup_confirmed = False
            outcome = "interrupted" if cleanup_confirmed else "cleanup_unconfirmed"
            timed_out = False
            interrupted = True
        stdout = captured_stdout[-MAX_CAPTURE_BYTES:]
        stderr = captured_stderr[-MAX_CAPTURE_BYTES:]
        result = {
            "outcome": outcome,
            "returncode": process.returncode,
            "timed_out": timed_out,
            "interrupted": interrupted,
            "cleanup_confirmed": cleanup_confirmed,
        }
    except OSError as exc:
        stderr = str(exc).encode("utf-8", errors="replace")
        result = {
            "outcome": "launch_error",
            "returncode": None,
            "timed_out": False,
            "interrupted": False,
            "cleanup_confirmed": True,
        }
    result.update(
        {
            "duration_seconds": round(time.monotonic() - started, 6),
            "stdout_sha256": hashlib.sha256(stdout).hexdigest(),
            "stderr_sha256": hashlib.sha256(stderr).hexdigest(),
            "stdout_bytes": len(stdout),
            "stderr_bytes": len(stderr),
        }
    )
    return result, stdout, stderr


def _cmd_check(args: argparse.Namespace, run_dir: Path) -> tuple[dict[str, Any], int]:
    command = list(args.command)
    if command and command[0] == "--":
        command.pop(0)
    if not command:
        _fail("check requires an explicit argv after '--'", code="invalid_command")
    if args.timeout <= 0:
        _fail("--timeout must be greater than zero", code="invalid_command")
    name = _expect_string(args.name, "--name")
    if not CHECK_RE.fullmatch(name):
        _fail(f"invalid check name: {name!r}", code="invalid_command")

    stdout = b""
    stderr = b""
    with _state_lock(run_dir, f"check:{args.task or 'final'}:{name}"):
        state = _load_state(run_dir)
        workspace = _workspace(state)
        if args.task:
            _require_stage(state, ("implement",), "task check")
            task = _task(state, args.task)
            if task.get("status") not in ("running", "submitted"):
                _fail(
                    f"task {args.task} must be running or submitted before checks",
                    code="invalid_transition",
                )
            if name not in task["checks"]:
                _fail(
                    f"check {name!r} is not configured for task {args.task}", code="unknown_check"
                )
            before = _task_snapshot(state, task)
            if (
                task.get("status") == "submitted"
                and task.get("submitted_snapshot") != before["digest"]
            ):
                _fail(
                    f"task {args.task} changed after submit; submit it again", code="stale_snapshot"
                )
            evidence_container = state["task_checks"][args.task]
            target = f"task:{args.task}"
        else:
            _require_stage(state, ("implement", "code-review"), "final check")
            if not _all_tasks_current(state):
                _fail("all task approvals must be current before final checks", code="gate_failed")
            configured = state.get("spec", {}).get("final_checks", [])
            if name not in configured:
                _fail(f"check {name!r} is not configured as a final check", code="unknown_check")
            before = _snapshot(state, state["initial_scope"])
            evidence_container = state["final_checks"]
            target = "final"

        lock_path = _resource_lock_path(workspace)
        lock_owner = f"{run_dir}:{target}:{name}"
        with _exclusive_lock(
            lock_path, owner=lock_owner, workspace=str(workspace)
        ) as resource_lock:
            started_at = _now()
            result, stdout, stderr = _run_check(command, args.timeout, workspace)
            after = (
                _task_snapshot(state, task)
                if args.task
                else _snapshot(state, state["initial_scope"])
            )
            result["workspace_changed"] = after["digest"] != before["digest"]
            if result["workspace_changed"] and result["outcome"] == "passed":
                result["outcome"] = "workspace_changed"
            evidence = {
                **result,
                "name": name,
                "target": target,
                "snapshot": before["digest"],
                "snapshot_after": after["digest"],
                "command_sha256": hashlib.sha256("\0".join(command).encode("utf-8")).hexdigest(),
                "started_at": started_at,
                "finished_at": _now(),
            }
            evidence_container[name] = evidence
            _commit(
                run_dir,
                state,
                "check_finished",
                {
                    "name": name,
                    "target": target,
                    "outcome": evidence["outcome"],
                    "snapshot": before["digest"],
                },
            )
            if not evidence.get("cleanup_confirmed", False):
                resource_lock["retain"] = True
    if stdout:
        sys.stderr.buffer.write(stdout)
        if not stdout.endswith(b"\n"):
            sys.stderr.buffer.write(b"\n")
    if stderr:
        sys.stderr.buffer.write(stderr)
        if not stderr.endswith(b"\n"):
            sys.stderr.buffer.write(b"\n")
    sys.stderr.flush()
    response = {
        "ok": result["outcome"] == "passed",
        "check": evidence,
        "revision": state["revision"],
    }
    if result.get("interrupted"):
        return response, 130
    return response, 0 if response["ok"] else 1


def _cmd_review(args: argparse.Namespace, run_dir: Path) -> dict[str, Any]:
    review = _validate_review(_read_json_file(args.file, "review"))
    with _state_lock(run_dir, f"review:{args.task or 'final'}"):
        state = _load_state(run_dir)
        _require_stage(state, ("implement", "code-review"), "review")
        if state.get("needs_replan"):
            _fail(
                "workflow requires explicit reopen/replan after repeated review rejection",
                code="needs_replan",
            )
        if args.task:
            task = _task(state, args.task)
            if task.get("status") != "submitted":
                _fail(
                    f"task {args.task} must be submitted before review", code="invalid_transition"
                )
            implementers = set(task.get("owner_history", []))
            if task.get("owner"):
                implementers.add(task["owner"])
            if review["reviewer"] in implementers:
                _fail("reviewer must differ from every task implementer", code="reviewer_conflict")
            current = _task_snapshot(state, task)["digest"]
            if review["snapshot"] != current or task.get("submitted_snapshot") != current:
                _fail(
                    "review snapshot is not the current submitted task snapshot",
                    code="stale_snapshot",
                )
            if review["verdict"] == "approve" and not _task_checks_current(
                state, args.task, task, current
            ):
                _fail(
                    "cannot approve: configured task checks are not passed on this snapshot",
                    code="unverified_approval",
                )
            recorded = {**review, "at": _now()}
            state.setdefault("review_history", []).append(
                {"target": "task", "task": args.task, "review": recorded}
            )
            task["last_review"] = recorded
            if review["verdict"] == "approve":
                task["status"] = "approved"
                task["approval"] = recorded
                event = "task_approved"
            else:
                task["rejection_count"] += 1
                task["approval"] = None
                task["status"] = (
                    "blocked_replan"
                    if task["rejection_count"] >= REJECTION_LIMIT
                    else "changes_requested"
                )
                if task["status"] == "blocked_replan":
                    state["needs_replan"] = True
                state["stage"] = "implement"
                event = "task_changes_requested"
            if _all_tasks_current(state):
                state["stage"] = "code-review"
            _commit(
                run_dir,
                state,
                event,
                {"task": args.task, "reviewer": review["reviewer"], "snapshot": current},
            )
            return {
                "ok": True,
                "target": "task",
                "task": args.task,
                "verdict": review["verdict"],
                "status": task["status"],
                "needs_replan": state["needs_replan"],
                "revision": state["revision"],
            }

        if not _all_tasks_current(state):
            _fail(
                "all task approvals and dependencies must be current before final review",
                code="gate_failed",
            )
        implementers: set[str] = set()
        for task in state["tasks"].values():
            implementers.update(task.get("owner_history", []))
            if task.get("owner"):
                implementers.add(task["owner"])
        if review["reviewer"] in implementers:
            _fail("final reviewer must differ from every implementer", code="reviewer_conflict")
        current = _snapshot(state, state["initial_scope"])["digest"]
        if review["snapshot"] != current:
            _fail("final review snapshot is not current", code="stale_snapshot")
        if review["verdict"] == "approve" and not _final_checks_current(state, current):
            _fail(
                "cannot approve: configured final checks are not passed on this snapshot",
                code="unverified_approval",
            )
        recorded = {**review, "at": _now()}
        state.setdefault("review_history", []).append({"target": "final", "review": recorded})
        state["final_review"] = recorded
        if review["verdict"] == "approve":
            state["stage"] = "code-review"
            event = "final_approved"
        else:
            state["final_rejection_count"] += 1
            state["stage"] = "implement"
            if state["final_rejection_count"] >= REJECTION_LIMIT:
                state["needs_replan"] = True
            event = "final_changes_requested"
        _commit(run_dir, state, event, {"reviewer": review["reviewer"], "snapshot": current})
        return {
            "ok": True,
            "target": "final",
            "verdict": review["verdict"],
            "stage": state["stage"],
            "needs_replan": state["needs_replan"],
            "revision": state["revision"],
        }


def _cmd_complete(args: argparse.Namespace, run_dir: Path) -> dict[str, Any]:
    with _state_lock(run_dir, "complete"):
        state = _load_state(run_dir)
        _require_stage(state, ("code-review",), "complete")
        if state.get("needs_replan"):
            _fail("workflow requires explicit reopen/replan", code="needs_replan")
        if not _all_tasks_current(state):
            _fail("not all task approvals are current", code="gate_failed")
        current = _snapshot(state, state["initial_scope"])["digest"]
        if not _final_checks_current(state, current):
            _fail("configured final checks are not current", code="gate_failed")
        final_review = state.get("final_review")
        if not (
            isinstance(final_review, dict)
            and final_review.get("verdict") == "approve"
            and final_review.get("snapshot") == current
        ):
            _fail("independent final approval is missing or stale", code="gate_failed")
        state["stage"] = "complete"
        _commit(run_dir, state, "completed", {"snapshot": current})
        return {"ok": True, "stage": "complete", "snapshot": current, "revision": state["revision"]}


def _cmd_reopen(args: argparse.Namespace, run_dir: Path) -> dict[str, Any]:
    reason = _expect_string(args.reason, "--reason")
    with _state_lock(run_dir, f"reopen:{args.stage}"):
        state = _load_state(run_dir)
        current_index = STAGES.index(state["stage"])
        target_index = STAGES.index(args.stage)
        if target_index > current_index:
            _fail("reopen cannot skip forward", code="invalid_transition")
        if args.scope and args.stage == "implement":
            _fail(
                "--scope is allowed only when reopening grill-with-docs, to-spec, or to-tickets",
                code="invalid_scope",
            )
        if args.scope:
            workspace = _workspace(state)
            scopes = [_normalize_rel(scope, "--scope") for scope in args.scope]
            _ensure_unique_paths(scopes, "--scope")
            for rel in scopes:
                _validate_scope_name(rel, "--scope")
                _validate_safe_path(workspace, rel, "--scope")
            run_path = Path(state["run_dir"])
            run_exclusion = _relative_if_inside(run_path, workspace)
            if run_exclusion is not None:
                if any(_is_under(scope, run_exclusion) for scope in scopes):
                    _fail(
                        "a replacement scope cannot be inside the run directory",
                        code="invalid_scope",
                    )
                if not any(_is_under(run_exclusion, scope) for scope in scopes):
                    run_exclusion = None
            prior_scope = state["initial_scope"]
            state["initial_scope"] = sorted(scopes)
            state["run_exclusion"] = run_exclusion
            state.setdefault("scope_history", []).append(
                {"at": _now(), "scope": prior_scope, "reason": reason}
            )
            state["scope_history"] = state["scope_history"][-50:]
            state["initial_snapshot"] = _snapshot(state, state["initial_scope"])
        state["reopen_history"].append(
            {"at": _now(), "from": state["stage"], "to": args.stage, "reason": reason}
        )
        state["reopen_history"] = state["reopen_history"][-50:]
        if target_index <= STAGES.index("grill-with-docs"):
            state["context"] = None
        if target_index <= STAGES.index("to-spec"):
            state["spec"] = None
        if target_index <= STAGES.index("to-tickets"):
            state["plan"] = None
            state["tasks"] = {}
            state["task_checks"] = {}
        elif args.stage == "implement":
            for task in state["tasks"].values():
                if task.get("status") == "blocked_replan":
                    task["status"] = "changes_requested"
                    task["rejection_count"] = 0
        state["final_checks"] = {}
        state["final_review"] = None
        state["final_rejection_count"] = 0
        state["needs_replan"] = False
        state["stage"] = args.stage
        _commit(run_dir, state, "reopened", {"stage": args.stage, "reason": reason})
        return _state_summary(state)


def _build_parser() -> argparse.ArgumentParser:
    parser = WorkflowArgumentParser(
        description="Persistent five-stage Codex workflow gates (Python 3.11+, standard library only)."
    )
    parser.add_argument("--run", required=True, help="run directory containing state.json")
    commands = parser.add_subparsers(dest="subcommand", required=True)

    init = commands.add_parser("init", help="initialize a run")
    init.add_argument("--workspace", required=True)
    init.add_argument("--goal", required=True)
    init.add_argument("--mode", required=True, choices=("light", "standard", "full"))
    init.add_argument(
        "--scope", required=True, action="append", help="relative file or directory; repeatable"
    )

    commands.add_parser("status", help="show current gates and snapshot freshness")
    for name, help_text in (
        ("context", "record grill-with-docs artifact"),
        ("spec", "record specification artifact"),
        ("plan", "record task DAG artifact"),
    ):
        sub = commands.add_parser(name, help=help_text)
        sub.add_argument("--file", required=True, help="UTF-8 JSON artifact")

    commands.add_parser("ready", help="list dependency-ready tasks")
    claim = commands.add_parser("claim", help="claim one ready task")
    claim.add_argument("--task", required=True)
    claim.add_argument("--owner", required=True)
    submit = commands.add_parser("submit", help="submit one running task at its current snapshot")
    submit.add_argument("--task", required=True)
    submit.add_argument("--owner", required=True)
    reassign = commands.add_parser("reassign", help="explicitly transfer a task to a new owner")
    reassign.add_argument("--task", required=True)
    reassign.add_argument("--owner", required=True)
    reassign.add_argument("--reason", required=True)
    snapshot = commands.add_parser("snapshot", help="calculate a task or full-scope snapshot")
    snapshot.add_argument("--task")
    check = commands.add_parser("check", help="run an explicitly supplied argv without a shell")
    check.add_argument("--name", required=True)
    check.add_argument("--task")
    check.add_argument("--timeout", required=True, type=float)
    check.add_argument("command", nargs=argparse.REMAINDER, help="use: -- executable arg ...")
    review = commands.add_parser("review", help="record task or final independent review")
    review.add_argument("--file", required=True)
    review.add_argument("--task")
    commands.add_parser("complete", help="complete when every gate is current")
    reopen = commands.add_parser("reopen", help="return to an earlier stage with a reason")
    reopen.add_argument("--reason", required=True)
    reopen.add_argument("--stage", required=True, choices=REOPEN_STAGES)
    reopen.add_argument(
        "--scope",
        action="append",
        help="replace initial scope when reopening an early stage; repeatable",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    run_dir = Path(args.run).expanduser().resolve(strict=False)
    try:
        if args.subcommand == "init":
            response = _cmd_init(args, run_dir)
            exit_code = 0
        elif args.subcommand == "status":
            response = _state_summary(_load_state(run_dir))
            exit_code = 0
        elif args.subcommand == "context":
            response = _cmd_context(args, run_dir)
            exit_code = 0
        elif args.subcommand == "spec":
            response = _cmd_spec(args, run_dir)
            exit_code = 0
        elif args.subcommand == "plan":
            response = _cmd_plan(args, run_dir)
            exit_code = 0
        elif args.subcommand == "ready":
            response = _cmd_ready(args, run_dir)
            exit_code = 0
        elif args.subcommand == "claim":
            response = _cmd_claim(args, run_dir)
            exit_code = 0
        elif args.subcommand == "submit":
            response = _cmd_submit(args, run_dir)
            exit_code = 0
        elif args.subcommand == "reassign":
            response = _cmd_reassign(args, run_dir)
            exit_code = 0
        elif args.subcommand == "snapshot":
            response = _cmd_snapshot(args, run_dir)
            exit_code = 0
        elif args.subcommand == "check":
            response, exit_code = _cmd_check(args, run_dir)
        elif args.subcommand == "review":
            response = _cmd_review(args, run_dir)
            exit_code = 0
        elif args.subcommand == "complete":
            response = _cmd_complete(args, run_dir)
            exit_code = 0
        elif args.subcommand == "reopen":
            response = _cmd_reopen(args, run_dir)
            exit_code = 0
        else:  # pragma: no cover - argparse enforces this.
            parser.error(f"unsupported command: {args.subcommand}")
        _emit(response, stream=sys.stdout if exit_code in (0, 1) else sys.stderr)
        return exit_code
    except WorkflowError as exc:
        code, _, message = str(exc).partition(": ")
        _emit({"ok": False, "error": code, "message": message or code}, stream=sys.stderr)
        return 2
    except KeyboardInterrupt:
        _emit(
            {"ok": False, "error": "interrupted", "message": "operation interrupted"},
            stream=sys.stderr,
        )
        return 130
    # Keep CLI failures structured without exposing a traceback by default.
    except Exception as exc:
        _emit({"ok": False, "error": "internal_error", "message": str(exc)}, stream=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
