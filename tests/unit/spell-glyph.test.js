import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loadScript } from "../helpers/load-script.js";

beforeEach(() => {
  loadScript("assets/js/spell-glyph.js");
});

const fireball = {
  id: "3-mechanics/cli/spells/fireball-xphb", name: "Fireball", level: 3, school: "Evocation",
  castingTime: "1 Action", range: "150 feet", components: "V, S, M (a ball of bat guano and sulfur)",
  duration: "Instantaneous",
  description: "A bright streak flashes from you to a point you choose within range and then blossoms " +
    "with a low roar into a fiery explosion. Each creature in a 20-foot-radius Sphere centered on that " +
    "point makes a Dexterity saving throw, taking 8d6 Fire damage on a failed save or half as much damage " +
    "on a successful one."
};

describe("spell-glyph.js spellGlyphAttributes", () => {
  it("reads every attribute from the spell's stats and rules text", () => {
    const a = spellGlyphAttributes(fireball);
    expect(a.level).toBe(3);
    expect(a.school).toBe("Evocation");
    expect(a.action).toEqual({ value: "Action" });
    expect(a.range).toEqual({ value: "Feet", count: 150 });
    expect(a.area).toEqual({ value: "Sphere", count: 20 });
    expect(a.components).toEqual({ verbal: true, somatic: true, material: "Material", focus: "None" });
    expect(a.duration).toEqual({ value: "Instantaneous" });
    expect(a.save).toEqual({ value: "Dexterity" });
    expect(a.effect).toEqual({ value: "Aggressive", partial: true });
    expect(a.target).toEqual({ value: "Area" });
  });

  it("handles reactions, ritual casting times, concentration and costly materials", () => {
    const a = spellGlyphAttributes({
      name: "Find Familiar", level: 1, school: "Conjuration", castingTime: "1 hour unless cast as a ritual",
      range: "10 feet", components: "V, S, M (burning incense worth 10+ GP)", duration: "Concentration, up to 10 minutes",
      concentration: true, ritual: true, description: "You gain the service of a familiar."
    });
    expect(a.action).toEqual({ value: "Hours", count: 1 });
    expect(a.components.material).toBe("Expensive Material");
    expect(a.duration).toEqual({ value: "Minutes", count: 10 });
    expect(a.effect.value).toBe("Summoning");
    const symbols = spellGlyphSymbols(a);
    expect(symbols.action).toBe("1🝮⌬");
    expect(symbols.duration).toBe("☾10◷");
    expect(spellGlyphAttributes({ name: "Shield", level: 1, castingTime: "1 Reaction" }).action.value).toBe("Reaction");
  });

  it("takes whichever of a save or a spell attack the rules text names first", () => {
    const a = spellGlyphAttributes({ name: "Ice Knife", level: 1, description:
      "Make a ranged spell attack. Each creature within 5 feet makes a Dexterity saving throw." });
    expect(a.save.value).toBe("Ranged Attack");
  });
});

describe("spell-glyph.js spellGlyphSvg", () => {
  it("draws the level's tiers, the inner symbols and the ring text", () => {
    const host = document.createElement("div");
    host.innerHTML = spellGlyphSvg(fireball, fireball.id);
    const svg = host.querySelector("svg.spell-glyph");
    expect(svg.querySelector("title").textContent).toBe("Fireball spell glyph");
    expect(svg.querySelector("desc").textContent).toContain("Save: Dexterity");
    // Level 3: tier 1 plus the bottom and two side intermediate circles.
    expect(svg.querySelectorAll("circle.glyph-fill")).toHaveLength(3 + 3);
    expect([...svg.querySelectorAll(".glyph-symbol")].map((t) => t.textContent)).toEqual(["♂", "δ", "◪Λ"]);
    const ring = [...svg.querySelectorAll("textPath")];
    expect(ring.map((t) => t.textContent)).toEqual(["⍱ 🜔 🝗", "20◯", "ϟ", "150φ", "⛶", "⇒"]);
    const pathId = svg.querySelector("path[id]").id;
    ring.forEach((t) => expect(t.getAttribute("href")).toBe("#" + pathId));
  });

  it("produces a glyph for every spell in spells.json", () => {
    const spells = JSON.parse(readFileSync("data/spells.json", "utf-8"));
    spells.forEach((spell) => {
      const host = document.createElement("div");
      host.innerHTML = spellGlyphSvg(spell, spell.id);
      expect(host.querySelectorAll("textPath"), spell.name).toHaveLength(6);
      expect(host.textContent, spell.name).not.toContain("undefined");
    });
  });
});
