/**
 * Aleucia Relationship Graph
 *
 * A small self-contained "ego network" diagram: the given entity in the
 * centre, every entity it has a relationship edge with arranged evenly
 * around it, connected by a line styled per the DM's own conventions from
 * obsidian-relationships (data/relationship-types.json — color, line style,
 * arrowhead). No graph library: with the handful of edges any one entity in
 * this vault actually has, a full force-directed layout would be overkill —
 * simple even radial placement is enough.
 *
 * renderRelationshipGraph(container, entityId, entityName) does its own
 * fetching (relationships.json, relationship-types.json, the entity index)
 * and replaces the container's content — call it once per detail page with
 * an empty container element.
 */

async function renderRelationshipGraph(container, entityId, entityName) {
  const [edges, typesFile, index] = await Promise.all([
    ContentStore.getTable("relationships"),
    ContentStore.getTable("relationshipTypes"),
    ContentStore.getEntityIndex(),
  ]);

  if (!edges || !typesFile) {
    return; // no relationships table exported yet — say nothing, rather than an empty-looking graph
  }

  const relationshipTypes = typesFile.relationshipTypes || {};
  const relevant = collectEdgesForEntity(entityId, edges, relationshipTypes);

  if (relevant.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "No known relationships recorded yet.";
    container.appendChild(p);
    return;
  }

  container.appendChild(buildSvg(entityId, entityName, relevant, relationshipTypes, index));
}

// Edges where this entity is the subject cover every type with a registered
// inverse or symmetric flag (relationships-exporter.ts synthesizes the
// matching edge on both sides for those) — checking subject alone would only
// miss the few types with neither (owns, works-at, located-in, founded,
// mentors), so those are picked up from the object side too. This can never
// double up a pair: a type that could show up from both sides always has an
// inverse/symmetric flag, which is exactly the condition excluded here.
function collectEdgesForEntity(entityId, edges, relationshipTypes) {
  return edges
    .filter(function (edge) {
      if (edge.subject === entityId) return true;
      if (edge.object === entityId) {
        const typeDef = relationshipTypes[edge.type];
        return !!typeDef && !typeDef.inverse && !typeDef.symmetric;
      }
      return false;
    })
    .map(function (edge) {
      const outgoing = edge.subject === entityId;
      return {
        edge: edge,
        otherId: outgoing ? edge.object : edge.subject,
        outgoing: outgoing,
        typeDef: relationshipTypes[edge.type] || {},
      };
    });
}

const SVG_NS = "http://www.w3.org/2000/svg";
const SIZE = 560;
const CENTER = SIZE / 2;
const RADIUS = 200;
const NODE_R = 34;

function buildSvg(entityId, entityName, relevant, relationshipTypes, index) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 " + SIZE + " " + SIZE);
  svg.setAttribute("class", "relationship-graph");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", entityName + "'s relationships");

  const defs = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(defs);
  const markerIds = new Map();

  const positions = relevant.map(function (item, i) {
    const angle = (2 * Math.PI * i) / relevant.length - Math.PI / 2;
    return { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
  });

  relevant.forEach(function (item, i) {
    svg.appendChild(buildEdgeLine(item, positions[i], defs, markerIds));
  });

  svg.appendChild(buildNode(CENTER, CENTER, NODE_R + 6, entityName, undefined, true));

  relevant.forEach(function (item, i) {
    const info = index.get(item.otherId);
    const label = info ? info.name : "Unknown";
    const href = info ? ContentStore.getEntityHref(item.otherId, index) : undefined;
    svg.appendChild(buildNode(positions[i].x, positions[i].y, NODE_R, label, href, false));
  });

  const wrap = document.createElement("div");
  wrap.className = "relationship-graph-wrap";
  wrap.appendChild(svg);
  return wrap;
}

function buildEdgeLine(item, pos, defs, markerIds) {
  const typeDef = item.typeDef;
  const color = typeDef.color || "#888888";
  const width = typeDef.lineWidth || 1;

  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("x1", CENTER);
  line.setAttribute("y1", CENTER);
  line.setAttribute("x2", pos.x);
  line.setAttribute("y2", pos.y);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", String(width));

  if (typeDef.lineStyle === "dashed") line.setAttribute("stroke-dasharray", "6,4");
  else if (typeDef.lineStyle === "dotted") line.setAttribute("stroke-dasharray", "1.5,4");

  if (typeDef.arrowhead && typeDef.arrowhead !== "none") {
    const markerId = ensureArrowMarker(defs, markerIds, color);
    // Semantically the arrow always points subject -> object; when this
    // entity is the object, the edge is "incoming" so the arrow belongs at
    // the centre end instead of the outer node.
    if (item.outgoing) line.setAttribute("marker-end", "url(#" + markerId + ")");
    else line.setAttribute("marker-start", "url(#" + markerId + ")");
  }

  const g = document.createElementNS(SVG_NS, "g");
  g.appendChild(line);

  const label = typeDef.label || item.edge.type;
  const detail = item.edge.status ? label + " (" + item.edge.status + ")" : label;
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String((CENTER + pos.x) / 2));
  text.setAttribute("y", String((CENTER + pos.y) / 2 - 6));
  text.setAttribute("class", "relationship-graph-edge-label");
  text.setAttribute("text-anchor", "middle");
  text.textContent = detail;
  g.appendChild(text);

  return g;
}

function ensureArrowMarker(defs, markerIds, color) {
  const key = color;
  if (markerIds.has(key)) return markerIds.get(key);

  const id = "arrow-" + markerIds.size;
  const marker = document.createElementNS(SVG_NS, "marker");
  marker.setAttribute("id", id);
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto-start-reverse");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M0,0 L10,5 L0,10 Z");
  path.setAttribute("fill", color);
  marker.appendChild(path);
  defs.appendChild(marker);

  markerIds.set(key, id);
  return id;
}

function buildNode(x, y, r, label, href, isCenter) {
  const el = href ? document.createElementNS(SVG_NS, "a") : document.createElementNS(SVG_NS, "g");
  if (href) el.setAttribute("href", href.url);
  el.setAttribute("class", "relationship-graph-node" + (isCenter ? " relationship-graph-node--center" : ""));

  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", String(x));
  circle.setAttribute("cy", String(y));
  circle.setAttribute("r", String(r));
  el.appendChild(circle);

  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(x));
  text.setAttribute("y", String(y + r + 16));
  text.setAttribute("text-anchor", "middle");
  text.textContent = truncateLabel(label);
  if (label && label.length > 14) {
    const titleEl = document.createElementNS(SVG_NS, "title");
    titleEl.textContent = label;
    el.appendChild(titleEl);
  }
  el.appendChild(text);

  return el;
}

function truncateLabel(label) {
  if (!label) return "";
  return label.length > 14 ? label.slice(0, 13) + "…" : label;
}
