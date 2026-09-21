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
    const manifest = fetchJson("data/manifest.json");
    manifest.then(checkSchemaCompatibility);
    return manifest;
  }

  // The plugin and this site evolve independently — data-schema.json's own
  // compat.policy reserves the major version number for breaking changes
  // (a table/field removed, renamed, or retyped), so that's the only part
  // worth comparing here. A minor/patch difference is expected and fine: an
  // older export simply omits a newer optional field, an older site just
  // doesn't render one yet. This warns once per page load (console only —
  // there's no reason to interrupt a player with a DM/developer-facing
  // signal) and never blocks rendering either way.
  let compatibilityChecked = false;
  function checkSchemaCompatibility(manifest) {
    if (compatibilityChecked || !manifest || !manifest.schemaVersion) return;
    compatibilityChecked = true;

    fetchJson("data-schema.json").then(function (schema) {
      if (!schema || !schema.version) return;
      const manifestMajor = String(manifest.schemaVersion).split(".")[0];
      const schemaMajor = String(schema.version).split(".")[0];
      if (manifestMajor !== schemaMajor) {
        console.warn(
          "Obsidian Cast: data/manifest.json was built against schema v" + manifest.schemaVersion +
          ", but this site's data-schema.json is now v" + schema.version + " — a major-version difference " +
          "means tables or fields may have been removed, renamed, or retyped since that export. " +
          "Some pages may render incompletely until the vault is re-exported. See data-schema.json's compat.policy."
        );
      }
    });
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

  // Used whenever an entity has no `image` set in its exported record (see
  // data-schema.json's "images" convention) — the same generic art
  // character-data.js has long fallen back to for roster characters,
  // reused here for every entity table so any portrait-bearing UI (the
  // relationship graph included) always has something to draw.
  const PLACEHOLDER_IMAGE = "assets/img/characters/placeholder.png";

  // A single id -> {name, table, image} lookup across every table that has a
  // name, for resolving a link field (a relationship's object, a recipe
  // ingredient/output, a location's parentLocation, ...) without every
  // caller re-fetching and re-indexing the same six tables itself.
  let entityIndexPromise = null;
  function getEntityIndex() {
    if (!entityIndexPromise) {
      entityIndexPromise = Promise.all(NAMEABLE_TABLES.map(getTable)).then(function (tables) {
        const index = new Map();
        tables.forEach(function (records, i) {
          (records || []).forEach(function (record) {
            index.set(record.id, {
              name: record.name,
              table: NAMEABLE_TABLES[i],
              image: record.image ? "data/" + record.image : PLACEHOLDER_IMAGE,
            });
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

  // Every roster character shares one page, character.html, driven by
  // ?character=<slug>&section=<section> (see character-page.js's
  // initCharacterPageFromLocation) rather than a file per character — unlike
  // every other table, which resolves to world.html?table=&id=.
  function getEntityHref(id, index) {
    const entry = index.get(id);
    if (!entry) return undefined;
    if (entry.table === "characters") {
      const slug = entry.name.toLowerCase().replace(/\s+/g, "-");
      return { url: "character.html?character=" + slug + "&section=items", label: entry.name };
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
    PLACEHOLDER_IMAGE: PLACEHOLDER_IMAGE,
  };
})();
