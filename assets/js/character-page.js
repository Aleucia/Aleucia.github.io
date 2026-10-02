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
    ["HP", profile.hp != null ? profile.hp + " / " + profile.maxHp : profile.maxHp],
    ["Passive Perception", profile.passivePerception],
    ["Passive Insight", profile.passiveInsight],
    ["Passive Investigation", profile.passiveInvestigation],
    ["Languages", (profile.languages || []).join(", ")],
    ["Proficiencies", (profile.proficiencies || []).join(", ")]
  ].forEach(function (pair) {
    if (pair[1] === undefined || pair[1] === null || pair[1] === "") return;
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

// Splits a spell description into paragraph and "## Subheading" blocks.
// Headings with no body after them (e.g. a dangling "## Summary") are dropped.
function parseSpellDescription(description) {
  const blocks = String(description || "").split(/\n\s*\n/).map(function (chunk) {
    const text = chunk.trim();
    const match = /^#{1,6}\s+(.*)$/.exec(text);
    return match ? { heading: true, text: match[1].trim() } : { heading: false, text: text };
  }).filter(function (block) { return block.text; });
  return blocks.filter(function (block, i) {
    return !(block.heading && (i === blocks.length - 1 || blocks[i + 1].heading));
  });
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
  catalogLink.href = "assets.html";
  catalogLink.textContent = "Browse all Assets →";
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

function spellLevelLabel(level) {
  if (level === 0) return "Cantrip";
  const suffix = level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th";
  return level + suffix;
}

// The collapsed row has little room, so the duration is trimmed to the part
// that matters: "Instantaneous" is dropped (it's the default) and a leading
// "Concentration, " is dropped (the name bar already flags concentration),
// leaving e.g. "up to 10 minutes", which may wrap. The expanded view always
// shows the full duration.
function collapsedDuration(duration) {
  if (!duration || /^instantaneous$/i.test(duration.trim())) return "";
  const trimmed = duration.replace(/^concentration,?\s*/i, "").trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function spellCell(className, text) {
  const cell = document.createElement("span");
  cell.className = "spell-cell " + className;
  cell.textContent = text || "";
  return cell;
}

// One row per spell, laid out as a table: the name bar (the <summary>)
// carries level, name, casting time, duration and range, and toggles the
// expanded view — a stat grid plus the rules text — when touched/clicked.
function spellCard(spell) {
  const card = document.createElement("details");
  card.className = "card spell-card";

  const flags = [spell.ritual ? "Ritual" : null, spell.concentration ? "Concentration" : null].filter(Boolean);
  const meta = [spell.school].concat(flags).filter(Boolean).join(" · ");

  const summary = document.createElement("summary");
  summary.className = "spell-row";
  summary.appendChild(spellCell("spell-level", spellLevelLabel(spell.level)));

  const name = document.createElement("span");
  name.className = "spell-cell spell-name";
  name.innerHTML =
    '<span class="card-title">' + escapeHtml(spell.name) +
    (spell.prepared ? ' <span class="spell-prepared">Prepared</span>' : "") + "</span>" +
    (meta ? '<span class="spell-meta">' + escapeHtml(meta) + "</span>" : "");
  summary.appendChild(name);

  summary.appendChild(spellCell("spell-casting", spell.castingTime));
  summary.appendChild(spellCell("spell-duration", collapsedDuration(spell.duration)));
  summary.appendChild(spellCell("spell-range", spell.range));

  const toggle = document.createElement("span");
  toggle.className = "spell-toggle";
  toggle.setAttribute("aria-hidden", "true");
  summary.appendChild(toggle);
  card.appendChild(summary);

  const details = document.createElement("div");
  details.className = "spell-details";

  const stats = [
    ["Level", spellLevelLabel(spell.level)],
    ["Casting Time", spell.castingTime],
    ["Range", spell.range],
    ["Components", spell.components],
    ["Duration", spell.duration],
    ["School", spell.school]
  ].filter(function (pair) { return pair[1]; });
  const list = document.createElement("dl");
  list.className = "spell-stats";
  stats.forEach(function (pair) {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = pair[0];
    const def = document.createElement("dd");
    def.textContent = pair[1];
    item.appendChild(term);
    item.appendChild(def);
    list.appendChild(item);
  });
  details.appendChild(list);

  if (spell.description) {
    const text = document.createElement("div");
    text.className = "card-body spell-description";
    parseSpellDescription(spell.description).forEach(function (block) {
      const node = document.createElement(block.heading ? "h4" : "p");
      node.textContent = block.text;
      text.appendChild(node);
    });
    details.appendChild(text);
  }
  card.appendChild(details);
  return card;
}

function renderSpellbook(profile, body) {
  if (!profile.spells.length) {
    body.appendChild(emptyState("No spells recorded yet — your grimoire awaits its first page."));
    return;
  }

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "section-link export-pdf-btn";
  exportBtn.textContent = "Export as PDF";
  exportBtn.addEventListener("click", function () {
    exportSpellbookPdf(profile.spells, document.body.dataset.character);
  });
  body.appendChild(exportBtn);

  const header = document.createElement("div");
  header.className = "spell-header";
  [["spell-level", "Level"], ["spell-name", "Name"], ["spell-casting", "Casting Time"],
   ["spell-duration", "Duration"], ["spell-range", "Range"]].forEach(function (col) {
    const cell = document.createElement("span");
    cell.className = "spell-cell " + col[0];
    cell.textContent = col[1];
    header.appendChild(cell);
  });
  header.appendChild(Object.assign(document.createElement("span"), { className: "spell-toggle" }));

  const list = document.createElement("div");
  list.className = "spell-list";
  list.appendChild(header);
  profile.spells.forEach(function (spell) {
    list.appendChild(spellCard(spell));
  });
  body.appendChild(list);
}

// Builds a self-contained, print-styled document of the full spell list (every
// spell fully expanded, grouped by level) and opens the browser's print dialog
// from a hidden iframe — choosing "Save as PDF" there produces the PDF, with no
// PDF library or popup window needed.
function buildSpellbookPrintHtml(spells, name) {
  const sorted = spells.slice().sort(function (a, b) {
    return (a.level - b.level) || a.name.localeCompare(b.name);
  });
  let html = "";
  let currentLevel = null;
  sorted.forEach(function (spell) {
    if (spell.level !== currentLevel) {
      currentLevel = spell.level;
      html += "<h2>" + (spell.level === 0 ? "Cantrips" : escapeHtml(spellLevelLabel(spell.level)) + " Level") + "</h2>";
    }
    const flags = [spell.ritual ? "Ritual" : null, spell.concentration ? "Concentration" : null].filter(Boolean);
    const meta = [spell.school].concat(flags).filter(Boolean).join(" · ");
    const stats = [
      ["Casting Time", spell.castingTime], ["Range", spell.range],
      ["Components", spell.components], ["Duration", spell.duration]
    ].filter(function (pair) { return pair[1]; }).map(function (pair) {
      return "<b>" + pair[0] + ":</b> " + escapeHtml(pair[1]);
    }).join(" &nbsp;|&nbsp; ");
    html += '<section><h3>' + escapeHtml(spell.name) +
      (spell.prepared ? ' <small>(Prepared)</small>' : "") + "</h3>" +
      (meta ? '<p class="meta">' + escapeHtml(meta) + "</p>" : "") +
      (stats ? "<p>" + stats + "</p>" : "") +
      parseSpellDescription(spell.description || "").map(function (block) {
        return block.heading ? "<h4>" + escapeHtml(block.text) + "</h4>" : "<p>" + escapeHtml(block.text) + "</p>";
      }).join("") + "</section>";
  });
  const title = (name ? escapeHtml(name) + " — " : "") + "Spell Book";
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + title + "</title><style>" +
    "body{font-family:Georgia,serif;color:#111;margin:0;font-size:11pt}" +
    "h1{font-size:20pt;margin:0 0 8pt}h2{font-size:14pt;border-bottom:1px solid #444;margin:16pt 0 6pt}" +
    "h3{font-size:12pt;margin:0 0 2pt}small{font-weight:normal;font-size:9pt}" +
    "section{break-inside:avoid;margin-bottom:10pt}p{margin:2pt 0}.meta{font-style:italic;color:#444}" +
    "</style></head><body><h1>" + title + "</h1>" + html + "</body></html>";
}

function exportSpellbookPdf(spells, name) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.srcdoc = buildSpellbookPrintHtml(spells, name);
  frame.onload = function () {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(function () { frame.remove(); }, 60000);
  };
  document.body.appendChild(frame);
}
