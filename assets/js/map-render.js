/**
 * Aleucia Map Rendering
 *
 * Shared Leaflet setup for a data/maps/<id>.json record (from Obsidian
 * Cast's maps-exporter.ts) — used both by the full-page viewer (map.html /
 * map-viewer.js) and by inline map embeds on location detail pages
 * (world.html / world.js), so the marker/overlay/coordinate logic only
 * lives in one place.
 *
 * Positions in that file are pixel coordinates on the source image (x
 * right, y DOWN — the Obsidian Map plugin's own convention, confirmed
 * against real *.map-state.json files), not lat/lng, and Leaflet's
 * CRS.Simple has y increasing UP. toLatLng() below is the one place that
 * conversion happens: image (x, y) -> Leaflet [imageHeight - y, x].
 */

function renderMap(container, map, index) {
  const imageHeight = map.imageBounds[1][0];
  const imageWidth = map.imageBounds[1][1];
  const toLatLng = function (position) { return [imageHeight - position[1], position[0]]; };

  const leafletMap = L.map(container, {
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

  (map.markers || []).forEach(function (marker) { addMapMarker(leafletMap, marker, toLatLng, index); });
  (map.overlays || []).forEach(function (overlay) { addMapOverlay(leafletMap, overlay, toLatLng); });

  return leafletMap;
}

function addMapMarker(leafletMap, marker, toLatLng, index) {
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
  if (marker.label) popupContent += '<strong class="map-popup__title">' + escapeMapHtml(marker.label) + "</strong>";
  if (marker.description) popupContent += '<p class="map-popup__desc">' + escapeMapHtml(marker.description) + "</p>";

  const linkedHref = marker.linkedEntity ? ContentStore.getEntityHref(marker.linkedEntity, index) : undefined;
  if (linkedHref) {
    popupContent += '<a class="map-popup__link" href="' + linkedHref.url + '">View ' + escapeMapHtml(linkedHref.label) + "</a>";
  }

  if (popupContent) leafletMarker.bindPopup(popupContent, { maxWidth: 280 });
}

function addMapOverlay(leafletMap, overlay, toLatLng) {
  const positions = (overlay.positions || []).map(toLatLng);
  if (positions.length < 2) return;

  const opts = { color: overlay.color || "#c8a84b", weight: 2 };
  let layer;
  if (overlay.type === "polygon") layer = L.polygon(positions, opts);
  else layer = L.polyline(positions, opts);

  layer.addTo(leafletMap);
  if (overlay.label) layer.bindTooltip(overlay.label);
}

function escapeMapHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
