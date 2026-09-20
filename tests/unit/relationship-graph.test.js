import { beforeEach, describe, expect, it } from "vitest";
import { loadScript } from "../helpers/load-script.js";

beforeEach(() => {
  loadScript("assets/js/relationship-graph.js");
});

describe("relationship-graph.js collectEdgesForEntity", () => {
  const relationshipTypes = {
    parent: { inverse: "child" },
    child: { inverse: "parent" },
    ally: { symmetric: true },
    owns: {}, // no inverse, not symmetric
  };

  it("includes every edge where the entity is the subject", () => {
    const edges = [{ subject: "c1", type: "owns", object: "item1" }];
    const relevant = collectEdgesForEntity("c1", edges, relationshipTypes);
    expect(relevant).toHaveLength(1);
    expect(relevant[0]).toMatchObject({ otherId: "item1", outgoing: true });
  });

  it("excludes an edge where the entity is only the object of a type with a registered inverse (already synthesized on the subject side)", () => {
    const edges = [{ subject: "p1", type: "parent", object: "c1" }];
    expect(collectEdgesForEntity("c1", edges, relationshipTypes)).toHaveLength(0);
  });

  it("excludes an edge where the entity is only the object of a symmetric type", () => {
    const edges = [{ subject: "c2", type: "ally", object: "c1" }];
    expect(collectEdgesForEntity("c1", edges, relationshipTypes)).toHaveLength(0);
  });

  it("includes an edge where the entity is the object of a type with neither inverse nor symmetric flag", () => {
    const edges = [{ subject: "npc1", type: "owns", object: "c1" }];
    const relevant = collectEdgesForEntity("c1", edges, relationshipTypes);
    expect(relevant).toHaveLength(1);
    expect(relevant[0]).toMatchObject({ otherId: "npc1", outgoing: false });
  });

  it("excludes edges that don't involve the entity at all", () => {
    const edges = [{ subject: "x", type: "owns", object: "y" }];
    expect(collectEdgesForEntity("c1", edges, relationshipTypes)).toHaveLength(0);
  });
});

describe("relationship-graph.js truncateLabel", () => {
  it("leaves short labels untouched", () => {
    expect(truncateLabel("Aerin")).toBe("Aerin");
  });

  it("truncates labels over 14 characters with an ellipsis", () => {
    expect(truncateLabel("Ser Gillard the Bold")).toBe("Ser Gillard t…");
    expect(truncateLabel("Ser Gillard the Bold").length).toBe(14);
  });

  it("returns an empty string for a falsy label", () => {
    expect(truncateLabel("")).toBe("");
    expect(truncateLabel(undefined)).toBe("");
  });
});
