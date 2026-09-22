import { beforeEach, describe, expect, it } from "vitest";
import { loadScript } from "../helpers/load-script.js";

beforeEach(() => {
  loadScript("assets/js/character-data.js");
});

describe("character-data.js extractOwnedItems", () => {
  const record = { id: "c1" };
  const items = [
    { id: "i1", name: "Sword" },
    { id: "i2", name: "Shield" },
  ];

  it("resolves owns edges for the record into item objects", () => {
    const edges = [
      { subject: "c1", type: "owns", object: "i1" },
      { subject: "c1", type: "owns", object: "i2" },
    ];
    expect(extractOwnedItems(record, edges, items)).toEqual([
      { id: "i1", name: "Sword" },
      { id: "i2", name: "Shield" },
    ]);
  });

  it("drops edges whose object has no matching item", () => {
    const edges = [
      { subject: "c1", type: "owns", object: "i1" },
      { subject: "c1", type: "owns", object: "missing" },
    ];
    expect(extractOwnedItems(record, edges, items)).toEqual([{ id: "i1", name: "Sword" }]);
  });

  it("drops edges that aren't an owns edge for this record", () => {
    const edges = [
      { subject: "c1", type: "parent", object: "i1" },
      { subject: "other", type: "owns", object: "i2" },
    ];
    expect(extractOwnedItems(record, edges, items)).toEqual([]);
  });

  it("returns an empty list when there are no edges", () => {
    expect(extractOwnedItems(record, [], items)).toEqual([]);
  });
});

describe("character-data.js extractCorrespondence", () => {
  const record = { id: "c1" };
  const correspondence = [
    { id: "l1", name: "A letter from home", sender: [], recipient: ["c1"] },
    { id: "l2", name: "A ransom note", sender: ["c1"], recipient: [] },
    { id: "l3", name: "An unrelated rumour", sender: [], recipient: [] },
  ];

  it("tags a letter as Received when the character is its recipient", () => {
    expect(extractCorrespondence(record, [], correspondence)).toEqual([
      { id: "l1", name: "A letter from home", roles: ["Received"] },
      { id: "l2", name: "A ransom note", roles: ["Sent"] },
    ]);
  });

  it("tags a letter as Possessed via an owns edge, even without sender/recipient match", () => {
    const edges = [{ subject: "c1", type: "owns", object: "l3" }];
    const result = extractCorrespondence(record, edges, correspondence);
    expect(result.find((r) => r.id === "l3")).toEqual({
      id: "l3",
      name: "An unrelated rumour",
      roles: ["Possessed"],
    });
  });

  it("unions roles for a letter that is both received and possessed", () => {
    const edges = [{ subject: "c1", type: "owns", object: "l1" }];
    const result = extractCorrespondence(record, edges, correspondence);
    expect(result.find((r) => r.id === "l1").roles).toEqual(["Received", "Possessed"]);
  });

  it("drops an owns edge whose object has no matching correspondence record", () => {
    const edges = [{ subject: "c1", type: "owns", object: "missing" }];
    expect(extractCorrespondence(record, edges, correspondence)).toEqual([
      { id: "l1", name: "A letter from home", roles: ["Received"] },
      { id: "l2", name: "A ransom note", roles: ["Sent"] },
    ]);
  });

  it("returns an empty list when the character has no correspondence at all", () => {
    expect(extractCorrespondence({ id: "unknown" }, [], correspondence)).toEqual([]);
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

describe("character-data.js buildTimeline", () => {
  const record = { id: "c1" };

  it("includes party-wide sessions and ones the character attended, but not others", () => {
    const sessions = [
      { id: "s1", name: "Session 1 - Party", attendees: [] },
      { id: "s2", name: "Session 2 - Solo", attendees: ["c1"] },
      { id: "s3", name: "Session 3 - Elsewhere", attendees: ["c2"] },
      { id: "s4", name: "Session 4 - No field" },
    ];
    expect(buildTimeline(record, sessions).map((e) => e.heading)).toEqual([
      "Session 1 - Party",
      "Session 2 - Solo",
      "Session 4 - No field",
    ]);
  });

  it("orders by sessionNumber, falling back to the number in the name, unnumbered last", () => {
    const sessions = [
      { id: "a", name: "Interlude" },
      { id: "b", name: "Session 10 - Later" },
      { id: "c", name: "Prologue", sessionNumber: 0 },
      { id: "d", name: "Session 2 - Earlier" },
    ];
    expect(buildTimeline(record, sessions).map((e) => e.heading)).toEqual([
      "Prologue",
      "Session 2 - Earlier",
      "Session 10 - Later",
      "Interlude",
    ]);
  });

  it("maps a session into the heading/summary/details shape the timeline renders", () => {
    const sessions = [
      { id: "s1", name: "Session 1 - The forgotten Isles", date: "2026-09-20", summary: "Short.", body: "Long\nwrite-up." },
    ];
    expect(buildTimeline(record, sessions)).toEqual([
      { heading: "Session 1 - The forgotten Isles · 2026-09-20", summary: "Short.", details: "Long\nwrite-up." },
    ]);
  });

  it("returns an empty list when there are no sessions", () => {
    expect(buildTimeline(record, [])).toEqual([]);
  });
});
