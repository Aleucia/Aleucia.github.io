import { beforeEach, describe, expect, it } from "vitest";
import { loadScript } from "../helpers/load-script.js";

function profileWith(overrides) {
  return Object.assign({
    items: [],
    correspondence: [],
    quests: [],
    timeline: [],
    relationships: {
      parent: [], partner: [], children: [], sibling: [],
      ally: [], enemy: [], groups: [], memberships: [],
    },
  }, overrides);
}

beforeEach(() => {
  loadScript("assets/js/character-page.js", { expose: ["CHARACTER_PAGE_SECTIONS"] });
  loadScript("assets/js/player-page.js", { expose: ["PLAYER_PAGE_PREVIEW_SIZE", "PLAYER_SECTION_PREVIEWS"] });
});

describe("player-page.js randomSubset", () => {
  it("returns at most `count` distinct elements from the list", () => {
    const list = [1, 2, 3, 4, 5, 6];
    const picked = randomSubset(list, 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    picked.forEach((n) => expect(list).toContain(n));
  });

  it("returns every element when the list is shorter than `count`", () => {
    expect(randomSubset(["a", "b"], 5).sort()).toEqual(["a", "b"]);
  });

  it("does not modify the original list", () => {
    const list = [1, 2, 3, 4];
    randomSubset(list, 2, () => 0.99);
    expect(list).toEqual([1, 2, 3, 4]);
  });

  it("uses the supplied random source", () => {
    expect(randomSubset([1, 2, 3, 4], 2, () => 0.99)).toEqual([4, 1]);
  });

  it("handles an empty or missing list", () => {
    expect(randomSubset([], 3)).toEqual([]);
    expect(randomSubset(undefined, 3)).toEqual([]);
  });
});

describe("player-page.js playerHeroFacts", () => {
  it("lists only the facts set on the profile", () => {
    const facts = playerHeroFacts({ player: "Bex", race: "Elf", level: 4, gender: "", hp: 50, maxHp: 71 });
    expect(facts).toEqual([
      ["Player", "Bex"],
      ["Race", "Elf"],
      ["Level", "4"],
      ["Hit Points", "50 / 71"],
    ]);
  });
});

describe("player-page.js playerSectionKeys", () => {
  it("only includes the spell book for spellcasters", () => {
    expect(playerSectionKeys(false)).not.toContain("spellbook");
    expect(playerSectionKeys(true)).toContain("spellbook");
  });
});

describe("player-page.js buildPlayerSection", () => {
  it("renders a heading, a preview capped at the preview size, and a button to the sub-page", () => {
    const items = [1, 2, 3, 4, 5].map((n) => ({ id: "i" + n, name: "Item " + n }));
    const section = buildPlayerSection("items", profileWith({ items }));

    expect(section.querySelector(".player-section-title").textContent).toBe("Magic Items");
    expect(section.querySelectorAll(".card")).toHaveLength(PLAYER_PAGE_PREVIEW_SIZE);
    const button = section.querySelector(".player-section-btn");
    expect(button.getAttribute("href")).toBe("character.html?section=items");
  });

  it("shows an empty state when the section has no content", () => {
    const section = buildPlayerSection("quests", profileWith({}));
    expect(section.querySelector(".empty-state")).not.toBeNull();
    expect(section.querySelector(".player-section-btn").getAttribute("href")).toBe("character.html?section=quests");
  });

  it("previews relationships as labelled tags", () => {
    const profile = profileWith({});
    profile.relationships.ally = ["Tom"];
    const section = buildPlayerSection("relationships", profile);
    expect([...section.querySelectorAll(".tag")].map((t) => t.textContent)).toEqual(["Tom · Ally"]);
  });

  it("keeps a random pick of journal entries in chronological order", () => {
    const timeline = [0, 1, 2, 3].map((n) => ({ heading: "Session " + n, text: "..." }));
    const section = buildPlayerSection("timeline", profileWith({ timeline }));
    const headings = [...section.querySelectorAll(".timeline-entry-heading")].map((h) => h.textContent);
    expect(headings).toHaveLength(2);
    expect([...headings].sort()).toEqual(headings);
  });
});
