/**
 * back-link.js
 *
 * Makes the page's "← Back to …" link return to the page the visitor
 * actually came from (e.g. player.html → correspondence → back to
 * player.html) instead of a fixed parent. The referrer is only used when it
 * is another page of this site; otherwise the link keeps the default href and
 * label set in the page's markup (or by world.js).
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

function applyBackLink() {
  const link = document.getElementById("backLink");
  if (!link || !document.referrer) return;

  let ref;
  try {
    ref = new URL(document.referrer);
  } catch (e) {
    return;
  }
  if (ref.origin !== window.location.origin) return;
  if (ref.href === window.location.href) return;

  const file = ref.pathname.split("/").pop() || "index.html";
  const label = BACK_LABELS[file];
  if (!label) return;

  link.href = ref.pathname + ref.search + ref.hash;
  link.textContent = "← Back to " + label;
}

applyBackLink();
