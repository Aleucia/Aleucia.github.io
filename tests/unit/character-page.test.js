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

  it("lists spells as rows under a column header", () => {
    const body = document.createElement("div");
    renderSpellbook({ spells }, body);
    expect([...body.querySelectorAll(".spell-header .spell-cell")].map((h) => h.textContent))
      .toEqual(["Level", "Name", "Casting Time", "Duration", "Range"]);
    expect(body.querySelectorAll(".spell-card")).toHaveLength(2);
    const [ward, sleep] = body.querySelectorAll(".spell-card");
    expect(ward.querySelector(".spell-level").textContent).toBe("Cantrip");
    expect(sleep.querySelector(".spell-level").textContent).toBe("1st");
  });

  it("marks prepared spells and shows stats and rules text when expanded", () => {
    const body = document.createElement("div");
    renderSpellbook({ spells }, body);
    const [ward, sleep] = body.querySelectorAll(".spell-card");
    expect(ward.querySelector(".spell-prepared")).not.toBeNull();
    expect(sleep.querySelector(".spell-prepared")).toBeNull();
    expect(sleep.querySelector(".spell-meta").textContent).toBe("Enchantment · Concentration");
    expect(sleep.querySelector(".spell-row .spell-range").textContent).toBe("90 feet");
    const stats = [...sleep.querySelectorAll(".spell-stats div")].map((d) => d.textContent);
    expect(stats).toContain("ComponentsV, S, M");
    expect(sleep.querySelector(".spell-description").textContent).toBe("Sends creatures to sleep.");
  });

  it("trims the collapsed duration but keeps the full one when expanded", () => {
    const mk = (duration) => {
      const body = document.createElement("div");
      renderSpellbook({ spells: [{ id: "x", name: "X", level: 1, duration }] }, body);
      return body.querySelector(".spell-card");
    };
    expect(mk("Instantaneous").querySelector(".spell-row .spell-duration").textContent).toBe("");
    const conc = mk("Concentration, up to 10 minutes");
    expect(conc.querySelector(".spell-row .spell-duration").textContent).toBe("Up to 10 minutes");
    expect(conc.querySelector(".spell-stats").textContent).toContain("Concentration, up to 10 minutes");
    expect(mk("8 hours").querySelector(".spell-row .spell-duration").textContent).toBe("8 hours");
  });

  it("toggles open from the name bar", () => {
    const body = document.createElement("div");
    renderSpellbook({ spells }, body);
    const card = body.querySelector(".spell-card");
    expect(card.tagName).toBe("DETAILS");
    expect(card.querySelector("summary.spell-row")).not.toBeNull();
  });
});
