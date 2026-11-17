public facing side of the Aleucia TTRPG world.

## Testing

```
npm install
npm test
```

Runs on Node + [Vitest](https://vitest.dev) (jsdom environment). The suite covers:

- `tests/unit/` — the pure logic in `assets/js/*.js` (auth/session handling, the
  auth guard, the content-store cache, character-data helpers, world.js
  helpers, the relationship graph, the player nav menu). These scripts are
  loaded exactly as a `<script>` tag would, so no source changes were needed
  to test them.
- `tests/data/` — validates `data/*.json` against `data-schema.json`'s field
  list, and cross-checks the exported data itself (relationship edges resolve
  to real entities, image paths resolve to real files, manifest counts match
  the data on disk, the `auth.js` roster matches `data/characters.json`).
- `tests/static/` — every protected page loads `assets/js/guard.js` first (see
  `SECURITY.md`), and every internal link/asset reference across the site
  resolves to a real file.

CI runs this on every push and pull request via `.github/workflows/test.yml`.

## Map thumbnails

`data/maps/index.json`'s `imageFile` entries are the full-resolution map
exports (several MB each), which is too slow for the location and assets-list
card grids to load a dozen of at once. `scripts/generate-map-thumbnails.py`
derives a compressed `thumbFile` for each map that's missing one, or whose
source image changed (Cast's `imageHash` no longer matches the recorded
`thumbHash`).

`.github/workflows/map-thumbnails.yml` runs this automatically on every push
that touches `data/maps/index.json` or `data/assets/maps/**` (i.e. every data
re-export from the vault; Cast carries `thumbFile`/`thumbHash` forward for
maps whose image is unchanged, so only new or replaced images are redone) and
commits any new thumbnails back to
the branch — new maps get one without anyone having to remember to run the
script. `tests/data/data-integrity.test.js` fails if a map is ever missing
its `thumbFile`, which is the signal that workflow didn't run (e.g. a fork
PR, where the default `GITHUB_TOKEN` can't push back).

To run it yourself — required for a fork PR, or just to check before
pushing:

```
pip install Pillow
python3 scripts/generate-map-thumbnails.py
```

## Spell writing circles

Every spell gets a spell writing circle, drawn per the Gorilla of Destiny's
[Spell Writing Guide](https://www.drivethrurpg.com/en/product/429711/The-Spell-Writing-Guide)
and shown in the spell's expanded card on the Spell Book. `scripts/generate-spell-circles.py`
(standard library only, no pip packages) writes one SVG per spell in
`data/spells.json` to `assets/spell-circles/<spell-slug>.svg`, and removes
circles for spells that are gone. Damage type and area of effect aren't in
`spells.json`, so they are read from the rules text; each SVG's `<desc>` lists
the values used.

It is part of the build: `npm run build` runs it, and
`.github/workflows/spell-circles.yml` runs it on every push that touches
`data/spells.json` and commits the result (GitHub Pages only runs Jekyll, so
the circles are committed, like the map thumbnails). `npm test` fails if a
circle is missing, orphaned or stale — rerun `npm run build` to fix.

## Spell glyphs

The Spell Book can also show each spell as a spell glyph instead of its
writing circle: the "Notation" switch above the spell list flips every spell
between **Wizard** (the circle, the default) and **Glyph**, and the browser
remembers the choice. Glyphs are drawn in the page by
`assets/js/spell-glyph.js`, so there is nothing to build or commit. The
spell's level picks the ornament, the three inner circles hold its school,
save and effect, and the outer ring carries components, area, duration,
range, target and casting time.

`spells.json` has no save, effect or target, so those (and the area) are read
from the rules text; the glyph's `<desc>` lists the values used. When the
rules text misleads the reader, add a correction for that spell to
`GLYPH_OVERRIDES` in `spell-glyph.js`.

## Cache busting

GitHub Pages (and browsers) cache `assets/css/style.css` and the page
scripts, so a page can load new HTML/JS alongside a stale stylesheet and
render broken. Every page links the stylesheet as `style.css?v=N` — bump
`N` in all `*.html` files whenever a change adds or renames CSS classes
that new markup depends on.

## Recipe books

`books.html` is the library of recipe books, and `books.html?book=<id>`
lays one out as a handwritten book ready to print: a cover with the book's
sketch, a foreword and contents page, one page per recipe (its sketch,
description, what it makes, what you need, the method and the author's
margin note) and a closing page. "Print this book" waits for the fonts and
sketches, then opens the print dialog; the paper size (A5, A4 or US Letter)
is picked above the book and remembered. "Save as PDF" in that dialog keeps
a copy.

The handwriting is a script typeface (each book uses one of three "hands",
picked from its author so a scribe always writes the same way), lines set a
little off true, and rules, underlines and frames drawn as wobbly SVG ink
strokes. Everything is seeded from the book, so it looks the same every time.
The code is `assets/js/books.js` and `assets/css/books.css`.

Everything a book needs is in `data/books.json` (data-schema.json's `books`
table): Obsidian Cast embeds every recipe in full, ingredients by name, and
copies each sketch under `data/assets/`. The sketches themselves are drawn in
the vault by `scripts/generate_sketches.py`. A recipe book's page in the Item
Catalog links to its printable copy.
