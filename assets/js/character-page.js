/**
 * Aleucia Character Page Renderer
 *
 * Shared logic for character.html's sections (items, correspondence,
 * timeline, quests, relationships, spellbook) — one generic page for every
 * roster character, mirroring how world.html already handles every other
 * entity table via ?table=&id= instead of a file per record.
 * initCharacterPageFromLocation() reads character.html's own
 * ?character=<slug>&section=<section> query params and delegates to
 * initCharacterPage(section) once the character is resolved.
 */

const CHARACTER_PAGE_SECTIONS = {
  items: {
    heading: "Magic Items",
    lead: "Artefacts and enchantments bound to your name.",
    render: renderItems
  },
  correspondence: {
    heading: "Correspondence",
    lead: "Letters, notes, and rumours you've sent, received, or kept.",
    render: renderCorrespondence
  },
  timeline: {
    heading: "Session Journals",
    lead: "The chronicle of your journey through Aleucia.",
    render: renderTimeline
  },
  quests: {
    heading: "Quest Log",
    lead: "Active threads, completed deeds, and forgotten oaths.",
    render: renderQuests
  },
  relationships: {
    heading: "Relationships",
    lead: "Those whose fates have crossed and entwined with yours.",
    render: renderRelationships
  },
  spellbook: {
    heading: "Spell Book",
    lead: "The arcane formulae you have gathered and mastered.",
    render: renderSpellbook
  }
};

// With no ?character= param, defaults to the logged-in session's own
// character — player.html's and nav-menu.js's own links omit it for exactly
// this reason. An explicit ?character=<slug> is what lets a relationship
// graph node link to any roster character's page, not just the viewer's own
// (see content-store.js's getEntityHref).
async function initCharacterPageFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section") || "items";
  const session = typeof getSession === "function" ? getSession() : null;
  const slug = params.get("character") || (session ? characterSlug(session.username) : null);

  if (!slug) {
    document.getElementById("pageTitle").textContent = "Chronicle";
    document.getElementById("pageBody").appendChild(emptyState("No character specified."));
    return;
  }

  const characters = await ContentStore.getTable("characters");
  const record = (characters || []).find(function (c) { return characterSlug(c.name) === slug; });

  if (!record) {
    document.getElementById("pageTitle").textContent = "Chronicle";
    document.getElementById("pageBody").appendChild(emptyState("This character could not be found in the roster."));
    return;
  }

  document.body.dataset.character = record.name;
  return initCharacterPage(section);
}

function characterSlug(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

async function initCharacterPage(section) {
  const def = CHARACTER_PAGE_SECTIONS[section];
  if (!def) {
    document.getElementById("pageBody").appendChild(emptyState("Unknown section."));
    return;
  }

  const name = document.body.dataset.character;
  const profile = await getCharacterProfile(name);

  document.getElementById("sessionUser").textContent = name;
  document.title = "Aleucia — " + name + " — " + def.heading;
  document.getElementById("pageTitle").textContent = def.heading;
  document.getElementById("pageLead").textContent = def.lead;

  renderCharacterHeader(profile, name);

  const body = document.getElementById("pageBody");
  if (!profile) {
    body.appendChild(emptyState("This character could not be found in the roster."));
    return;
  }
  await def.render(profile, body);
}

function renderCharacterHeader(profile, name) {
  const header = document.getElementById("characterHeader");
  if (!profile) return;

  const img = document.createElement("img");
  img.className = "character-portrait";
  img.src = profile.image;
  img.alt = name;

  const info = document.createElement("div");
  info.className = "character-header-info";

  const title = document.createElement("p");
  title.className = "character-header-name";
  title.textContent = name;
  info.appendChild(title);

  const stats = document.createElement("div");
  stats.className = "stat-row";
  [
    ["Race", profile.race],
    ["Class", profile.charClass],
    ["Level", profile.level],
    ["Status", profile.status],
    ["AC", profile.ac],
    ["HP", profile.hp + " / " + profile.maxHp]
  ].forEach(function (pair) {
    stats.appendChild(statChip(pair[0], pair[1]));
  });
  info.appendChild(stats);

  header.appendChild(img);
  header.appendChild(info);
}

function statChip(label, value) {
  const chip = document.createElement("span");
  chip.className = "stat-chip";
  chip.innerHTML = label + ": <strong>" + escapeHtml(String(value)) + "</strong>";
  return chip;
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
  names.forEach(function (n) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = n;
    wrap.appendChild(tag);
  });
  return wrap;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function renderItems(profile, body) {
  const catalogLink = document.createElement("a");
  catalogLink.className = "section-link";
  catalogLink.href = "world.html?table=items";
  catalogLink.textContent = "Browse the full Item Catalog →";
  body.appendChild(catalogLink);

  if (!profile.items.length) {
    body.appendChild(emptyState("No magic items recorded yet — check back as the chronicle grows."));
    return;
  }
  const grid = document.createElement("div");
  grid.className = "card-grid";
  profile.items.forEach(function (item) {
    const card = document.createElement("a");
    card.className = "card";
    card.href = "world.html?table=items&id=" + encodeURIComponent(item.id);
    card.innerHTML = '<p class="card-title">' + escapeHtml(item.name) + '</p>';
    grid.appendChild(card);
  });
  body.appendChild(grid);
}

// Sent/received come from the letter's own Sender/Recipient fields;
// possessed comes from an "owns" edge — see character-data.js's
// extractCorrespondence and SCHEMA.md's "Notable design choices". A letter
// can carry more than one role (e.g. kept after being received), shown as a
// "Sent · Received"-style subtitle on its card.
function renderCorrespondence(profile, body) {
  const catalogLink = document.createElement("a");
  catalogLink.className = "section-link";
  catalogLink.href = "world.html?table=correspondence";
  catalogLink.textContent = "Browse all Correspondence →";
  body.appendChild(catalogLink);

  if (!profile.correspondence.length) {
    body.appendChild(emptyState("No correspondence recorded yet — no word has reached you."));
    return;
  }
  const grid = document.createElement("div");
  grid.className = "card-grid";
  profile.correspondence.forEach(function (letter) {
    const card = document.createElement("a");
    card.className = "card";
    card.href = "world.html?table=correspondence&id=" + encodeURIComponent(letter.id);
    card.innerHTML =
      '<p class="card-title">' + escapeHtml(letter.name) + '</p>' +
      '<p class="card-body">' + escapeHtml(letter.roles.join(" · ")) + '</p>';
    grid.appendChild(card);
  });
  body.appendChild(grid);
}

// Entries render in the order profile.timeline provides them —
// character-data.js's buildTimeline() already sorts the vault's sessions
// chronologically, the same way a journal is written.
function renderTimeline(profile, body) {
  if (!profile.timeline.length) {
    body.appendChild(emptyState("Your chronicle has yet to be written — the tale continues at the table."));
    return;
  }
  const list = document.createElement("div");
  list.className = "timeline";
  profile.timeline.forEach(function (entry, index) {
    list.appendChild(timelineEntry(entry, index));
  });
  body.appendChild(list);
}

// An entry with both a summary and details distinct from it renders as a
// click-to-expand row (summary always visible, details revealed on toggle).
// An older/simpler entry — just a heading + one block of text — still
// renders as a plain, non-interactive block, so hand-curated data written
// before the summary/details split keeps working unchanged.
function timelineEntry(entry, index) {
  const summary = entry.summary;
  const details = entry.details !== undefined ? entry.details : entry.text;
  const expandable = !!summary && !!details && details !== summary;

  const item = document.createElement("div");
  item.className = "timeline-entry";

  const toggle = document.createElement(expandable ? "button" : "div");
  toggle.className = "timeline-entry-toggle";

  const heading = document.createElement("p");
  heading.className = "timeline-entry-heading";
  heading.textContent = entry.heading;
  toggle.appendChild(heading);

  const summaryText = document.createElement("p");
  summaryText.className = "timeline-entry-summary";
  summaryText.textContent = summary || details || "";
  toggle.appendChild(summaryText);

  if (expandable) {
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");

    const chevron = document.createElement("span");
    chevron.className = "timeline-entry-chevron";
    chevron.setAttribute("aria-hidden", "true");
    toggle.appendChild(chevron);

    const panelId = "timeline-entry-details-" + index;
    toggle.setAttribute("aria-controls", panelId);

    const panel = document.createElement("div");
    panel.className = "timeline-entry-details";
    panel.id = panelId;
    panel.hidden = true;
    const detailsText = document.createElement("p");
    detailsText.textContent = details;
    panel.appendChild(detailsText);

    toggle.addEventListener("click", function () {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isOpen));
      panel.hidden = isOpen;
      item.classList.toggle("timeline-entry--open", !isOpen);
    });

    item.appendChild(toggle);
    item.appendChild(panel);
  } else {
    item.appendChild(toggle);
  }

  return item;
}

function renderQuests(profile, body) {
  if (!profile.quests.length) {
    body.appendChild(emptyState("No quests logged yet — your first thread awaits."));
    return;
  }
  const grid = document.createElement("div");
  grid.className = "card-grid";
  profile.quests.forEach(function (quest) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = '<p class="card-title">' + escapeHtml(quest) + '</p>';
    grid.appendChild(card);
  });
  body.appendChild(grid);
}

async function renderRelationships(profile, body) {
  if (typeof renderRelationshipGraph === "function") {
    const graphContainer = document.createElement("div");
    body.appendChild(graphContainer);
    await renderRelationshipGraph(graphContainer, profile.id, document.body.dataset.character);
  }

  const rel = profile.relationships;
  const groups = [
    ["Family", rel.parent.concat(rel.partner, rel.children, rel.sibling)],
    ["Allies", rel.ally],
    ["Enemies", rel.enemy]
  ];

  const hasAny = groups.some(function (g) { return g[1].length; }) ||
    rel.memberships.length || rel.groups.length;

  if (!hasAny) return;

  groups.forEach(function (g) {
    if (!g[1].length) return;
    body.appendChild(sectionHeading(g[0]));
    body.appendChild(tagList(g[1]));
  });

  if (rel.memberships.length) {
    body.appendChild(sectionHeading("Guild & Faction Memberships"));
    rel.memberships.forEach(function (m) {
      const card = document.createElement("div");
      card.className = "membership-card";
      const detailParts = [];
      if (m.status) detailParts.push(m.status);
      if (m.rank) detailParts.push("Rank " + m.rank);
      if (m.superior) detailParts.push("Reports to " + m.superior);
      const detail = detailParts.length ? detailParts.join(" · ") : "Member";
      card.innerHTML =
        '<p class="membership-card-group">' + escapeHtml(m.group) + '</p>' +
        '<p class="membership-card-detail">' + escapeHtml(detail) + '</p>';
      body.appendChild(card);
    });
  }

  if (rel.groups.length) {
    body.appendChild(sectionHeading("Connected Groups"));
    body.appendChild(tagList(rel.groups));
  }
}

function renderSpellbook(profile, body) {
  body.appendChild(emptyState("No spells recorded yet — your grimoire awaits its first page."));
}
