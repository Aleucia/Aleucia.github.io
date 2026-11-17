/**
 * Recipe Books — books.html
 *
 * Lists the recipe books Obsidian Cast exported (data/books.json, see
 * data-schema.json's "books" table) and lays one out as a handwritten,
 * printable book: a cover, a contents page, one page per recipe with its
 * sketch, and a closing page.
 *
 * A book record carries everything its pages need (each recipe embedded in
 * full, ingredients by name, sketches as files under data/assets/), so this
 * page reads no other table.
 *
 * "Handwritten" here is three things: a script typeface (each book is in one
 * of a few "hands", picked from its author so one scribe always writes the
 * same way); lines that sit a hair off true, each by its own small seeded
 * amount; and rules, underlines and frames drawn as wobbly ink strokes rather
 * than CSS borders. All of it is seeded from the book, so a book looks the
 * same every time it is opened or printed.
 *
 *   books.html                 the library
 *   books.html?book=<book id>  one book, ready to print
 */

const BOOK_HANDS = ["hand-kalam", "hand-caveat", "hand-nanum"];

const BOOK_PRINT_WAIT_MS = 10000;

const BOOK_PAGE_SIZES = {
  a5: { label: "A5", css: "A5" },
  a4: { label: "A4", css: "A4" },
  letter: { label: "US Letter", css: "letter" }
};

async function initBooksPage() {
  const container = document.getElementById("booksBody");
  if (!container) return;
  const books = await ContentStore.getTable("books");
  const id = new URLSearchParams(window.location.search).get("book");

  if (!books || books.length === 0) {
    container.appendChild(bookEmptyState("No recipe books have been published yet."));
    return;
  }
  if (id) {
    const book = books.find(function (b) { return b.id === id; });
    if (!book) {
      container.appendChild(bookEmptyState("That book isn't on the shelf."));
      return;
    }
    renderBookReader(book, container);
  } else {
    renderBookLibrary(books, container);
  }
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------
function renderBookLibrary(books, container) {
  const search = document.createElement("input");
  search.type = "search";
  search.className = "world-search book-search";
  search.placeholder = "Search books, trades or recipes…";
  search.setAttribute("aria-label", "Search recipe books");
  container.appendChild(search);

  const grid = document.createElement("div");
  grid.className = "book-shelf";
  container.appendChild(grid);

  function draw() {
    const q = search.value.trim().toLowerCase();
    grid.textContent = "";
    const shown = books.filter(function (b) { return !q || bookSearchText(b).indexOf(q) !== -1; });
    shown.forEach(function (b) { grid.appendChild(bookCard(b)); });
    if (shown.length === 0) grid.appendChild(bookEmptyState("No book matches that search."));
  }
  search.addEventListener("input", draw);
  draw();
}

function bookSearchText(book) {
  return [book.name, book.author, book.bookKind, book.craftingTier]
    .concat(book.profession || [])
    .concat((book.recipes || []).map(function (r) { return r.name; }))
    .join(" ")
    .toLowerCase();
}

function bookCard(book) {
  const card = document.createElement("a");
  card.className = "book-card " + bookHand(book);
  card.href = "books.html?book=" + encodeURIComponent(book.id);

  if (book.sketch) {
    const img = document.createElement("img");
    img.className = "book-card-sketch";
    img.src = "data/" + book.sketch;
    img.alt = "";
    img.loading = "lazy";
    card.appendChild(img);
  }
  const title = document.createElement("p");
  title.className = "book-card-title";
  title.textContent = book.name;
  card.appendChild(title);

  const sub = document.createElement("p");
  sub.className = "book-card-sub";
  sub.textContent = bookSubtitle(book);
  card.appendChild(sub);

  const count = document.createElement("p");
  count.className = "book-card-count";
  const n = (book.recipes || []).length;
  count.textContent = n + (n === 1 ? " recipe" : " recipes") + (book.author ? " · " + book.author : "");
  card.appendChild(count);
  return card;
}

// "A Competent Brewer's Primer", "A Blacksmith's Manual", "A Recipe Book"
function bookSubtitle(book) {
  const trade = (book.profession || []).join(" & ");
  const kind = book.bookKind || "Recipe Book";
  const words = [book.craftingTier, trade ? trade + "'s" : "", kind].filter(Boolean).join(" ");
  return (/^[AEIOU]/i.test(words) ? "An " : "A ") + words;
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------
function renderBookReader(book, container) {
  document.title = "Aleucia — " + book.name;
  const title = document.getElementById("booksTitle");
  if (title) title.textContent = book.name;
  const lead = document.getElementById("booksLead");
  if (lead) lead.textContent = bookSubtitle(book) + " · " + (book.recipes || []).length + " recipes";
  const back = document.getElementById("backLink");
  if (back && !back.dataset.trail) {
    back.href = "books.html";
    back.textContent = "← Back to Recipe Books";
  }

  container.appendChild(bookToolbar(book));
  const volume = document.createElement("div");
  volume.className = "book-volume " + bookHand(book);
  bookPages(book).forEach(function (page) { volume.appendChild(page); });
  container.appendChild(volume);
}

function bookToolbar(book) {
  const bar = document.createElement("div");
  bar.className = "book-toolbar";

  const label = document.createElement("label");
  label.className = "book-toolbar-size";
  label.textContent = "Paper ";
  const select = document.createElement("select");
  Object.keys(BOOK_PAGE_SIZES).forEach(function (key) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = BOOK_PAGE_SIZES[key].label;
    select.appendChild(option);
  });
  select.value = readBookPaper();
  setBookPageSize(select.value);
  select.addEventListener("change", function () {
    setBookPageSize(select.value);
    try { localStorage.setItem("aleuciaBookPaper", select.value); } catch (e) { /* private mode */ }
  });
  label.appendChild(select);
  bar.appendChild(label);

  const print = document.createElement("button");
  print.type = "button";
  print.className = "book-print-btn";
  print.textContent = "Print this book";
  print.addEventListener("click", function () { printBook(print); });
  bar.appendChild(print);

  const hint = document.createElement("p");
  hint.className = "book-toolbar-hint";
  hint.textContent = "Each recipe starts on a fresh page. Choose “Save as PDF” in the print dialog to keep a copy.";
  bar.appendChild(hint);
  return bar;
}

function readBookPaper() {
  try {
    const saved = localStorage.getItem("aleuciaBookPaper");
    if (saved && BOOK_PAGE_SIZES[saved]) return saved;
  } catch (e) { /* private mode */ }
  return "a5";
}

// @page can't be set from a class, so the chosen size is a small style tag.
function setBookPageSize(key) {
  const size = (BOOK_PAGE_SIZES[key] || BOOK_PAGE_SIZES.a5).css;
  let style = document.getElementById("bookPageSize");
  if (!style) {
    style = document.createElement("style");
    style.id = "bookPageSize";
    document.head.appendChild(style);
  }
  style.textContent = "@page { size: " + size + "; margin: 0; }";
  document.documentElement.setAttribute("data-book-paper", key);
}

// The handwriting fonts and the sketches must be in before the print dialog
// snapshots the page, or the first copy comes out in a fallback font with
// empty picture frames.
function printBook(button) {
  if (button) button.disabled = true;
  const images = Array.prototype.slice.call(document.querySelectorAll(".book-volume img"));
  images.forEach(function (img) { img.loading = "eager"; });
  const loaded = images.map(function (img) {
    if (img.complete) return Promise.resolve();
    return new Promise(function (resolve) {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  });
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  // A sketch that never arrives (offline, a missing file the browser keeps
  // retrying) mustn't hold the print dialog hostage.
  const giveUp = new Promise(function (resolve) { setTimeout(resolve, BOOK_PRINT_WAIT_MS); });
  return Promise.race([Promise.all([fonts].concat(loaded)), giveUp]).then(function () {
    if (button) button.disabled = false;
    window.print();
  });
}

function bookPages(book) {
  const rand = seededRandom(book.id);
  const pages = [coverPage(book, rand), contentsPage(book, rand)];
  (book.recipes || []).forEach(function (recipe, i) {
    pages.push(recipePage(recipe, i + 1, rand));
  });
  pages.push(closingPage(book, rand));
  return pages;
}

function sheet(kind) {
  const page = document.createElement("section");
  page.className = "book-sheet book-sheet--" + kind;
  return page;
}

function coverPage(book, rand) {
  const page = sheet("cover");
  page.appendChild(inkFrame(rand));

  const kicker = handLine("p", "book-cover-kicker", bookSubtitle(book), rand);
  page.appendChild(kicker);
  page.appendChild(handLine("h2", "book-cover-title", book.name, rand));
  page.appendChild(inkRule(rand, "book-cover-rule"));

  if (book.sketch) {
    const img = document.createElement("img");
    img.className = "book-cover-sketch";
    img.src = "data/" + book.sketch;
    img.alt = "";
    page.appendChild(img);
  }
  if (book.author) page.appendChild(handLine("p", "book-cover-author", "set down by " + book.author, rand));
  return page;
}

function contentsPage(book, rand) {
  const page = sheet("contents");
  if (book.body) {
    book.body.split(/\n\s*\n/).forEach(function (para) {
      page.appendChild(handLine("p", "book-foreword", para.replace(/\s*\n\s*/g, " "), rand));
    });
    page.appendChild(inkRule(rand, "book-divider"));
  }
  page.appendChild(handLine("h3", "book-heading", "Contents", rand));
  const list = document.createElement("ol");
  list.className = "book-contents";
  (book.recipes || []).forEach(function (recipe) {
    list.appendChild(handLine("li", "", recipe.name, rand));
  });
  page.appendChild(list);
  if ((book.recipes || []).length === 0) page.appendChild(handLine("p", "book-foreword", "The pages are blank.", rand));
  return page;
}

function recipePage(recipe, number, rand) {
  const page = sheet("recipe");

  const head = document.createElement("header");
  head.className = "book-recipe-head";
  head.appendChild(handLine("p", "book-recipe-number", "No. " + number, rand));
  head.appendChild(handLine("h3", "book-recipe-title", recipe.name, rand));
  head.appendChild(inkRule(rand, "book-recipe-underline"));
  page.appendChild(head);

  if (recipe.sketch) {
    const fig = document.createElement("figure");
    fig.className = "book-recipe-sketch " + (number % 2 ? "book-recipe-sketch--right" : "book-recipe-sketch--left");
    fig.style.transform = "rotate(" + ((rand() - 0.5) * 6).toFixed(2) + "deg)";
    const img = document.createElement("img");
    img.src = "data/" + recipe.sketch;
    img.alt = "Sketch of " + recipe.name;
    img.loading = "lazy";
    fig.appendChild(img);
    page.appendChild(fig);
  }

  if (recipe.body) {
    recipe.body.split(/\n\s*\n/).forEach(function (para) {
      page.appendChild(handLine("p", "book-recipe-body", para.replace(/\s*\n\s*/g, " "), rand));
    });
  }

  const facts = recipeFacts(recipe);
  if (facts.length) page.appendChild(handLine("p", "book-recipe-facts", facts.join(" · "), rand));

  const makes = (recipe.output || []).map(quantityText);
  if (makes.length) page.appendChild(handLine("p", "book-recipe-makes", "Makes " + makes.join(", "), rand));

  page.appendChild(handLine("h4", "book-subheading", "You will need", rand));
  const ingredients = recipe.ingredients || [];
  if (ingredients.length) {
    const list = document.createElement("ul");
    list.className = "book-ingredients";
    ingredients.forEach(function (ing) {
      const li = handLine("li", ing.required === false ? "book-optional" : "", quantityText(ing), rand);
      if (ing.required === false) {
        const opt = document.createElement("span");
        opt.className = "book-optional-mark";
        opt.textContent = " (if you have it)";
        li.appendChild(opt);
      }
      list.appendChild(li);
    });
    page.appendChild(list);
  } else {
    page.appendChild(handLine("p", "book-recipe-body", "Nothing but the tools and the time.", rand));
  }
  if (recipe.craftingTools && recipe.craftingTools.length) {
    page.appendChild(handLine("p", "book-recipe-tools", "Tools: " + recipe.craftingTools.join(", "), rand));
  }

  if (recipe.instructions && recipe.instructions.length) {
    page.appendChild(handLine("h4", "book-subheading", "Method", rand));
    const steps = document.createElement("ol");
    steps.className = "book-method";
    recipe.instructions.forEach(function (step) { steps.appendChild(handLine("li", "", step, rand)); });
    page.appendChild(steps);
  }

  if (recipe.note) {
    const note = document.createElement("aside");
    note.className = "book-margin-note";
    note.style.transform = "rotate(" + ((rand() - 0.5) * 3).toFixed(2) + "deg)";
    note.appendChild(inkBox(rand));
    note.appendChild(handLine("p", "", recipe.note, rand));
    page.appendChild(note);
  }
  return page;
}

function closingPage(book, rand) {
  const page = sheet("closing");
  page.appendChild(inkRule(rand, "book-divider"));
  page.appendChild(handLine("p", "book-finis", "Finis", rand));
  page.appendChild(inkRule(rand, "book-divider"));
  return page;
}

function recipeFacts(recipe) {
  const facts = [];
  if (recipe.craftingTier) facts.push(recipe.craftingTier);
  if (recipe.crafter && recipe.crafter.length) facts.push(recipe.crafter.join(", "));
  if (recipe.craftingTime !== undefined) facts.push(recipe.craftingTime + (recipe.craftingTime === 1 ? " day" : " days"));
  if (recipe.baseSuccess !== undefined) facts.push(recipe.baseSuccess + "% to succeed");
  if (recipe.rarity) facts.push(recipe.rarity);
  return facts;
}

function quantityText(entry) {
  return (entry.qty !== undefined && entry.qty !== 1 ? entry.qty + " × " : entry.qty === 1 ? "1 " : "") + entry.name;
}

// ---------------------------------------------------------------------------
// The hand
// ---------------------------------------------------------------------------

// One element of handwriting: its text, sat a little off true.
function handLine(tag, className, text, rand) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  const tilt = (rand() - 0.5) * 0.9;
  const shift = (rand() - 0.5) * 3;
  el.style.transform = "translateX(" + shift.toFixed(1) + "px) rotate(" + tilt.toFixed(2) + "deg)";
  return el;
}

function bookHand(book) {
  return BOOK_HANDS[hashString(book.author || book.name) % BOOK_HANDS.length];
}

const SVG_NS = "http://www.w3.org/2000/svg";

// A pen stroke across the page: an SVG path that wanders a little.
function inkRule(rand, className) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "ink-rule " + (className || ""));
  svg.setAttribute("viewBox", "0 0 200 8");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", wobblyPath([[2, 4], [198, 4]], rand, 1.1));
  svg.appendChild(path);
  if (rand() < 0.6) {
    const second = document.createElementNS(SVG_NS, "path");
    second.setAttribute("d", wobblyPath([[10 + rand() * 20, 5.5], [170 + rand() * 25, 5.2]], rand, 0.8));
    second.setAttribute("class", "ink-rule-second");
    svg.appendChild(second);
  }
  return svg;
}

// A hand-ruled rectangle filling its (relatively positioned) parent.
function inkBox(rand) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "ink-box");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", wobblyPath([[1.5, 2], [98.5, 1.5], [98, 98], [2, 98.5], [1.5, 2]], rand, 0.6));
  svg.appendChild(path);
  return svg;
}

// A cover frame: two ruled rectangles, slightly out of step with each other.
function inkFrame(rand) {
  const svg = inkBox(rand);
  svg.setAttribute("class", "ink-box ink-frame");
  const inner = document.createElementNS(SVG_NS, "path");
  inner.setAttribute("d", wobblyPath([[4, 4.5], [96, 4], [95.5, 96], [4.5, 95.5], [4, 4.5]], rand, 0.5));
  inner.setAttribute("class", "ink-rule-second");
  svg.appendChild(inner);
  return svg;
}

// Resamples a polyline and nudges each point sideways by a slow wave, so it
// reads as drawn rather than ruled.
function wobblyPath(points, rand, amp) {
  const out = [];
  const phase = rand() * Math.PI * 2;
  const freq = 0.08 + rand() * 0.06;
  let travelled = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(2, Math.round(len / 6));
    const nx = -(b[1] - a[1]) / (len || 1);
    const ny = (b[0] - a[0]) / (len || 1);
    for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
      const t = s / steps;
      const d = travelled + len * t;
      const w = amp * (Math.sin(d * freq + phase) * 0.7 + (rand() - 0.5) * 0.6);
      out.push([a[0] + (b[0] - a[0]) * t + nx * w, a[1] + (b[1] - a[1]) * t + ny * w]);
    }
    travelled += len;
  }
  return out.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("");
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: small, fast, and the same sequence for the same book.
function seededRandom(seed) {
  let a = hashString(String(seed));
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bookEmptyState(text) {
  const p = document.createElement("p");
  p.className = "empty-state";
  p.textContent = text;
  return p;
}
