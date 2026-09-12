/**
 * Aleucia World Pages
 *
 * One generic list+detail page (world.html) for every entity table besides
 * characters (which keep their own dedicated pages) — locations,
 * organisations, npcs, quests, items. Which table and, optionally, which
 * record to show come from the URL: world.html?table=items or
 * world.html?table=items&id=<id>. This avoids ten near-duplicate HTML files
 * for what's really one layout with a per-table field list.
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

  if (id) {
    document.getElementById("backLink").href = "world.html?table=" + encodeURIComponent(table);
    await renderDetail(table, id, meta);
  } else {
    await renderList(table, meta);
  }
}

async function renderList(table, meta) {
  document.title = "Aleucia — " + meta.label;
  document.getElementById("pageTitle").textContent = meta.label;
  document.getElementById("pageLead").textContent = meta.lead;

  const records = await ContentStore.getTable(table);
  const body = document.getElementById("pageBody");

  if (!records || records.length === 0) {
    body.appendChild(emptyState(meta.empty + " Check back as the chronicle grows."));
    return;
  }

  const grid = document.createElement("div");
  grid.className = "card-grid";
  records
    .slice()
    .sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); })
    .forEach(function (record) {
      const card = document.createElement("a");
      card.className = "card";
      card.href = "world.html?table=" + encodeURIComponent(table) + "&id=" + encodeURIComponent(record.id);
      card.innerHTML =
        '<p class="card-title">' + escapeHtml(record.name) + "</p>" +
        '<p class="card-body">' + escapeHtml(cardSubtitle(table, record)) + "</p>";
      grid.appendChild(card);
    });
  body.appendChild(grid);
}

function cardSubtitle(table, record) {
  if (table === "locations") return record.locationType ? capitalize(record.locationType) : record.summary || "";
  if (table === "items") return record.rarity || (record.crafting ? "Craftable" : "") || record.summary || "";
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

  if (record.image) {
    const img = document.createElement("img");
    img.className = "entry-portrait";
    img.src = "data/" + record.image;
    img.alt = record.name;
    body.appendChild(img);
  }

  if (record.summary) {
    const p = document.createElement("p");
    p.className = "entry-summary";
    p.textContent = record.summary;
    body.appendChild(p);
  }

  const index = await ContentStore.getEntityIndex();
  renderEntityFields(table, record, index, body);

  if (body.children.length === 0) {
    body.appendChild(emptyState("No further details recorded yet."));
  }
}

function renderEntityFields(table, record, index, body) {
  if (table === "locations") renderLocationFields(record, index, body);
  if (table === "items") renderItemFields(record, index, body);
  if (table === "quests") renderQuestFields(record, index, body);
  if (table === "npcs") renderNpcFields(record, index, body);

  if (record.tags && record.tags.length) {
    body.appendChild(sectionHeading("Tags"));
    body.appendChild(tagList(record.tags));
  }
}

function renderLocationFields(record, index, body) {
  const facts = [];
  if (record.locationType) facts.push(["Type", capitalize(record.locationType)]);
  if (linkedName(record.parentLocation, index)) facts.push(["Within", linkedName(record.parentLocation, index)]);
  if (linkedName(record.owner, index)) facts.push(["Owner", linkedName(record.owner, index)]);
  appendFacts(body, facts);
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

  if (!record.crafting) return;

  body.appendChild(sectionHeading("Crafting Recipe"));
  const craftFacts = [];
  if (record.crafting.crafter) craftFacts.push(["Crafter", record.crafting.crafter]);
  if (record.crafting.tier) craftFacts.push(["Tier", record.crafting.tier]);
  if (record.crafting.cost !== undefined) craftFacts.push(["Cost", record.crafting.cost]);
  if (record.crafting.time) craftFacts.push(["Time", record.crafting.time]);
  appendFacts(body, craftFacts);

  const ingredients = record.crafting.ingredients || [];
  if (ingredients.length === 0) {
    body.appendChild(emptyState("No ingredients recorded yet."));
    return;
  }

  const grid = document.createElement("div");
  grid.className = "card-grid";
  ingredients.forEach(function (ingredient) {
    const info = index.get(ingredient.item);
    const card = document.createElement(info ? "a" : "div");
    card.className = "card";
    if (info) card.href = "world.html?table=items&id=" + encodeURIComponent(ingredient.item);
    const name = info ? info.name : "Unknown ingredient";
    const detail = (ingredient.qty ? ingredient.qty + "x " : "") + (ingredient.required ? "Required" : "Optional");
    card.innerHTML = '<p class="card-title">' + escapeHtml(name) + '</p><p class="card-body">' + escapeHtml(detail) + "</p>";
    grid.appendChild(card);
  });
  body.appendChild(grid);
}

function renderQuestFields(record, index, body) {
  if (record.status) appendFacts(body, [["Status", record.status]]);

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

function linkedName(id, index) {
  const entry = id && index.get(id);
  return entry ? entry.name : undefined;
}

function linkNames(ids, index) {
  return (ids || []).map(function (id) { return linkedName(id, index); }).filter(Boolean);
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", initWorldPage);
