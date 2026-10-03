#!/usr/bin/env python3
"""Generate a spell writing circle (SVG) for every spell in data/spells.json.

The circles follow the Gorilla of Destiny's Spell Writing Guide
(https://www.drivethrurpg.com/en/product/429711/The-Spell-Writing-Guide),
using the rules from his MIT-licensed reference implementation
(https://github.com/GorillaOfDestiny/SpellWriting, (c) 2025 GorillaOfDestiny):

* Thirteen points sit on a circle (2 * 6 attributes + 1).
* Each of six attributes - level, school, damage type, area of effect, range
  and duration, in that order - is looked up in a fixed, ordered list. The
  position in that list picks a rotationally unique 13-bit binary number (a
  "necklace"); the n-th attribute (n = 1..6) draws a straight line from point
  j to point j + n for every bit j that is set.
* Concentration adds a dot at the centre; ritual adds a ring around it.

The necklace generator is Ernesti's, from the Theory of Magic server
(https://github.com/Ernesti04/necklace_projects), as used upstream. It is
re-implemented here with only the standard library, and the SVG is written by
hand, so the build needs no pip packages (matplotlib/numpy upstream).

data/spells.json carries level, school, range, duration, concentration and
ritual, but not a damage type or area of effect, so those two are read from
the rules text (and the range, for "Self (15-foot Cone)" style entries). A
value that has no entry in the guide's lists snaps to the nearest one that
does (a 25-foot cone draws as a 30-foot cone), or to the list's blank entry
when the spell has none. Each SVG's <desc> records the values that were used.

Output is deterministic - one assets/spell-circles/<spell-slug>.svg per spell,
where the slug is the last segment of the spell's id - so re-running only
changes files whose spell changed. Spells that have left spells.json have
their circle removed. Run it as part of the build:

    python3 scripts/generate-spell-circles.py          # (re)write the circles
    python3 scripts/generate-spell-circles.py --check  # exit 1 if any are stale

CI runs it on every push that touches data/spells.json (see
.github/workflows/spell-circles.yml).
"""

import json
import math
import os
import re
import sys
from xml.sax.saxutils import escape

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPELLS_PATH = os.path.join(REPO_ROOT, "data", "spells.json")
OUT_DIR = os.path.join(REPO_ROOT, "assets", "spell-circles")

N_ATTRIBUTES = 6
N_POINTS = 2 * N_ATTRIBUTES + 1

# Ink colours: the site's gold (--gold in assets/css/style.css) for the
# strokes, on a transparent background so the card shows through.
LINE_COLOR = "#c8a84b"
DOT_COLOR = "#e8dfc8"

# Attribute orderings, copied from the guide's attribute_ordering/*.txt. The
# order is the spell-writing system itself - never re-sort or insert in the
# middle, only append, or every existing circle changes meaning.
LEVELS = ["Blank", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
SCHOOLS = ["Blank", "Abjuration", "Conjuration", "Divination", "Enchantment",
           "Evocation", "Illusion", "Necromancy", "Transmutation"]
DAMAGE_TYPES = ["None", "Acid", "Bludgeoning", "Cold", "Fire", "Force",
                "Lightning", "Necrotic", "Piercing", "Poison", "Psychic",
                "Radiant", "Slashing", "Thunder"]
AREAS = ["None",
         "cone (15)", "cone (30)", "cone (40)", "cone (60)",
         "cube (10)", "cube (100)", "cube (15)", "cube (150)", "cube (20)",
         "cube (200)", "cube (2500)", "cube (30)", "cube (40)", "cube (40000)",
         "cube (5)", "cube (5280)",
         "cylinder (10)", "cylinder (20)", "cylinder (40)", "cylinder (5)",
         "cylinder (50)", "cylinder (60)",
         "line (100)", "line (50)", "line (60)", "line (90)",
         "sphere (10)", "sphere (100)", "sphere (15)", "sphere (20)",
         "sphere (30)", "sphere (360)", "sphere (40)", "sphere (5)",
         "sphere (60)"]
RANGES = ["Blank", "1 mile", "10 feet", "100 feet", "120 feet", "150 feet",
          "30 feet", "300 feet", "5 feet", "500 feet", "500 miles", "60 feet",
          "90 feet", "Self", "Sight", "Special", "Touch", "Unlimited"]
DURATIONS = ["Instantaneous", "1 hour", "1 minute", "1 round", "10 days",
             "10 minutes", "24 hours", "30 days", "7 days", "8 hours",
             "Special", "Until dispelled", "Up to 1 hour", "Up to 1 minute",
             "Up to 1 round", "Up to 10 minutes", "Up to 2 hours",
             "Up to 24 hours", "Up to 8 hours"]


def unique_necklaces(n):
    """Every rotationally unique n-bit binary number, as lists of bits, in
    ascending order (all zeros first). Ernesti's method: a necklace is
    counted once, as its smallest rotation. Only odd numbers are tried - an
    even one ends in 0, so a rotation that moves that 0 to the front is
    smaller, and the necklace is found as that rotation instead."""
    found = ["0" * n]
    for x in range(1, 2 ** n, 2):
        s = format(x, "0%db" % n)
        if all(s[i:] + s[:i] >= s for i in range(1, n)):
            found.append(s)
    return [[int(bit) for bit in s] for s in found]


NECKLACES = unique_necklaces(N_POINTS)


def index_of(options, value):
    return [o.lower() for o in options].index(value.lower())


def nearest(candidates, target):
    """The candidate closest to target; the smaller one wins a tie."""
    return min(candidates, key=lambda c: (abs(c - target), c))


def snap_area(shape, size):
    sizes = sorted(int(m.group(1)) for a in AREAS
                   for m in [re.fullmatch(shape + r" \((\d+)\)", a)] if m)
    return "%s (%d)" % (shape, nearest(sizes, size)) if sizes else "None"


AREA_SHAPES = {"sphere": "sphere", "radius": "sphere", "emanation": "sphere",
               "cone": "cone", "cube": "cube", "square": "cube",
               "cylinder": "cylinder", "line": "line"}
AREA_PATTERN = re.compile(
    r"(\d+)[- ]foot(?:[- ](?:radius|diameter|long|wide))*[, ]*(?:[a-z-]+ )?"
    r"(sphere|cone|cube|cylinder|line|emanation|square|radius)\b", re.I)


def damage_type(spell):
    match = re.search(r"\b(%s) damage" % "|".join(DAMAGE_TYPES[1:]),
                      spell.get("description", ""), re.I)
    return match.group(1).title() if match else "None"


def area_of_effect(spell):
    # The range line is the most reliable ("Self (15-foot Cone)"); fall back
    # to the first shape the rules text mentions.
    for text in (spell.get("range", ""), spell.get("description", "")):
        match = AREA_PATTERN.search(text)
        if match:
            return snap_area(AREA_SHAPES[match.group(2).lower()], int(match.group(1)))
    return "None"


def range_of(spell):
    text = re.sub(r"\s*\(.*\)", "", spell.get("range", "")).strip()
    if any(text.lower() == r.lower() for r in RANGES):
        return text
    match = re.fullmatch(r"(\d+) feet", text, re.I)
    if match:
        feet = [int(r.split()[0]) for r in RANGES if r.endswith(" feet")]
        return "%d feet" % nearest(feet, int(match.group(1)))
    return "Special"


def duration_of(spell):
    text = re.sub(r"^concentration,?\s*", "", spell.get("duration", ""), flags=re.I).strip()
    return text if any(text.lower() == d.lower() for d in DURATIONS) else "Special"


def circle_attributes(spell):
    """The six attribute values, in drawing order, as they appear in the
    guide's lists."""
    return [
        str(spell["level"]),
        spell.get("school") or "Blank",
        damage_type(spell),
        area_of_effect(spell),
        range_of(spell),
        duration_of(spell),
    ]


ATTRIBUTE_LISTS = [LEVELS, SCHOOLS, DAMAGE_TYPES, AREAS, RANGES, DURATIONS]
ATTRIBUTE_NAMES = ["Level", "School", "Damage", "Area", "Range", "Duration"]

SIZE = 400
CENTER = SIZE / 2
RADIUS = 160


def point(i):
    # Upstream's polygon base: point 0 is the filled dot; the rest follow
    # clockwise from just left of the top.
    angle = math.pi / N_POINTS + (i + 1) * 2 * math.pi / N_POINTS
    return (CENTER + RADIUS * math.sin(angle), CENTER - RADIUS * math.cos(angle))


def fmt(value):
    return ("%.2f" % value).rstrip("0").rstrip(".")


def render_svg(spell):
    attributes = circle_attributes(spell)
    points = [point(i) for i in range(N_POINTS)]
    lines = []
    for k, (options, value) in enumerate(zip(ATTRIBUTE_LISTS, attributes), start=1):
        bits = NECKLACES[index_of(options, value)]
        for j, bit in enumerate(bits):
            if bit:
                (x1, y1), (x2, y2) = points[j], points[(j + k) % N_POINTS]
                lines.append('<line x1="%s" y1="%s" x2="%s" y2="%s"/>'
                             % (fmt(x1), fmt(y1), fmt(x2), fmt(y2)))

    dots = []
    for i, (x, y) in enumerate(points):
        fill = DOT_COLOR if i == 0 else "none"
        dots.append('<circle cx="%s" cy="%s" r="5" fill="%s"/>' % (fmt(x), fmt(y), fill))

    marks = []
    if spell.get("concentration"):
        marks.append('<circle cx="%s" cy="%s" r="5" fill="%s" stroke="none"/>'
                     % (fmt(CENTER), fmt(CENTER), DOT_COLOR))
    if spell.get("ritual"):
        marks.append('<circle cx="%s" cy="%s" r="14" fill="none" stroke-width="3"/>'
                     % (fmt(CENTER), fmt(CENTER)))

    description = "; ".join("%s: %s" % pair for pair in zip(ATTRIBUTE_NAMES, attributes))
    flags = [f for f, on in (("concentration", spell.get("concentration")),
                             ("ritual", spell.get("ritual"))) if on]
    if flags:
        description += "; " + ", ".join(flags)

    return "\n".join([
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" role="img"'
        ' aria-labelledby="title desc">' % (SIZE, SIZE),
        "<title id=\"title\">%s spell writing circle</title>" % escape(spell["name"]),
        '<desc id="desc">%s</desc>' % escape(description),
        '<g stroke="%s" stroke-width="2.5" stroke-linecap="round">' % LINE_COLOR,
        *lines,
        *dots,
        *marks,
        "</g>",
        "</svg>",
        "",
    ])


def slug_of(spell):
    return spell["id"].rsplit("/", 1)[-1]


def main():
    check = "--check" in sys.argv[1:]
    with open(SPELLS_PATH, encoding="utf-8") as f:
        spells = json.load(f)

    expected = {}
    for spell in spells:
        slug = slug_of(spell)
        if slug in expected:
            sys.exit("Duplicate spell slug '%s' (%s)" % (slug, spell["id"]))
        expected[slug + ".svg"] = render_svg(spell)

    existing = set(os.listdir(OUT_DIR)) if os.path.isdir(OUT_DIR) else set()
    existing = {name for name in existing if name.endswith(".svg")}
    stale = []
    for name, svg in expected.items():
        path = os.path.join(OUT_DIR, name)
        current = None
        if os.path.isfile(path):
            with open(path, encoding="utf-8", newline="") as f:
                current = f.read()
        if current != svg:
            stale.append(name)
            if not check:
                os.makedirs(OUT_DIR, exist_ok=True)
                with open(path, "w", encoding="utf-8", newline="") as f:
                    f.write(svg)
    orphans = sorted(existing - set(expected))
    if not check:
        for name in orphans:
            os.remove(os.path.join(OUT_DIR, name))

    if check:
        for name in stale + orphans:
            print("out of date: %s" % name)
        if stale or orphans:
            sys.exit("Spell circles are out of date - run scripts/generate-spell-circles.py")
        print("All %d spell circles are up to date." % len(expected))
    else:
        print("Spell circles: %d total, %d written, %d removed."
              % (len(expected), len(stale), len(orphans)))


if __name__ == "__main__":
    main()
