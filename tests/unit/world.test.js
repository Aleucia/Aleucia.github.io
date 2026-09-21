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
