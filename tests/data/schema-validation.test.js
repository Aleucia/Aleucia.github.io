import { describe, expect, it } from "vitest";
import { loadDataSchema, loadManifest, readJson, validateEntityRecords } from "../helpers/schema.js";

const schema = loadDataSchema();
const manifest = loadManifest();

describe("data-schema.json", () => {
  it("is well-formed with a version and a table for every kind referenced", () => {
    expect(typeof schema.version).toBe("string");
    expect(schema.tables).toBeTypeOf("object");
  });
});

describe("data/manifest.json", () => {
  it("declares a schemaVersion whose major version matches data-schema.json", () => {
    const manifestMajor = String(manifest.schemaVersion).split(".")[0];
    const schemaMajor = String(schema.version).split(".")[0];
    expect(manifestMajor).toBe(schemaMajor);
  });

  it("only lists tables that data-schema.json actually defines", () => {
    for (const name of Object.keys(manifest.tables)) {
      expect(schema.tables, "manifest references unknown table '" + name + "'").toHaveProperty(name);
    }
  });

  it("points every array-backed table at the path data-schema.json declares", () => {
    for (const [name, entry] of Object.entries(manifest.tables)) {
      const tableDef = schema.tables[name];
      if (!tableDef || tableDef.kind === "dynamic" || tableDef.kind === "bases") continue;
      // bases/maps are directories of per-item files by design (see SCHEMA.md
      // and content-store.js) - only entity/graph/static-reference tables
      // have one fixed file to check.
      if (tableDef.kind === "entity" && entry.path.endsWith(".json") === false) continue;
      if (["entity", "graph", "static-reference"].includes(tableDef.kind) && tableDef.path.endsWith(".json")) {
        expect(entry.path).toBe(tableDef.path);
      }
    }
  });
});

describe("entity table records match their data-schema.json field list", () => {
  const entityTables = Object.entries(schema.tables).filter(([, t]) => t.kind === "entity" || t.kind === "graph");

  for (const [name, tableDef] of entityTables) {
    const manifestEntry = manifest.tables[name];
    if (!manifestEntry) continue; // not exported yet (e.g. items/quests) — nothing to validate
    if (!manifestEntry.path.endsWith(".json")) continue; // one-file-per-record table (maps) — checked separately

    it(`${name}: every record satisfies required fields and scalar types`, () => {
      const records = readJson(manifestEntry.path);
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBe(manifestEntry.count);

      const problems = validateEntityRecords(tableDef, records);
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
});

describe("maps: each data/maps/<id>.json satisfies data-schema.json's maps field list", () => {
  const manifestEntry = manifest.tables.maps;
  if (manifestEntry) {
    const index = readJson(manifestEntry.path + "/index.json");
    for (const { id } of index) {
      it(`map '${id}'`, () => {
        const record = readJson(`${manifestEntry.path}/${id}.json`);
        const problems = validateEntityRecords(schema.tables.maps, [record]);
        expect(problems, problems.join("\n")).toEqual([]);
      });
    }
  }
});

describe("relationship-types.json", () => {
  it("is exported wholesale with the vocabulary sections data-schema.json expects", () => {
    const manifestEntry = manifest.tables.relationshipTypes;
    if (!manifestEntry) return;

    const file = readJson(manifestEntry.path);
    expect(file).toHaveProperty("relationshipTypes");
    expect(file.relationshipTypes).toBeTypeOf("object");
  });
});
