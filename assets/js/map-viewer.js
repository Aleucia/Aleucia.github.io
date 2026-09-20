/**
 * Aleucia Map Viewer
 *
 * Full-page viewer for one data/maps/<id>.json (from Obsidian Cast's
 * maps-exporter.ts), identified by map.html?id=<id>. The actual Leaflet
 * setup (coordinate conversion, markers, overlays) lives in map-render.js's
 * renderMap(), shared with the inline map embeds on location detail pages.
 */

async function initMapViewer() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const body = document.getElementById("pageBody");

  if (!id) {
    document.getElementById("mapContainer").remove();
    body.appendChild(emptyState("No map specified."));
    return;
  }

  const map = await ContentStore.getMap(id);
  if (!map) {
    document.getElementById("mapContainer").remove();
    document.getElementById("pageTitle").textContent = "Map";
    body.appendChild(emptyState("This map could not be found."));
    return;
  }

  document.title = "Aleucia — " + capitalize(id) + " Map";
  document.getElementById("pageTitle").textContent = capitalize(id);
  document.getElementById("pageLead").textContent = "Map";

  const index = await ContentStore.getEntityIndex();
  renderMap(document.getElementById("mapContainer"), map, index);

  if ((map.markers || []).length === 0) {
    body.appendChild(emptyState("No markers recorded on this map yet."));
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function emptyState(text) {
  const p = document.createElement("p");
  p.className = "empty-state";
  p.textContent = text;
  return p;
}

document.addEventListener("DOMContentLoaded", initMapViewer);
