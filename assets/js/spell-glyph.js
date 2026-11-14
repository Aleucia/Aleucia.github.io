// Spell glyphs: the alternative spell notation to the wizard's writing circle
// (scripts/generate-spell-circles.py). Ported from spell_glyph_generator_3.html:
//
// * The spell's level picks the ornament: a ring and 12-sided polygon for
//   every spell, with small "intermediate" circles for levels 1-3, a
//   pentagram tier from 4th level, a ticked outer ring at 8th and corner
//   brackets at 9th.
// * Three inner circles hold the school, save and effect symbols.
// * Six symbols are written around the outer ring, clockwise from the top:
//   components, area, duration, range, target, casting time (action).
//
// spells.json has no save, effect or target fields, so those - like the
// area of effect - are read from the rules text. spellGlyphAttributes()
// returns everything that was used, and the SVG's <desc> lists it.
//
// The glyph is drawn inline (not as an <img>) with currentColor, so it takes
// the page's colours and fonts; the filled circles use --glyph-bg.

const GLYPH_SYMBOLS = {
  action: {
    "Reaction": "↯", "Bonus Action": "→", "Action": "⇒", "Minutes": "◷", "Hours": "🝮"
  },
  ritual: "⌬",
  range: {
    "Self": "§", "Touch": "☞", "Feet": "φ", "Miles": "μ", "Sight": "𓂀", "Special": "ß"
  },
  area: {
    "None": "∅", "Target": "⊹", "Point": "⋄", "Line": "|", "Burst": "🝊", "Cone": "△",
    "Cube": "◻", "Cylinder": "⌭", "Sphere": "◯"
  },
  verbal: "⍱",
  somatic: "🜔",
  material: { "None": "", "Material": "🝗", "Expensive Material": "🝗¤" },
  focus: { "None": "", "Focus": "∮", "Expensive Focus": "∮¤" },
  duration: {
    "Instantaneous": "ϟ", "Rounds": "↻", "Minutes": "◷", "Hours": "🝮", "Days": "🝰",
    "Indefinite": "∞", "Special": "ß"
  },
  concentration: "☾",
  school: {
    "Abjuration": "♄", "Conjuration": "♃", "Divination": "♆", "Enchantment": "♀",
    "Evocation": "♂", "Illusion": "☿", "Necromancy": "♇", "Transmutation": "♅"
  },
  save: {
    "None": "∅", "Strength": "σ", "Dexterity": "δ", "Constitution": "κ", "Intelligence": "ι",
    "Wisdom": "ω", "Charisma": "χ", "Melee Attack": "†", "Ranged Attack": "➵"
  },
  partialEffect: "◪",
  effect: {
    "Aggressive": "Λ", "Defensive": "⛉", "Control": "⚷", "Mobility": "⊱", "Utility": "⚙",
    "Summoning": "Ϡ"
  },
  target: {
    "None": "∅", "Self": "§", "Target(s)": "⊹", "Area": "⛶", "Objects": "❐", "Creature": "🜶",
    "You can see": "∢", "Can understand you": "⛤", "Choose": "∵"
  }
};

const GLYPH_NUMBER_WORDS = {
  a: 1, an: 1, the: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, twelve: 12
};

function glyphText(spell) {
  return String((spell && spell.description) || "");
}

function glyphCastingTime(spell) {
  const text = String(spell.castingTime || "").toLowerCase();
  let match;
  if (/reaction/.test(text)) return { value: "Reaction" };
  if (/bonus action/.test(text)) return { value: "Bonus Action" };
  if ((match = text.match(/(\d+)\s*minute/))) return { value: "Minutes", count: +match[1] };
  if ((match = text.match(/(\d+)\s*hour/))) return { value: "Hours", count: +match[1] };
  return { value: "Action" };
}

function glyphRange(spell) {
  const text = String(spell.range || "").replace(/\s*\(.*\)/, "").trim().toLowerCase();
  let match;
  if (text === "self") return { value: "Self" };
  if (text === "touch") return { value: "Touch" };
  if (text === "sight") return { value: "Sight" };
  if ((match = text.match(/^(\d+)\s*(?:foot|feet)/))) return { value: "Feet", count: +match[1] };
  if ((match = text.match(/^(\d+)\s*miles?/))) return { value: "Miles", count: +match[1] };
  return { value: "Special" };
}

const GLYPH_AREA_SHAPES = {
  sphere: "Sphere", radius: "Sphere", emanation: "Burst", cone: "Cone", cube: "Cube",
  square: "Cube", cylinder: "Cylinder", line: "Line"
};
const GLYPH_AREA_PATTERN =
  /(\d+)[- ]foot(?:[- ](?:radius|diameter|long|wide))*[, ]*(?:[a-z-]+ )?(sphere|cone|cube|cylinder|line|emanation|square|radius)\b/i;

function glyphArea(spell) {
  // The range line is the most reliable ("Self (15-foot Cone)"); fall back
  // to the first shape the rules text mentions.
  const sources = [String(spell.range || ""), glyphText(spell)];
  for (let i = 0; i < sources.length; i++) {
    const match = sources[i].match(GLYPH_AREA_PATTERN);
    if (match) return { value: GLYPH_AREA_SHAPES[match[2].toLowerCase()], count: +match[1] };
  }
  if (/\ba point\b/i.test(glyphText(spell))) return { value: "Point" };
  return { value: "None" };
}

function glyphComponents(spell) {
  const text = String(spell.components || "");
  const letters = text.replace(/\(.*\)/, "").split(",").map(function (s) { return s.trim().toUpperCase(); });
  const material = letters.indexOf("M") === -1 ? "None"
    : /\bworth\b|\d+\+?\s*GP\b/i.test(text) ? "Expensive Material" : "Material";
  return {
    verbal: letters.indexOf("V") !== -1,
    somatic: letters.indexOf("S") !== -1,
    material: material,
    focus: "None"
  };
}

function glyphDuration(spell) {
  const text = String(spell.duration || "").replace(/^concentration,?\s*/i, "").trim().toLowerCase();
  let match;
  if (/^instantaneous/.test(text)) return { value: "Instantaneous" };
  if (/until dispelled|permanent/.test(text)) return { value: "Indefinite" };
  if ((match = text.match(/(\d+)\s*round/))) return { value: "Rounds", count: +match[1] };
  if ((match = text.match(/(\d+)\s*minute/))) return { value: "Minutes", count: +match[1] };
  if ((match = text.match(/(\d+)\s*hour/))) return { value: "Hours", count: +match[1] };
  if ((match = text.match(/(\d+)\s*day/))) return { value: "Days", count: +match[1] };
  return { value: "Special" };
}

// Whichever comes first in the rules text: a saving throw or a spell attack.
function glyphSave(spell) {
  const text = glyphText(spell);
  const candidates = [
    [/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i, null],
    [/\bmelee spell attack/i, "Melee Attack"],
    [/\branged spell attack/i, "Ranged Attack"]
  ];
  let best = null;
  candidates.forEach(function (c) {
    const match = text.match(c[0]);
    if (match && (!best || match.index < best.index)) {
      best = { index: match.index, value: c[1] || match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() };
    }
  });
  return { value: best ? best.value : "None" };
}

// The spell's purpose, judged from its name and rules text, most specific
// first. "Partial" marks a spell that still does half damage on a save.
function glyphEffect(spell, save) {
  const name = String(spell.name || "");
  const text = glyphText(spell);
  const partial = /half as much damage|half damage/i.test(text);
  let value;
  if (/\b(summon|conjure|familiar|steed|servant)\b/i.test(name) || /\byou (summon|conjure)\b/i.test(text)) {
    value = "Summoning";
  } else if (/\d+d\d+[^.]*\bdamage\b|\bdamage\b[^.]*\d+d\d+/i.test(text)) {
    value = "Aggressive";
  } else if (/\b(step|jump|fall|walk|fly|teleport|haste|longstrider)\b/i.test(name) ||
             /\bteleport|speed increases|flying speed|rate of descent/i.test(text)) {
    value = "Mobility";
  } else if (spell.school === "Abjuration" || /armor class|\bresistance\b|hit points/i.test(text)) {
    value = "Defensive";
  } else if (save !== "None" ||
             /\b(charmed|frightened|paralyzed|restrained|prone|incapacitated|unconscious|blinded|stunned)\b/i.test(text)) {
    value = "Control";
  } else {
    value = "Utility";
  }
  return { value: value, partial: partial };
}

function glyphTarget(spell, range, area) {
  const text = glyphText(spell);
  let match;
  if (area.value !== "None" && area.value !== "Point") return { value: "Area" };
  if (range.value === "Self") return { value: "Self" };
  if (/can understand you/i.test(text)) return { value: "Can understand you" };
  // Whichever the rules text names first: creatures or objects.
  const creature = text.match(/\b(?:up to )?(a|an|the|one|two|three|four|five|six|seven|eight|nine|ten|twelve|\d+) (?:willing )?(?:creatures?|humanoids?|beasts?|targets?)\b/i);
  const object = text.match(/\b(?:objects?|weapons?)\b/i);
  if (creature && (!object || creature.index < object.index)) {
    const word = creature[1].toLowerCase();
    const count = GLYPH_NUMBER_WORDS[word] || +word || 1;
    const seen = /you can see/i.test(text.slice(creature.index, creature.index + creature[0].length + 30));
    return { value: seen ? "You can see" : "Creature", count: count > 1 ? count : undefined };
  }
  if (object) return { value: "Objects" };
  if (/\bof your choice\b|\byou choose\b/i.test(text)) return { value: "Choose" };
  return { value: "None" };
}

// Corrections for spells whose rules text misleads the readers above, keyed
// by spell slug (the last segment of its id). Each entry replaces whole
// attributes, in the shape spellGlyphAttributes() returns.
const GLYPH_OVERRIDES = {
  "enlarge-reduce-xphb": { effect: { value: "Utility", partial: false } },
  "light-xphb": { target: { value: "Objects" } }
};

function spellGlyphAttributes(spell) {
  const range = glyphRange(spell);
  const area = glyphArea(spell);
  const save = glyphSave(spell);
  const slug = String(spell.id || "").split("/").pop();
  return Object.assign({
    level: Math.max(0, Math.min(9, Number(spell.level) || 0)),
    school: GLYPH_SYMBOLS.school[spell.school] ? spell.school : null,
    action: glyphCastingTime(spell),
    ritual: !!spell.ritual,
    range: range,
    area: area,
    components: glyphComponents(spell),
    duration: glyphDuration(spell),
    concentration: !!spell.concentration,
    save: save,
    effect: glyphEffect(spell, save.value),
    target: glyphTarget(spell, range, area)
  }, GLYPH_OVERRIDES[slug] || {});
}

// The ring text for one attribute: an optional count, then its symbol.
function glyphWithCount(attr, symbols) {
  return (attr.count ? String(attr.count) : "") + symbols[attr.value];
}

function spellGlyphSymbols(attrs) {
  const c = attrs.components;
  return {
    school: attrs.school ? GLYPH_SYMBOLS.school[attrs.school] : "",
    save: GLYPH_SYMBOLS.save[attrs.save.value],
    effect: (attrs.effect.partial ? GLYPH_SYMBOLS.partialEffect : "") + GLYPH_SYMBOLS.effect[attrs.effect.value],
    components: [
      c.verbal ? GLYPH_SYMBOLS.verbal : "",
      c.somatic ? GLYPH_SYMBOLS.somatic : "",
      GLYPH_SYMBOLS.material[c.material],
      GLYPH_SYMBOLS.focus[c.focus]
    ].filter(Boolean).join(" "),
    area: glyphWithCount(attrs.area, GLYPH_SYMBOLS.area),
    duration: (attrs.concentration ? GLYPH_SYMBOLS.concentration : "") +
      glyphWithCount(attrs.duration, GLYPH_SYMBOLS.duration),
    range: glyphWithCount(attrs.range, GLYPH_SYMBOLS.range),
    target: glyphWithCount(attrs.target, GLYPH_SYMBOLS.target),
    action: glyphWithCount(attrs.action, GLYPH_SYMBOLS.action) + (attrs.ritual ? GLYPH_SYMBOLS.ritual : "")
  };
}

function glyphFmt(n) {
  return String(Math.round(n * 1000) / 1000);
}

function glyphCircle(cx, cy, r, width, filled) {
  return '<circle cx="' + glyphFmt(cx) + '" cy="' + glyphFmt(cy) + '" r="' + r + '" stroke-width="' + width + '"' +
    (filled ? ' class="glyph-fill"' : ' fill="none"') + "/>";
}

function glyphPolygon(points, width) {
  return '<polygon fill="none" stroke-width="' + width + '" points="' +
    points.map(function (p) { return glyphFmt(p[0]) + "," + glyphFmt(p[1]); }).join(" ") + '"/>';
}

function glyphRegular(n, r, startDeg, step) {
  const points = [];
  for (let i = 0; i < n; i++) {
    const a = (startDeg + i * (step || 360 / n)) * Math.PI / 180;
    points.push([300 + r * Math.sin(a), 300 - r * Math.cos(a)]);
  }
  return points;
}

// The level ornaments, built from the generator's tiers.
function glyphLevelGeometry(level) {
  const tier1 = [
    glyphCircle(300, 300, 210, 2.5),
    glyphPolygon(glyphRegular(12, 210, 0), 1),
    glyphCircle(300, 300, 250, 2.5),
    glyphCircle(300, 300, 255, 1)
  ];
  const tier2 = [
    glyphCircle(300, 300, 65, 5),
    glyphCircle(300, 300, 70, 1),
    glyphCircle(300, 300, 145, 2.5),
    // A pentagram: every second point of a pentagon.
    glyphPolygon(glyphRegular(5, 65, 0, 144), 2)
  ];
  const ticks = [];
  for (let deg = 0; deg < 360; deg += 5) {
    const a = deg * Math.PI / 180;
    ticks.push('<line stroke-width="1" x1="' + glyphFmt(300 + 260 * Math.cos(a)) + '" y1="' +
      glyphFmt(300 + 260 * Math.sin(a)) + '" x2="' + glyphFmt(300 + 280 * Math.cos(a)) + '" y2="' +
      glyphFmt(300 + 280 * Math.sin(a)) + '"/>');
  }
  const tier3 = [glyphCircle(300, 300, 260, 2.5), glyphCircle(300, 300, 280, 2.5)].concat(ticks);
  const tier4 = [
    "M 10,10 H 190.455 A 320,320 0 0,0 10,190.455 Z",
    "M 590,10 H 409.545 A 320,320 0 0,1 590,190.455 Z",
    "M 10,590 H 190.455 A 320,320 0 0,1 10,409.545 Z",
    "M 590,590 H 409.545 A 320,320 0 0,0 590,409.545 Z"
  ].map(function (d) { return '<path fill="none" stroke-width="2" d="' + d + '"/>'; });
  const inter1 = [glyphCircle(300, 550, 40, 2.5, true)];
  const inter2 = [glyphCircle(300, 50, 40, 2.5, true)];
  const inter3 = [glyphCircle(83.494, 175, 40, 2.5, true), glyphCircle(516.506, 175, 40, 2.5, true)];

  const byLevel = [
    [tier1],
    [tier1, inter1],
    [tier1, inter1, inter2],
    [tier1, inter1, inter3],
    [tier1, tier2],
    [tier1, tier2, inter1],
    [tier1, tier2, inter1, inter2],
    [tier1, tier2, inter1, inter3],
    [tier1, tier2, tier3],
    [tier1, tier2, tier3, tier4]
  ];
  return byLevel[level].reduce(function (all, part) { return all.concat(part); }, []);
}

function glyphEscape(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function glyphDescribe(attrs) {
  const withCount = function (a, unit) { return (a.count ? a.count + " " + (unit || "") : "") + a.value; };
  const c = attrs.components;
  const components = [c.verbal ? "V" : "", c.somatic ? "S" : "", c.material !== "None" ? c.material : ""]
    .filter(Boolean).join(", ") || "None";
  return [
    "Level: " + attrs.level,
    "School: " + (attrs.school || "None"),
    "Casting time: " + withCount(attrs.action) + (attrs.ritual ? " (ritual)" : ""),
    "Range: " + withCount(attrs.range),
    "Area: " + withCount(attrs.area, "ft "),
    "Components: " + components,
    "Duration: " + (attrs.concentration ? "Concentration, " : "") + withCount(attrs.duration),
    "Save: " + attrs.save.value,
    "Effect: " + attrs.effect.value + (attrs.effect.partial ? " (partial on save)" : ""),
    "Target: " + withCount(attrs.target)
  ].join("; ");
}

// The glyph as an SVG string. `uid` keeps the ring path's id unique when
// several glyphs share a page.
function spellGlyphSvg(spell, uid) {
  const attrs = spellGlyphAttributes(spell);
  const symbols = spellGlyphSymbols(attrs);
  const id = "glyph-ring-" + String(uid || "x").replace(/[^A-Za-z0-9_-]/g, "-");

  const ring = [
    ["components", 8.333], ["area", 25], ["duration", 41.667],
    ["range", 58.333], ["target", 75], ["action", 91.667]
  ].map(function (slot) {
    return '<text class="glyph-ring-text" font-size="28"><textPath href="#' + id + '" startOffset="' + slot[1] +
      '%" text-anchor="middle" dominant-baseline="middle">' + glyphEscape(symbols[slot[0]]) + "</textPath></text>";
  });

  const inner = [
    ["school", 300, 184.53], ["save", 200, 357.735], ["effect", 400, 357.735]
  ].map(function (slot) {
    return glyphCircle(slot[1], slot[2], 30, 2, true) +
      '<text class="glyph-symbol" x="' + slot[1] + '" y="' + slot[2] + '" font-size="32" text-anchor="middle"' +
      ' dominant-baseline="central" fill="currentColor" stroke="none">' + glyphEscape(symbols[slot[0]]) + "</text>";
  });

  return [
    '<svg class="spell-glyph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img">',
    "<title>" + glyphEscape(spell.name || "Spell") + " spell glyph</title>",
    "<desc>" + glyphEscape(glyphDescribe(attrs)) + "</desc>",
    '<path id="' + id + '" fill="none" stroke="none" d="M 300,70 A 230,230 0 1,1 300,530 A 230,230 0 1,1 300,70"/>',
    '<g stroke="currentColor" stroke-linecap="round">',
    glyphCircle(300, 300, 200, 3),
    // The hexagram: two triangles inscribed in the main circle.
    glyphPolygon([[200, 126.795], [500, 300], [200, 473.205]], 1.5),
    glyphPolygon([[100, 300], [400, 126.795], [400, 473.205]], 1.5),
    glyphLevelGeometry(attrs.level).join(""),
    inner.join(""),
    "</g>",
    '<g fill="currentColor" stroke="none">',
    ring.join(""),
    "</g>",
    "</svg>"
  ].join("");
}
