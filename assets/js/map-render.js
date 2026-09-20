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

  addFullscreenControl(leafletMap, container, bounds);

  return leafletMap;
}

// A custom control rather than relying on the (unmaintained) Leaflet.fullscreen
// plugin — this needs no extra CDN dependency and lets the toggle button match
// the site's own dark theme. Fullscreens the map's own container element via
// the native Fullscreen API, which browsers auto-exit on Escape; the button
// itself is the explicit way in *and* out, flipping to a "Exit fullscreen"
// state so leaving isn't a hidden-Escape-key-only affordance.
function addFullscreenControl(leafletMap, container, bounds) {
  const control = L.control({ position: "topright" });

  control.onAdd = function () {
    const wrapper = L.DomUtil.create("div", "leaflet-bar map-fullscreen-control");
    const btn = L.DomUtil.create("a", "map-fullscreen-btn", wrapper);
    btn.href = "#";
    btn.innerHTML = "&#9974;";
    btn.setAttribute("role", "button");

    function syncState() {
      const active = fullscreenElement() === container;
      btn.classList.toggle("is-fullscreen", active);
      const label = active ? "Exit fullscreen" : "Enter fullscreen";
      btn.title = label;
      btn.setAttribute("aria-label", label);
    }

    L.DomEvent.disableClickPropagation(wrapper);
    L.DomEvent.on(btn, "click", function (e) {
      L.DomEvent.preventDefault(e);
      toggleFullscreen(container);
    });

    ["fullscreenchange", "webkitfullscreenchange"].forEach(function (evt) {
      document.addEventListener(evt, function () {
        syncState();
        // The container's on-screen size just changed drastically (a small
        // embed <-> the whole screen); invalidateSize() alone only tells
        // Leaflet to re-measure it, it doesn't re-frame the map, so without
        // fitBounds the view stays at its old size and pixel position,
        // reading as the same small map now surrounded by empty space. The
        // fullscreen transition can also take a frame to apply the new
        // layout in some browsers, so both run again shortly after, not
        // just immediately.
        leafletMap.invalidateSize();
        leafletMap.fitBounds(bounds);
        setTimeout(function () {
          leafletMap.invalidateSize();
          leafletMap.fitBounds(bounds);
        }, 150);
      });
    });

    syncState();
    return wrapper;
  };

  control.addTo(leafletMap);
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function toggleFullscreen(container) {
  if (fullscreenElement() === container) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document);
    return;
  }
  const request = container.requestFullscreen || container.webkitRequestFullscreen;
  if (request) request.call(container);
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
