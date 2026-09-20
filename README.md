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
