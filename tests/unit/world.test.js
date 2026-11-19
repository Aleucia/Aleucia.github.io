import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "../helpers/load-script.js";

beforeEach(() => {
  loadScript("assets/js/content-store.js", { expose: ["ContentStore"] });
  loadScript("assets/js/person-card.js");
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

describe("world.js questCard", () => {
  const index = new Map([["n1", { name: "Guildmaster Vell", table: "npcs" }]]);

  it("paints the quest image as the background and shows the giver and status", () => {
    const card = questCard(
      { id: "q1", name: "Lighthouse resupply", image: "assets/quests/lighthouse.webp", questGiver: "n1", status: "Active" },
      index
    );

    expect(card.getAttribute("href")).toBe("world.html?table=quests&id=q1");
    expect(card.querySelector(".card-title").textContent).toBe("Lighthouse resupply");
    const thumb = card.querySelector(".card-thumb");
    expect(thumb.classList.contains("card-thumb--empty")).toBe(false);
    expect(thumb.style.backgroundImage).toContain("data/assets/quests/lighthouse.webp");
    const facts = Array.from(card.querySelectorAll(".card-media-fact")).map((el) => el.textContent);
    expect(facts).toEqual(["Quest Giver: Guildmaster Vell", "Status: Active"]);
  });

  it("falls back to the placeholder background and Unknown giver/status when data is missing", () => {
    const card = questCard({ id: "q2", name: "Lost oath" }, index);

    expect(card.querySelector(".card-thumb").classList.contains("card-thumb--empty")).toBe(true);
    const facts = Array.from(card.querySelectorAll(".card-media-fact")).map((el) => el.textContent);
    expect(facts).toEqual(["Quest Giver: Unknown", "Status: Unknown"]);
  });
});

describe("world.js parseQuestBody", () => {
  const body = "---\nQuest Info\n\nSafe Passage - Escort the caravan east.\nBandits lurk.\n\nDifficulty: Easy (Rank 1)\nReward: 50 gp\n\n- [x] Meet the merchant\n- [ ] Reach Millhaven";

  it("splits prose, Key: Value notes and steps, dropping the heading and a repeated title", () => {
    const parsed = parseQuestBody(body, "Safe Passage");
    expect(parsed.prose).toEqual(["Escort the caravan east. Bandits lurk."]);
    expect(parsed.notes).toEqual([["Difficulty", "Easy (Rank 1)"], ["Reward", "50 gp"]]);
    expect(parsed.steps).toEqual([
      { text: "Meet the merchant", done: true },
      { text: "Reach Millhaven", done: false }
    ]);
  });

  it("is empty for a missing body", () => {
    expect(parseQuestBody(undefined, "x")).toEqual({ prose: [], notes: [], steps: [] });
  });
});

describe("world.js linkText", () => {
  it("unwraps wikilinks to their alias or basename", () => {
    expect(linkText("[[2-World/People/Aldric|Aldric T.]]")).toBe("Aldric T.");
    expect(linkText("[[2-World/Places/Millhaven]]")).toBe("Millhaven");
    expect(linkText(["[[A]]", "B"])).toBe("A, B");
    expect(linkText(undefined)).toBe("");
  });
});

describe("world.js questPoster", () => {
  const index = new Map([
    ["n1", { name: "Guildmaster Vell", table: "npcs" }],
    ["l1", { name: "Millhaven", table: "locations" }]
  ]);

  it("shows title, image, reward, contact, location and only the completed steps", () => {
    const poster = questPoster({
      id: "q1",
      name: "Safe Passage",
      image: "assets/quests/q1/art.png",
      status: "In Progress",
      contact: "Merchant Aldric",
      location: "[[Millhaven]]",
      reward: "50 gold pieces",
      body: "- [x] Meet the merchant\n- [ ] Reach Millhaven"
    }, index);

    expect(poster.querySelector(".quest-poster__title").textContent).toBe("Safe Passage");
    expect(poster.querySelector(".quest-poster__image img").getAttribute("src")).toBe("data/assets/quests/q1/art.png");
    expect(poster.querySelector(".quest-poster__reward-value").textContent).toBe("50 gold pieces");
    const details = Array.from(poster.querySelectorAll("dt")).map((dt) => [dt.textContent, dt.nextElementSibling.textContent]);
    expect(details).toContainEqual(["Point of Contact", "Merchant Aldric"]);
    expect(details).toContainEqual(["Location", "Millhaven"]);
    expect(poster.querySelector("dd a").getAttribute("href")).toBe("world.html?table=locations&id=l1");
    const steps = Array.from(poster.querySelectorAll(".quest-step")).map((li) => li.textContent);
    expect(steps).toEqual(["✓Meet the merchant"]);
    expect(poster.textContent).not.toContain("Reach Millhaven");
    expect(poster.querySelector(".quest-poster__stamp")).toBeNull();
  });

  it("links a resolved quest giver and stamps a completed quest", () => {
    const poster = questPoster({ id: "q2", name: "Lost oath", questGiver: "n1", status: "Complete" }, index);
    const contact = poster.querySelector("dd a");
    expect(contact.textContent).toBe("Guildmaster Vell");
    expect(contact.getAttribute("href")).toBe("world.html?table=npcs&id=n1");
    expect(poster.querySelector(".quest-poster__stamp").textContent).toBe("Completed");
    expect(poster.querySelector(".quest-poster__image")).toBeNull();
  });

  it("leaves out the steps section until a step is completed", () => {
    const poster = questPoster({ id: "q4", name: "x", body: "- [ ] Secret first step\n- [ ] Secret twist" }, index);
    expect(poster.querySelector(".quest-poster__steps")).toBeNull();
    expect(poster.textContent).not.toContain("Secret");
  });

  it("falls back to a Reward: line in the body", () => {
    const poster = questPoster({ id: "q3", name: "x", body: "Reward: A favour" }, index);
    expect(poster.querySelector(".quest-poster__reward-value").textContent).toBe("A favour");
  });
});

describe("world.js renderQuestFields", () => {
  it("lists connected people below the poster", () => {
    const body = document.createElement("div");
    const index = new Map([["n1", { name: "Guildmaster Vell" }]]);

    renderQuestFields({ connectedPeople: ["n1"] }, index, body);

    expect(body.querySelector(".tag").textContent).toBe("Guildmaster Vell");
  });
});

describe("world.js organisationFacts", () => {
  it("shows a capitalized Type fact when organisationType is set", () => {
    expect(organisationFacts({ organisationType: "trade-guild" })).toEqual([["Type", "Trade guild"]]);
  });

  it("is empty when organisationType is unset", () => {
    expect(organisationFacts({})).toEqual([]);
  });
});

describe("world.js organisationCard", () => {
  it("uses the faction symbol as the card background, with name and type", () => {
    const record = {
      id: "2-world/groups/organisations/adventures-guild",
      name: "Adventures Guild",
      image: "assets/organisations/adventures-guild/symbol.png",
      organisationType: "guild"
    };

    const card = organisationCard(record);

    expect(card.className).toBe("card card--faction");
    expect(card.getAttribute("href")).toBe(
      "world.html?table=organisations&id=" + encodeURIComponent(record.id)
    );
    expect(card.querySelector(".card-thumb").style.backgroundImage).toContain("assets/organisations/adventures-guild/symbol.png");
    expect(card.querySelector(".card-title").textContent).toBe("Adventures Guild");
    expect(card.querySelector(".card-media-fact").innerHTML).toBe("Type: <strong>Guild</strong>");
  });

  it("shows an empty thumbnail and falls back to the summary when there is no symbol or type", () => {
    const record = { id: "x", name: "Nameless Order", summary: "A secretive cabal." };

    const card = organisationCard(record);

    expect(card.querySelector(".card-thumb").classList.contains("card-thumb--empty")).toBe(true);
    expect(card.querySelector(".card-media-fact").textContent).toBe("A secretive cabal.");
  });
});

describe("world.js itemFacts", () => {
  it("includes type and rarity when present", () => {
    expect(itemFacts({ itemType: ["Consumable"], rarity: "Rare" })).toEqual([
      ["Type", "Consumable"],
      ["Rarity", "Rare"]
    ]);
  });

  it("joins multiple types and omits missing facts", () => {
    expect(itemFacts({ itemType: ["Consumable", "Drink"] })).toEqual([["Type", "Consumable, Drink"]]);
    expect(itemFacts({ rarity: "Common" })).toEqual([["Rarity", "Common"]]);
    expect(itemFacts({})).toEqual([]);
  });
});

describe("world.js itemCard", () => {
  it("uses the item's image as the card's background and links to its detail page", () => {
    const record = { id: "3-mechanics/items/ale-mug-", name: "Ale (mug)", image: "assets/items/ale-mug.png" };
    const card = itemCard(record);

    expect(card.className).toBe("card card--item");
    expect(card.getAttribute("href")).toBe("world.html?table=items&id=3-mechanics%2Fitems%2Fale-mug-");
    const thumb = card.querySelector(".card-thumb");
    expect(thumb.style.backgroundImage).toContain("data/assets/items/ale-mug.png");
    expect(thumb.className).not.toContain("card-thumb--empty");
  });

  it("shows the name up front and type/rarity as hover facts", () => {
    const record = { id: "i1", name: "Ale (mug)", itemType: ["Consumable"], rarity: "Basic - Limited" };
    const card = itemCard(record);

    expect(card.querySelector(".card-title").textContent).toBe("Ale (mug)");
    const facts = card.querySelectorAll(".card-media-fact");
    expect(facts[0].textContent).toBe("Type: Consumable");
    expect(facts[1].textContent).toBe("Rarity: Basic - Limited");
  });

  it("marks the thumbnail empty and falls back to the summary when there's no image or facts", () => {
    const record = { id: "i2", name: "Mystery Box", summary: "Nobody knows what's inside." };
    const card = itemCard(record);

    expect(card.querySelector(".card-thumb").className).toContain("card-thumb--empty");
    expect(card.querySelector(".card-media-fact").textContent).toBe("Nobody knows what's inside.");
  });
});

describe("world.js personCard", () => {
  it("shows portrait, name and occupation, with species/gender/age revealed on hover", () => {
    const card = personCard({
      id: "n1",
      name: "Algris",
      image: "assets/npcs/algris/portrait.png",
      race: "Dwarf",
      age: "Middle-aged",
      gender: "Male",
      occupation: "Blacksmith",
      summary: "A gruff smith."
    });

    expect(card.getAttribute("href")).toBe("world.html?table=npcs&id=n1");
    expect(card.classList.contains("card--person-media")).toBe(true);
    expect(card.querySelector(".card-title").textContent).toBe("Algris");
    expect(card.querySelector(".card-media-fact--always").textContent).toBe("Blacksmith");

    const thumb = card.querySelector(".card-thumb");
    expect(thumb.classList.contains("card-thumb--empty")).toBe(false);
    expect(thumb.style.backgroundImage).toContain("data/assets/npcs/algris/portrait.png");

    const facts = [...card.querySelectorAll(".card-media-facts .card-media-fact")].map((f) => f.textContent);
    expect(facts).toEqual(["Species: Dwarf", "Gender: Male", "Age: Middle-aged"]);
  });

  it("falls back to the summary when no species/gender/age is set", () => {
    const card = personCard({ id: "n2", name: "Borin", summary: "A quiet smith." });
    expect(card.querySelector(".card-media-facts").textContent).toBe("A quiet smith.");
  });

  it("marks the thumbnail empty and shows only the facts that are set", () => {
    const card = personCard({ id: "n3", name: "Cass", gender: "Female" });
    expect(card.querySelector(".card-thumb").classList.contains("card-thumb--empty")).toBe(true);
    expect(card.querySelector(".card-media-fact--always")).toBeNull();
    expect(card.querySelectorAll(".card-media-facts .card-media-fact").length).toBe(1);
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

describe("world.js recipe book items", () => {
  it("links a recipe book to its printable copy once books.json has it", async () => {
    const body = document.createElement("div");
    const getTable = vi.spyOn(ContentStore, "getTable").mockResolvedValue([{ id: "items/fire-and-oak" }]);
    await appendBookLink({ id: "items/fire-and-oak" }, body);
    const link = body.querySelector("a.book-read-link");
    expect(link.getAttribute("href")).toBe("books.html?book=items%2Ffire-and-oak");
    expect(getTable).toHaveBeenCalledWith("books");
    getTable.mockRestore();
  });

  it("adds no link when the book wasn't exported", async () => {
    const body = document.createElement("div");
    const getTable = vi.spyOn(ContentStore, "getTable").mockResolvedValue(null);
    await appendBookLink({ id: "items/fire-and-oak" }, body);
    expect(body.querySelector("a")).toBeNull();
    getTable.mockRestore();
  });
});
