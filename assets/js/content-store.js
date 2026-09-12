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

  const NAMEABLE_TABLES = ["characters", "npcs", "organisations", "locations", "items", "quests"];

  // A single id -> {name, table} lookup across every table that has a name,
  // for resolving a link field (a relationship's object, an item's crafting
  // ingredient, a location's parentLocation, ...) without every caller
  // re-fetching and re-indexing the same six tables itself.
  let entityIndexPromise = null;
  function getEntityIndex() {
    if (!entityIndexPromise) {
      entityIndexPromise = Promise.all(NAMEABLE_TABLES.map(getTable)).then(function (tables) {
        const index = new Map();
        tables.forEach(function (records, i) {
          (records || []).forEach(function (record) {
            index.set(record.id, { name: record.name, table: NAMEABLE_TABLES[i] });
          });
        });
        return index;
      });
    }
    return entityIndexPromise;
  }

  // Maps write one file per map (not an array like the entity tables) plus
  // data/maps/index.json ({id, imageFile} per map) — see Obsidian Cast's
  // maps-exporter.ts. manifest.tables.maps.path is the "data/maps" directory
  // itself, so these read the fixed filenames within it directly.
  function getMapIndex() {
    return fetchJson("data/maps/index.json");
  }

  function getMap(id) {
    return fetchJson("data/maps/" + id + ".json");
  }

  // characters live at characters/<slug>/items.html (slug = their name,
  // lowercased with spaces to hyphens — player.html's own convention), not at
  // world.html like every other table.
  function getEntityHref(id, index) {
    const entry = index.get(id);
    if (!entry) return undefined;
    if (entry.table === "characters") {
      const slug = entry.name.toLowerCase().replace(/\s+/g, "-");
      return { url: "characters/" + slug + "/items.html", label: entry.name };
    }
    return { url: "world.html?table=" + encodeURIComponent(entry.table) + "&id=" + encodeURIComponent(id), label: entry.name };
  }

  return {
    getManifest: getManifest,
    getTable: getTable,
    getBasesForSlug: getBasesForSlug,
    getEntityIndex: getEntityIndex,
    getMapIndex: getMapIndex,
    getMap: getMap,
    getEntityHref: getEntityHref,
  };
})();
