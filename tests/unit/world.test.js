import { beforeEach, describe, expect, it } from "vitest";
import { loadScript } from "../helpers/load-script.js";

beforeEach(() => {
  loadScript("assets/js/content-store.js", { expose: ["ContentStore"] });
  loadScript("assets/js/world.js");
});

describe("world.js escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(\"x\")&lt;/script&gt;"
    );
  });

  it("treats null/undefined as an empty string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("stringifies non-string values", () => {
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("world.js capitalize", () => {
  it("capitalizes the first letter and turns hyphens into spaces", () => {
    expect(capitalize("horizon-s-landing")).toBe("Horizon s landing");
  });

  it("leaves an already-capitalized single word alone", () => {
    expect(capitalize("region")).toBe("Region");
  });
});

describe("world.js cardSubtitle", () => {
  it("shows a capitalized locationType for locations, falling back to summary", () => {
    expect(cardSubtitle("locations", { locationType: "hub" })).toBe("Hub");
    expect(cardSubtitle("locations", { summary: "A quiet town." })).toBe("A quiet town.");
  });

  it("prefers rarity, then summary, for items", () => {
    expect(cardSubtitle("items", { rarity: "Rare" })).toBe("Rare");
    expect(cardSubtitle("items", { summary: "A neat item." })).toBe("A neat item.");
  });

  it("prefers correspondenceType, then summary, for correspondence", () => {
    expect(cardSubtitle("correspondence", { correspondenceType: "Letter" })).toBe("Letter");
    expect(cardSubtitle("correspondence", { summary: "A hurried note." })).toBe("A hurried note.");
    expect(cardSubtitle("correspondence", {})).toBe("");
  });

  it("shows craftingTier, falling back to rarity, for recipes", () => {
    expect(cardSubtitle("recipes", { craftingTier: "Novice", rarity: "Common" })).toBe("Novice");
    expect(cardSubtitle("recipes", { rarity: "Common" })).toBe("Common");
    expect(cardSubtitle("recipes", {})).toBe("");
  });

  it("shows status for quests, falling back to summary", () => {
    expect(cardSubtitle("quests", { status: "Active" })).toBe("Active");
    expect(cardSubtitle("quests", { summary: "A quest." })).toBe("A quest.");
  });

  it("falls back to summary for every other table", () => {
    expect(cardSubtitle("npcs", { summary: "A person." })).toBe("A person.");
    expect(cardSubtitle("npcs", {})).toBe("");
  });
});

describe("world.js renderCorrespondenceFields", () => {
  it("renders the full letter text as parchment, with line breaks preserved, ahead of the facts row", () => {
    const body = document.createElement("div");
    const record = {
      body: "Dear Petra,\nIt has been quite a time.\nAlgris",
      correspondenceType: "Letter"
    };

    renderCorrespondenceFields(record, new Map(), body);

    const parchment = body.querySelector(".letter-parchment");
    expect(parchment).not.toBeNull();
    const text = parchment.querySelector(".letter-parchment__text");
    expect(text.textContent).toBe("Dear Petra,\nIt has been quite a time.\nAlgris");
  });

  it("renders nothing for the letter parchment when record.body is absent", () => {
    const body = document.createElement("div");
    renderCorrespondenceFields({ correspondenceType: "Letter" }, new Map(), body);
    expect(body.querySelector(".letter-parchment")).toBeNull();
  });

  it("links the sender and recipient to their entity pages when they resolve", () => {
    const body = document.createElement("div");
    const index = new Map([
      ["p1", { name: "Algris", table: "npcs" }],
      ["p2", { name: "Petra", table: "characters" }]
    ]);
    const record = { sender: ["p1"], recipient: ["p2"] };

    renderCorrespondenceFields(record, index, body);

    const sender = body.querySelector(".tag-list a.tag");
    expect(sender.textContent).toBe("Algris");
    expect(sender.getAttribute("href")).toBe("world.html?table=npcs&id=p1");

    const tags = body.querySelectorAll(".tag-list a.tag");
    expect(tags[1].textContent).toBe("Petra");
    expect(tags[1].getAttribute("href")).toBe("character.html?character=petra&section=items");
  });

  it("drops a sender/recipient id that has no matching entity page", () => {
    const body = document.createElement("div");
    const record = { sender: ["missing"], recipient: [] };

    renderCorrespondenceFields(record, new Map(), body);

    expect(body.textContent).not.toContain("Sender");
    expect(body.querySelector(".tag-list a.tag")).toBeNull();
  });
});

describe("world.js linkedName / linkNames", () => {
  const index = new Map([["a1", { name: "Adventurers' Guild" }]]);

  it("resolves a single linked id through the entity index", () => {
    expect(linkedName("a1", index)).toBe("Adventurers' Guild");
    expect(linkedName("missing", index)).toBeUndefined();
    expect(linkedName(undefined, index)).toBeUndefined();
  });

  it("resolves a list of ids, dropping unresolved entries", () => {
    expect(linkNames(["a1", "missing"], index)).toEqual(["Adventurers' Guild"]);
    expect(linkNames(undefined, index)).toEqual([]);
  });
});

describe("world.js entityHrefs", () => {
  it("resolves a list of ids to their entity pages, dropping unresolved entries", () => {
    const index = new Map([["n1", { name: "Aerin - Mum", table: "npcs" }]]);
    expect(entityHrefs(["n1", "missing"], index)).toEqual([
      { url: "world.html?table=npcs&id=n1", label: "Aerin - Mum" }
    ]);
    expect(entityHrefs(undefined, index)).toEqual([]);
  });
});

describe("world.js list filters", () => {
  const index = new Map([
    ["g1", { name: "Adventurers' Guild" }],
    ["l1", { name: "Lothmyr" }]
  ]);
  const npcs = [
    { id: "n1", name: "Aerin", summary: "A healer.", status: "Dead", connectedGroups: ["g1"], tags: ["Category/People", "Healer"] },
    { id: "n2", name: "Borin", summary: "A smith.", connectedGroups: [], tags: ["Category/People"] },
    { id: "n3", name: "Cass", status: "Alive", connectedGroups: ["g1", "missing"], tags: [] }
  ];

  function stateFor(table, records, selected, search) {
    const facets = tableFacets(table);
    const sel = {};
    facets.forEach((f) => { sel[f.key] = new Set((selected || {})[f.key] || []); });
    return { records, index, facets, selected: sel, search: search || "" };
  }

  it("counts facet values across records, resolving linked names and skipping blanks", () => {
    const [status, groups] = tableFacets("npcs");
    expect(facetOptions(npcs, status, index)).toEqual([
      { value: "Alive", count: 1 },
      { value: "Dead", count: 1 }
    ]);
    expect(facetOptions(npcs, groups, index)).toEqual([{ value: "Adventurers' Guild", count: 2 }]);
  });

  it("leaves Category/ tags out of the Tags facet", () => {
    const tags = tableFacets("npcs").find((f) => f.key === "tag");
    expect(facetOptions(npcs, tags, index)).toEqual([{ value: "Healer", count: 1 }]);
  });

  it("gives tables without their own facets just the Tags facet", () => {
    expect(tableFacets("organisations").map((f) => f.key)).toEqual(["tag"]);
  });

  it("matches everything when nothing is selected", () => {
    const state = stateFor("npcs", npcs);
    expect(npcs.filter((r) => matchesWorldFilters(r, state)).map((r) => r.id)).toEqual(["n1", "n2", "n3"]);
  });

  it("ORs values within a facet and ANDs across facets", () => {
    let state = stateFor("npcs", npcs, { status: ["Dead", "Alive"] });
    expect(npcs.filter((r) => matchesWorldFilters(r, state)).map((r) => r.id)).toEqual(["n1", "n3"]);
    state = stateFor("npcs", npcs, { status: ["Dead", "Alive"], tag: ["Healer"] });
    expect(npcs.filter((r) => matchesWorldFilters(r, state)).map((r) => r.id)).toEqual(["n1"]);
  });

  it("searches name and summary case-insensitively", () => {
    const state = stateFor("npcs", npcs, {}, "smith");
    expect(npcs.filter((r) => matchesWorldFilters(r, state)).map((r) => r.id)).toEqual(["n2"]);
  });

  it("filters locations by capitalized-on-display type and by parent location name", () => {
    const locs = [
      { id: "a", name: "A", locationType: "region", parentLocation: "l1" },
      { id: "b", name: "B", locationType: "hub" }
    ];
    const [type, within] = tableFacets("locations");
    expect(type.format(facetOptions(locs, type, index)[1].value)).toBe("Region");
    expect(facetOptions(locs, within, index)).toEqual([{ value: "Lothmyr", count: 1 }]);
    const state = stateFor("locations", locs, { within: ["Lothmyr"] });
    expect(locs.filter((r) => matchesWorldFilters(r, state)).map((r) => r.id)).toEqual(["a"]);
  });
});
