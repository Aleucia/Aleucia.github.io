#!/usr/bin/env python3
"""Generate compressed map thumbnails used by the location and assets-list
card grids (assets/js/world.js, assets/js/assets-list.js).

data/maps/index.json's imageFile entries point at the full-resolution map
exports (often several MB each) — fine for the single-map viewer, far too
slow to load a dozen at once in a card grid. This script derives a small
"<name>-thumb.jpg" next to each source image and records it as `thumbFile`
on the matching index.json entry.

Only maps missing a thumbFile (new maps, or ones whose thumb went missing)
are processed, so re-running this after every data export is cheap and
idempotent — pass --force to regenerate every thumbnail anyway (e.g. after
changing THUMB_WIDTH/JPEG_QUALITY). CI runs this on every push that touches
map data (see .github/workflows/map-thumbnails.yml); to run it yourself:

    pip install Pillow
    python3 scripts/generate-map-thumbnails.py
"""

import json
import os
import sys

THUMB_WIDTH = 800
JPEG_QUALITY = 72

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX_PATH = os.path.join(REPO_ROOT, "data", "maps", "index.json")


def make_thumb(image_file):
    src_path = os.path.join(REPO_ROOT, "data", image_file)
    folder, filename = os.path.split(src_path)
    base, _ext = os.path.splitext(filename)
    thumb_path = os.path.join(folder, base + "-thumb.jpg")

    from PIL import Image

    with Image.open(src_path) as im:
        im = im.convert("RGB")
        width, height = im.size
        if width > THUMB_WIDTH:
            new_height = round(height * THUMB_WIDTH / width)
            im = im.resize((THUMB_WIDTH, new_height), Image.LANCZOS)
        im.save(thumb_path, "JPEG", quality=JPEG_QUALITY, optimize=True)

    return os.path.relpath(thumb_path, os.path.join(REPO_ROOT, "data"))


def main():
    force = "--force" in sys.argv[1:]

    try:
        import PIL  # noqa: F401
    except ImportError:
        sys.exit("Pillow is required: pip install Pillow")

    with open(INDEX_PATH) as f:
        index = json.load(f)

    changed = False
    for entry in index:
        thumb_path = entry.get("thumbFile") and os.path.join(REPO_ROOT, "data", entry["thumbFile"])
        if not force and thumb_path and os.path.exists(thumb_path):
            continue

        thumb_rel = make_thumb(entry["imageFile"])
        entry["thumbFile"] = thumb_rel
        changed = True
        print(f"{entry['imageFile']} -> {thumb_rel}")

    if not changed:
        print("All maps already have a thumbnail; nothing to do.")
        return

    with open(INDEX_PATH, "w") as f:
        json.dump(index, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
