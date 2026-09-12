/**
 * Aleucia Character Profiles
 *
 * Non-sensitive character-sheet data for each roster member, sourced from
 * the DM's Obsidian vault (1-Party/The filthy casuals). This feeds the
 * per-character pages (characters/<slug>/*.html) linked from player.html.
 *
 * To update a character's data, edit their entry below and commit. Keep
 * this file free of anything the DM hasn't already shared with the party —
 * it is served as a plain static file, readable by anyone with the URL.
 */

const CHARACTER_PROFILES = {
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
    image: "aerin.png",
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
    image: "alaric.png",
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
    image: "placeholder.png",
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
    image: "jeff.png",
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
    image: "petra.png",
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
    image: "ser-gillard.png",
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
    image: "placeholder.png",
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
    image: "yat.png",
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

/**
 * Returns the full profile for the named character, or null if unknown.
 * @param {string} characterName
 */
function getCharacterProfile(characterName) {
  return CHARACTER_PROFILES[characterName] || null;
}
