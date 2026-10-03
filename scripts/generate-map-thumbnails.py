#!/usr/bin/env python3
"""Generate compressed thumbnails for the card grids (assets/js/world.js,
assets-list.js, player-page.js, ...).

Two kinds of source are covered:

* Maps: data/maps/index.json entries (`imageFile`). The full-resolution
  exports are often several MB each — fine for the single-map viewer, far too
  slow to load a dozen at once in a card grid.
* Records: every entry in the data/*.json tables with an `image` (items,
  people, organisations, quests, correspondence, ...).

For each, this derives a small "<name>-thumb.jpg" next to the source image and
records it as `thumbFile` on the matching entry. Every entry also carries an
`imageHash` (fingerprint of the source image) and the script records it as
`thumbHash` beside `thumbFile`; a thumb is stale when the two differ. Cast
supplies `imageHash` on map entries; where an entry has none, the script
computes one from the image's bytes and adds it.

Only entries that need a thumb are processed — new ones, ones whose thumb went
missing, and ones whose source image changed since the thumb was built — so
re-running this after every data export is cheap and idempotent. Pass --force
to regenerate every thumbnail anyway (e.g. after changing the widths or
JPEG_QUALITY below). CI runs this on every push that touches data (see
.github/workflows/map-thumbnails.yml); to run it yourself:

    pip install Pillow
    python3 scripts/generate-map-thumbnails.py
"""

import glob
import hashlib
import json
import os
import sys

MAP_THUMB_WIDTH = 800
RECORD_THUMB_WIDTH = 480
JPEG_QUALITY = 72

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")
INDEX_PATH = os.path.join(DATA_DIR, "maps", "index.json")


def file_hash(image_file):
    with open(os.path.join(DATA_DIR, image_file), "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]


def make_thumb(image_file, width):
    src_path = os.path.join(DATA_DIR, image_file)
    folder, filename = os.path.split(src_path)
    base, _ext = os.path.splitext(filename)
    thumb_path = os.path.join(folder, base + "-thumb.jpg")

    from PIL import Image

    with Image.open(src_path) as im:
        # Flatten transparency onto white so PNGs with alpha don't go black.
        im = im.convert("RGBA")
        flat = Image.new("RGB", im.size, (255, 255, 255))
        flat.paste(im, mask=im.split()[3])
        if flat.width > width:
            new_height = round(flat.height * width / flat.width)
            flat = flat.resize((width, new_height), Image.LANCZOS)
        flat.save(thumb_path, "JPEG", quality=JPEG_QUALITY, optimize=True)

    return os.path.relpath(thumb_path, DATA_DIR)


def refresh(entry, image_file, width, force):
    """Ensure `entry` has a current thumb; return True if the entry changed."""
    if not os.path.exists(os.path.join(DATA_DIR, image_file)):
        return False

    changed = False
    image_hash = entry.get("imageHash")
    if not image_hash:
        image_hash = entry["imageHash"] = file_hash(image_file)
        changed = True

    thumb = entry.get("thumbFile")
    current = (
        bool(thumb)
        and os.path.exists(os.path.join(DATA_DIR, thumb))
        and entry.get("thumbHash") == image_hash
    )
    if force or not current:
        entry["thumbFile"] = make_thumb(image_file, width)
        entry["thumbHash"] = image_hash
        print(f"{image_file} -> {entry['thumbFile']}")
        changed = True
    return changed


def update_table(path, image_key, width, force):
    with open(path, encoding="utf-8") as f:
        table = json.load(f)
    if not isinstance(table, list):
        return False

    changed = False
    for entry in table:
        image_file = isinstance(entry, dict) and entry.get(image_key)
        if image_file and refresh(entry, image_file, width, force):
            changed = True

    if changed:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(table, f, indent=2, ensure_ascii=False)
            f.write("\n")
    return changed


def main():
    force = "--force" in sys.argv[1:]

    try:
        import PIL  # noqa: F401
    except ImportError:
        sys.exit("Pillow is required: pip install Pillow")

    changed = update_table(INDEX_PATH, "imageFile", MAP_THUMB_WIDTH, force)
    for path in sorted(glob.glob(os.path.join(DATA_DIR, "*.json"))):
        changed |= update_table(path, "image", RECORD_THUMB_WIDTH, force)

    if not changed:
        print("All images already have a current thumbnail; nothing to do.")


if __name__ == "__main__":
    main()
