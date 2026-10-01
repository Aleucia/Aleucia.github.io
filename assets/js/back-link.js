/**
 * back-link.js
 *
 * Makes the page's "← Back to …" link walk back down the trail of pages the
 * visitor actually passed through (e.g. home → player → correspondence: back
 * goes to player, then to home) instead of a fixed parent or just the
 * referrer, which would bounce between the same two pages.
 *
 * The trail lives in sessionStorage as a list of page URLs, current page last.
 * Visiting a page already on the trail cuts the trail back to it; any other
 * page is appended. The link points at the entry before the current page and
 * is labelled with that page's name. With no earlier entry the link keeps the
 * default href and label set in the page's markup (or by world.js).
 *
 * Loaded on every page with a #backLink, after nav-menu.js. world.js calls
 * applyBackLink() again once it has chosen its own default.
 */

const BACK_LABELS = {
  "home.html": "Home",
  "player.html": "Chronicle",
  "character.html": "Character",
  "assets.html": "Assets",
  "map.html": "Map",
  "world.html": "World"
};

const BACK_TRAIL_KEY = "aleuciaBackTrail";
const BACK_TRAIL_MAX = 50;

// World pages are named after the table they show; correspondence has no
// list page of its own and is browsed from assets.html, so a trail that
// recorded a bare list URL still gets a sensible label.
const BACK_WORLD_LABELS = {
  locations: "The World",
  organisations: "Factions",
  npcs: "People",
  quests: "Quest Log",
  items: "Items",
  correspondence: "Correspondence",
  recipes: "Known Recipes"
};

function backEntryFor(url) {
  return url.pathname + url.search + url.hash;
}

function backLabelFor(entry) {
  const url = new URL(entry, window.location.origin);
  const file = url.pathname.split("/").pop() || "index.html";
  if (file === "world.html") {
    return BACK_WORLD_LABELS[url.searchParams.get("table")] || BACK_LABELS[file];
  }
  return BACK_LABELS[file];
}

function readBackTrail() {
  try {
    const trail = JSON.parse(sessionStorage.getItem(BACK_TRAIL_KEY));
    if (Array.isArray(trail)) return trail.filter(function (e) { return typeof e === "string"; });
  } catch (e) { /* storage unavailable or corrupt */ }
  return [];
}

function writeBackTrail(trail) {
  try {
    sessionStorage.setItem(BACK_TRAIL_KEY, JSON.stringify(trail.slice(-BACK_TRAIL_MAX)));
  } catch (e) { /* storage unavailable */ }
}

function sameSiteReferrerEntry() {
  if (!document.referrer) return null;
  try {
    const ref = new URL(document.referrer);
    if (ref.origin !== window.location.origin) return null;
    return backEntryFor(ref);
  } catch (e) {
    return null;
  }
}

// Records the current page on the trail and returns the trail up to and
// including it.
function recordBackTrail() {
  const current = backEntryFor(window.location);
  let trail = readBackTrail();

  const at = trail.lastIndexOf(current);
  if (at !== -1) {
    trail = trail.slice(0, at + 1);
  } else {
    const ref = sameSiteReferrerEntry();
    // A trail that doesn't end at the referrer belongs to some other visit
    // (new tab, typed URL); start again from where we really came from.
    if (!ref) trail = [];
    else if (trail[trail.length - 1] !== ref) trail = [ref];
    trail.push(current);
  }

  writeBackTrail(trail);
  return trail;
}

function applyBackLink() {
  const link = document.getElementById("backLink");
  if (!link) return;

  const trail = recordBackTrail();
  // Walk back past entries that have no name rather than showing a bare link.
  for (let i = trail.length - 2; i >= 0; i--) {
    const label = backLabelFor(trail[i]);
    if (!label) continue;
    link.href = trail[i];
    link.textContent = "← Back to " + label;
    return;
  }
}

applyBackLink();
