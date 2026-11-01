"""Create WebP copies of selected content artwork; originals are never modified.

Requires Pillow: python -m pip install Pillow
Run from any directory: python scripts/optimize_images.py
"""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageOps

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "public/images"
TARGETS = (
    ("team-community.jpg", 1920),
    ("team-men.jpg", 1440),
    ("team-women.jpg", 1440),
    ("brand/intro-claw-single.png", None),
    ("brand/intro-scratch-clean.png", None),
    ("brand/club-emblem.png", None),
)


def optimize() -> list[dict[str, object]]:
    manifest: list[dict[str, object]] = []
    for relative_path, max_width in TARGETS:
        source = IMAGES / relative_path
        target = source.with_suffix(".webp")
        source_checksum = hashlib.sha256(source.read_bytes()).hexdigest()
        with Image.open(source) as original:
            image = ImageOps.exif_transpose(original)
            alpha = "A" in image.getbands()
            image = image.convert("RGBA" if alpha else "RGB")
            if max_width and image.width > max_width:
                height = round(image.height * max_width / image.width)
                image = image.resize((max_width, height), Image.Resampling.LANCZOS)
            # WebP's alpha plane remains lossless; RGB is encoded at quality 88.
            image.save(target, format="WEBP", quality=88, method=6, exact=True)
            expected_size = image.size
            original_alpha = image.getchannel("A") if alpha else None
        with Image.open(target) as encoded:
            assert encoded.size == expected_size
            if alpha:
                assert "A" in encoded.getbands()
                assert (
                    ImageChops.difference(encoded.getchannel("A"), original_alpha).getbbox() is None
                )
        assert hashlib.sha256(source.read_bytes()).hexdigest() == source_checksum
        source_bytes = source.stat().st_size
        output_bytes = target.stat().st_size
        record: dict[str, object] = {
            "source": "/images/" + relative_path,
            "output": "/images/" + target.relative_to(IMAGES).as_posix(),
            "width": expected_size[0],
            "height": expected_size[1],
            "alpha": alpha,
            "sourceBytes": source_bytes,
            "outputBytes": output_bytes,
            "savedPercent": round(100 * (1 - output_bytes / source_bytes), 1),
            "sourceSha256": source_checksum,
        }
        manifest.append(record)
        print(
            f"{record['output']}: {source_bytes:,} -> {output_bytes:,} bytes "
            f"({record['savedPercent']}% smaller)"
        )
    (IMAGES / "optimized-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest


if __name__ == "__main__":
    optimize()
