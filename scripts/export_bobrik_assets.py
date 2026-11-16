"""Export the unified, supplied Bobrik cutouts for the existing web sprite player.

Requires Pillow. Originals are read only; motion uses whole-character transforms.
Run: python scripts/export_bobrik_assets.py --master path/to/idle.png --ball path/to/ball.png
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageOps

ROOT = Path(__file__).resolve().parents[1]
FRAME = (192, 208)
COLUMNS = 8
ROWS = 9
ATLAS_LIMIT = 1024 * 1024
LAUNCHER_LIMIT = 80 * 1024

# The names and frame counts retain the installed renderer's clip contract.
# They describe player states; these exports do not invent separate walking frames.
CLIPS = {
    "idle": {"row": 0, "durationsMs": [1680, 660, 660, 840, 840, 1920]},
    "running-right": {"row": 1, "durationsMs": [120] * 7 + [220]},
    "running-left": {"row": 2, "durationsMs": [120] * 7 + [220]},
    "waving": {"row": 3, "durationsMs": [140, 140, 140, 280]},
    "jumping": {"row": 4, "durationsMs": [140, 140, 140, 140, 280]},
    "failed": {"row": 5, "durationsMs": [140] * 7 + [240]},
    "waiting": {"row": 6, "durationsMs": [150] * 5 + [260]},
    "running": {"row": 7, "durationsMs": [120] * 5 + [220]},
    "review": {"row": 8, "durationsMs": [150] * 5 + [280]},
}


def checksum(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def load_pose(path: Path) -> tuple[Image.Image, dict[str, object]]:
    contents = path.read_bytes()
    with Image.open(io.BytesIO(contents)) as source:
        source = ImageOps.exif_transpose(source).convert("RGBA")
        alpha = source.getchannel("A")
        if alpha.getextrema() != (0, 255):
            raise ValueError(
                f"{path.name}: an opaque or empty background is not a cutout"
            )
        bounds = alpha.getbbox()
        if not bounds:
            raise ValueError(f"{path.name}: the pose is empty")
        image = source.copy()
    return image, {"file": path.name, "sha256": checksum(contents)}


def fit_pose(image: Image.Image, bounds: tuple[int, int, int, int]) -> Image.Image:
    cutout = image.crop(bounds)
    cutout.thumbnail((174, 190), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", FRAME)
    # Shared crop, scale and feet baseline keep both poses identically registered.
    frame.alpha_composite(cutout, ((FRAME[0] - cutout.width) // 2, 200 - cutout.height))
    return frame


def motion(
    frame: Image.Image, angle: float = 0, dx: int = 0, dy: int = 0
) -> Image.Image:
    moved = frame.rotate(angle, Image.Resampling.BICUBIC, expand=False)
    result = Image.new("RGBA", FRAME)
    result.alpha_composite(moved, (dx, dy))
    bounds = result.getchannel("A").getbbox()
    if (
        not bounds
        or min(bounds[:2]) < 2
        or bounds[2] > FRAME[0] - 2
        or bounds[3] > FRAME[1] - 2
    ):
        raise ValueError("A transformed pose clips the frame edge")
    return result


def frames(
    name: str, master: Image.Image, ball: Image.Image, count: int
) -> list[Image.Image]:
    if name == "idle":
        return [master.copy() for _ in range(count)]
    if name in {"running-right", "running-left", "running"}:
        sign = -1 if name == "running-left" else 1
        angles = [0, 1.8, 2.5, 1.2, 0, -1.2, -2.5, -1.8]
        shifts = [0, 1, 2, 1, 0, -1, -2, -1]
        return [
            motion(master, sign * angles[i], sign * shifts[i], -abs(shifts[i]))
            for i in range(count)
        ]
    if name == "waving":
        return [motion(master, angle) for angle in (0, -2, 2, 0)]
    if name == "jumping":
        return [motion(master, dy=dy) for dy in (0, -2, -5, -2, 0)]
    if name == "failed":
        return [
            motion(master, angle=angle, dy=dy)
            for angle, dy in (
                (0, 0),
                (-1, 1),
                (-2, 2),
                (-2, 2),
                (-1, 1),
                (0, 0),
                (0, 0),
                (0, 0),
            )
        ]
    # The ball is an alternate supplied pose with the same canonical body/face/uniform.
    return [motion(ball, angle=angle) for angle in (0, -0.6, -0.6, 0, 0.6, 0.6)]


def export(master_path: Path, ball_path: Path, output: Path) -> None:
    master, master_source = load_pose(master_path)
    ball, ball_source = load_pose(ball_path)
    if master.size != ball.size:
        raise ValueError("The master poses must share a canvas size for registration")
    master_bounds = master.getchannel("A").getbbox()
    ball_bounds = ball.getchannel("A").getbbox()
    assert master_bounds and ball_bounds
    common_bounds = (
        min(master_bounds[0], ball_bounds[0]),
        min(master_bounds[1], ball_bounds[1]),
        max(master_bounds[2], ball_bounds[2]),
        max(master_bounds[3], ball_bounds[3]),
    )
    master = fit_pose(master, common_bounds)
    ball = fit_pose(ball, common_bounds)
    atlas = Image.new("RGBA", (FRAME[0] * COLUMNS, FRAME[1] * ROWS))
    clips: dict[str, dict[str, object]] = {}
    for name, specification in CLIPS.items():
        count = len(specification["durationsMs"])
        row = int(specification["row"])
        poses = frames(name, master, ball, count)
        for column in range(COLUMNS):
            atlas.alpha_composite(
                poses[min(column, count - 1)], (column * FRAME[0], row * FRAME[1])
            )
        clips[name] = {**specification, "frameCount": count}

    buffer = io.BytesIO()
    atlas.save(buffer, format="WEBP", lossless=True, method=6, exact=True)
    encoded_atlas = buffer.getvalue()
    quality: int | str = "lossless"
    for candidate in (92, 88, 84, 80, 76):
        if len(encoded_atlas) <= ATLAS_LIMIT:
            break
        buffer = io.BytesIO()
        atlas.save(buffer, format="WEBP", quality=candidate, method=6, exact=True)
        encoded_atlas = buffer.getvalue()
        quality = candidate
    if len(encoded_atlas) > ATLAS_LIMIT:
        raise ValueError("The atlas exceeds the 1 MiB budget")

    with Image.open(io.BytesIO(encoded_atlas)) as decoded:
        decoded = decoded.convert("RGBA")
        if ImageChops.difference(
            decoded.getchannel("A"), atlas.getchannel("A")
        ).getbbox():
            raise ValueError("WebP changed the alpha plane")
        # Encode the decoded atlas's idle frame losslessly: first-scroll composition,
        # color and alpha match the launcher exactly, including WebP RGB compression.
        launcher = decoded.crop((0, 0, *FRAME))
        buffer = io.BytesIO()
        launcher.save(buffer, format="WEBP", lossless=True, method=6, exact=True)
        encoded_launcher = buffer.getvalue()
    if len(encoded_launcher) > LAUNCHER_LIMIT:
        raise ValueError("The launcher exceeds the 80 KiB budget")
    with Image.open(io.BytesIO(encoded_launcher)) as decoded_launcher:
        if decoded_launcher.convert("RGBA").tobytes() != launcher.tobytes():
            raise ValueError("The launcher differs from atlas idle frame 0")

    manifest = {
        "schemaVersion": 1,
        "id": "bobrik",
        "displayName": "Бобрик",
        "origin": "User-supplied illustrations, unified by deterministic compositing; supplied pose transforms only",
        "sources": [master_source, ball_source],
        "spriteVersion": 1,
        "image": {
            "file": "spritesheet.webp",
            "width": atlas.width,
            "height": atlas.height,
            "frameWidth": FRAME[0],
            "frameHeight": FRAME[1],
            "columns": COLUMNS,
            "rows": ROWS,
            "sha256": checksum(encoded_atlas),
            "webpQuality": quality,
        },
        "launcher": {
            "file": "launcher.webp",
            "width": FRAME[0],
            "height": FRAME[1],
            "sha256": checksum(encoded_launcher),
            "matches": "decoded idle frame 0, pixel for pixel",
        },
        "defaultClip": "idle",
        "coordinateConvention": "zero-based row and column; x=column*frameWidth; y=row*frameHeight",
        "clips": clips,
        "notes": "Legacy clip names retain renderer compatibility. Scroll clips gently sway/tilt the entire pose; they do not depict a generated walking gait. Text is never mirrored. Launcher is static outside scrolling.",
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "spritesheet.webp").write_bytes(encoded_atlas)
    (output / "launcher.webp").write_bytes(encoded_launcher)
    (output / "animation.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Bobrik exported: atlas={len(encoded_atlas)} B, launcher={len(encoded_launcher)} B, quality={quality}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--master",
        type=Path,
        required=True,
        help="Transparent canonical idle/thumbs-up pose",
    )
    parser.add_argument(
        "--ball", type=Path, required=True, help="Transparent canonical ball pose"
    )
    parser.add_argument("--output", type=Path, default=ROOT / "public/mascot/bobrik")
    arguments = parser.parse_args()
    export(
        arguments.master.resolve(), arguments.ball.resolve(), arguments.output.resolve()
    )
