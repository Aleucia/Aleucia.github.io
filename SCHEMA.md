# Data Schema

This repo owns the site's data contract: [`data-schema.json`](data-schema.json) declares
every table the site knows how to render, and the [Obsidian Cast](https://github.com/thocking2/Obsidian-cast)
plugin — running against the Aleucia vault — reads it and writes matching files under
[`data/`](data/) on every publish. Layout, styling, and rendering stay entirely in this
repo; the vault only ever supplies data that fits this contract.

This is a fresh design, not a description of what's currently in `assets/js/character-data.js`.
That file is a hand-written prototype from before this contract existed and predates the
plugin integration — it will be migrated to consume `data/*.json` in a later pass, once the
plugin can actually produce it.

## How it fits together

```
Vault (Aleucia)  →  Obsidian Cast plugin  →  data/*.json  →  this site's renderers
                        (reads data-schema.json               (fetch + render,
                         to know what to build)                 own layout/CSS)
```

## Reading `data-schema.json`

- **`conventions.id`** — every entity's id is its vault path run through the same
  `fileToSlug()` the plugin already uses elsewhere, so ids are stable and collision-free
  without a lookup table.
- **`tables.*.kind`**:
  - `entity` — one JSON array of typed records, one per matching vault note (characters,
    npcs, locations, organisations, items, recipes, quests, maps).
  - `graph` — edges, not nodes (`relationships`).
  - `static-reference` — vocabulary/config copied wholesale from a vault plugin's own
    config rather than derived per-note (`relationshipTypes`).
  - `dynamic` — the table's shape isn't fixed in advance because the vault author defines
    it themselves (a `.base` file's columns, a Dataview query's headers). One file per
    instance, all of them listed in `manifest.json`.
- **`tables.*.vaultSource.match`** — how the plugin decides which notes belong in this
  table (by `Category/*` tag, mostly).
- **`tables.*.fields[].source`** — the exact frontmatter key or vault construct a field
  comes from. Where a note's real behavior was checked against the vault (e.g. the
  `characters` table, checked against `1-Party/The filthy casuals/Aerin.md`), the mapping
  is exact. Where it's a best-effort guess because no confirmed example exists yet
  (`npcs.occupation`), that's called out in the field's description.

## Notable design choices

- **A recipe is its own entity, not an item.** Originally documented the other way around
  ("a recipe is just an item record with `crafting` populated via the `Item_Crafting`
  fileClass") — checked against a real vault note and found wrong: `Category/Recipe` is a
  separate tag from `Category/Item`, and a real recipe note (`Recipe - Ale mug.md`)
  declares its ingredients (`crafting_ingredients`) and output (`recipeOutput`, linking to
  the item it produces) directly, with no `Item_Crafting` fileClass involved. That
  fileClass does exist on some item notes, but its crafting fields are typically blank in
  practice — `items.crafting` is kept for compatibility, but `recipes` is where real
  recipe data lives.
- **Item ownership is a relationship, not a field.** A character's inventory isn't a
  list on the character record — it's `owns` edges in the `relationships` table, because
  in the vault it's actually sourced from a Bases backlink query (items in
  `3-Mechanics/Items` that link back to the owner), not a frontmatter list. Modeling it
  as an edge keeps one shape for "who owns what" whether the source was a Bases query or
  a direct frontmatter reference.
- **Relationships keep the vault's full vocabulary.** `obsidian-relationships` already
  defines types, inverses, symmetry, and display metadata (color/line style/arrowhead) in
  its own `data.json`. Rather than flattening that into a handful of display buckets
  (family/allies/enemies), the schema copies it wholesale as `relationshipTypes` and keeps
  edges fully typed — the site buckets/groups them for display however it wants, without
  losing information in the data layer.
- **Locations are one table, not several.** Place/Hub/PointOfInterest/Continent/Region/
  Planet/Galaxy are all "a location with a `locationType`," mirroring how the vault's own
  `MapConfig` fileClass already groups those tags together for map-bearing notes.
- **Bases and Dataview stay dynamic.** Both let a vault author define arbitrary columns
  per query/view, so their tables can't have a fixed field list — they're snapshotted as
  generic `{columns, rows}` or `{headers, rows}` data instead, one file per view/query,
  indexed through `manifest.json`.

## Versioning

`data-schema.json`'s `version` field is semver (see `compat.policy` inside the file
itself). `data/manifest.json`'s `schemaVersion` records what a given publish was built
against, so a renderer can detect a stale or incompatible export before it tries to read
data shaped for a different schema version.

## What's still open

- `npcs` has no confirmed real-note example yet (unlike `characters`, which was checked
  against `Aerin.md`) — its field list is a best guess and may need adjusting once the
  plugin is built against real NPC notes.
- Session Journal and Quest Log content (per the per-character pages) has no structured
  vault source today; `quests` covers the Quest Log via `connectedQuests` once that
  frontmatter field is actually populated in the vault, but there's intentionally no
  `timeline` table yet — that stays hand-curated until a real convention exists. Once
  one does, each entry is expected to carry `heading` (the session's title/date),
  `summary` (shown on the timeline itself), and `details` (the full write-up, revealed
  when a player clicks into that entry) — see `renderTimeline()` in
  `assets/js/character-page.js`.
