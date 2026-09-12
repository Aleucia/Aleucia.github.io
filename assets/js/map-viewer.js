/**
 * Aleucia Map Viewer
 *
 * Renders one data/maps/<id>.json (from Obsidian Cast's maps-exporter.ts)
 * with Leaflet. Positions in that file are pixel coordinates on the source
 * image (x right, y DOWN — the Obsidian Map plugin's own convention,
 * confirmed against real *.map-state.json files), not lat/lng, and Leaflet's
 * CRS.Simple has y increasing UP. toLatLng() below is the one place that
 * conversion happens: image (x, y) -> Leaflet [imageHeight - y, x].
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

  const imageHeight = map.imageBounds[1][0];
  const imageWidth = map.imageBounds[1][1];
  const toLatLng = function (position) { return [imageHeight - position[1], position[0]]; };

  const leafletMap = L.map("mapContainer", {
    crs: L.CRS.Simple,
    minZoom: -3,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
  });

  const bounds = [[0, 0], [imageHeight, imageWidth]];

  if (map.imageFile) {
    L.imageOverlay("data/" + map.imageFile, bounds).addTo(leafletMap);
  }
  leafletMap.fitBounds(bounds);
  // A quarter-image margin of pan room beyond the edges, not a hard clamp to
  // the image itself — markers or overlays right at the border shouldn't be
  // stuck against the viewport edge.
  leafletMap.setMaxBounds([
    [-imageHeight * 0.25, -imageWidth * 0.25],
    [imageHeight * 1.25, imageWidth * 1.25]
  ]);

  const index = await ContentStore.getEntityIndex();

  (map.markers || []).forEach(function (marker) { addMarker(leafletMap, marker, toLatLng, index); });
  (map.overlays || []).forEach(function (overlay) { addOverlay(leafletMap, overlay, toLatLng); });

  if ((map.markers || []).length === 0) {
    body.appendChild(emptyState("No markers recorded on this map yet."));
  }
}

function addMarker(leafletMap, marker, toLatLng, index) {
  const latlng = toLatLng(marker.position || [0, 0]);
  const icon = L.divIcon({
    className: "map-marker",
    html: '<span class="map-marker__dot"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });

  const leafletMarker = L.marker(latlng, { icon: icon }).addTo(leafletMap);

  let popupContent = "";
  if (marker.label) popupContent += '<strong class="map-popup__title">' + escapeHtml(marker.label) + "</strong>";
  if (marker.description) popupContent += '<p class="map-popup__desc">' + escapeHtml(marker.description) + "</p>";

  const linkedHref = marker.linkedEntity ? ContentStore.getEntityHref(marker.linkedEntity, index) : undefined;
  if (linkedHref) {
    popupContent += '<a class="map-popup__link" href="' + linkedHref.url + '">View ' + escapeHtml(linkedHref.label) + "</a>";
  }

  if (popupContent) leafletMarker.bindPopup(popupContent, { maxWidth: 280 });
}

function addOverlay(leafletMap, overlay, toLatLng) {
  const positions = (overlay.positions || []).map(toLatLng);
  if (positions.length < 2) return;

  const opts = { color: overlay.color || "#c8a84b", weight: 2 };
  let layer;
  if (overlay.type === "polygon") layer = L.polygon(positions, opts);
  else layer = L.polyline(positions, opts);

  layer.addTo(leafletMap);
  if (overlay.label) layer.bindTooltip(overlay.label);
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", initMapViewer);
