import { beforeEach, describe, expect, it } from "vitest";
import { loadScript } from "../helpers/load-script.js";

beforeEach(() => {
  loadScript("assets/js/character-data.js");
});

describe("character-data.js extractOwnedItems", () => {
  const items = [
    { id: "i1", name: "Sword" },
    { id: "i2", name: "Shield" },
  ];

  it("resolves this character's owns edges into item id/name pairs", () => {
    const record = { id: "c1" };
    const edges = [
      { subject: "c1", type: "owns", object: "i1" },
      { subject: "c1", type: "owns", object: "i2" },
    ];
    expect(extractOwnedItems(record, edges, items)).toEqual([
      { id: "i1", name: "Sword" },
      { id: "i2", name: "Shield" },
    ]);
  });

  it("ignores edges for other subjects or other relationship types", () => {
    const record = { id: "c1" };
    const edges = [
      { subject: "other", type: "owns", object: "i1" },
      { subject: "c1", type: "ally", object: "i2" },
    ];
    expect(extractOwnedItems(record, edges, items)).toEqual([]);
  });

  it("drops an owns edge whose object has no matching item", () => {
    const record = { id: "c1" };
    const edges = [{ subject: "c1", type: "owns", object: "missing" }];
    expect(extractOwnedItems(record, edges, items)).toEqual([]);
  });

  it("returns an empty list when there are no edges", () => {
    expect(extractOwnedItems({ id: "c1" }, [], items)).toEqual([]);
  });
});

describe("character-data.js resolveNames", () => {
  const table = [
    { id: "q1", name: "Find the ring" },
    { id: "q2", name: "Slay the dragon" },
  ];

  it("maps ids to names in order, dropping unresolved ids", () => {
    expect(resolveNames(["q2", "missing", "q1"], table)).toEqual(["Slay the dragon", "Find the ring"]);
  });

  it("returns an empty list for a non-array or empty input", () => {
    expect(resolveNames(undefined, table)).toEqual([]);
    expect(resolveNames([], table)).toEqual([]);
  });
});

describe("character-data.js buildNameIndex", () => {
  it("merges every table's id -> name pairs into one index", () => {
    const index = buildNameIndex([
      [{ id: "c1", name: "Aerin" }],
      [{ id: "n1", name: "Aerin - Mum" }],
      undefined,
    ]);
    expect(index).toEqual({ c1: "Aerin", n1: "Aerin - Mum" });
  });
});

describe("character-data.js buildRelationships", () => {
  const namesById = { p1: "Aerin - Dad", p2: "Aerin - Mum", org1: "Adventurers' Guild" };
  const organisations = [{ id: "org1", name: "Adventurers' Guild" }];

  it("buckets outgoing edges by relationship type", () => {
    const record = { id: "c1", connectedGroups: [] };
    const edges = [
      { subject: "c1", type: "parent", object: "p1" },
      { subject: "c1", type: "parent", object: "p2" },
      { subject: "c1", type: "ally", object: "p1" },
      { subject: "other", type: "parent", object: "p1" },
    ];

    const rel = buildRelationships(record, edges, organisations, namesById);

    expect(rel.parent).toEqual(["Aerin - Dad", "Aerin - Mum"]);
    expect(rel.ally).toEqual(["Aerin - Dad"]);
    expect(rel.enemy).toEqual([]);
  });

  it("builds membership entries with group/status/rank from member edges", () => {
    const record = { id: "c1", connectedGroups: [] };
    const edges = [{ subject: "c1", type: "member", object: "org1", status: "active", rank: "Squire" }];

    const rel = buildRelationships(record, edges, organisations, namesById);

    expect(rel.memberships).toEqual([{ group: "Adventurers' Guild", status: "active", rank: "Squire" }]);
  });

  it("drops edges pointing at an id absent from namesById", () => {
    const record = { id: "c1", connectedGroups: [] };
    const edges = [{ subject: "c1", type: "ally", object: "unknown" }];
    expect(buildRelationships(record, edges, organisations, namesById).ally).toEqual([]);
  });

  it("resolves the record's own connectedGroups against the organisations table", () => {
    const record = { id: "c1", connectedGroups: ["org1"] };
    const rel = buildRelationships(record, [], organisations, namesById);
    expect(rel.groups).toEqual(["Adventurers' Guild"]);
  });
});
