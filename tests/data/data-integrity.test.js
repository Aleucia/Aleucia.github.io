import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadManifest, readJson, repoPath } from "../helpers/schema.js";
import { loadScript } from "../helpers/load-script.js";

const manifest = loadManifest();

function tableRecords(name) {
  const entry = manifest.tables[name];
  if (!entry || !entry.path.endsWith(".json")) return [];
  return readJson(entry.path);
}

// Every table with names that a relationship edge, connectedGroups, etc. can
// point at, per data-schema.json's conventions section.
const ENTITY_TABLES = ["characters", "npcs", "locations", "organisations", "items", "correspondence", "quests"];

function allKnownIds() {
  const ids = new Set();
  ENTITY_TABLES.forEach((name) => tableRecords(name).forEach((r) => ids.add(r.id)));
  return ids;
}

describe("relationships.json edges resolve to known entities", () => {
  const edges = tableRecords("relationships");
  const knownIds = allKnownIds();

  it.each(edges.map((e) => [e.id, e]))("%s", (_label, edge) => {
    expect(knownIds.has(edge.subject), `subject '${edge.subject}' is not a known entity id`).toBe(true);
    expect(knownIds.has(edge.object), `object '${edge.object}' is not a known entity id`).toBe(true);
  });

  it("uses a relationship type declared in relationship-types.json", () => {
    const typesFile = manifest.tables.relationshipTypes ? readJson(manifest.tables.relationshipTypes.path) : null;
    if (!typesFile) return;
    const knownTypes = new Set(Object.keys(typesFile.relationshipTypes || {}));
    edges.forEach((edge) => {
      expect(knownTypes.has(edge.type), `edge '${edge.id}' uses undeclared type '${edge.type}'`).toBe(true);
    });
  });
});

describe("image fields resolve to a real file under data/assets/", () => {
  ENTITY_TABLES.forEach((name) => {
    const records = tableRecords(name);
    records.forEach((record) => {
      if (!record.image) return;
      it(`${name}/${record.id}: image '${record.image}' exists`, () => {
        expect(existsSync(repoPath("data", record.image))).toBe(true);
      });
    });
  });
});

describe("maps index and per-map files stay in sync", () => {
  const mapsEntry = manifest.tables.maps;
  if (!mapsEntry) return;
  const index = readJson(mapsEntry.path + "/index.json");

  index.forEach(({ id, imageFile, thumbFile }) => {
    it(`map '${id}' has a data file and its image exists`, () => {
      expect(existsSync(repoPath(mapsEntry.path, `${id}.json`))).toBe(true);
      expect(existsSync(repoPath("data", imageFile))).toBe(true);
    });

    // Required, not optional: .github/workflows/map-thumbnails.yml commits a
    // thumbFile for every map automatically, so a missing one means that
    // workflow didn't run (e.g. a fork PR) rather than it being expected —
    // run scripts/generate-map-thumbnails.py locally to fix it.
    it(`map '${id}' has a thumbFile that exists`, () => {
      expect(thumbFile, `map '${id}' is missing thumbFile — run scripts/generate-map-thumbnails.py`).toBeTruthy();
      expect(existsSync(repoPath("data", thumbFile))).toBe(true);
    });
  });

  it("manifest's map count matches the index", () => {
    expect(index.length).toBe(mapsEntry.count);
  });
});

describe("data/manifest.json counts match the data actually on disk", () => {
  Object.entries(manifest.tables).forEach(([name, entry]) => {
    if (!entry.path.endsWith(".json")) return;
    if (name === "relationshipTypes") {
      it(`${name}: manifest count (${entry.count}) matches the number of declared types`, () => {
        const file = readJson(entry.path);
        expect(Object.keys(file.relationshipTypes || {}).length).toBe(entry.count);
      });
      return;
    }
    it(`${name}: manifest count (${entry.count}) matches the array length`, () => {
      expect(readJson(entry.path).length).toBe(entry.count);
    });
  });
});

describe("auth.js roster matches the exported character data", () => {
  loadScript("assets/js/auth.js");
  const rosterNames = getCharacterNames().slice().sort();
  const dataNames = tableRecords("characters").map((c) => c.name).sort();

  it("every roster character has a matching exported character record", () => {
    expect(rosterNames).toEqual(dataNames);
  });
});

describe("record thumbnails exist", () => {
  // thumbFile/thumbHash are written by scripts/generate-map-thumbnails.py (run by
  // .github/workflows/map-thumbnails.yml), same as maps' thumbFile.
  readdirSync(repoPath("data")).filter((f) => f.endsWith(".json")).forEach((file) => {
    const table = readJson("data/" + file);
    if (!Array.isArray(table)) return;
    table.filter((r) => r && r.image).forEach((r) => {
      it(`${file} '${r.id}' has a thumbFile that exists`, () => {
        expect(r.thumbFile, `missing thumbFile — run scripts/generate-map-thumbnails.py`).toBeTruthy();
        expect(existsSync(repoPath("data", r.thumbFile))).toBe(true);
        expect(r.thumbHash, "stale thumbnail — rerun scripts/generate-map-thumbnails.py").toBe(r.imageHash);
      });
    });
  });
});

describe("spell writing circles", () => {
  // Written by scripts/generate-spell-circles.py (npm run build; committed by
  // .github/workflows/spell-circles.yml), one SVG per spell, named after the
  // last segment of the spell's id.
  const spells = tableRecords("spells");
  const slugOf = (spell) => spell.id.split("/").pop();

  spells.forEach((spell) => {
    it(`spell '${spell.id}' has a writing circle`, () => {
      expect(
        existsSync(repoPath("assets", "spell-circles", slugOf(spell) + ".svg")),
        "missing circle — run scripts/generate-spell-circles.py"
      ).toBe(true);
    });
  });

  it("has no circles for spells that are not in spells.json", () => {
    const slugs = new Set(spells.map(slugOf));
    const orphans = readdirSync(repoPath("assets", "spell-circles"))
      .filter((f) => f.endsWith(".svg") && !slugs.has(f.slice(0, -4)));
    expect(orphans, "orphaned circles — run scripts/generate-spell-circles.py").toEqual([]);
  });

  it("are all up to date with spells.json", () => {
    const run = () => execFileSync("python3", [repoPath("scripts", "generate-spell-circles.py"), "--check"],
      { encoding: "utf8", stdio: "pipe" });
    expect(run).not.toThrow();
  });
});
