#!/usr/bin/env python3
"""Probe actual local skill discovery and standalone role inputs without inference."""

from __future__ import annotations

import argparse
import json
import os
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import tomllib
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

SKILLS = {"agent-workflow", "grill-with-docs", "to-spec", "to-tickets", "implement", "code-review"}
ROLES = {
    "workflow-team-lead",
    "workflow-researcher",
    "workflow-architect",
    "workflow-implementer",
    "workflow-reviewer",
    "workflow-qa",
}


@contextmanager
def isolated_profile() -> Iterator[Path]:
    root = Path(tempfile.gettempdir()).resolve()
    path = root / ("workflow-registry-probe-" + uuid.uuid4().hex)
    path.mkdir()
    try:
        yield path
    finally:
        if path.resolve().parent != root:
            raise RuntimeError("Refusing cleanup outside the probe temporary root")
        shutil.rmtree(path)


def discover_skills(
    workspace: Path, executable: str, codex_home: Path, isolated_home: Path
) -> dict[str, list[str]]:
    process = subprocess.Popen(
        [executable, "app-server", "--stdio"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        errors="replace",
        env={**os.environ, "CODEX_HOME": str(isolated_home)},
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    messages: queue.Queue[dict[str, Any]] = queue.Queue()

    def read_messages() -> None:
        assert process.stdout is not None
        for line in process.stdout:
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                messages.put(value)

    threading.Thread(target=read_messages, daemon=True).start()

    def send(message: dict[str, Any]) -> None:
        assert process.stdin is not None
        process.stdin.write(json.dumps(message) + "\n")
        process.stdin.flush()

    def response(request_id: int) -> dict[str, Any]:
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            try:
                message = messages.get(timeout=max(0.01, deadline - time.monotonic()))
            except queue.Empty as exc:
                raise RuntimeError("Codex registry probe timed out") from exc
            if message.get("id") == request_id:
                if "error" in message:
                    raise RuntimeError(f"Codex rejected registry request {request_id}")
                return message["result"]
        raise RuntimeError("Codex registry probe timed out")

    try:
        send(
            {
                "id": 1,
                "method": "initialize",
                "params": {
                    "clientInfo": {"name": "agent-workflow-install-probe", "version": "1.0"},
                },
            }
        )
        response(1)
        send({"method": "initialized"})
        send(
            {
                "id": 2,
                "method": "skills/extraRoots/set",
                "params": {
                    "extraRoots": [str(codex_home / "skills")],
                },
            }
        )
        response(2)
        send(
            {
                "id": 3,
                "method": "skills/list",
                "params": {
                    "cwds": [str(workspace)],
                    "forceReload": True,
                },
            }
        )
        result = response(3)
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        if process.stdin is not None:
            process.stdin.close()
        if process.stdout is not None:
            process.stdout.close()

    found: dict[str, list[str]] = {}
    for entry in result.get("data", []):
        for skill in entry.get("skills", []):
            name = skill.get("name")
            if name in SKILLS and skill.get("enabled", True):
                found.setdefault(name, []).append(str(skill.get("path", "")))
    return found


def discover_roles(workspace: Path, codex_home: Path) -> dict[str, str]:
    found: dict[str, str] = {}
    for directory in (codex_home / "agents", workspace / ".codex" / "agents"):
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("*.toml")):
            try:
                data = tomllib.loads(path.read_text(encoding="utf-8-sig"))
            except (OSError, tomllib.TOMLDecodeError):
                continue
            name = data.get("name")
            if name not in ROLES:
                continue
            if not all(
                isinstance(data.get(key), str) and data[key].strip()
                for key in ("name", "description", "developer_instructions")
            ):
                raise RuntimeError(f"Invalid workflow role: {name}")
            found[name] = str(path.resolve())
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=Path.cwd())
    arguments = parser.parse_args()
    executable = shutil.which("codex")
    if not executable:
        print("error: codex executable is not available", file=sys.stderr)
        return 2
    workspace = arguments.workspace.resolve(strict=True)
    codex_home = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex")
    try:
        with isolated_profile() as isolated_home:
            skills = discover_skills(workspace, executable, codex_home, isolated_home)
        roles = discover_roles(workspace, codex_home)
    except (OSError, RuntimeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    missing_skills = sorted(SKILLS - skills.keys())
    missing_roles = sorted(ROLES - roles.keys())
    duplicates = sorted(name for name, paths in skills.items() if len(paths) != 1)
    valid = not (missing_skills or missing_roles or duplicates)
    print(
        json.dumps(
            {
                "ok": valid,
                "skills_discovered": skills,
                "role_files_validated": roles,
                "missing_skills": missing_skills,
                "missing_roles": missing_roles,
                "duplicate_skill_names": duplicates,
                "model_turns_requested": 0,
                "role_runtime_invocation_verified": False,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
