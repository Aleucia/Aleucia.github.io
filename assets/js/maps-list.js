/**
 * Aleucia Maps — list page. Reads data/maps/index.json ({id, imageFile} per
 * map, written by Obsidian Cast's maps-exporter.ts) and links each to its
 * own map.html?id=<id> viewer.
 */

async function initMapsList() {
  const maps = await ContentStore.getMapIndex();
  const body = document.getElementById("pageBody");

  if (!maps || maps.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "No maps recorded yet. Check back as the chronicle grows.";
    body.appendChild(p);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "card-grid";
  maps
    .slice()
    .sort(function (a, b) { return a.id.localeCompare(b.id); })
    .forEach(function (map) {
      const card = document.createElement("a");
      card.className = "card map-thumb-card";
      card.href = "map.html?id=" + encodeURIComponent(map.id);
      card.innerHTML =
        '<img class="map-thumb" src="data/' + map.imageFile + '" alt="">' +
        '<p class="card-title">' + escapeHtml(capitalize(map.id)) + "</p>";
      grid.appendChild(card);
    });
  body.appendChild(grid);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", initMapsList);
