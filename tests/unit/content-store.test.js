import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "../helpers/load-script.js";

function jsonResponse(body) {
  return { ok: true, json: async () => body };
}

beforeEach(() => {
  vi.restoreAllMocks();
  loadScript("assets/js/content-store.js", { expose: ["ContentStore"] });
});

describe("content-store.js getEntityHref", () => {
  it("routes a character to their dedicated page", () => {
    const index = new Map([["c1", { name: "Aerin", table: "characters" }]]);
    expect(ContentStore.getEntityHref("c1", index)).toEqual({
      url: "characters/aerin/items.html",
      label: "Aerin",
    });
  });

  it("lowercases and hyphenates multi-word character names", () => {
    const index = new Map([["c2", { name: "Ser Gillard", table: "characters" }]]);
    expect(ContentStore.getEntityHref("c2", index).url).toBe("characters/ser-gillard/items.html");
  });

  it("routes every other table to world.html with table + id params", () => {
    const index = new Map([["n1", { name: "Aerin - Mum", table: "npcs" }]]);
    expect(ContentStore.getEntityHref("n1", index)).toEqual({
      url: "world.html?table=npcs&id=n1",
      label: "Aerin - Mum",
    });
  });

  it("returns undefined for an id missing from the index", () => {
    expect(ContentStore.getEntityHref("missing", new Map())).toBeUndefined();
  });
});

describe("content-store.js fetching", () => {
  it("caches repeated fetches of the same path", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ hello: "world" }));
    globalThis.fetch = fetchMock;

    const first = await ContentStore.getMapIndex();
    const second = await ContentStore.getMapIndex();

    expect(first).toEqual({ hello: "world" });
    expect(second).toEqual({ hello: "world" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves to null (never rejects) when a fetch fails", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    });

    await expect(ContentStore.getMap("mournwyn")).resolves.toBeNull();
  });

  it("resolves to null when the response is not ok", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) }));

    await expect(ContentStore.getMap("mournwyn")).resolves.toBeNull();
  });

  it("looks up a table's file through the manifest", async () => {
    const manifest = { schemaVersion: "1.0.0", tables: { characters: { path: "data/characters.json" } } };
    const characters = [{ id: "c1", name: "Aerin" }];

    globalThis.fetch = vi.fn(async (path) => {
      if (path === "data/manifest.json") return jsonResponse(manifest);
      if (path === "data/characters.json") return jsonResponse(characters);
      if (path === "data-schema.json") return jsonResponse({ version: "1.0.0" });
      throw new Error("unexpected fetch: " + path);
    });

    await expect(ContentStore.getTable("characters")).resolves.toEqual(characters);
  });

  it("resolves a directory-style manifest path to its index.json", async () => {
    const manifest = { schemaVersion: "1.0.0", tables: { bases: { path: "data/bases" } } };
    globalThis.fetch = vi.fn(async (path) => {
      if (path === "data/manifest.json") return jsonResponse(manifest);
      if (path === "data/bases/index.json") return jsonResponse([{ id: "b1" }]);
      if (path === "data-schema.json") return jsonResponse({ version: "1.0.0" });
      throw new Error("unexpected fetch: " + path);
    });

    await expect(ContentStore.getTable("bases")).resolves.toEqual([{ id: "b1" }]);
  });

  it("returns null for a table missing from the manifest", async () => {
    globalThis.fetch = vi.fn(async (path) => {
      if (path === "data/manifest.json") return jsonResponse({ schemaVersion: "1.0.0", tables: {} });
      throw new Error("unexpected fetch: " + path);
    });

    await expect(ContentStore.getTable("quests")).resolves.toBeNull();
  });
});
