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
