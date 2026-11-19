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
    // A quest that's still open can be printed and pinned up at the table.
    if (!questOutcome(record.status)) {
      document.body.classList.add("quest-printable");
      body.appendChild(questPrintBar());
    }
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

// How a quest ended: "sealed" once completed (the giver's wax seal),
// "torn" once failed or abandoned (the poster is ripped down), "" while
// it's still open.
function questOutcome(status) {
  const s = (status || "").toLowerCase();
  if (/abandon|fail/.test(s)) return "torn";
  if (/complete|success|done/.test(s)) return "sealed";
  return "";
}

// ---- Wax seals ----
//
// A finished quest is sealed in wax by whoever gave it. Everything about the
// seal comes from the giver's name, so the same giver always presses the
// same seal on every quest: the wax colour, the drip of the blob's edge,
// their initials in the centre and their name around the rim.

const SEAL_WAXES = [
  { name: "crimson", base: "#8f1d17", light: "#c9473c", dark: "#4d0a07" },
  { name: "oxblood", base: "#5f1322", light: "#93324a", dark: "#300810" },
  { name: "forest", base: "#22502f", light: "#4f8a5d", dark: "#0f2817" },
  { name: "navy", base: "#1f3160", light: "#4a64a3", dark: "#0d1631" },
  { name: "jet", base: "#2a2522", light: "#5f5650", dark: "#100d0b" },
  { name: "ochre", base: "#9c6d16", light: "#d4a443", dark: "#4f3507" },
  { name: "violet", base: "#4d2459", light: "#82508f", dark: "#25102c" },
  { name: "teal", base: "#1d5558", light: "#4b8e90", dark: "#0b2a2c" }
];

// Titles that shouldn't become initials ("Merchant Aldric Thornweave" -> AT).
const SEAL_TITLES = /^(the|of|merchant|keeper|guildmaster|guild|master|mistress|lord|lady|sir|ser|dame|captain|capt|magistrate|elder|brother|sister|father|mother|old|young|king|queen|prince|princess|duke|duchess|baron|baroness|count|countess|high|priest|priestess|mayor|commander|general|doctor|dr|professor|archmage|mage|sage|chief|warden|sheriff)$/i;

function sealHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sealRandom(seed) {
  let x = seed || 1;
  return function () {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

function sealInitials(name) {
  const words = String(name || "").replace(/[^A-Za-z' -]/g, " ").split(/[\s-]+/).filter(Boolean);
  const kept = words.filter(function (w) { return !SEAL_TITLES.test(w); });
  const use = kept.length ? kept : words;
  if (!use.length) return "?";
  const letters = use.length > 1 ? [use[0], use[use.length - 1]] : [use[0]];
  return letters.map(function (w) { return w.replace(/^'+/, "").charAt(0).toUpperCase(); }).join("");
}

// The seal's look for a giver: { wax, initials, rim, blob } — blob is the
// SVG path of the poured wax, a wobbly circle seeded by the name.
function sealDesign(giverName) {
  const name = (giverName || "").trim() || "Unknown";
  const seed = sealHash(name.toLowerCase());
  const rand = sealRandom(seed);
  rand(); rand();
  const wax = SEAL_WAXES[Math.floor(rand() * SEAL_WAXES.length)];

  const points = [];
  const count = 22;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 52 + (rand() - 0.35) * 7;
    points.push([60 + Math.cos(angle) * r, 60 + Math.sin(angle) * r]);
  }
  function mid(p, q) { return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; }
  function fmt(p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }
  let blob = "M " + fmt(mid(points[count - 1], points[0]));
  for (let i = 0; i < count; i++) {
    blob += " Q " + fmt(points[i]) + " " + fmt(mid(points[i], points[(i + 1) % count]));
  }
  blob += " Z";

  let rim = name.toUpperCase() + " ✦ ";
  while (rim.length < 30) rim += name.toUpperCase() + " ✦ ";

  return { wax: wax, initials: sealInitials(name), rim: rim, blob: blob, tilt: Math.round((rand() - 0.5) * 24) };
}

let sealCounter = 0;

function waxSeal(giverName) {
  const design = sealDesign(giverName);
  const id = "seal" + (++sealCounter);
  const wax = design.wax;
  const svgNS = "http://www.w3.org/2000/svg";

  const wrap = document.createElement("div");
  wrap.className = "quest-poster__seal";
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", "Wax seal of " + ((giverName || "").trim() || "an unknown giver"));
  wrap.style.setProperty("--seal-tilt", design.tilt + "deg");

  wrap.innerHTML =
    '<svg xmlns="' + svgNS + '" viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
      "<defs>" +
        '<radialGradient id="' + id + 'w" cx="38%" cy="32%" r="75%">' +
          '<stop offset="0" stop-color="' + wax.light + '"/>' +
          '<stop offset="0.45" stop-color="' + wax.base + '"/>' +
          '<stop offset="1" stop-color="' + wax.dark + '"/>' +
        "</radialGradient>" +
        '<radialGradient id="' + id + 'd" cx="60%" cy="65%" r="70%">' +
          '<stop offset="0" stop-color="' + wax.base + '"/>' +
          '<stop offset="1" stop-color="' + wax.dark + '"/>' +
        "</radialGradient>" +
        '<path id="' + id + 'r" d="M 60 26 A 34 34 0 1 1 59.99 26"/>' +
      "</defs>" +
      '<path d="' + design.blob + '" fill="url(#' + id + 'w)"/>' +
      '<circle cx="60" cy="60" r="41" fill="url(#' + id + 'd)" stroke="' + wax.dark + '" stroke-width="2"/>' +
      '<circle cx="60" cy="60" r="41" fill="none" stroke="' + wax.light + '" stroke-opacity="0.45" stroke-width="1" transform="translate(-0.8 -0.8)"/>' +
      '<circle cx="60" cy="60" r="26" fill="none" stroke="' + wax.dark + '" stroke-width="1.2"/>' +
      '<text class="quest-seal__rim" fill="' + wax.light + '" fill-opacity="0.85">' +
        '<textPath href="#' + id + 'r" textLength="211" lengthAdjust="spacingAndGlyphs">' + escapeHtml(design.rim) + "</textPath>" +
      "</text>" +
      '<text class="quest-seal__mono" x="60.8" y="61.8" fill="' + wax.dark + '">' + escapeHtml(design.initials) + "</text>" +
      '<text class="quest-seal__mono" x="59.4" y="60.4" fill="' + wax.light + '" fill-opacity="0.7">' + escapeHtml(design.initials) + "</text>" +
      '<text class="quest-seal__mono" x="60" y="61" fill="' + wax.base + '">' + escapeHtml(design.initials) + "</text>" +
      '<ellipse cx="42" cy="36" rx="12" ry="6" fill="#fff" fill-opacity="0.16" transform="rotate(-35 42 36)"/>' +
    "</svg>";
  return wrap;
}

function questPoster(record, index) {
  const parsed = parseQuestBody(record.body, record.name);
  const notes = parsed.notes.filter(function (n) { return n[0].toLowerCase() !== "reward"; });
  const bodyReward = parsed.notes.find(function (n) { return n[0].toLowerCase() === "reward"; });

  const poster = document.createElement("article");
  poster.className = "quest-poster";

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

  poster.appendChild(questWriteIn());

  // A completed quest is sealed by its giver, or by the group behind it when
  // the note names no giver. A failed or abandoned one is torn down instead.
  const outcome = questOutcome(record.status);
  if (outcome === "sealed") {
    const groupName = linkedName((record.connectedGroups || [])[0], index);
    const sealer = (giverId && linkedName(giverId, index)) || linkText(record.contact) || groupName || "";
    poster.classList.add("quest-poster--sealed");
    poster.appendChild(waxSeal(sealer));
  } else if (outcome === "torn") {
    return tornPoster(poster, record.name);
  }

  return poster;
}

// A failed or abandoned quest's poster, taken down, ripped across and laid
// flat: the bottom half lies on top of the top half, which pokes out from
// under it just far enough to show the title. Both halves are the same
// poster clipped either side of one ragged tear line, and each has a pale
// strip of torn paper fibre along its ripped edge. The tear is seeded by
// the quest's name, so it is the same every visit but different from
// poster to poster. The bottom copy is hidden from screen readers and
// keyboard focus so the poster is only read once.
function tornPoster(poster, name) {
  const tear = tearLine(name);
  const wrap = document.createElement("div");
  wrap.className = "quest-poster-torn";

  ["top", "bottom"].forEach(function (side) {
    const piece = document.createElement("div");
    piece.className = "quest-tear quest-tear--" + side;

    const fibre = document.createElement("div");
    fibre.className = "quest-tear__fibre";
    fibre.style.clipPath = tearBand(tear.fibre, side);
    piece.appendChild(fibre);

    const clip = document.createElement("div");
    clip.className = "quest-tear__clip";
    clip.style.clipPath = tearPolygon(tear.edge, side, 0);
    const copy = side === "top" ? poster : poster.cloneNode(true);
    copy.classList.add("quest-poster--torn");
    if (side === "bottom") {
      piece.setAttribute("aria-hidden", "true");
      copy.querySelectorAll("a").forEach(function (a) { a.setAttribute("tabindex", "-1"); });
    }
    clip.appendChild(copy);
    piece.appendChild(clip);
    wrap.appendChild(piece);
  });

  // How far the bottom half slides up over the top one depends on where the
  // title ends, which depends on how many lines it wraps to, so it's
  // measured once the poster is on the page and again whenever it resizes.
  const ys = tear.edge.map(function (p) { return p[1]; });
  const highest = Math.min.apply(null, ys);
  const lowest = Math.max.apply(null, ys);
  function fit() { fitTornPoster(wrap, poster, highest, lowest); }
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(fit);
  if (typeof ResizeObserver === "function") new ResizeObserver(fit).observe(poster);
  return wrap;
}

// Slides the bottom half up until its ragged top edge sits just below the
// title (--tear-lift), and trims the top half's box to the paper left above
// the tear (--tear-keep) so its clipped-away lower half doesn't stretch the
// page. Both are px custom properties on the torn poster's wrapper.
function fitTornPoster(wrap, poster, highestTearPoint, lowestTearPoint) {
  const title = poster.querySelector(".quest-poster__title");
  if (!title || !poster.offsetHeight) return;
  const middle = poster.offsetHeight / 2;
  const titleBottom = title.offsetTop + title.offsetHeight;
  const lift = Math.max(0, Math.round(middle + highestTearPoint - titleBottom - 6));
  wrap.style.setProperty("--tear-lift", lift + "px");
  wrap.style.setProperty("--tear-keep", Math.ceil(middle + lowestTearPoint + 8) + "px");
}

// The rip: a run of points across the poster, x in % of its width and y in
// px either side of its middle. It wanders rather than zigzags: a slow
// diagonal drift plus a random walk, with small fibre-sized jitter on top
// and the odd sharper snag. The fibre line is the same rip with its own
// finer jitter, so the pale torn edge looks frayed rather than ruled.
function tearLine(name) {
  const rand = sealRandom(sealHash("tear:" + (name || "")));
  const edge = [];
  const fibre = [];
  const steps = 46;
  let walk = 0;
  for (let i = 0; i <= steps; i++) {
    const x = -2 + (i / steps) * 104 + (i && i < steps ? (rand() - 0.5) * 1.6 : 0);
    walk += (rand() - 0.5) * 7;
    walk *= 0.9;
    const snag = rand() < 0.12 ? (rand() - 0.5) * 14 : 0;
    const y = 28 - (i / steps) * 40 + walk + snag + (rand() - 0.5) * 3;
    edge.push([x, y]);
    fibre.push([x + (rand() - 0.5) * 0.8, y + (rand() - 0.5) * 2.5]);
  }
  return { edge: edge, fibre: fibre };
}

// The strip of torn fibre along one piece's ripped edge: from a few px
// past the paper's edge back a little way into the paper, so it only
// shows along the rip and nowhere else around the poster.
function tearBand(points, side) {
  function pt(p, shift) { return p[0].toFixed(2) + "% calc(50% + " + (p[1] + shift).toFixed(1) + "px)"; }
  const out = side === "top" ? 4 : -4;
  const inward = side === "top" ? -16 : 16;
  const outer = points.map(function (p) { return pt(p, out); });
  const inner = points.slice().reverse().map(function (p) { return pt(p, inward); });
  return "polygon(" + outer.concat(inner).join(", ") + ")";
}

// One side of the poster as a clip-path polygon bounded by the tear line,
// pushed `shift` px up (negative) or down (positive) so the fibre strip
// shows past the paper's ripped edge.
function tearPolygon(points, side, shift) {
  function pt(p) { return p[0].toFixed(2) + "% calc(50% + " + (p[1] + shift).toFixed(1) + "px)"; }
  const line = points.map(pt);
  if (side === "top") {
    return "polygon(-10% -10%, 110% -10%, " + line.slice().reverse().join(", ") + ")";
  }
  return "polygon(" + line.join(", ") + ", 110% 110%, -10% 110%)";
}

// Blank space on a printed poster for the players to fill in themselves as
// they go: a column of empty checkbox lines for objectives and a column of
// ruled lines for clues. Only the print stylesheet shows it, where it
// stretches to fill whatever room the poster leaves on the sheet.
function questWriteIn() {
  const wrap = document.createElement("section");
  wrap.className = "quest-poster__writein";
  wrap.setAttribute("aria-hidden", "true");
  [["Objectives", "quest-writein--objectives"], ["Clues", "quest-writein--clues"]].forEach(function (col) {
    const box = document.createElement("div");
    box.className = "quest-writein " + col[1];
    const label = document.createElement("p");
    label.className = "quest-poster__label";
    label.textContent = col[0];
    const lines = document.createElement("div");
    lines.className = "quest-writein__lines";
    box.appendChild(label);
    box.appendChild(lines);
    wrap.appendChild(box);
  });
  return wrap;
}

// The Print button under an open quest's poster. The print stylesheet
// (@media print in style.css, under .quest-printable) leaves only the
// poster on the page.
const QUEST_PRINT_WAIT_MS = 4000;

function questPrintBar() {
  const bar = document.createElement("div");
  bar.className = "quest-print-bar";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "quest-print-btn";
  button.textContent = "Print this poster";
  button.addEventListener("click", function () { printQuestPoster(button); });
  bar.appendChild(button);

  const hint = document.createElement("p");
  hint.className = "quest-print-hint";
  hint.textContent = "Prints the poster on its own. Choose “Save as PDF” in the print dialog to keep a copy.";
  bar.appendChild(hint);
  return bar;
}

// The poster's fonts and artwork must be in before the print dialog
// snapshots the page, or it prints in a fallback font with an empty frame.
// A picture that never arrives mustn't hold the dialog hostage, though.
function printQuestPoster(button) {
  if (button) button.disabled = true;
  const images = Array.prototype.slice.call(document.querySelectorAll(".quest-poster img"));
  const loaded = images.map(function (img) {
    if (img.complete) return Promise.resolve();
    return new Promise(function (resolve) {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  });
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const giveUp = new Promise(function (resolve) { setTimeout(resolve, QUEST_PRINT_WAIT_MS); });
  return Promise.race([Promise.all([fonts].concat(loaded)), giveUp]).then(function () {
    if (button) button.disabled = false;
    window.print();
  });
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
