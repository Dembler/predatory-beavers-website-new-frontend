"""Regenerate the self-hosted WOFF2 fonts from their licensed TTF sources.

Install the optional build tool with: python -m pip install 'fonttools[woff]'
Then run: python scripts/optimize_fonts.py
The website itself needs no Python dependencies.
"""

from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    for name in ("oswald-variable", "roboto-variable"):
        source = ROOT / "assets" / "source-fonts" / f"{name}.ttf"
        target = ROOT / "public" / "fonts" / f"{name}.woff2"
        with TTFont(source, recalcTimestamp=False) as font:
            font.flavor = "woff2"
            font.save(target)
        print(f"{name}: {source.stat().st_size} -> {target.stat().st_size} bytes")


if __name__ == "__main__":
    main()
