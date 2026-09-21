import { beforeEach, describe, expect, it } from "vitest";
import { loadScript } from "../helpers/load-script.js";

beforeEach(() => {
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
