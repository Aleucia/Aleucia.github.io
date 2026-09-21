#!/usr/bin/env python3
"""Regenerate compressed map thumbnails used by the location and maps-list
card grids (assets/js/world.js, assets/js/maps-list.js).

data/maps/index.json's imageFile entries point at the full-resolution map
exports (often several MB each) — fine for the single-map viewer, far too
slow to load a dozen at once in a card grid. This script derives a small
"<name>-thumb.jpg" next to each source image and records it as `thumbFile`
on the matching index.json entry.

Run this after every data re-export from the vault (data/maps/index.json is
overwritten wholesale by that export and won't carry `thumbFile` forward):

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


def main():
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Pillow is required: pip install Pillow")

    with open(INDEX_PATH) as f:
        index = json.load(f)

    for entry in index:
        image_file = entry["imageFile"]
        src_path = os.path.join(REPO_ROOT, "data", image_file)
        folder, filename = os.path.split(src_path)
        base, _ext = os.path.splitext(filename)
        thumb_path = os.path.join(folder, base + "-thumb.jpg")

        with Image.open(src_path) as im:
            im = im.convert("RGB")
            width, height = im.size
            if width > THUMB_WIDTH:
                new_height = round(height * THUMB_WIDTH / width)
                im = im.resize((THUMB_WIDTH, new_height), Image.LANCZOS)
            im.save(thumb_path, "JPEG", quality=JPEG_QUALITY, optimize=True)

        entry["thumbFile"] = os.path.relpath(thumb_path, os.path.join(REPO_ROOT, "data"))
        print(f"{image_file} -> {entry['thumbFile']}")

    with open(INDEX_PATH, "w") as f:
        json.dump(index, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
