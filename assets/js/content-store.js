/**
 * Aleucia Content Store
 *
 * Thin fetch + cache layer over data/*.json — the files Obsidian Cast writes
 * per data-schema.json / SCHEMA.md at the repo root. A character page needs
 * several tables at once, so results are cached per page load and shared
 * across every fetch of the same path.
 *
 * Every function resolves to `null` (never rejects) when a table isn't
 * available — the plugin export may not have been run against this repo yet,
 * and that's a normal state, not a bug, for every caller here.
 */

const ContentStore = (function () {
  const cache = new Map();

  function fetchJson(path) {
    if (!cache.has(path)) {
      cache.set(
        path,
        fetch(path, { cache: "no-store" })
          .then(function (res) { return res.ok ? res.json() : null; })
          .catch(function () { return null; })
      );
    }
    return cache.get(path);
  }

  function getManifest() {
    return fetchJson("data/manifest.json");
  }

  // Looks up an entity table's file by name via the manifest rather than
  // hardcoding paths here, so a table moving in data-schema.json doesn't
  // require a matching change on this side.
  function getTable(name) {
    return getManifest().then(function (manifest) {
      const entry = manifest && manifest.tables && manifest.tables[name];
      if (!entry || !entry.path) return null;
      const path = /\.json$/.test(entry.path) ? entry.path : entry.path + "/index.json";
      return fetchJson(path);
    });
  }

  // Bases output is one flat file per source note/base file, named by its id
  // with "/" flattened to "-" (see Obsidian Cast's bases-exporter.ts) — not
  // the nested per-view path data-schema.json's table description shows,
  // given how many inline blocks the vault actually has. slug is the owning
  // note's own id (e.g. a character record's `id`).
  function getBasesForSlug(slug) {
    return fetchJson("data/bases/" + slug.replace(/\//g, "-") + ".json");
  }

  return {
    getManifest: getManifest,
    getTable: getTable,
    getBasesForSlug: getBasesForSlug,
  };
})();
