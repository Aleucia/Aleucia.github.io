/**
 * Aleucia Assets — one filterable list of every in-world document the party
 * can look at: maps (data/maps/index.json, written by Obsidian Cast's
 * maps-exporter.ts) and correspondence records (letters, quest posters,
 * notes, rumours — whatever each note's correspondence_type says).
 *
 * Maps link to their own map.html?id=<id> viewer; correspondence links to
 * world.html?table=correspondence&id=<id>.
 *
 * A sidebar narrows the list by asset type ("Map", or the correspondence
 * record's correspondenceType), by the location type of a map's linked
 * location record, and by tags. Location data is joined via
 * locations.mapId, falling back to the location id's basename when mapId
 * isn't populated yet (same convention world.js's renderLocationMap uses).
 *
 * The type filter can be preselected from the URL, e.g.
 * assets.html?type=Map or assets.html?type=Letter&type=Quest%20Poster.
 */

const MAP_ASSET_TYPE = "Map";
const DEFAULT_CORRESPONDENCE_TYPE = "Correspondence";

const assetsListState = {
  assets: [],
  search: "",
  assetTypes: new Set(),
  locationTypes: new Set(),
  tags: new Set(),
};

async function initAssetsList() {
  const [mapIndex, locations, correspondence] = await Promise.all([
    ContentStore.getMapIndex(),
    ContentStore.getTable("locations"),
    ContentStore.getTable("correspondence"),
  ]);
  const body = document.getElementById("pageBody");

  assetsListState.assets = buildAssets(mapIndex, locations, correspondence);

  if (assetsListState.assets.length === 0) {
    body.appendChild(emptyState("No assets recorded yet. Check back as the chronicle grows."));
    return;
  }

  new URLSearchParams(window.location.search).getAll("type").forEach(function (type) {
    assetsListState.assetTypes.add(type);
  });

  renderAssetsLayout(body);
}

function buildAssets(mapIndex, locations, correspondence) {
  const maps = (mapIndex || []).map(function (map) { return mapAsset(map, locations); });
  const letters = (correspondence || []).map(correspondenceAsset);
  return maps.concat(letters).sort(function (a, b) { return a.name.localeCompare(b.name); });
}

function mapAsset(map, locations) {
  const location = (locations || []).find(function (loc) {
    return loc.mapId === map.id || (loc.id || "").split("/").pop() === map.id;
  });
  return {
    id: map.id,
    assetType: MAP_ASSET_TYPE,
    name: capitalize(map.id),
    href: "map.html?id=" + encodeURIComponent(map.id),
    thumb: map.thumbFile || map.imageFile,
    locationType: location ? location.locationType : undefined,
    tags: (location && location.tags) || [],
  };
}

function correspondenceAsset(record) {
  return {
    id: record.id,
    assetType: record.correspondenceType || DEFAULT_CORRESPONDENCE_TYPE,
    name: record.name || "",
    href: "world.html?table=correspondence&id=" + encodeURIComponent(record.id),
    thumb: record.image,
    summary: record.summary,
    locationType: undefined,
    // Every correspondence note carries Category/Correspondence (it's how the
    // exporter finds them), so it says nothing the Type filter doesn't.
    tags: (record.tags || []).filter(function (tag) { return tag.indexOf("Category/") !== 0; }),
  };
}

function renderAssetsLayout(body) {
  const layout = document.createElement("div");
  layout.className = "assets-layout";

  const sidebar = document.createElement("aside");
  sidebar.className = "assets-sidebar";
  sidebar.appendChild(buildSearchFilter());

  const typeGroup = buildCheckboxFilter(
    "Type",
    facetCounts(assetsListState.assets, "assetType"),
    assetsListState.assetTypes
  );
  if (typeGroup) sidebar.appendChild(typeGroup);

  const locationTypeGroup = buildCheckboxFilter(
    "Location Type",
    facetCounts(assetsListState.assets, "locationType"),
    assetsListState.locationTypes,
    capitalize
  );
  if (locationTypeGroup) sidebar.appendChild(locationTypeGroup);

  const tagGroup = buildCheckboxFilter("Tags", facetCounts(assetsListState.assets, "tags"), assetsListState.tags);
  if (tagGroup) sidebar.appendChild(tagGroup);

  sidebar.appendChild(buildClearButton());

  const results = document.createElement("div");
  results.className = "assets-results";

  const count = document.createElement("p");
  count.className = "filter-results-count";
  count.id = "assetsResultsCount";
  results.appendChild(count);

  const grid = document.createElement("div");
  grid.className = "card-grid";
  grid.id = "assetsGrid";
  results.appendChild(grid);

  const empty = emptyState("No assets match the selected filters.");
  empty.id = "assetsEmptyState";
  empty.hidden = true;
  results.appendChild(empty);

  layout.appendChild(sidebar);
  layout.appendChild(results);
  body.appendChild(layout);

  renderAssetsGrid();
}

// Distinct values (with counts against the full, unfiltered list) for a
// field that's either a single string (assetType, locationType) or a
// string[] (tags).
function facetCounts(assets, field) {
  const counts = new Map();
  assets.forEach(function (asset) {
    const value = asset[field];
    const values = Array.isArray(value) ? value : (value ? [value] : []);
    values.forEach(function (v) { counts.set(v, (counts.get(v) || 0) + 1); });
  });
  return Array.from(counts.keys())
    .sort()
    .map(function (value) { return { value: value, count: counts.get(value) }; });
}

function buildSearchFilter() {
  const wrap = document.createElement("div");
  wrap.className = "filter-group";

  const label = document.createElement("label");
  label.className = "filter-label";
  label.setAttribute("for", "assetSearchInput");
  label.textContent = "Search";
  wrap.appendChild(label);

  const input = document.createElement("input");
  input.type = "search";
  input.id = "assetSearchInput";
  input.className = "filter-search-input";
  input.placeholder = "Search assets…";
  input.addEventListener("input", function () {
    assetsListState.search = input.value.trim().toLowerCase();
    renderAssetsGrid();
  });
  wrap.appendChild(input);

  return wrap;
}

function buildCheckboxFilter(label, options, selectedSet, formatFn) {
  if (!options.length) return null;

  const wrap = document.createElement("div");
  wrap.className = "filter-group";

  const heading = document.createElement("p");
  heading.className = "filter-label";
  heading.textContent = label;
  wrap.appendChild(heading);

  const list = document.createElement("div");
  list.className = "filter-checkbox-list";
  options.forEach(function (option) {
    const optionLabel = document.createElement("label");
    optionLabel.className = "filter-checkbox";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = option.value;
    input.checked = selectedSet.has(option.value);
    input.addEventListener("change", function () {
      if (input.checked) selectedSet.add(option.value);
      else selectedSet.delete(option.value);
      renderAssetsGrid();
    });
    optionLabel.appendChild(input);

    const text = document.createElement("span");
    text.textContent = formatFn ? formatFn(option.value) : option.value;
    optionLabel.appendChild(text);

    const countTag = document.createElement("span");
    countTag.className = "filter-checkbox-count";
    countTag.textContent = "(" + option.count + ")";
    optionLabel.appendChild(countTag);

    list.appendChild(optionLabel);
  });
  wrap.appendChild(list);

  return wrap;
}

function buildClearButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "filter-clear-btn";
  btn.textContent = "Clear filters";
  btn.addEventListener("click", function () {
    assetsListState.search = "";
    assetsListState.assetTypes.clear();
    assetsListState.locationTypes.clear();
    assetsListState.tags.clear();
    document.querySelectorAll(".assets-sidebar input").forEach(function (el) {
      if (el.type === "checkbox") el.checked = false;
      else el.value = "";
    });
    renderAssetsGrid();
  });
  return btn;
}

function matchesAssetFilters(asset) {
  if (assetsListState.search) {
    const haystack = (asset.name + " " + (asset.summary || "")).toLowerCase();
    if (haystack.indexOf(assetsListState.search) === -1) return false;
  }
  if (assetsListState.assetTypes.size && !assetsListState.assetTypes.has(asset.assetType)) return false;
  if (assetsListState.locationTypes.size && !assetsListState.locationTypes.has(asset.locationType)) return false;
  if (assetsListState.tags.size) {
    const hasTag = asset.tags.some(function (tag) { return assetsListState.tags.has(tag); });
    if (!hasTag) return false;
  }
  return true;
}

function renderAssetsGrid() {
  const grid = document.getElementById("assetsGrid");
  const empty = document.getElementById("assetsEmptyState");
  const count = document.getElementById("assetsResultsCount");

  const filtered = assetsListState.assets.filter(matchesAssetFilters);
  count.textContent = filtered.length + " of " + assetsListState.assets.length + " assets";

  grid.innerHTML = "";
  grid.hidden = filtered.length === 0;
  empty.hidden = filtered.length !== 0;

  filtered.forEach(function (asset) { grid.appendChild(assetCard(asset)); });
}

function assetCard(asset) {
  const card = document.createElement("a");
  card.className = "card asset-card";
  card.href = asset.href;
  // Same reasoning as world.js's location cards: maps prefer the compressed
  // thumbFile over the multi-MB full map image, and offscreen images are
  // deferred (this grid can list every asset on the site at once).
  const thumb = asset.thumb
    ? '<img class="asset-thumb" src="' + escapeHtml(encodeURI("data/" + asset.thumb)) + '" alt="" loading="lazy" decoding="async">'
    : '<div class="asset-thumb asset-thumb--empty"></div>';
  card.innerHTML =
    thumb +
    '<div class="asset-card-text">' +
      '<p class="asset-card-type">' + escapeHtml(asset.assetType) + "</p>" +
      '<p class="card-title">' + escapeHtml(asset.name) + "</p>" +
    "</div>";
  return card;
}

function emptyState(text) {
  const p = document.createElement("p");
  p.className = "empty-state";
  p.textContent = text;
  return p;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", initAssetsList);
