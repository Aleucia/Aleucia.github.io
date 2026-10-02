/**
 * Aleucia Player Page Renderer
 *
 * player.html is the logged-in character's own overview: a hero block with
 * their portrait and general information, followed by one section per
 * character.html section (items, correspondence, timeline, quests,
 * relationships, spellbook). Each section previews a random handful of that
 * sub-page's content — a different handful on every visit — with a button
 * opening the full sub-page.
 *
 * Depends on character-data.js (getCharacterProfile), character-page.js
 * (CHARACTER_PAGE_SECTIONS, characterSlug and the small DOM helpers) and
 * person-card.js (buildPersonCard), all of which must be loaded first.
 */

const PLAYER_PAGE_PREVIEW_SIZE = 3;

async function initPlayerPage() {
  const session = typeof getSession === "function" ? getSession() : null;
  if (!session) return;

  const name = session.username;
  document.getElementById("sessionUser").textContent = name;
  document.getElementById("pageTitle").textContent = name;
  document.title = "Aleucia — " + name;

  const profile = await getCharacterProfile(name);
  const body = document.getElementById("pageBody");

  if (!profile) {
    body.appendChild(emptyState("This character could not be found in the roster."));
    return;
  }

  renderPlayerHero(profile, name, document.getElementById("playerHero"));

  const charData = typeof getCharacterData === "function" ? getCharacterData(name) : null;
  playerSectionKeys(!!(charData && charData.spellcaster)).forEach(function (key) {
    if (!playerSectionHasContent(key, profile)) return;
    body.appendChild(buildPlayerSection(key, profile));
  });
}

function playerSectionKeys(isSpellcaster) {
  const keys = ["timeline", "correspondence", "quests", "relationships", "items"];
  if (isSpellcaster) keys.push("spellbook");
  return keys;
}

// Sections with nothing to show are left off the page entirely.
function playerSectionHasContent(key, profile) {
  const rel = profile.relationships || {};
  switch (key) {
    case "items": return (profile.items || []).length > 0;
    case "correspondence": return (profile.correspondence || []).length > 0;
    case "timeline": return (profile.timeline || []).length > 0;
    case "quests": return (profile.quests || []).length > 0;
    case "relationships":
      return (rel.people || []).length > 0 ||
        [rel.parent, rel.partner, rel.children, rel.sibling, rel.ally, rel.enemy,
          rel.memberships, rel.groups].some(function (list) { return (list || []).length > 0; });
    case "spellbook":
      return (profile.spells || []).some(function (spell) { return spell.prepared; });
    default: return true;
  }
}

function renderPlayerHero(profile, name, hero) {
  const img = document.createElement("img");
  img.className = "player-hero-portrait";
  img.src = profile.image;
  img.alt = name;
  hero.appendChild(img);

  const info = document.createElement("div");
  info.className = "player-hero-info";

  if (profile.aliases && profile.aliases.length) {
    const aliases = document.createElement("p");
    aliases.className = "player-hero-aliases";
    aliases.textContent = "Also known as " + profile.aliases.join(", ");
    info.appendChild(aliases);
  }

  const facts = document.createElement("dl");
  facts.className = "player-hero-facts";
  playerHeroFacts(profile).forEach(function (pair) {
    const fact = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = pair[0];
    const dd = document.createElement("dd");
    dd.textContent = pair[1];
    fact.appendChild(dt);
    fact.appendChild(dd);
    facts.appendChild(fact);
  });
  info.appendChild(facts);

  hero.appendChild(info);
}

// Only facts actually set on the record are shown, so a sparsely filled-in
// vault note doesn't render a column of blanks.
function playerHeroFacts(profile) {
  const hp = profile.maxHp == null ? null : profile.hp != null ? profile.hp + " / " + profile.maxHp : String(profile.maxHp);
  return [
    ["Player", profile.player],
    ["Race", profile.race],
    ["Class", profile.charClass],
    ["Level", profile.level],
    ["Gender", profile.gender],
    ["Age", profile.age],
    ["Status", profile.status],
    ["Armour Class", profile.ac],
    ["Hit Points", hp],
    ["Passive Perception", profile.passivePerception],
    ["Passive Insight", profile.passiveInsight],
    ["Passive Investigation", profile.passiveInvestigation],
    ["Languages", (profile.languages || []).join(", ")],
    ["Proficiencies", (profile.proficiencies || []).join(", ")]
  ].filter(function (pair) {
    return pair[1] !== undefined && pair[1] !== null && pair[1] !== "";
  }).map(function (pair) {
    return [pair[0], String(pair[1])];
  });
}

function buildPlayerSection(key, profile) {
  const def = CHARACTER_PAGE_SECTIONS[key];

  const section = document.createElement("section");
  section.className = "player-section";
  section.id = "section-" + key;

  const header = document.createElement("div");
  header.className = "player-section-header";

  const heading = document.createElement("h2");
  heading.className = "player-section-title";
  heading.textContent = def.heading;
  header.appendChild(heading);

  const lead = document.createElement("p");
  lead.className = "player-section-lead";
  lead.textContent = def.lead;
  header.appendChild(lead);

  section.appendChild(header);

  const preview = document.createElement("div");
  preview.className = "player-section-preview";
  PLAYER_SECTION_PREVIEWS[key](profile, preview);
  section.appendChild(preview);

  // character.html resolves to this same session's own character when
  // ?character= is omitted, so the link only needs ?section=.
  const button = document.createElement("a");
  button.className = "player-section-btn";
  button.href = "character.html?section=" + key;
  button.textContent = "Open " + def.heading + " →";
  section.appendChild(button);

  return section;
}

/**
 * Returns up to `count` elements of `list` chosen at random, in random
 * order, without modifying `list`. `random` defaults to Math.random and is
 * only a parameter so tests can make the choice deterministic.
 */
function randomSubset(list, count, random) {
  const rand = random || Math.random;
  const copy = (list || []).slice();
  const n = Math.min(Math.max(count, 0), copy.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rand() * (copy.length - i));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, n);
}

// ---------------------------------------------------------------------------
// Section previews — a random slice of what each character.html section shows
// ---------------------------------------------------------------------------

const PLAYER_SECTION_PREVIEWS = {
  items: previewItems,
  correspondence: previewCorrespondence,
  timeline: previewTimeline,
  quests: previewQuests,
  relationships: previewRelationships,
  spellbook: previewSpellbook
};

function previewItems(profile, preview) {
  if (!profile.items.length) {
    preview.appendChild(emptyState("No magic items recorded yet — check back as the chronicle grows."));
    return;
  }
  const grid = document.createElement("div");
  grid.className = "card-grid";
  randomSubset(profile.items, PLAYER_PAGE_PREVIEW_SIZE).forEach(function (item) {
    const card = document.createElement("a");
    card.className = "card";
    card.href = "world.html?table=items&id=" + encodeURIComponent(item.id);
    card.innerHTML = '<p class="card-title">' + escapeHtml(item.name) + '</p>';
    grid.appendChild(card);
  });
  preview.appendChild(grid);
}

function previewCorrespondence(profile, preview) {
  if (!profile.correspondence.length) {
    preview.appendChild(emptyState("No correspondence recorded yet — no word has reached you."));
    return;
  }
  const grid = document.createElement("div");
  grid.className = "card-grid";
  randomSubset(profile.correspondence, PLAYER_PAGE_PREVIEW_SIZE).forEach(function (letter) {
    const card = document.createElement("a");
    card.className = "card";
    card.href = "world.html?table=correspondence&id=" + encodeURIComponent(letter.id);
    card.innerHTML =
      '<p class="card-title">' + escapeHtml(letter.name) + '</p>' +
      '<p class="card-body">' + escapeHtml(letter.roles.join(" · ")) + '</p>';
    grid.appendChild(card);
  });
  preview.appendChild(grid);
}

// A random pick of journal entries is still shown in chronological order —
// a journal read out of order is harder to follow than a shorter one.
function previewTimeline(profile, preview) {
  if (!profile.timeline.length) {
    preview.appendChild(emptyState("Your chronicle has yet to be written — the tale continues at the table."));
    return;
  }
  const indices = randomSubset(profile.timeline.map(function (_, i) { return i; }), 2)
    .sort(function (a, b) { return a - b; });
  const list = document.createElement("div");
  list.className = "timeline";
  indices.forEach(function (i) {
    list.appendChild(timelineEntry(profile.timeline[i], "preview-" + i));
  });
  preview.appendChild(list);
}

function previewQuests(profile, preview) {
  if (!profile.quests.length) {
    preview.appendChild(emptyState("No quests logged yet — your first thread awaits."));
    return;
  }
  const grid = document.createElement("div");
  grid.className = "card-grid";
  randomSubset(profile.quests, PLAYER_PAGE_PREVIEW_SIZE).forEach(function (quest) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = '<p class="card-title">' + escapeHtml(quest) + '</p>';
    grid.appendChild(card);
  });
  preview.appendChild(grid);
}

// The full page draws a relationship graph; the preview is lighter — a few
// random connections. People get the same card as the People page (image,
// name and occupation, with species/gender/age revealed on hover or tap);
// groups and anything without a record stay as labelled tags.
function previewRelationships(profile, preview) {
  const rel = profile.relationships;
  const people = rel.people || [];
  const personNames = {};
  people.forEach(function (p) { personNames[p.name] = true; });

  const labelled = [];
  function add(names, label) {
    names.forEach(function (n) { if (!personNames[n]) labelled.push(n + " · " + label); });
  }
  add(rel.parent.concat(rel.partner, rel.children, rel.sibling), "Family");
  add(rel.ally, "Ally");
  add(rel.enemy, "Enemy");
  add(rel.memberships.map(function (m) { return m.group; }), "Member");
  add(rel.groups, "Group");

  if (!people.length && !labelled.length) {
    preview.appendChild(emptyState("No known relationships recorded yet."));
    return;
  }
  if (people.length) {
    const grid = document.createElement("div");
    grid.className = "card-grid";
    randomSubset(people, PLAYER_PAGE_PREVIEW_SIZE).forEach(function (person) {
      grid.appendChild(buildPersonCard(person));
    });
    preview.appendChild(grid);
  }
  if (labelled.length) preview.appendChild(tagList(randomSubset(labelled, 6)));
}

// Unlike the other previews this isn't a random slice: the player page
// lists every prepared spell, in the same collapsible layout as the sub-page.
function previewSpellbook(profile, preview) {
  const prepared = profile.spells.filter(function (spell) { return spell.prepared; });
  if (!prepared.length) {
    preview.appendChild(emptyState("No spells prepared yet — your grimoire awaits its first page."));
    return;
  }
  renderSpellbook({ spells: prepared }, preview);
}
