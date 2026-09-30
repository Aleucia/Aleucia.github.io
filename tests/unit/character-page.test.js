import { beforeEach, describe, expect, it } from "vitest";
import { loadScript } from "../helpers/load-script.js";

beforeEach(() => {
  loadScript("assets/js/character-page.js");
});

describe("character-page.js characterSlug", () => {
  it("lowercases and hyphenates a multi-word name", () => {
    expect(characterSlug("Ser Gillard")).toBe("ser-gillard");
  });

  it("leaves an already-lowercase single word alone", () => {
    expect(characterSlug("aerin")).toBe("aerin");
  });
});

describe("character-page.js renderSpellbook", () => {
  const spells = [
    { id: "a", name: "Blade Ward", level: 0, school: "Abjuration", castingTime: "1 Action", prepared: true },
    {
      id: "b", name: "Sleep", level: 1, school: "Enchantment", castingTime: "1 Action",
      range: "90 feet", components: "V, S, M", duration: "1 minute", concentration: true,
      description: "Sends creatures to sleep.",
    },
  ];

  it("shows an empty state with no spells", () => {
    const body = document.createElement("div");
    renderSpellbook({ spells: [] }, body);
    expect(body.querySelector(".empty-state")).not.toBeNull();
  });

  it("groups spells under a heading per level", () => {
    const body = document.createElement("div");
    renderSpellbook({ spells }, body);
    expect([...body.querySelectorAll(".section-heading")].map((h) => h.textContent)).toEqual(["Cantrips", "1st Level"]);
    expect(body.querySelectorAll(".spell-card")).toHaveLength(2);
  });

  it("marks prepared spells and shows stats and rules text", () => {
    const body = document.createElement("div");
    renderSpellbook({ spells }, body);
    const [ward, sleep] = body.querySelectorAll(".spell-card");
    expect(ward.querySelector(".spell-prepared")).not.toBeNull();
    expect(sleep.querySelector(".spell-prepared")).toBeNull();
    expect(sleep.querySelector(".spell-meta").textContent).toBe("Enchantment · 1 Action · Concentration");
    expect(sleep.querySelector(".spell-stats").textContent).toBe("Range: 90 feet · Components: V, S, M · Duration: 1 minute");
    expect(sleep.querySelector(".spell-description").textContent).toBe("Sends creatures to sleep.");
  });
});
