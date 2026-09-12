/**
 * Aleucia Character Profiles
 *
 * getCharacterProfile(name) resolves a roster character's profile from the
 * vault-exported data/*.json (see content-store.js, and data-schema.json /
 * SCHEMA.md at the repo root) once the Obsidian Cast plugin has been run at
 * least once against this repo. Until then — or if a fetch simply fails —
 * it falls back to FALLBACK_PROFILES below, so the site keeps working
 * exactly as it did before any export existed.
 *
 * The switch is all-or-nothing per deploy, not per field or per character:
 * once data/manifest.json exists, every character's items/quests/
 * relationships come from live data — even if that's an empty result for a
 * character with nothing recorded yet — rather than mixing sources.
 *
 * FALLBACK_PROFILES also supplies each character's curated portrait
 * (`image`), which stays in use even once live data is flowing: the vault's
 * own `image:` frontmatter is raw, uncropped source art, not the portrait
 * already chosen for this site. A character with no fallback entry (added
 * to the vault after this file was last hand-edited) gets their live image
 * instead, or a placeholder.
 */

const FALLBACK_PROFILES = {
  "Aerin": {
    player: "Lee",
    race: "Elf",
    charClass: "Wizard",
    gender: "Male",
    age: "Young Adult",
    status: "Alive",
    level: 5,
    hp: 50,
    maxHp: 71,
    ac: 80,
    image: "assets/img/characters/aerin.png",
    items: [],
    quests: [],
    timeline: [],
    relationships: {
      parent: ["Aerin - Mum", "Aerin - Dad"],
      partner: ["Skye"],
      children: [],
      sibling: [],
      enemy: ["Marcus"],
      ally: ["Borin"],
      groups: ["The filthy casuals"],
      memberships: [
        { group: "Band of Brothers", status: "Active", rank: null }
      ]
    }
  },

  "Alaric": {
    player: "Tim",
    race: "Elf",
    charClass: "Wizard",
    gender: "Female",
    age: "Young Adult",
    status: "Alive",
    level: 4,
    hp: 50,
    maxHp: 71,
    ac: 80,
    image: "assets/img/characters/alaric.png",
    items: ["Shortsword - Moon-Touched"],
    quests: [],
    timeline: [],
    relationships: {
      parent: [],
      partner: [],
      children: [],
      sibling: [],
      enemy: ["Marcus"],
      ally: [],
      groups: ["The Black Hand", "The Helping Hand"],
      memberships: [
        { group: "Vaelthari", status: "Active", rank: 6 },
        { group: "The Helping Hand", status: "Active", rank: 6 },
        { group: "The Black Hand", status: "Active", rank: 6 }
      ]
    }
  },

  "Clueless": {
    player: "Bob",
    race: "Elf",
    charClass: "Wizard",
    gender: "Female",
    age: "Young Adult",
    status: "Alive",
    level: 4,
    hp: 50,
    maxHp: 71,
    ac: 80,
    image: "assets/img/characters/placeholder.png",
    items: [],
    quests: [],
    timeline: [],
    relationships: {
      parent: [],
      partner: [],
      children: [],
      sibling: [],
      enemy: [],
      ally: [],
      groups: [],
      memberships: []
    }
  },

  "Jeff": {
    player: "Ian",
    race: "Elf",
    charClass: "Wizard",
    gender: "Female",
    age: "Young Adult",
    status: "Alive",
    level: 4,
    hp: 50,
    maxHp: 71,
    ac: 80,
    image: "assets/img/characters/jeff.png",
    items: [],
    quests: [],
    timeline: [],
    relationships: {
      parent: [],
      partner: [],
      children: [],
      sibling: [],
      enemy: ["Toren", "Marcus"],
      ally: ["Bruce", "Myra"],
      groups: [],
      memberships: [
        { group: "The League of Extraordinary Thieves", status: "Banned", rank: 3, superior: "Bruce" }
      ]
    }
  },

  "Petra": {
    player: "Nadine",
    race: "Elf",
    charClass: "Wizard",
    gender: "Female",
    age: "Young Adult",
    status: "Alive",
    level: 4,
    hp: 50,
    maxHp: 71,
    ac: 80,
    image: "assets/img/characters/petra.png",
    items: [],
    quests: [],
    timeline: [
      {
        heading: "Birth",
        text: "Petra was born in The Feywild. Unsure how or why she left, Petra took on the life of a nomad, though she has no idea who or what she is looking for."
      },
      {
        heading: "Journey",
        text: "During her travels Petra stumbled upon what appeared to be an abandoned mage tower. Inside she found the wizard under whom she would apprentice. Whilst unlocking the secrets of the tower, the mage taught Petra how to utilise the weave — the longest period of stability in her life."
      }
    ],
    relationships: {
      parent: ["Algris"],
      partner: [],
      children: [],
      sibling: [],
      enemy: ["Marcus"],
      ally: ["Shay", "Unknown2", "Unknown1"],
      groups: ["Test Group"],
      memberships: []
    }
  },

  "Ser Gillard": {
    player: "Ed Prince",
    race: "Unknown",
    charClass: "Wizard",
    gender: "Female",
    age: "Young Adult",
    status: "Unknown",
    level: 5,
    hp: 50,
    maxHp: 71,
    ac: 80,
    image: "assets/img/characters/ser-gillard.png",
    items: [],
    quests: [],
    timeline: [],
    relationships: {
      parent: [],
      partner: [],
      children: [],
      sibling: [],
      enemy: [],
      ally: [],
      groups: [],
      memberships: []
    }
  },

  "Steve": {
    player: "Sarah",
    race: "Elf",
    charClass: "Wizard",
    gender: "Female",
    age: "Young Adult",
    status: "Unknown",
    level: 4,
    hp: 50,
    maxHp: 71,
    ac: 80,
    image: "assets/img/characters/placeholder.png",
    items: [],
    quests: [],
    timeline: [],
    relationships: {
      parent: [],
      partner: [],
      children: [],
      sibling: [],
      enemy: ["Marcus"],
      ally: [],
      groups: [],
      memberships: []
    }
  },

  "Yat": {
    player: "Bex",
    race: "Elf",
    charClass: "Wizard",
    gender: "Female",
    age: "Young Adult",
    status: "Alive",
    level: 4,
    hp: 50,
    maxHp: 71,
    ac: 80,
    image: "assets/img/characters/yat.png",
    items: [],
    quests: [],
    timeline: [
      {
        heading: "Childhood",
        text: "Ddraig and Yat have been friends since an early age, ever since Ddraig's family gave shelter to Yat and his family."
      },
      {
        heading: "Journey",
        text: "After meeting Ddraig Corllin-Hill on the Stormwreck Isle, Yat was gifted a ball of gems believed to be good luck, and a new quest."
      }
    ],
    relationships: {
      parent: [],
      partner: ["Alfred"],
      children: [],
      sibling: [],
      enemy: ["Marcus"],
      ally: ["Gwilym Cadwalader"],
      groups: [],
      memberships: []
    }
  }
};

function getFallbackProfile(characterName) {
  return FALLBACK_PROFILES[characterName] || null;
}

/**
 * Returns the full profile for the named character, or null if unknown.
 * @param {string} characterName
 * @returns {Promise<object|null>}
 */
async function getCharacterProfile(characterName) {
  // Gated on the characters table specifically, not just data/manifest.json
  // existing — the manifest is committed with empty `tables` from Phase 1
  // and stays that way until the plugin's first real export, so checking
  // only "does the manifest fetch succeed" would treat that placeholder
  // state as "live data is authoritative" and wrongly show nobody found
  // instead of falling back.
  const characters = await ContentStore.getTable("characters");
  if (!characters) return getFallbackProfile(characterName);

  const [npcs, organisations, quests, items, relationships] = await Promise.all([
    ContentStore.getTable("npcs"),
    ContentStore.getTable("organisations"),
    ContentStore.getTable("quests"),
    ContentStore.getTable("items"),
    ContentStore.getTable("relationships"),
  ]);

  const record = characters.find(function (c) { return c.name === characterName; });
  if (!record) return null;

  const bases = await ContentStore.getBasesForSlug(record.id);
  const fallback = getFallbackProfile(characterName);
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
    image: (fallback && fallback.image) || (record.image ? "data/" + record.image : "assets/img/characters/placeholder.png"),
    items: extractOwnedItems(bases, items || []),
    quests: resolveNames(record.connectedQuests, quests || []),
    timeline: (fallback && fallback.timeline) || [],
    relationships: buildRelationships(record, relationships || [], organisations || [], namesById),
  };
}

// A character's owned items come from a Bases backlink query in the vault
// (e.g. Aerin.md's "Inventory" section), not a frontmatter list — so they
// land in this note's Bases export, in whichever view name mentions items.
function extractOwnedItems(bases, items) {
  if (!bases || !Array.isArray(bases.views)) return [];
  const itemView = bases.views.find(function (v) { return /item/i.test(v.viewName); });
  if (!itemView) return [];
  const byId = {};
  items.forEach(function (item) { byId[item.id] = item; });
  return itemView.rows
    .map(function (row) { return row.entityId && byId[row.entityId]; })
    .filter(Boolean)
    .map(function (item) { return item.name; });
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
    children: byType("children"),
    sibling: byType("sibling"),
    enemy: byType("enemy"),
    ally: byType("ally"),
    groups: resolveNames(record.connectedGroups, organisations),
    memberships: memberships,
  };
}
