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

## Cache busting

GitHub Pages (and browsers) cache `assets/css/style.css` and the page
scripts, so a page can load new HTML/JS alongside a stale stylesheet and
render broken. Every page links the stylesheet as `style.css?v=N` — bump
`N` in all `*.html` files whenever a change adds or renames CSS classes
that new markup depends on.
