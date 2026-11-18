from __future__ import annotations

import importlib.util
import json
import os
import shutil
import sys
import uuid
from pathlib import Path

import pytest

INSTALLER_PATH = Path(__file__).parents[1] / "install.py"
SPEC = importlib.util.spec_from_file_location("workflow_installer", INSTALLER_PATH)
assert SPEC is not None and SPEC.loader is not None
installer = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = installer
SPEC.loader.exec_module(installer)


@pytest.fixture
def work_path() -> Path:
    root = Path(__file__).parents[1] / ".test-runs"
    root.mkdir(exist_ok=True)
    path = root / uuid.uuid4().hex
    path.mkdir()
    try:
        yield path
    finally:
        shutil.rmtree(path)
        try:
            root.rmdir()
        except OSError:
            pass


def make_source(work_path: Path) -> Path:
    source = work_path / "bundle"
    for skill_name in installer.SKILL_NAMES:
        skill = source / "skills" / skill_name
        skill.mkdir(parents=True)
        (skill / "SKILL.md").write_text(f"# {skill_name}\n", encoding="utf-8")
    coordinator = source / "skills" / "agent-workflow"
    (coordinator / "scripts").mkdir()
    (coordinator / "scripts" / "workflow.py").write_text("# runtime\n", encoding="utf-8")
    (coordinator / "references").mkdir()
    (coordinator / "references" / "runtime.md").write_text("# runtime\n", encoding="utf-8")
    agents = (
        "workflow-coordinator",
        "workflow-grill-with-docs",
        "workflow-to-spec",
        "workflow-to-tickets",
        "workflow-implementer",
        "workflow-code-reviewer",
    )
    agents_root = source / "agents"
    agents_root.mkdir()
    for name in agents:
        (agents_root / f"{name}.toml").write_text(
            f'name = "{name}"\ndescription = "test"\ndeveloper_instructions = "test"\n',
            encoding="utf-8",
        )
    return source


def manifest_path(target: Path) -> Path:
    return target / "workflow-installations" / "agent-workflow" / "manifest.json"


def tree_snapshot(root: Path) -> dict[str, bytes]:
    if not root.exists():
        return {}
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file()
    }


def test_fresh_install_and_idempotent_repeat(work_path: Path) -> None:
    source = make_source(work_path)
    target = work_path / "codex-home"

    messages = installer.run(source_root=source, target=target)

    assert "write installation manifest" in messages
    assert (target / "skills" / "agent-workflow" / "SKILL.md").is_file()
    assert (target / "agents" / "workflow-coordinator.toml").is_file()
    document = json.loads(manifest_path(target).read_text(encoding="utf-8"))
    assert document["package"] == "agent-workflow"
    assert len(document["files"]) == 14
    first_snapshot = tree_snapshot(target)

    assert installer.run(source_root=source, target=target) == ["already up to date"]
    assert tree_snapshot(target) == first_snapshot


@pytest.mark.parametrize(
    "collision",
    [
        Path("skills/agent-workflow/SKILL.md"),
        Path("agents/workflow-coordinator.toml"),
    ],
)
def test_first_install_refuses_unknown_collision(work_path: Path, collision: Path) -> None:
    source = make_source(work_path)
    target = work_path / "codex-home"
    existing = target / collision
    existing.parent.mkdir(parents=True)
    existing.write_text("user content", encoding="utf-8")
    before = tree_snapshot(target)

    with pytest.raises(installer.InstallError, match="collision"):
        installer.run(source_root=source, target=target)

    assert tree_snapshot(target) == before


def test_modified_owned_file_blocks_entire_update(work_path: Path) -> None:
    source = make_source(work_path)
    target = work_path / "codex-home"
    installer.run(source_root=source, target=target)
    edited = target / "skills" / "to-spec" / "SKILL.md"
    edited.write_text("user edit", encoding="utf-8")
    (source / "skills" / "agent-workflow" / "SKILL.md").write_text(
        "# package update\n", encoding="utf-8"
    )
    before = tree_snapshot(target)

    with pytest.raises(installer.InstallError, match="modified"):
        installer.run(source_root=source, target=target)

    assert tree_snapshot(target) == before


def test_dry_run_does_not_create_target(work_path: Path) -> None:
    source = make_source(work_path)
    target = work_path / "never-created"

    messages = installer.run(source_root=source, target=target, dry_run=True)

    assert any(message.startswith("install ") for message in messages)
    assert not target.exists()


@pytest.mark.parametrize(
    "malicious_path",
    [
        "skills/agent-workflow/..\\..\\config.toml",
        "skills/agent-workflow/C:config.toml",
        "skills/agent-workflow/../../../config.toml",
    ],
)
def test_corrupt_manifest_cannot_reach_configuration(work_path: Path, malicious_path: str) -> None:
    source = make_source(work_path)
    target = work_path / "codex-home"
    installer.run(source_root=source, target=target)
    config = target / "config.toml"
    config.write_text("preserve configuration", encoding="utf-8")
    document = json.loads(manifest_path(target).read_text(encoding="utf-8"))
    document["files"][0]["path"] = malicious_path
    manifest_path(target).write_text(json.dumps(document), encoding="utf-8")
    before = tree_snapshot(target)
    with pytest.raises(installer.InstallError, match="unsafe"):
        installer.run(source_root=source, target=target, uninstall=True)
    assert tree_snapshot(target) == before


def test_update_keeps_user_files_and_records_replaced_bytes(work_path: Path) -> None:
    source = make_source(work_path)
    target = work_path / "codex-home"
    installer.run(source_root=source, target=target)
    installed = target / "skills" / "to-tickets" / "SKILL.md"
    original = installed.read_bytes()
    user_file = target / "skills" / "to-tickets" / "notes.txt"
    user_file.write_text("keep me", encoding="utf-8")
    (source / "skills" / "to-tickets" / "SKILL.md").write_text(
        "# to-tickets v2\n", encoding="utf-8"
    )

    installer.run(source_root=source, target=target)

    assert installed.read_text(encoding="utf-8") == "# to-tickets v2\n"
    assert user_file.read_text(encoding="utf-8") == "keep me"
    document = json.loads(manifest_path(target).read_text(encoding="utf-8"))
    record = next(
        item for item in document["files"] if item["path"].endswith("to-tickets/SKILL.md")
    )
    assert record["backup"]["bytes_b64"] == installer.base64.b64encode(original).decode("ascii")


def test_update_adds_and_removes_only_owned_files(work_path: Path) -> None:
    source = make_source(work_path)
    target = work_path / "codex-home"
    obsolete_source = source / "skills" / "implement" / "old.txt"
    obsolete_source.write_text("old package file", encoding="utf-8")
    installer.run(source_root=source, target=target)
    obsolete_target = target / "skills" / "implement" / "old.txt"
    user_file = target / "skills" / "implement" / "user.txt"
    user_file.write_text("user", encoding="utf-8")
    obsolete_source.unlink()
    (source / "skills" / "implement" / "new.txt").write_text("new", encoding="utf-8")

    installer.run(source_root=source, target=target)

    assert not obsolete_target.exists()
    assert (target / "skills" / "implement" / "new.txt").read_text(encoding="utf-8") == "new"
    assert user_file.read_text(encoding="utf-8") == "user"


def test_symlink_traversal_is_rejected(work_path: Path) -> None:
    source = make_source(work_path)
    target = work_path / "codex-home"
    target.mkdir()
    outside = work_path / "outside"
    outside.mkdir()
    try:
        os.symlink(outside, target / "skills", target_is_directory=True)
    except (OSError, NotImplementedError) as exc:
        pytest.skip(f"symlink creation unavailable: {exc}")

    with pytest.raises(installer.InstallError, match="reparse point or symlink"):
        installer.run(source_root=source, target=target)

    assert tree_snapshot(outside) == {}


def test_caught_write_failure_rolls_back(work_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    source = make_source(work_path)
    target = work_path / "codex-home"
    real_atomic_write = installer._atomic_write
    calls = 0

    def fail_once(path: Path, data: bytes) -> None:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("injected failure")
        real_atomic_write(path, data)

    monkeypatch.setattr(installer, "_atomic_write", fail_once)

    with pytest.raises(installer.InstallError, match="rolled back"):
        installer.run(source_root=source, target=target)

    assert tree_snapshot(target) == {}


def test_uninstall_refuses_changes_then_removes_owned_files(work_path: Path) -> None:
    source = make_source(work_path)
    target = work_path / "codex-home"
    installer.run(source_root=source, target=target)
    changed = target / "agents" / "workflow-implementer.toml"
    changed.write_text("user edit", encoding="utf-8")
    before = tree_snapshot(target)

    with pytest.raises(installer.InstallError, match="modified"):
        installer.run(source_root=source, target=target, uninstall=True)
    assert tree_snapshot(target) == before

    changed.write_bytes((source / "agents" / "workflow-implementer.toml").read_bytes())
    user_file = target / "skills" / "implement" / "user.txt"
    user_file.write_text("keep", encoding="utf-8")
    installer.run(source_root=source, target=target, uninstall=True)

    assert user_file.read_text(encoding="utf-8") == "keep"
    assert not manifest_path(target).exists()
    assert not (target / "agents" / "workflow-implementer.toml").exists()
