#!/usr/bin/env python3
"""Generate compressed thumbnails for the item, people, organisation, quest
and correspondence card grids (assets/js/world.js, assets-list.js,
player-page.js), the same way generate-map-thumbnails.py does for maps.

Each record in data/*.json carries an `image` pointing at a full-size file
(often several MB) — fine for a detail page, far too slow to load dozens at
once in a card grid. This script derives a small "<name>-thumb.jpg" next to
each source image and records it as `thumbFile` on the matching record.

Only records that need one are processed — new images, ones whose thumb went
missing, or whose `thumbFile` is unset — so re-running after every data
export is cheap and idempotent. Pass --force to regenerate every thumbnail
(e.g. after changing THUMB_WIDTH/JPEG_QUALITY). CI runs this on every push
that touches data (see .github/workflows/map-thumbnails.yml); to run it
yourself:

    pip install Pillow
    python3 scripts/generate-image-thumbnails.py
"""

import glob
import json
import os
import sys

THUMB_WIDTH = 480
JPEG_QUALITY = 75

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")


def make_thumb(image_file):
    from PIL import Image

    src_path = os.path.join(DATA_DIR, image_file)
    folder, filename = os.path.split(src_path)
    base, _ext = os.path.splitext(filename)
    thumb_path = os.path.join(folder, base + "-thumb.jpg")

    with Image.open(src_path) as im:
        im = im.convert("RGBA")
        flat = Image.new("RGB", im.size, (255, 255, 255))
        flat.paste(im, mask=im.split()[3])
        if flat.width > THUMB_WIDTH:
            new_height = round(flat.height * THUMB_WIDTH / flat.width)
            flat = flat.resize((THUMB_WIDTH, new_height), Image.LANCZOS)
        flat.save(thumb_path, "JPEG", quality=JPEG_QUALITY, optimize=True)

    return os.path.relpath(thumb_path, DATA_DIR)


def main():
    force = "--force" in sys.argv[1:]

    try:
        import PIL  # noqa: F401
    except ImportError:
        sys.exit("Pillow is required: pip install Pillow")

    total = 0
    for path in sorted(glob.glob(os.path.join(DATA_DIR, "*.json"))):
        with open(path, encoding="utf-8") as f:
            table = json.load(f)
        if not isinstance(table, list):
            continue

        changed = False
        for record in table:
            image = isinstance(record, dict) and record.get("image")
            if not image or not os.path.exists(os.path.join(DATA_DIR, image)):
                continue
            thumb = record.get("thumbFile")
            if not force and thumb and os.path.exists(os.path.join(DATA_DIR, thumb)):
                continue
            record["thumbFile"] = make_thumb(image)
            changed = True
            total += 1

        if changed:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(table, f, indent=2, ensure_ascii=False)
                f.write("\n")

    print(f"Generated {total} thumbnail(s)." if total else "All images already have a thumbnail; nothing to do.")


if __name__ == "__main__":
    main()
