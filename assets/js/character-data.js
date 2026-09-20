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

  const [npcs, organisations, quests, items, relationships] = await Promise.all([
    ContentStore.getTable("npcs"),
    ContentStore.getTable("organisations"),
    ContentStore.getTable("quests"),
    ContentStore.getTable("items"),
    ContentStore.getTable("relationships"),
  ]);

  const record = characters.find(function (c) { return c.name === characterName; });
  if (!record) return null;

  const namesById = buildNameIndex([characters, npcs, organisations]);

  return {
    id: record.id,
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
    image: record.image ? "data/" + record.image : "assets/img/characters/placeholder.png",
    items: extractOwnedItems(record, relationships || [], items || []),
    quests: resolveNames(record.connectedQuests, quests || []),
    timeline: [],
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
