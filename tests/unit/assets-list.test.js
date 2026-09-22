import { beforeEach, describe, expect, it } from "vitest";
import { loadScript } from "../helpers/load-script.js";

beforeEach(() => {
  loadScript("assets/js/assets-list.js", { expose: ["assetsListState"] });
  assetsListState.search = "";
  assetsListState.assetTypes.clear();
  assetsListState.locationTypes.clear();
  assetsListState.tags.clear();
});

const mapIndex = [
  { id: "the-forgotten-isles", imageFile: "assets/maps/isles/full.jpeg", thumbFile: "assets/maps/isles/thumb.jpg" },
  { id: "aleucia", imageFile: "assets/maps/aleucia/full.jpeg" },
];

const locations = [
  { id: "2-world/places/the-forgotten-isles", locationType: "region", tags: ["Coast"] },
];

const correspondence = [
  {
    id: "letters/petra",
    name: "Petra - message from her mentor",
    image: "assets/correspondence/petra.png",
    summary: "The first in a series of letters.",
    correspondenceType: "Letter",
    tags: ["Category/Correspondence", "Tower"],
  },
  { id: "posters/wanted", name: "Wanted: Blood Pirates", correspondenceType: "Quest Poster", tags: [] },
  { id: "notes/untyped", name: "A scrap of paper" },
];

describe("assets-list.js buildAssets", () => {
  it("merges maps and correspondence into one list sorted by name", () => {
    const assets = buildAssets(mapIndex, locations, correspondence);
    expect(assets.map((a) => a.name)).toEqual([
      "A scrap of paper",
      "Aleucia",
      "Petra - message from her mentor",
      "The forgotten isles",
      "Wanted: Blood Pirates",
    ]);
  });

  it("types maps as Map and correspondence by its correspondenceType", () => {
    const byId = Object.fromEntries(buildAssets(mapIndex, locations, correspondence).map((a) => [a.id, a]));
    expect(byId["aleucia"].assetType).toBe("Map");
    expect(byId["letters/petra"].assetType).toBe("Letter");
    expect(byId["posters/wanted"].assetType).toBe("Quest Poster");
    expect(byId["notes/untyped"].assetType).toBe("Correspondence");
  });

  it("links each asset to its own viewer page", () => {
    const byId = Object.fromEntries(buildAssets(mapIndex, locations, correspondence).map((a) => [a.id, a]));
    expect(byId["aleucia"].href).toBe("map.html?id=aleucia");
    expect(byId["letters/petra"].href).toBe("world.html?table=correspondence&id=letters%2Fpetra");
  });

  it("prefers a map's thumbFile and joins its location's type and tags", () => {
    const isles = buildAssets(mapIndex, locations, []).find((a) => a.id === "the-forgotten-isles");
    expect(isles.thumb).toBe("assets/maps/isles/thumb.jpg");
    expect(isles.locationType).toBe("region");
    expect(isles.tags).toEqual(["Coast"]);

    const aleucia = buildAssets(mapIndex, locations, []).find((a) => a.id === "aleucia");
    expect(aleucia.thumb).toBe("assets/maps/aleucia/full.jpeg");
    expect(aleucia.tags).toEqual([]);
  });

  it("drops Category/ tags from correspondence", () => {
    const petra = buildAssets([], [], correspondence).find((a) => a.id === "letters/petra");
    expect(petra.tags).toEqual(["Tower"]);
  });

  it("tolerates missing tables", () => {
    expect(buildAssets(null, null, null)).toEqual([]);
  });
});

describe("assets-list.js facetCounts", () => {
  it("counts each distinct asset type", () => {
    const assets = buildAssets(mapIndex, locations, correspondence);
    expect(facetCounts(assets, "assetType")).toEqual([
      { value: "Correspondence", count: 1 },
      { value: "Letter", count: 1 },
      { value: "Map", count: 2 },
      { value: "Quest Poster", count: 1 },
    ]);
  });
});

describe("assets-list.js matchesAssetFilters", () => {
  const matching = () =>
    buildAssets(mapIndex, locations, correspondence).filter(matchesAssetFilters).map((a) => a.id);

  it("matches everything with no filters set", () => {
    expect(matching()).toHaveLength(5);
  });

  it("filters by asset type", () => {
    assetsListState.assetTypes.add("Map");
    assetsListState.assetTypes.add("Quest Poster");
    expect(matching().sort()).toEqual(["aleucia", "posters/wanted", "the-forgotten-isles"]);
  });

  it("searches names and summaries", () => {
    assetsListState.search = "series of letters";
    expect(matching()).toEqual(["letters/petra"]);
  });

  it("filters by location type and tags", () => {
    assetsListState.locationTypes.add("region");
    expect(matching()).toEqual(["the-forgotten-isles"]);

    assetsListState.locationTypes.clear();
    assetsListState.tags.add("Tower");
    expect(matching()).toEqual(["letters/petra"]);
  });
});
