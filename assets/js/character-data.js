/**
 * Aleucia Character Profiles
 *
 * getCharacterProfile(name) resolves a roster character's profile entirely
 * from the vault-exported data/*.json (see content-store.js, and
 * data-schema.json / SCHEMA.md at the repo root). There is no hand-maintained
 * fallback: the portrait art in data/characters.json's `image` field is the
 * same file a vault author uploads directly to the character's note — not
 * raw source art needing a separate curated crop — so it's used as-is, with
 * a generic placeholder only when a character has no image set at all.
 *
 * If data/characters.json hasn't been exported yet (data/manifest.json's
 * `tables` is still the empty placeholder from before the plugin's first
 * run), every character resolves to "not found" until an export exists.
 */

/**
 * Returns the full profile for the named character, or null if unknown.
 * @param {string} characterName
 * @returns {Promise<object|null>}
 */
async function getCharacterProfile(characterName) {
  const characters = await ContentStore.getTable("characters");
  if (!characters) return null;

  const [npcs, organisations, quests, items, correspondence, relationships, sessions] = await Promise.all([
    ContentStore.getTable("npcs"),
    ContentStore.getTable("organisations"),
    ContentStore.getTable("quests"),
    ContentStore.getTable("items"),
    ContentStore.getTable("correspondence"),
    ContentStore.getTable("relationships"),
    ContentStore.getTable("sessions"),
  ]);

  const record = characters.find(function (c) { return c.name === characterName; });
  if (!record) return null;

  const namesById = buildNameIndex([characters, npcs, organisations]);

  return {
    id: record.id,
    aliases: record.aliases || [],
    player: record.player,
    race: record.race,
    charClass: record.charClass,
    gender: record.gender,
    age: record.age,
    status: record.status,
    level: record.level,
    hp: record.hp,
    maxHp: record.maxHp,
    ac: record.ac,
    image: record.image ? "data/" + record.image : ContentStore.PLACEHOLDER_IMAGE,
    items: extractOwnedItems(record, relationships || [], items || []),
    correspondence: extractCorrespondence(record, relationships || [], correspondence || []),
    quests: resolveNames(record.connectedQuests, quests || []),
    timeline: buildTimeline(record, sessions || []),
    relationships: buildRelationships(record, relationships || [], organisations || [], namesById),
  };
}

// Per data-schema.json's characters.relatedVia: item ownership is an "owns"
// edge in the relationships table (subject = this character), not a field
// on the character record or a Bases export.
function extractOwnedItems(record, edges, items) {
  const byId = {};
  items.forEach(function (item) { byId[item.id] = item; });
  return edges
    .filter(function (e) { return e.subject === record.id && e.type === "owns"; })
    .map(function (e) { return byId[e.object]; })
    .filter(Boolean)
    .map(function (item) { return { id: item.id, name: item.name }; });
}

// Correspondence "known to" a character, per SCHEMA.md's "Notable design
// choices": unlike items, a letter's sender/recipient are fields on the
// correspondence record itself (the vault's own Sender/Recipient
// frontmatter), so "sent" and "received" are found by scanning those arrays
// for this character's id. A letter kept without being sent or received
// (found, stolen, intercepted) has no such field, so that case still falls
// back to an "owns" edge, exactly like item ownership. The three are unioned
// into one deduplicated list, each entry tagged with which role(s) apply.
function extractCorrespondence(record, edges, correspondence) {
  const byId = {};
  correspondence.forEach(function (letter) { byId[letter.id] = letter; });

  const roleById = {};
  function addRole(id, role) {
    if (!byId[id]) return;
    if (!roleById[id]) roleById[id] = [];
    if (roleById[id].indexOf(role) === -1) roleById[id].push(role);
  }

  correspondence.forEach(function (letter) {
    if ((letter.sender || []).indexOf(record.id) !== -1) addRole(letter.id, "Sent");
    if ((letter.recipient || []).indexOf(record.id) !== -1) addRole(letter.id, "Received");
  });

  edges
    .filter(function (e) { return e.subject === record.id && e.type === "owns"; })
    .forEach(function (e) { addRole(e.object, "Possessed"); });

  return Object.keys(roleById).map(function (id) {
    const letter = byId[id];
    return { id: letter.id, name: letter.name, roles: roleById[id] };
  });
}

// Session journals come from the `sessions` table (see data-schema.json). A
// session with no attendees listed is a party-wide one and belongs in every
// character's journal; otherwise only the listed characters see it. A
// "Planned" session is the GM's prep, not something that happened yet, so it
// never shows. Entries are returned oldest first, in the
// heading/summary/details shape character-page.js's timelineEntry() renders.
function buildTimeline(record, sessions) {
  return sessions
    .filter(function (session) {
      if (session.status === "Planned") return false;
      const attendees = session.attendees || [];
      return attendees.length === 0 || attendees.indexOf(record.id) !== -1;
    })
    .map(function (session, i) {
      return { session: session, number: sessionNumber(session), index: i };
    })
    .sort(function (a, b) {
      if (a.number !== b.number) {
        if (a.number === null) return 1;
        if (b.number === null) return -1;
        return a.number - b.number;
      }
      return a.index - b.index;
    })
    .map(function (entry) {
      const session = entry.session;
      const date = session.date === SESSION_DATE_PLACEHOLDER ? undefined : session.date;
      return {
        heading: date ? session.name + " · " + date : session.name,
        summary: sessionSummary(session),
        details: session.body,
      };
    });
}

// The Session Journal template's own defaults, left in notes nobody has
// filled in yet — shown as if unset rather than as real values.
const SESSION_DATE_PLACEHOLDER = "2000-01-01";
const SESSION_SUMMARY_PLACEHOLDER = "1 Line Summary";

// The note's one-liner, or when it has none, an excerpt of the write-up's
// first bullet/sentence — a timeline entry needs a summary to be collapsible,
// otherwise the whole write-up would sit open on the timeline.
function sessionSummary(session) {
  if (session.summary && session.summary !== SESSION_SUMMARY_PLACEHOLDER) return session.summary;
  const lines = (session.body || "").split("\n").map(function (line) {
    return line.replace(/^\s*(?:[-*]|\d+\.)\s+/, "").trim();
  });
  // The body keeps headings as plain lines, so skip anything shorter than a
  // sentence ("Session Overview", "Events").
  const first = lines.find(function (line) { return line.length >= 40; }) || lines.find(Boolean);
  if (!first) return undefined;
  return first.length > 160 ? first.slice(0, 159).trimEnd() + "…" : first;
}

// Prefers the explicit sessionNumber field, falling back to the leading
// number in a name like "Session 12 - The forgotten Isles".
function sessionNumber(session) {
  if (typeof session.sessionNumber === "number") return session.sessionNumber;
  const match = /^\s*session\s*(\d+)/i.exec(session.name || "");
  return match ? Number(match[1]) : null;
}

function resolveNames(ids, table) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const byId = {};
  table.forEach(function (record) { byId[record.id] = record; });
  return ids.map(function (id) { return byId[id]; }).filter(Boolean).map(function (record) { return record.name; });
}

function buildNameIndex(tables) {
  const byId = {};
  tables.forEach(function (table) {
    (table || []).forEach(function (record) { byId[record.id] = record.name; });
  });
  return byId;
}

// relationships.json holds every edge in the vault; a character's own view of
// it is just the edges where they're the subject, bucketed by type to match
// the shape character-page.js already renders.
function buildRelationships(record, edges, organisations, namesById) {
  const outgoing = edges.filter(function (e) { return e.subject === record.id; });

  const byType = function (type) {
    return outgoing
      .filter(function (e) { return e.type === type && namesById[e.object]; })
      .map(function (e) { return namesById[e.object]; });
  };

  const memberships = outgoing
    .filter(function (e) { return e.type === "member" && namesById[e.object]; })
    .map(function (e) {
      const membership = { group: namesById[e.object], status: e.status, rank: e.rank };
      return membership;
    });

  return {
    parent: byType("parent"),
    partner: byType("partner"),
    children: byType("child"),
    sibling: byType("sibling"),
    enemy: byType("enemy"),
    ally: byType("ally"),
    groups: resolveNames(record.connectedGroups, organisations),
    memberships: memberships,
  };
}
