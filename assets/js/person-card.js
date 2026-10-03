/**
 * Aleucia person card
 *
 * Shared by the People page (world.js) and the player page's relationships
 * section. Portrait with name and occupation always visible; hovering
 * (cursor) or tapping (touch) blurs the portrait and reveals species,
 * gender and age — the same treatment as the world media cards.
 *
 * person: { href, image, name, species, gender, age, occupation, summary }.
 * `image` is a ready-to-use URL. `summary` is only shown, in place of the
 * facts, when none of species/gender/age is set.
 */

/**
 * Card thumbnails: the People/Item/etc. grids paint ~200px tiles, so they load
 * the small "<name>-thumb.jpg" that scripts/generate-image-thumbnails.py
 * writes next to each source image, rather than the (often multi-MB) original.
 * If the thumb is missing the tile falls back to the original image.
 */
function thumbUrlFor(url) {
  if (/-thumb\.jpg$/i.test(url)) return url;
  return String(url).replace(/\.(png|jpe?g|webp|gif)$/i, "-thumb.jpg");
}

function setCardThumbImage(thumb, url) {
  const small = thumbUrlFor(url);
  if (small === url) {
    thumb.style.backgroundImage = 'url("' + url + '")';
    return;
  }
  thumb.style.backgroundImage = 'url("' + small + '")';
  const probe = new Image();
  probe.onerror = function () {
    thumb.style.backgroundImage = 'url("' + url + '")';
  };
  probe.src = small;
}

function buildPersonCard(person) {
  const card = document.createElement("a");
  card.className = "card card--person-media";
  card.href = person.href;

  const thumb = document.createElement("div");
  thumb.className = "card-thumb" + (person.image ? "" : " card-thumb--empty");
  if (person.image) setCardThumbImage(thumb, encodeURI(person.image));
  card.appendChild(thumb);

  const overlay = document.createElement("div");
  overlay.className = "card-media-overlay";

  const title = document.createElement("p");
  title.className = "card-title";
  title.textContent = person.name;
  overlay.appendChild(title);

  if (person.occupation) {
    const occ = document.createElement("p");
    occ.className = "card-media-fact card-media-fact--always";
    occ.textContent = person.occupation;
    overlay.appendChild(occ);
  }

  const facts = document.createElement("div");
  facts.className = "card-media-facts";
  let shown = 0;
  [["Species", person.species], ["Gender", person.gender], ["Age", person.age]].forEach(function (pair) {
    if (!pair[1]) return;
    shown++;
    const line = document.createElement("p");
    line.className = "card-media-fact";
    line.textContent = pair[0] + ": ";
    const strong = document.createElement("strong");
    strong.textContent = pair[1];
    line.appendChild(strong);
    facts.appendChild(line);
  });
  if (!shown && person.summary) {
    const line = document.createElement("p");
    line.className = "card-media-fact";
    line.textContent = person.summary;
    facts.appendChild(line);
  }
  overlay.appendChild(facts);
  card.appendChild(overlay);

  // Touch has no hover: the first tap expands the card, a second tap follows
  // the link. Tapping elsewhere collapses it again.
  card.addEventListener("click", function (e) {
    const noHover = typeof window.matchMedia === "function" && window.matchMedia("(hover: none)").matches;
    if (!noHover || card.classList.contains("is-expanded")) return;
    e.preventDefault();
    document.querySelectorAll(".card--person-media.is-expanded").forEach(function (c) {
      c.classList.remove("is-expanded");
    });
    card.classList.add("is-expanded");
  });
  return card;
}

if (typeof document !== "undefined") {
  document.addEventListener("click", function (e) {
    document.querySelectorAll(".card--person-media.is-expanded").forEach(function (c) {
      if (!c.contains(e.target)) c.classList.remove("is-expanded");
    });
  });
}
