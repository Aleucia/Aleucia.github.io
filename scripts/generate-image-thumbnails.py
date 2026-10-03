#!/usr/bin/env python3
"""Generate small "<name>-thumb.jpg" files next to every card image under
data/assets (people, items, organisations, quests, ...), which the card grids
load instead of the full-size originals (see thumbUrlFor in
assets/js/person-card.js). Existing thumbs newer than their source are kept,
so re-running is cheap. Map thumbnails are handled by
generate-map-thumbnails.py. Pass --force to rebuild everything.

    pip install Pillow
    python3 scripts/generate-image-thumbnails.py
"""

import os
import sys

THUMB_WIDTH = 480
JPEG_QUALITY = 75
EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif")

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(REPO_ROOT, "data", "assets")
SKIP_DIRS = {"maps"}


def main():
    from PIL import Image

    force = "--force" in sys.argv[1:]
    made = 0
    for root, dirs, files in os.walk(ASSETS_DIR):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            base, ext = os.path.splitext(name)
            if ext.lower() not in EXTS or base.endswith("-thumb"):
                continue
            src = os.path.join(root, name)
            dst = os.path.join(root, base + "-thumb.jpg")
            if not force and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                continue
            with Image.open(src) as im:
                im = im.convert("RGBA")
                bg = Image.new("RGB", im.size, (255, 255, 255))
                bg.paste(im, mask=im.split()[3])
                if bg.width > THUMB_WIDTH:
                    h = round(bg.height * THUMB_WIDTH / bg.width)
                    bg = bg.resize((THUMB_WIDTH, h), Image.LANCZOS)
                bg.save(dst, "JPEG", quality=JPEG_QUALITY, optimize=True)
            made += 1
    print("Generated %d thumbnail(s)." % made)


if __name__ == "__main__":
    main()
