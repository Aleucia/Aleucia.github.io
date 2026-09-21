/**
 * Aleucia Maps — list page. Reads data/maps/index.json ({id, imageFile} per
 * map, written by Obsidian Cast's maps-exporter.ts) and links each to its
 * own map.html?id=<id> viewer.
 *
 * A sidebar lets the player narrow the list by properties of the map's
 * linked location record (locationType, tags) — joined via
 * locations.mapId, falling back to the location id's basename when mapId
 * isn't populated yet (same convention world.js's renderLocationMap uses).
 */

const mapsListState = {
  maps: [],
  search: "",
  types: new Set(),
  tags: new Set(),
};

async function initMapsList() {
  const [mapIndex, locations] = await Promise.all([
    ContentStore.getMapIndex(),
    ContentStore.getTable("locations"),
  ]);
  const body = document.getElementById("pageBody");

  if (!mapIndex || mapIndex.length === 0) {
    body.appendChild(emptyState("No maps recorded yet. Check back as the chronicle grows."));
    return;
  }

  mapsListState.maps = mapIndex
    .slice()
    .sort(function (a, b) { return a.id.localeCompare(b.id); })
    .map(function (map) { return joinLocation(map, locations); });

  renderMapsLayout(body);
}

function joinLocation(map, locations) {
  const location = (locations || []).find(function (loc) {
    return loc.mapId === map.id || (loc.id || "").split("/").pop() === map.id;
  });
  return {
    id: map.id,
    imageFile: map.imageFile,
    name: capitalize(map.id),
    locationType: location ? location.locationType : undefined,
    tags: (location && location.tags) || [],
  };
}

function renderMapsLayout(body) {
  const layout = document.createElement("div");
  layout.className = "maps-layout";

  const sidebar = document.createElement("aside");
  sidebar.className = "maps-sidebar";
  sidebar.appendChild(buildSearchFilter());

  const typeGroup = buildCheckboxFilter(
    "Type",
    facetCounts(mapsListState.maps, "locationType"),
    mapsListState.types,
    capitalize
  );
  if (typeGroup) sidebar.appendChild(typeGroup);

  const tagGroup = buildCheckboxFilter("Tags", facetCounts(mapsListState.maps, "tags"), mapsListState.tags);
  if (tagGroup) sidebar.appendChild(tagGroup);

  sidebar.appendChild(buildClearButton());

  const results = document.createElement("div");
  results.className = "maps-results";

  const count = document.createElement("p");
  count.className = "filter-results-count";
  count.id = "mapsResultsCount";
  results.appendChild(count);

  const grid = document.createElement("div");
  grid.className = "card-grid";
  grid.id = "mapsGrid";
  results.appendChild(grid);

  const empty = emptyState("No maps match the selected filters.");
  empty.id = "mapsEmptyState";
  empty.hidden = true;
  results.appendChild(empty);

  layout.appendChild(sidebar);
  layout.appendChild(results);
  body.appendChild(layout);

  renderMapsGrid();
}

// Distinct values (with counts against the full, unfiltered list) for a
// field that's either a single string (locationType) or a string[] (tags).
function facetCounts(maps, field) {
  const counts = new Map();
  maps.forEach(function (map) {
    const value = map[field];
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
  label.setAttribute("for", "mapSearchInput");
  label.textContent = "Search";
  wrap.appendChild(label);

  const input = document.createElement("input");
  input.type = "search";
  input.id = "mapSearchInput";
  input.className = "filter-search-input";
  input.placeholder = "Search maps…";
  input.addEventListener("input", function () {
    mapsListState.search = input.value.trim().toLowerCase();
    renderMapsGrid();
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
      renderMapsGrid();
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
    mapsListState.search = "";
    mapsListState.types.clear();
    mapsListState.tags.clear();
    document.querySelectorAll(".maps-sidebar input").forEach(function (el) {
      if (el.type === "checkbox") el.checked = false;
      else el.value = "";
    });
    renderMapsGrid();
  });
  return btn;
}

function matchesMapFilters(map) {
  if (mapsListState.search && map.name.toLowerCase().indexOf(mapsListState.search) === -1) return false;
  if (mapsListState.types.size && !mapsListState.types.has(map.locationType)) return false;
  if (mapsListState.tags.size) {
    const hasTag = map.tags.some(function (tag) { return mapsListState.tags.has(tag); });
    if (!hasTag) return false;
  }
  return true;
}

function renderMapsGrid() {
  const grid = document.getElementById("mapsGrid");
  const empty = document.getElementById("mapsEmptyState");
  const count = document.getElementById("mapsResultsCount");

  const filtered = mapsListState.maps.filter(matchesMapFilters);
  count.textContent = filtered.length + " of " + mapsListState.maps.length + " maps";

  grid.innerHTML = "";
  grid.hidden = filtered.length === 0;
  empty.hidden = filtered.length !== 0;

  filtered.forEach(function (map) {
    const card = document.createElement("a");
    card.className = "card map-thumb-card";
    card.href = "map.html?id=" + encodeURIComponent(map.id);
    card.innerHTML =
      '<img class="map-thumb" src="data/' + map.imageFile + '" alt="">' +
      '<p class="card-title">' + escapeHtml(map.name) + "</p>";
    grid.appendChild(card);
  });
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

document.addEventListener("DOMContentLoaded", initMapsList);
