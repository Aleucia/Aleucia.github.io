/**
 * Aleucia World Pages
 *
 * One generic list+detail page (world.html) for every entity table besides
 * characters (which keep their own dedicated pages) — locations,
 * organisations, npcs, quests, items, correspondence. Which table and,
 * optionally, which record to show come from the URL:
 * world.html?table=items or world.html?table=items&id=<id>. This avoids
 * ten near-duplicate HTML files for what's really one layout with a
 * per-table field list.
 *
 * List views get the same filter sidebar as assets.html (search plus
 * per-table facets from TABLE_FACETS, and tags), reusing its CSS.
 */

const TABLE_META = {
  locations: {
    label: "The World",
    lead: "Lands, regions, and points of interest across Aleucia.",
    empty: "No locations recorded yet."
  },
  organisations: {
    label: "Factions",
    lead: "The powers that move in shadow and in light.",
    empty: "No factions recorded yet."
  },
  npcs: {
    label: "People",
    lead: "Notable figures your party has encountered.",
    empty: "No one recorded yet."
  },
  quests: {
    label: "Quest Log",
    lead: "Threads, deeds, and rumours across the world.",
    empty: "No quests recorded yet."
  },
  items: {
    label: "Items",
    lead: "Artefacts, treasures, and the recipes behind them.",
    empty: "No items recorded yet."
  },
  correspondence: {
    label: "Correspondence",
    lead: "Letters, notes, and rumours passed between the people of Aleucia.",
    empty: "No correspondence recorded yet."
  },
  recipes: {
    label: "Known Recipes",
    lead: "Crafting recipes recorded across Aleucia.",
    empty: "No recipes recorded yet."
  }
};

async function initWorldPage() {
  const params = new URLSearchParams(window.location.search);
  const table = params.get("table");
  const id = params.get("id");
  const meta = TABLE_META[table];

  if (!meta) {
    document.getElementById("pageBody").appendChild(emptyState("Unknown section."));
    return;
  }

  // Correspondence has no list of its own here — it's browsed alongside
  // maps on assets.html, so old links to the list land there instead.
  if (table === "correspondence" && !id) {
    window.location.replace("assets.html");
    return;
  }

  if (id) {
    const backLink = document.getElementById("backLink");
    if (table === "correspondence") {
      backLink.href = "assets.html";
      backLink.textContent = "← Back to Assets";
    } else {
      backLink.href = "world.html?table=" + encodeURIComponent(table);
    }
    if (typeof applyBackLink === "function") applyBackLink();
    await renderDetail(table, id, meta);
  } else {
    await renderList(table, meta);
  }
}

// Sidebar filters for each table's list view. Each facet names the URL
// parameter that can preselect it (e.g. world.html?table=items&rarity=Rare)
// and pulls a string or string[] off a record; values that resolve to
// nothing are skipped, and a facet with no values at all isn't shown.
// Every table also gets name/summary search and a Tags facet.
const TABLE_FACETS = {
  locations: [
    { key: "type", label: "Type", value: function (r) { return r.locationType; }, format: capitalize },
    { key: "within", label: "Within", value: function (r, index) { return linkedName(r.parentLocation, index); } }
  ],
  npcs: [
    { key: "status", label: "Status", value: function (r) { return r.status; } },
    { key: "group", label: "Groups", value: function (r, index) { return linkNames(r.connectedGroups, index); } },
    { key: "quest", label: "Quests", value: function (r, index) { return linkNames(r.connectedQuests, index); } }
  ],
  quests: [
    { key: "status", label: "Status", value: function (r) { return r.status; } },
    { key: "group", label: "Groups", value: function (r, index) { return linkNames(r.connectedGroups, index); } },
    { key: "person", label: "People", value: function (r, index) { return linkNames(r.connectedPeople, index); } }
  ],
  items: [
    { key: "type", label: "Type", value: function (r) { return r.itemType; } },
    { key: "subtype", label: "Subtype", value: function (r) { return r.itemSubType; } },
    { key: "rarity", label: "Rarity", value: function (r) { return r.rarity; } },
    { key: "attunement", label: "Attunement", value: function (r) { return r.requiresAttunement ? "Required" : "Not required"; } }
  ],
  recipes: [
    { key: "tier", label: "Tier", value: function (r) { return r.craftingTier; } },
    { key: "rarity", label: "Rarity", value: function (r) { return r.rarity; } },
    { key: "crafter", label: "Crafter", value: function (r) { return r.crafter; } }
  ]
};

// Every exported note carries a Category/<Table> tag (it's how the exporter
// sorts notes into tables), so within one table's list it says nothing.
const TAG_FACET = {
  key: "tag",
  label: "Tags",
  value: function (r) { return (r.tags || []).filter(function (tag) { return tag.indexOf("Category/") !== 0; }); }
};

const worldListState = {
  table: null,
  records: [],
  index: new Map(),
  maps: [],
  facets: [],
  search: "",
  selected: {}
};

function tableFacets(table) {
  return (TABLE_FACETS[table] || []).concat([TAG_FACET]);
}

function facetValues(facet, record, index) {
  const value = facet.value(record, index);
  const values = Array.isArray(value) ? value : [value];
  return values.filter(function (v) { return v !== undefined && v !== null && v !== ""; }).map(String);
}

// Distinct values (with counts against the full, unfiltered list) for one
// facet, sorted alphabetically.
function facetOptions(records, facet, index) {
  const counts = new Map();
  records.forEach(function (record) {
    facetValues(facet, record, index).forEach(function (v) { counts.set(v, (counts.get(v) || 0) + 1); });
  });
  return Array.from(counts.keys())
    .sort(function (a, b) { return a.localeCompare(b); })
    .map(function (value) { return { value: value, count: counts.get(value) }; });
}

// A record passes when it matches the search text and, for every facet with
// something ticked, carries at least one of the ticked values.
function matchesWorldFilters(record, state) {
  if (state.search) {
    const haystack = ((record.name || "") + " " + (record.summary || "")).toLowerCase();
    if (haystack.indexOf(state.search) === -1) return false;
  }
  return state.facets.every(function (facet) {
    const selected = state.selected[facet.key];
    if (!selected || selected.size === 0) return true;
    return facetValues(facet, record, state.index).some(function (v) { return selected.has(v); });
  });
}

async function renderList(table, meta) {
  document.title = "Aleucia — " + meta.label;
  document.getElementById("pageTitle").textContent = meta.label;
  document.getElementById("pageLead").textContent = meta.lead;

  const [records, index, maps] = await Promise.all([
    ContentStore.getTable(table),
    ContentStore.getEntityIndex(),
    table === "locations" ? ContentStore.getMapIndex() : Promise.resolve([])
  ]);
  const body = document.getElementById("pageBody");

  if (!records || records.length === 0) {
    body.appendChild(emptyState(meta.empty + " Check back as the chronicle grows."));
    return;
  }

  const params = new URLSearchParams(window.location.search);
  worldListState.table = table;
  worldListState.records = records.slice().sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
  worldListState.index = index;
  worldListState.maps = maps;
  worldListState.search = "";
  worldListState.facets = tableFacets(table);
  worldListState.selected = {};
  worldListState.facets.forEach(function (facet) {
    worldListState.selected[facet.key] = new Set(params.getAll(facet.key));
  });

  document.querySelector(".page-content").classList.add("page-content--wide");

  const layout = document.createElement("div");
  layout.className = "assets-layout";

  const sidebar = document.createElement("aside");
  sidebar.className = "assets-sidebar";
  sidebar.appendChild(buildWorldSearchFilter(meta));
  worldListState.facets.forEach(function (facet) {
    const group = buildWorldCheckboxFilter(facet, facetOptions(worldListState.records, facet, index));
    if (group) sidebar.appendChild(group);
  });
  sidebar.appendChild(buildWorldClearButton());

  const results = document.createElement("div");
  results.className = "assets-results";

  const count = document.createElement("p");
  count.className = "filter-results-count";
  count.id = "worldResultsCount";
  results.appendChild(count);

  const grid = document.createElement("div");
  grid.className = "card-grid";
  grid.id = "worldGrid";
  results.appendChild(grid);

  const empty = emptyState("Nothing matches the selected filters.");
  empty.id = "worldEmptyState";
  empty.hidden = true;
  results.appendChild(empty);

  layout.appendChild(sidebar);
  layout.appendChild(results);
  body.appendChild(layout);

  renderWorldGrid();
}

function buildWorldSearchFilter(meta) {
  const wrap = document.createElement("div");
  wrap.className = "filter-group";

  const label = document.createElement("label");
  label.className = "filter-label";
  label.setAttribute("for", "worldSearchInput");
  label.textContent = "Search";
  wrap.appendChild(label);

  const input = document.createElement("input");
  input.type = "search";
  input.id = "worldSearchInput";
  input.className = "filter-search-input";
  input.placeholder = "Search " + meta.label.toLowerCase() + "…";
  input.addEventListener("input", function () {
    worldListState.search = input.value.trim().toLowerCase();
    renderWorldGrid();
  });
  wrap.appendChild(input);

  return wrap;
}

function buildCollapseToggle(label, list) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "filter-label filter-collapse-toggle";
  btn.setAttribute("aria-expanded", "true");
  btn.textContent = label;
  btn.addEventListener("click", function () {
    const collapsed = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    list.hidden = collapsed;
  });
  return btn;
}

function buildWorldCheckboxFilter(facet, options) {
  if (!options.length) return null;
  const selectedSet = worldListState.selected[facet.key];

  const wrap = document.createElement("div");
  wrap.className = "filter-group";

  const list = document.createElement("div");
  list.className = "filter-checkbox-list";
  wrap.appendChild(buildCollapseToggle(facet.label, list));
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
      renderWorldGrid();
    });
    optionLabel.appendChild(input);

    const text = document.createElement("span");
    text.textContent = facet.format ? facet.format(option.value) : option.value;
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

function buildWorldClearButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "filter-clear-btn";
  btn.textContent = "Clear filters";
  btn.addEventListener("click", function () {
    worldListState.search = "";
    Object.keys(worldListState.selected).forEach(function (key) { worldListState.selected[key].clear(); });
    document.querySelectorAll(".assets-sidebar input").forEach(function (el) {
      if (el.type === "checkbox") el.checked = false;
      else el.value = "";
    });
    renderWorldGrid();
  });
  return btn;
}

function renderWorldGrid() {
  const state = worldListState;
  const grid = document.getElementById("worldGrid");
  const empty = document.getElementById("worldEmptyState");
  const count = document.getElementById("worldResultsCount");

  const filtered = state.records.filter(function (record) { return matchesWorldFilters(record, state); });
  count.textContent = filtered.length + " of " + state.records.length + " shown";

  grid.innerHTML = "";
  grid.hidden = filtered.length === 0;
  empty.hidden = filtered.length !== 0;

  filtered.forEach(function (record) {
    if (state.table === "locations") grid.appendChild(locationCard(record, state.index, state.maps));
    else if (state.table === "quests") grid.appendChild(questCard(record, state.index));
    else if (state.table === "organisations") grid.appendChild(organisationCard(record));
    else if (state.table === "items") grid.appendChild(itemCard(record));
    else if (state.table === "npcs") grid.appendChild(personCard(record));
    else grid.appendChild(recordCard(state.table, record));
  });
}

function recordCard(table, record) {
  const card = document.createElement("a");
  card.className = "card";
  card.href = "world.html?table=" + encodeURIComponent(table) + "&id=" + encodeURIComponent(record.id);
  card.innerHTML =
    '<p class="card-title">' + escapeHtml(record.name) + "</p>" +
    '<p class="card-body">' + escapeHtml(cardSubtitle(table, record)) + "</p>";
  return card;
}

// Shared by location, item, and faction cards: a background-image thumbnail
// with just the name shown by default; hovering slides the name up and
// reveals a list of facts over a blurred, darkened copy of the same image
// (an overlay with a backdrop-filter blur sitting on top of the thumbnail,
// rather than a second blurred image).
function mediaCard(modifierClass, href, imageUrl, name, facts, emptyFactsText) {
  const card = document.createElement("a");
  card.className = "card " + modifierClass;
  card.href = href;

  const thumb = document.createElement("div");
  thumb.className = "card-thumb" + (imageUrl ? "" : " card-thumb--empty");
  if (imageUrl) thumb.style.backgroundImage = 'url("' + imageUrl + '")';
  card.appendChild(thumb);

  const overlay = document.createElement("div");
  overlay.className = "card-media-overlay";

  const title = document.createElement("p");
  title.className = "card-title";
  title.textContent = name;
  overlay.appendChild(title);

  const factsWrap = document.createElement("div");
  factsWrap.className = "card-media-facts";
  if (facts.length) {
    facts.forEach(function (pair) {
      const line = document.createElement("p");
      line.className = "card-media-fact";
      line.innerHTML = escapeHtml(pair[0]) + ": <strong>" + escapeHtml(pair[1]) + "</strong>";
      factsWrap.appendChild(line);
    });
  } else {
    const line = document.createElement("p");
    line.className = "card-media-fact";
    line.textContent = emptyFactsText;
    factsWrap.appendChild(line);
  }
  overlay.appendChild(factsWrap);

  card.appendChild(overlay);
  return card;
}

function locationCard(record, index, maps) {
  const mapMeta = findMapMeta(record, maps);
  // Cards show a small, cropped preview, so a compressed thumbFile (when the
  // export provides one) spares the list page from pulling every map's
  // full-resolution image — several MB apiece — just to paint a ~200px tile.
  const imageUrl = mapMeta ? encodeURI("data/" + (mapMeta.thumbFile || mapMeta.imageFile)) : null;
  return mediaCard(
    "card--location",
    "world.html?table=locations&id=" + encodeURIComponent(record.id),
    imageUrl,
    record.name,
    locationFacts(record, index),
    record.summary || "No further details recorded."
  );
}

// An item card previews its image with just the name beneath it; hovering
// reveals the item's type and rarity, same as a location card's map preview.
function itemCard(record) {
  return mediaCard(
    "card--item",
    "world.html?table=items&id=" + encodeURIComponent(record.id),
    (record.thumbFile || record.image) ? encodeURI("data/" + (record.thumbFile || record.image)) : null,
    record.name,
    itemFacts(record),
    record.summary || "No further details recorded."
  );
}

function itemFacts(record) {
  const facts = [];
  if (record.itemType && record.itemType.length) facts.push(["Type", record.itemType.join(", ")]);
  if (record.rarity) facts.push(["Rarity", record.rarity]);
  return facts;
}

// A faction card shows its symbol (record.image) as the background, its
// name always visible, and its type revealed on hover — same treatment as
// a location card's map thumbnail.
function organisationCard(record) {
  return mediaCard(
    "card--faction",
    "world.html?table=organisations&id=" + encodeURIComponent(record.id),
    (record.thumbFile || record.image) ? encodeURI("data/" + (record.thumbFile || record.image)) : null,
    record.name,
    organisationFacts(record),
    record.summary || "No further details recorded."
  );
}

function organisationFacts(record) {
  const facts = [];
  if (record.organisationType) facts.push(["Type", capitalize(record.organisationType)]);
  return facts;
}

// A People-page (npcs table) card: portrait, name and occupation, with
// species/gender/age revealed on hover or tap (see person-card.js).
function personCard(record) {
  return buildPersonCard({
    href: "world.html?table=npcs&id=" + encodeURIComponent(record.id),
    image: (record.thumbFile || record.image) ? "data/" + (record.thumbFile || record.image) : null,
    name: record.name,
    species: record.race || record.species,
    gender: record.gender,
    age: record.age,
    occupation: record.occupation,
    summary: record.summary
  });
}

// A quest card paints the quest's own image behind its name. Unlike other
// media cards, the quest giver and status stay visible instead of revealing
// on hover (see .card--quest in style.css).
function questCard(record, index) {
  return mediaCard(
    "card--quest",
    "world.html?table=quests&id=" + encodeURIComponent(record.id),
    (record.thumbFile || record.image) ? encodeURI("data/" + (record.thumbFile || record.image)) : null,
    record.name,
    questFacts(record, index),
    ""
  );
}

function questFacts(record, index) {
  return [
    ["Quest Giver", linkedName(record.questGiver, index) || linkText(record.contact) || "Unknown"],
    ["Status", record.status || "Unknown"]
  ];
}

function cardSubtitle(table, record) {
  if (table === "locations") return record.locationType ? capitalize(record.locationType) : record.summary || "";
  if (table === "items") return record.rarity || record.summary || "";
  if (table === "correspondence") return record.correspondenceType || record.summary || "";
  if (table === "recipes") return record.craftingTier || record.rarity || "";
  if (table === "quests") return record.status || record.summary || "";
  return record.summary || "";
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

async function renderDetail(table, id, meta) {
  const records = await ContentStore.getTable(table);
  const record = (records || []).find(function (r) { return r.id === id; });
  const body = document.getElementById("pageBody");

  if (!record) {
    document.title = "Aleucia — " + meta.label;
    document.getElementById("pageTitle").textContent = meta.label;
    document.getElementById("pageLead").textContent = "";
    body.appendChild(emptyState("This entry could not be found."));
    return;
  }

  document.title = "Aleucia — " + record.name;
  document.getElementById("pageTitle").textContent = record.name;
  document.getElementById("pageLead").textContent = meta.label;

  const index = await ContentStore.getEntityIndex();

  // A quest is a poster pinned to the guild board: its title, image and
  // summary live on the poster itself instead of the usual header layout.
  if (table === "quests") {
    document.getElementById("pageTitle").classList.add("visually-hidden");
    body.appendChild(questPoster(record, index));
  } else if (record.image) {
    const img = document.createElement("img");
    img.className = "entry-portrait";
    img.src = "data/" + record.image;
    img.alt = record.name;
    body.appendChild(img);
  }

  if (record.summary && table !== "quests") {
    body.appendChild(entrySummary(record.summary));
  }

  await renderEntityFields(table, record, index, body);

  if (["npcs", "organisations", "locations"].indexOf(table) !== -1) {
    body.appendChild(sectionHeading("Relationships"));
    const graphContainer = document.createElement("div");
    body.appendChild(graphContainer);
    await renderRelationshipGraph(graphContainer, record.id, record.name);
  }

  if (body.children.length === 0) {
    body.appendChild(emptyState("No further details recorded yet."));
  }
}

async function renderEntityFields(table, record, index, body) {
  if (table === "locations") await renderLocationFields(record, index, body);
  if (table === "items") renderItemFields(record, index, body);
  if (table === "correspondence") renderCorrespondenceFields(record, index, body);
  if (table === "recipes") renderRecipeFields(record, index, body);
  if (table === "quests") renderQuestFields(record, index, body);
  if (table === "npcs") renderNpcFields(record, index, body);
  if (table === "organisations") appendFacts(body, organisationFacts(record));

  if (record.tags && record.tags.length) {
    body.appendChild(sectionHeading("Tags"));
    body.appendChild(tagList(record.tags));
  }
}

async function renderLocationFields(record, index, body) {
  appendFacts(body, locationFacts(record, index));
  await renderLocationMap(record, index, body);
}

function locationFacts(record, index) {
  const facts = [];
  if (record.locationType) facts.push(["Type", capitalize(record.locationType)]);
  if (linkedName(record.parentLocation, index)) facts.push(["Within", linkedName(record.parentLocation, index)]);
  if (linkedName(record.owner, index)) facts.push(["Owner", linkedName(record.owner, index)]);
  return facts;
}

// The exporter's mapId field is the intended join to data/maps/index.json,
// but not every export populates it yet. A map's own id is always its
// source location's fileToSlug basename (see maps-exporter.ts), which is
// also always a location's own id's last path segment — so falling back to
// that keeps the map showing up even before mapId is wired up on the vault
// side, and costs nothing when mapId is already present.
function findMapMeta(record, maps) {
  if (!maps || maps.length === 0) return null;
  const fallbackId = (record.id || "").split("/").pop();
  return maps.find(function (m) { return m.id === record.mapId; }) ||
    maps.find(function (m) { return m.id === fallbackId; }) ||
    null;
}

async function renderLocationMap(record, index, body) {
  const maps = await ContentStore.getMapIndex();
  const mapMeta = findMapMeta(record, maps);

  const map = await ContentStore.getMap(mapMeta.id);
  if (!map) return;

  body.appendChild(sectionHeading("Map"));

  const container = document.createElement("div");
  container.className = "map-container map-container--embedded";
  body.appendChild(container);

  // renderMap depends on the Leaflet global loading from its CDN; a blocked
  // or offline request there shouldn't take out the rest of this page (tags,
  // relationships, etc. below still have nothing to do with maps).
  try {
    renderMap(container, map, index);
  } catch (err) {
    console.warn("Aleucia: could not render the inline map.", err);
    container.remove();
    body.appendChild(emptyState("The map could not be loaded."));
  }

  const link = document.createElement("a");
  link.className = "map-container__expand";
  link.href = "map.html?id=" + encodeURIComponent(mapMeta.id);
  link.textContent = "Open full-screen map ↗";
  body.appendChild(link);
}

function renderItemFields(record, index, body) {
  const facts = [];
  if (record.itemType && record.itemType.length) facts.push(["Type", record.itemType.join(", ")]);
  if (record.itemSubType && record.itemSubType.length) facts.push(["Subtype", record.itemSubType.join(", ")]);
  if (record.rarity) facts.push(["Rarity", record.rarity]);
  if (record.cost !== undefined) facts.push(["Cost", record.cost]);
  if (record.weight !== undefined) facts.push(["Weight", record.weight]);
  if (record.requiresAttunement) facts.push(["Attunement", "Required"]);
  if (record.cursed) facts.push(["Cursed", "Yes"]);
  appendFacts(body, facts);

  // The note's own "# Description" section (damage/properties lines, lore),
  // line breaks kept — see data-schema.json's items.body.
  if (record.body) {
    const description = document.createElement("p");
    description.className = "item-description";
    description.textContent = record.body;
    body.appendChild(description);
  }

  if ((record.itemType || []).indexOf("Recipe Book") !== -1) appendBookLink(record, body);
}

// A recipe book's item record shares its id with its data/books.json entry
// (see data-schema.json's "books" table), where the whole book can be read
// and printed. The link only appears once that entry is confirmed, since an
// older export may not include books yet.
function appendBookLink(record, body) {
  const link = document.createElement("a");
  link.className = "book-read-link";
  link.href = "books.html?book=" + encodeURIComponent(record.id);
  link.textContent = "Read and print this book \u2192";
  return ContentStore.getTable("books").then(function (books) {
    if ((books || []).some(function (b) { return b.id === record.id; })) body.appendChild(link);
  });
}

// A Category/Correspondence note (see data-schema.json's "correspondence"
// table): sender/recipient are stored directly as link fields on the record
// itself (the vault's own Sender/Recipient frontmatter), unlike item
// ownership which only ever exists as a relationships edge.
function renderCorrespondenceFields(record, index, body) {
  // record.summary (rendered above by renderDetail, same as every other
  // table) is a short excerpt for card subtitles — record.body is the
  // letter's complete text, rendered as a page of parchment rather than the
  // site's usual panels, since this is the letter itself, not a UI blurb
  // about it.
  if (record.body) {
    body.appendChild(letterParchment(record.body));
  }

  const facts = [];
  if (record.correspondenceType) facts.push(["Type", record.correspondenceType]);
  if (record.dateSent) facts.push(["Sent", record.dateSent]);
  if (record.dateReceived) facts.push(["Received", record.dateReceived]);
  appendFacts(body, facts);

  const senders = entityHrefs(record.sender, index);
  if (senders.length) {
    body.appendChild(sectionHeading("Sender"));
    body.appendChild(linkedTagList(senders));
  }

  const recipients = entityHrefs(record.recipient, index);
  if (recipients.length) {
    body.appendChild(sectionHeading("Recipient"));
    body.appendChild(linkedTagList(recipients));
  }

  const quests = linkNames(record.connectedQuests, index);
  if (quests.length) {
    body.appendChild(sectionHeading("Connected Quests"));
    body.appendChild(tagList(quests));
  }

  const groups = linkNames(record.connectedGroups, index);
  if (groups.length) {
    body.appendChild(sectionHeading("Connected Groups"));
    body.appendChild(tagList(groups));
  }
}

// A Category/Recipe note (see data-schema.json's "recipes" table) is its own
// entity, distinct from the item(s) it produces — checked against a real
// vault note ("Recipe - Ale mug.md"), which has no Item_Crafting fileClass
// involved at all.
function renderRecipeFields(record, index, body) {
  const facts = [];
  if (record.rarity) facts.push(["Rarity", record.rarity]);
  if (record.crafter && record.crafter.length) facts.push(["Crafter", record.crafter.join(", ")]);
  if (record.craftingTier) facts.push(["Tier", record.craftingTier]);
  if (record.craftingTools && record.craftingTools.length) facts.push(["Tools", record.craftingTools.join(", ")]);
  if (record.craftingTime !== undefined) facts.push(["Time", record.craftingTime + " days"]);
  if (record.baseSuccess !== undefined) facts.push(["Base Success", record.baseSuccess + "%"]);
  appendFacts(body, facts);

  body.appendChild(sectionHeading("Ingredients"));
  const ingredients = record.ingredients || [];
  if (ingredients.length === 0) {
    body.appendChild(emptyState("No ingredients recorded yet."));
  } else {
    renderLinkedItemCards(ingredients, index, body, { showRequired: true });
  }

  const output = record.output || [];
  if (output.length) {
    body.appendChild(sectionHeading("Produces"));
    renderLinkedItemCards(output, index, body, { showRequired: false });
  }

  const groups = linkNames(record.connectedGroups, index);
  if (groups.length) {
    body.appendChild(sectionHeading("Connected Groups"));
    body.appendChild(tagList(groups));
  }
}

// Shared by the recipes table's ingredients/output lists: each entry names
// another item plus an optional qty (and, for ingredients, a
// required/optional flag).
function renderLinkedItemCards(entries, index, body, opts) {
  opts = opts || {};
  const grid = document.createElement("div");
  grid.className = "card-grid";
  entries.forEach(function (entry) {
    const info = index.get(entry.item);
    const card = document.createElement(info ? "a" : "div");
    card.className = "card";
    if (info) card.href = "world.html?table=items&id=" + encodeURIComponent(entry.item);
    const name = info ? info.name : "Unknown item";
    const parts = [];
    if (entry.qty) parts.push(entry.qty + "x");
    if (opts.showRequired) parts.push(entry.required ? "Required" : "Optional");
    card.innerHTML = '<p class="card-title">' + escapeHtml(name) + '</p><p class="card-body">' + escapeHtml(parts.join(" ")) + "</p>";
    grid.appendChild(card);
  });
  body.appendChild(grid);
}

// The poster (questPoster) already carries the giver, status, reward and
// location, so the fields below it are just who and what else is involved.
function renderQuestFields(record, index, body) {
  const people = linkNames(record.connectedPeople, index);
  if (people.length) {
    body.appendChild(sectionHeading("Connected People"));
    body.appendChild(tagList(people));
  }

  const groups = linkNames(record.connectedGroups, index);
  if (groups.length) {
    body.appendChild(sectionHeading("Connected Groups"));
    body.appendChild(tagList(groups));
  }
}

function renderNpcFields(record, index, body) {
  if (record.aliases && record.aliases.length) {
    body.appendChild(sectionHeading("Also Known As"));
    body.appendChild(tagList(record.aliases));
  }
  if (record.status) appendFacts(body, [["Status", record.status]]);

  const quests = linkNames(record.connectedQuests, index);
  if (quests.length) {
    body.appendChild(sectionHeading("Connected Quests"));
    body.appendChild(tagList(quests));
  }

  const groups = linkNames(record.connectedGroups, index);
  if (groups.length) {
    body.appendChild(sectionHeading("Connected Groups"));
    body.appendChild(tagList(groups));
  }
}

// ---- Quest posters ----
//
// A quest's detail page is a notice pinned to a guild board: title, image,
// reward, point of contact, location, the objectives the party has already
// completed and the clues they've found. Everything comes from the quests record (see data-schema.json);
// the objectives, clues, prose and the "Difficulty:"-style notes are parsed out of
// its body, which is only the note's player-facing Quest Info section.

const QUEST_STEP_RE = /^[-*+]\s+\[([ xX])\]\s+(.+)$/;
const QUEST_NOTE_RE = /^([A-Z][A-Za-z ]{1,30}):\s+(.+)$/;

// Turns the exported body into { prose, notes, steps, clues }. The section's
// own heading ("Quest Info") and stray rules are dropped; a prose paragraph
// that opens by repeating the quest's name ("Safe Passage - Escort ...")
// loses that prefix, since the poster already shows it as the title.
//
// Quest Info can hold "## Objectives" and "## Clues" subheadings; the export
// flattens them to plain "Objectives" / "Clues" lines, which switch what the
// list items below them are. Under Clues, "- [x]" and plain "- " bullets are
// clues the party has found and "- [ ]" ones are not found yet.
const QUEST_BULLET_RE = /^[-*+]\s+(.+)$/;
const QUEST_OBJECTIVES_LABEL_RE = /^(objectives?|steps|quest steps)$/i;
const QUEST_CLUES_LABEL_RE = /^clues?$/i;

function parseQuestBody(body, name) {
  const result = { prose: [], notes: [], steps: [], clues: [] };
  if (!body) return result;
  const lowerName = (name || "").toLowerCase();
  let inClues = false;
  let paragraph = [];
  function flush() {
    if (paragraph.length) result.prose.push(paragraph.join(" "));
    paragraph = [];
  }
  String(body).split("\n").forEach(function (raw) {
    const line = raw.trim();
    const step = QUEST_STEP_RE.exec(line);
    const bullet = QUEST_BULLET_RE.exec(line);
    const note = QUEST_NOTE_RE.exec(line);
    if (!line || /^-{3,}$/.test(line) || /^quest info$/i.test(line)) {
      flush();
    } else if (QUEST_CLUES_LABEL_RE.test(line) || QUEST_OBJECTIVES_LABEL_RE.test(line)) {
      flush();
      inClues = QUEST_CLUES_LABEL_RE.test(line);
    } else if (inClues) {
      if (step) result.clues.push({ text: step[2].trim(), found: step[1] !== " " });
      else result.clues.push({ text: (bullet ? bullet[1] : line).trim(), found: true });
    } else if (step) {
      flush();
      result.steps.push({ text: step[2].trim(), done: step[1] !== " " });
    } else if (note) {
      flush();
      result.notes.push([note[1].trim(), note[2].trim()]);
    } else {
      let text = line;
      if (!paragraph.length && lowerName && text.toLowerCase().indexOf(lowerName) === 0) {
        const rest = text.slice(lowerName.length).replace(/^\s*[-–—:]\s*/, "");
        if (rest !== text.slice(lowerName.length)) text = rest;
      }
      paragraph.push(text);
    }
  });
  flush();
  return result;
}

// "[[2-World/People/Aldric|Aldric]]" -> "Aldric", "[[Millhaven]]" ->
// "Millhaven"; plain text passes through. Lists are joined.
function linkText(value) {
  if (Array.isArray(value)) return value.map(linkText).filter(Boolean).join(", ");
  if (value == null) return "";
  return String(value).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (_m, target, alias) {
    return (alias || target.split("/").pop()).trim();
  }).trim();
}

// Finds an exported record by display name, so a plain-text location or
// contact still links to its page when one exists.
function findByName(name, index, tables) {
  if (!name || !index) return undefined;
  const wanted = name.toLowerCase();
  let found;
  index.forEach(function (entry, id) {
    if (!found && entry && entry.name && entry.name.toLowerCase() === wanted &&
        (!tables || tables.indexOf(entry.table) !== -1)) found = id;
  });
  return found;
}

function questStampText(status) {
  const s = (status || "").toLowerCase();
  if (/complete|success|done/.test(s)) return "Completed";
  if (/abandon/.test(s)) return "Abandoned";
  if (/fail/.test(s)) return "Failed";
  return "";
}

function questPoster(record, index) {
  const parsed = parseQuestBody(record.body, record.name);
  const notes = parsed.notes.filter(function (n) { return n[0].toLowerCase() !== "reward"; });
  const bodyReward = parsed.notes.find(function (n) { return n[0].toLowerCase() === "reward"; });

  const poster = document.createElement("article");
  poster.className = "quest-poster";

  const stamp = questStampText(record.status);
  if (stamp) {
    poster.classList.add("quest-poster--" + stamp.toLowerCase());
    const mark = document.createElement("span");
    mark.className = "quest-poster__stamp";
    mark.textContent = stamp;
    poster.appendChild(mark);
  }

  const kicker = document.createElement("p");
  kicker.className = "quest-poster__kicker";
  kicker.textContent = "Adventurers Wanted";
  poster.appendChild(kicker);

  const title = document.createElement("h2");
  title.className = "quest-poster__title";
  title.textContent = record.name;
  poster.appendChild(title);

  if (record.image) {
    const figure = document.createElement("div");
    figure.className = "quest-poster__image";
    const img = document.createElement("img");
    img.src = encodeURI("data/" + record.image);
    img.alt = record.name;
    figure.appendChild(img);
    poster.appendChild(figure);
  }

  const prose = parsed.prose.length ? parsed.prose : (record.summary ? [record.summary] : []);
  prose.forEach(function (text) {
    const p = document.createElement("p");
    p.className = "quest-poster__text";
    p.textContent = text;
    poster.appendChild(p);
  });

  const reward = linkText(record.reward) || (bodyReward ? bodyReward[1] : "");
  const rewardBox = document.createElement("div");
  rewardBox.className = "quest-poster__reward";
  rewardBox.innerHTML = '<span class="quest-poster__label">Reward</span>' +
    '<span class="quest-poster__reward-value">' + escapeHtml(reward || "To be negotiated") + "</span>";
  poster.appendChild(rewardBox);

  const giverId = (record.questGiver && index.get(record.questGiver)) ? record.questGiver
    : findByName(linkText(record.contact), index, ["npcs", "characters"]);
  const locationName = linkText(record.location);
  const locationId = findByName(locationName, index, ["locations"]);

  const details = document.createElement("dl");
  details.className = "quest-poster__details";
  addPosterDetail(details, "Point of Contact", giverId, linkText(record.contact), index);
  addPosterDetail(details, "Location", locationId, locationName, index);
  notes.forEach(function (n) { addPosterDetail(details, n[0], null, n[1], index); });
  if (record.status) addPosterDetail(details, "Status", null, record.status, index);
  poster.appendChild(details);

  const steps = questSteps(parsed.steps);
  if (steps) poster.appendChild(steps);
  const clues = questClues(parsed.clues);
  if (clues) poster.appendChild(clues);

  return poster;
}

function addPosterDetail(list, label, id, fallback, index) {
  const href = id ? ContentStore.getEntityHref(id, index) : undefined;
  const text = href ? href.label : fallback;
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  if (href) {
    const a = document.createElement("a");
    a.href = href.url;
    a.textContent = text;
    dd.appendChild(a);
  } else {
    dd.textContent = text || "Unknown";
  }
  list.appendChild(dt);
  list.appendChild(dd);
}

// Only the steps the party has already done are shown. Upcoming steps (and
// how many there are) would spoil what's ahead, so they never reach the page.
function questSteps(steps) {
  const done = steps.filter(function (s) { return s.done; });
  if (!done.length) return null;

  const wrap = document.createElement("section");
  wrap.className = "quest-poster__steps";

  const heading = document.createElement("p");
  heading.className = "quest-poster__label";
  heading.textContent = "Completed Objectives";
  wrap.appendChild(heading);

  const list = document.createElement("ol");
  done.forEach(function (step) {
    const li = document.createElement("li");
    li.className = "quest-step quest-step--done";
    const box = document.createElement("span");
    box.className = "quest-step__box";
    box.setAttribute("aria-hidden", "true");
    box.textContent = "✓";
    const text = document.createElement("span");
    text.className = "quest-step__text";
    text.textContent = step.text;
    li.appendChild(box);
    li.appendChild(text);
    list.appendChild(li);
  });
  wrap.appendChild(list);
  return wrap;
}

// The clues the party has turned up so far, scrawled under the objectives.
// Clues not found yet ("- [ ]") stay off the page, like upcoming objectives.
function questClues(clues) {
  const found = clues.filter(function (c) { return c.found; });
  if (!found.length) return null;

  const wrap = document.createElement("section");
  wrap.className = "quest-poster__clues";

  const heading = document.createElement("p");
  heading.className = "quest-poster__label";
  heading.textContent = "Clues";
  wrap.appendChild(heading);

  const list = document.createElement("ul");
  found.forEach(function (clue) {
    const li = document.createElement("li");
    li.className = "quest-clue";
    li.textContent = clue.text;
    list.appendChild(li);
  });
  wrap.appendChild(list);
  return wrap;
}

function linkedName(id, index) {
  const entry = id && index.get(id);
  return entry ? entry.name : undefined;
}

function linkNames(ids, index) {
  return (ids || []).map(function (id) { return linkedName(id, index); }).filter(Boolean);
}

// Sender/recipient (see renderCorrespondenceFields) point at whichever
// nameable table the letter's writer picked, so ContentStore.getEntityHref
// -- already used for map popups and the relationship graph -- resolves
// each id to its actual page rather than just a display name; an id with
// no matching page (getEntityHref returns undefined) is dropped, same as
// an unresolved linkNames() entry.
function entityHrefs(ids, index) {
  return (ids || []).map(function (id) { return ContentStore.getEntityHref(id, index); }).filter(Boolean);
}

function appendFacts(body, facts) {
  if (!facts.length) return;
  const row = document.createElement("div");
  row.className = "stat-row";
  facts.forEach(function (pair) {
    const chip = document.createElement("span");
    chip.className = "stat-chip";
    chip.innerHTML = escapeHtml(pair[0]) + ": <strong>" + escapeHtml(String(pair[1])) + "</strong>";
    row.appendChild(chip);
  });
  body.appendChild(row);
}

function entrySummary(text) {
  const p = document.createElement("p");
  p.className = "entry-summary";
  p.textContent = text;
  return p;
}

// A correspondence record's full letter text (see SCHEMA.md), rendered as a
// page of parchment rather than the plain italic blurb every table's
// .summary gets.
function letterParchment(text) {
  const wrap = document.createElement("div");
  wrap.className = "letter-parchment";
  const p = document.createElement("p");
  p.className = "letter-parchment__text";
  p.textContent = text;
  wrap.appendChild(p);
  return wrap;
}

function emptyState(text) {
  const p = document.createElement("p");
  p.className = "empty-state";
  p.textContent = text;
  return p;
}

function sectionHeading(text) {
  const h = document.createElement("p");
  h.className = "section-heading";
  h.textContent = text;
  return h;
}

function tagList(names) {
  const wrap = document.createElement("div");
  wrap.className = "tag-list";
  names.forEach(function (name) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = name;
    wrap.appendChild(tag);
  });
  return wrap;
}

// Same visual tag as tagList(), but each entry ({url, label} from
// ContentStore.getEntityHref) links to the referenced entity's page.
function linkedTagList(entries) {
  const wrap = document.createElement("div");
  wrap.className = "tag-list";
  entries.forEach(function (entry) {
    const tag = document.createElement("a");
    tag.className = "tag";
    tag.href = entry.url;
    tag.textContent = entry.label;
    wrap.appendChild(tag);
  });
  return wrap;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", initWorldPage);
