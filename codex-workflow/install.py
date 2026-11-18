#!/usr/bin/env python3
"""Safely install the agent-workflow bundle into a Codex home directory."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import stat
import sys
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

PACKAGE_NAME = "agent-workflow"
SCHEMA_VERSION = 1
SKILL_NAMES = (
    "agent-workflow",
    "grill-with-docs",
    "to-spec",
    "to-tickets",
    "implement",
    "code-review",
)
EXPECTED_AGENT_COUNT = 6


class InstallError(RuntimeError):
    """An expected, user-actionable installer failure."""


@dataclass(frozen=True)
class OwnedFile:
    relative_path: str
    sha256: str
    backup: dict[str, str] | None = None


@dataclass
class Plan:
    writes: dict[str, bytes]
    removes: list[str]
    manifest_bytes: bytes | None
    remove_manifest: bool
    messages: list[str]


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _lexists(path: Path) -> bool:
    return os.path.lexists(path)


def _is_reparse(path: Path) -> bool:
    if not _lexists(path):
        return False
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode):
        return True
    attributes = getattr(info, "st_file_attributes", 0)
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    return bool(attributes & reparse_flag)


def _absolute(path: Path) -> Path:
    return Path(os.path.abspath(os.path.expanduser(os.fspath(path))))


def _assert_safe_components(path: Path, boundary: Path) -> None:
    """Reject links/reparse points from boundary down to path, without resolving them."""
    path = _absolute(path)
    boundary = _absolute(boundary)
    try:
        relative = path.relative_to(boundary)
    except ValueError as exc:
        raise InstallError(f"destination escapes target: {path}") from exc

    current = boundary
    if _is_reparse(current):
        raise InstallError(f"refusing reparse point or symlink: {current}")
    if _lexists(current) and not current.is_dir():
        raise InstallError(f"expected directory, found another file type: {current}")
    for part in relative.parts:
        current = current / part
        if _is_reparse(current):
            raise InstallError(f"refusing reparse point or symlink: {current}")


def _validate_relative(relative: str) -> PurePosixPath:
    if "\\" in relative or ":" in relative or "\x00" in relative:
        raise InstallError(f"unsafe manifest path: {relative!r}")
    parsed = PurePosixPath(relative)
    if parsed.is_absolute() or not parsed.parts or ".." in parsed.parts:
        raise InstallError(f"unsafe manifest path: {relative!r}")
    if parsed.parts[0] == "skills":
        if len(parsed.parts) < 3 or parsed.parts[1] not in SKILL_NAMES:
            raise InstallError(f"manifest path is outside package skill scopes: {relative}")
    elif parsed.parts[0] == "agents":
        if len(parsed.parts) != 2:
            raise InstallError(f"nested agent path is not allowed: {relative}")
        name = parsed.parts[1]
        if not (name.startswith("workflow-") and name.endswith(".toml")):
            raise InstallError(f"manifest agent path is not package-scoped: {relative}")
    else:
        raise InstallError(f"manifest path is outside install scopes: {relative}")
    return parsed


def _destination(target: Path, relative: str) -> Path:
    parsed = _validate_relative(relative)
    return target.joinpath(*parsed.parts)


def _collect_sources(source_root: Path) -> dict[str, bytes]:
    source_root = _absolute(source_root)
    result: dict[str, bytes] = {}
    skills_root = source_root / "skills"
    agents_root = source_root / "agents"

    for root in (skills_root, agents_root):
        if not root.is_dir() or _is_reparse(root):
            raise InstallError(f"missing or unsafe package directory: {root}")

    for skill_name in SKILL_NAMES:
        skill_root = skills_root / skill_name
        if not skill_root.is_dir() or _is_reparse(skill_root):
            raise InstallError(f"missing or unsafe packaged skill: {skill_name}")
        if not (skill_root / "SKILL.md").is_file():
            raise InstallError(f"packaged skill has no SKILL.md: {skill_name}")
        skill_files = 0
        for path in sorted(skill_root.rglob("*")):
            relative_parts = path.relative_to(skill_root).parts
            if "__pycache__" in relative_parts or path.suffix in {".pyc", ".pyo"}:
                continue
            if _is_reparse(path):
                raise InstallError(f"packaged content contains a link/reparse point: {path}")
            if path.is_dir():
                continue
            if not path.is_file():
                raise InstallError(f"unsupported packaged file type: {path}")
            relative = PurePosixPath("skills", skill_name, *path.relative_to(skill_root).parts)
            result[relative.as_posix()] = path.read_bytes()
            skill_files += 1
        if skill_files == 0:
            raise InstallError(f"packaged skill is empty: {skill_name}")

    coordinator = skills_root / "agent-workflow"
    for required in (Path("scripts/workflow.py"), Path("references/runtime.md")):
        if not (coordinator / required).is_file():
            raise InstallError(f"incomplete coordinator package; missing {required.as_posix()}")

    agents = sorted(agents_root.glob("workflow-*.toml"))
    if len(agents) != EXPECTED_AGENT_COUNT:
        raise InstallError(
            f"expected {EXPECTED_AGENT_COUNT} workflow agent files, found {len(agents)}"
        )
    for path in agents:
        if _is_reparse(path) or not path.is_file():
            raise InstallError(f"unsafe packaged agent file: {path}")
        result[PurePosixPath("agents", path.name).as_posix()] = path.read_bytes()
    return result


def _manifest_path(target: Path) -> Path:
    return target / "workflow-installations" / PACKAGE_NAME / "manifest.json"


def _load_manifest(target: Path) -> tuple[dict[str, OwnedFile], bytes | None]:
    path = _manifest_path(target)
    if not _lexists(path):
        return {}, None
    _assert_safe_components(path, target)
    if not path.is_file():
        raise InstallError(f"manifest is not a regular file: {path}")
    raw = path.read_bytes()
    try:
        document = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise InstallError(f"invalid installer manifest: {path}") from exc
    if not isinstance(document, dict):
        raise InstallError(f"invalid installer manifest: {path}")
    if document.get("schema_version") != SCHEMA_VERSION:
        raise InstallError("unsupported installer manifest schema")
    if document.get("package") != PACKAGE_NAME or not isinstance(document.get("files"), list):
        raise InstallError("manifest does not belong to agent-workflow")

    owned: dict[str, OwnedFile] = {}
    for item in document["files"]:
        if not isinstance(item, dict):
            raise InstallError("invalid manifest file entry")
        relative = item.get("path")
        digest = item.get("sha256")
        backup = item.get("backup")
        if not isinstance(relative, str) or not isinstance(digest, str):
            raise InstallError("invalid manifest file entry")
        _validate_relative(relative)
        if relative in owned:
            raise InstallError(f"duplicate manifest path: {relative}")
        if backup is not None and not isinstance(backup, dict):
            raise InstallError(f"invalid backup metadata for {relative}")
        owned[relative] = OwnedFile(relative, digest, backup)
    return owned, raw


def _manifest_bytes(files: list[OwnedFile]) -> bytes:
    entries: list[dict[str, object]] = []
    for item in sorted(files, key=lambda entry: entry.relative_path):
        entry: dict[str, object] = {"path": item.relative_path, "sha256": item.sha256}
        if item.backup is not None:
            entry["backup"] = item.backup
        entries.append(entry)
    document = {
        "schema_version": SCHEMA_VERSION,
        "package": PACKAGE_NAME,
        "files": entries,
    }
    return (json.dumps(document, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _validate_target_scopes(target: Path, relative_paths: set[str]) -> None:
    target = _absolute(target)
    for scope in (target, target / "skills", target / "agents", target / "workflow-installations"):
        _assert_safe_components(scope, target)
        if _lexists(scope) and not scope.is_dir():
            raise InstallError(f"expected directory, found another file type: {scope}")
    for relative in relative_paths:
        destination = _destination(target, relative)
        _assert_safe_components(destination, target)


def _read_owned_file(path: Path, expected_hash: str) -> bytes:
    if not _lexists(path):
        raise InstallError(f"owned file is missing; refusing to overwrite user state: {path}")
    if _is_reparse(path) or not path.is_file():
        raise InstallError(f"owned path is no longer a regular file: {path}")
    data = path.read_bytes()
    if _sha256(data) != expected_hash:
        raise InstallError(f"owned file was modified; refusing partial update: {path}")
    return data


def _plan_install(source_root: Path, target: Path) -> Plan:
    sources = _collect_sources(source_root)
    owned, previous_manifest = _load_manifest(target)
    all_paths = set(sources) | set(owned)
    _validate_target_scopes(target, all_paths)

    if previous_manifest is None:
        registry = _manifest_path(target).parent
        if _lexists(registry):
            raise InstallError(f"unmanaged installer state already exists: {registry}")
        for skill_name in SKILL_NAMES:
            destination = target / "skills" / skill_name
            if _lexists(destination):
                raise InstallError(f"unmanaged skill collision: {destination}")
        for relative in sources:
            if relative.startswith("agents/") and _lexists(_destination(target, relative)):
                raise InstallError(f"unmanaged agent collision: {_destination(target, relative)}")

    writes: dict[str, bytes] = {}
    removes: list[str] = []
    records: list[OwnedFile] = []
    messages: list[str] = []

    for relative, content in sorted(sources.items()):
        destination = _destination(target, relative)
        old = owned.get(relative)
        backup = None
        if old is None:
            if _lexists(destination):
                raise InstallError(f"unmanaged file collision: {destination}")
            writes[relative] = content
            messages.append(f"install {relative}")
        else:
            current = _read_owned_file(destination, old.sha256)
            backup = old.backup
            if current != content:
                backup = {
                    "sha256": _sha256(current),
                    "bytes_b64": base64.b64encode(current).decode("ascii"),
                }
                writes[relative] = content
                messages.append(f"update {relative}")
        records.append(OwnedFile(relative, _sha256(content), backup))

    for relative, old in sorted(owned.items()):
        if relative in sources:
            continue
        destination = _destination(target, relative)
        _read_owned_file(destination, old.sha256)
        removes.append(relative)
        messages.append(f"remove obsolete {relative}")

    new_manifest = _manifest_bytes(records)
    if new_manifest != previous_manifest:
        messages.append("write installation manifest")
        manifest_bytes: bytes | None = new_manifest
    else:
        manifest_bytes = None
    if not messages:
        messages.append("already up to date")
    return Plan(writes, removes, manifest_bytes, False, messages)


def _plan_uninstall(target: Path) -> Plan:
    owned, previous_manifest = _load_manifest(target)
    if previous_manifest is None:
        return Plan({}, [], None, False, ["not installed"])
    _validate_target_scopes(target, set(owned))
    removes: list[str] = []
    for relative, item in sorted(owned.items()):
        destination = _destination(target, relative)
        if not _lexists(destination):
            continue
        _read_owned_file(destination, item.sha256)
        removes.append(relative)
    messages = [f"remove {relative}" for relative in removes]
    messages.append("remove installation manifest")
    return Plan({}, removes, None, True, messages)


def _mkdir_tracked(path: Path, target: Path, created: list[Path]) -> None:
    missing: list[Path] = []
    current = path
    while not _lexists(current):
        missing.append(current)
        if current == target:
            break
        current = current.parent
    _assert_safe_components(current, target)
    if _lexists(current) and not current.is_dir():
        raise InstallError(f"cannot create directory below non-directory: {current}")
    for directory in reversed(missing):
        try:
            directory.mkdir()
        except FileExistsError:
            _assert_safe_components(directory, target)
            if not directory.is_dir():
                raise InstallError(f"cannot create directory: {directory}")
        else:
            created.append(directory)


def _atomic_write(path: Path, data: bytes) -> None:
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    descriptor = -1
    try:
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "wb") as stream:
            descriptor = -1
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        if _lexists(temporary):
            temporary.unlink()


def _cleanup_empty(directories: list[Path]) -> None:
    for directory in sorted(set(directories), key=lambda item: len(item.parts), reverse=True):
        try:
            directory.rmdir()
        except (FileNotFoundError, OSError):
            pass


@contextmanager
def _lock(target: Path) -> Iterator[None]:
    created: list[Path] = []
    registry = target / "workflow-installations"
    _mkdir_tracked(registry, target, created)
    lock_path = registry / f"{PACKAGE_NAME}.lock"
    try:
        descriptor = os.open(lock_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        _cleanup_empty(created)
        raise InstallError(
            f"another installer is active (or left a stale lock): {lock_path}"
        ) from exc
    try:
        with os.fdopen(descriptor, "w", encoding="ascii") as stream:
            stream.write(f"pid={os.getpid()}\n")
        yield
    finally:
        try:
            lock_path.unlink()
        except FileNotFoundError:
            pass
        _cleanup_empty(created)


def _apply(plan: Plan, target: Path) -> None:
    created_dirs: list[Path] = []
    before: dict[Path, bytes | None] = {}
    manifest = _manifest_path(target)

    try:
        for relative, content in plan.writes.items():
            destination = _destination(target, relative)
            _mkdir_tracked(destination.parent, target, created_dirs)
            before[destination] = destination.read_bytes() if _lexists(destination) else None
            _atomic_write(destination, content)
        for relative in plan.removes:
            destination = _destination(target, relative)
            if not _lexists(destination):
                continue
            before[destination] = destination.read_bytes()
            destination.unlink()
        if plan.manifest_bytes is not None:
            _mkdir_tracked(manifest.parent, target, created_dirs)
            before[manifest] = manifest.read_bytes() if _lexists(manifest) else None
            _atomic_write(manifest, plan.manifest_bytes)
        elif plan.remove_manifest:
            before[manifest] = manifest.read_bytes()
            manifest.unlink()
    except Exception as exc:
        rollback_errors: list[str] = []
        for path, old_content in reversed(tuple(before.items())):
            try:
                if old_content is None:
                    if _lexists(path) and (path.is_file() or path.is_symlink()):
                        path.unlink()
                else:
                    _mkdir_tracked(path.parent, target, created_dirs)
                    _atomic_write(path, old_content)
            except Exception as rollback_exc:  # pragma: no cover - catastrophic filesystem failure
                rollback_errors.append(f"{path}: {rollback_exc}")
        _cleanup_empty(created_dirs)
        detail = f"; rollback failures: {'; '.join(rollback_errors)}" if rollback_errors else ""
        raise InstallError(f"installation failed and was rolled back: {exc}{detail}") from exc

    cleanup_candidates: list[Path] = []
    for relative in plan.removes:
        parent = _destination(target, relative).parent
        while parent not in (target, target / "skills", target / "agents"):
            cleanup_candidates.append(parent)
            parent = parent.parent
    if plan.remove_manifest:
        cleanup_candidates.extend([manifest.parent, manifest.parent.parent])
    _cleanup_empty(cleanup_candidates)


def run(
    *, source_root: Path, target: Path, dry_run: bool = False, uninstall: bool = False
) -> list[str]:
    """Plan and optionally apply an install/uninstall operation."""
    source_root = _absolute(source_root)
    target = _absolute(target)
    planner = (
        (lambda: _plan_uninstall(target))
        if uninstall
        else (lambda: _plan_install(source_root, target))
    )
    plan = planner()
    if dry_run or plan.messages in (["already up to date"], ["not installed"]):
        return plan.messages

    with _lock(target):
        # The lock closes the check/write race with another well-behaved installer.
        plan = planner()
        if plan.messages not in (["already up to date"], ["not installed"]):
            _apply(plan, target)
    return plan.messages


def _default_target() -> Path:
    configured = os.environ.get("CODEX_HOME")
    return Path(configured).expanduser() if configured else Path.home() / ".codex"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--target",
        type=Path,
        default=_default_target(),
        help="Codex home directory (default: CODEX_HOME or ~/.codex)",
    )
    parser.add_argument("--dry-run", action="store_true", help="show the plan without writing")
    parser.add_argument(
        "--uninstall", action="store_true", help="remove an unmodified installation"
    )
    arguments = parser.parse_args(argv)
    try:
        messages = run(
            source_root=Path(__file__).parent,
            target=arguments.target,
            dry_run=arguments.dry_run,
            uninstall=arguments.uninstall,
        )
    except InstallError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for message in messages:
        print(message)
    if arguments.dry_run:
        print("dry-run: no files changed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
