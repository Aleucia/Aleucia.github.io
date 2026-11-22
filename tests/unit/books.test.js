import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "../helpers/load-script.js";

const book = {
  id: "3-mechanics/items/recipe-books/fire-and-oak",
  name: "Fire and Oak",
  sketch: "assets/books/3-mechanics/items/recipe-books/fire-and-oak/Fire and Oak.svg",
  bookKind: "Primer",
  author: "Master Distiller Corwen Ashcask",
  profession: ["Brewer"],
  craftingTier: "Competent",
  body: "A distiller's journeyman book.\n\nAny Brewer already knows these.",
  recipes: [
    {
      id: "3-mechanics/recipes/recipe-charred-oak-cask",
      name: "Charred Oak Cask",
      note: "Ashcask's grandfather's pattern.",
      sketch: "assets/recipes/3-mechanics/recipes/recipe-charred-oak-cask/Recipe - Charred Oak Cask.svg",
      body: "Oak staves bent over a fire pit.",
      instructions: ["Split the staves.", "Char the inside."],
      crafter: ["Brewer", "Carpenter"],
      craftingTier: "Competent",
      craftingTools: ["Woodcarvers Tools"],
      craftingTime: 3,
      baseSuccess: 70,
      ingredients: [
        { name: "Seasoned Timber", qty: 4, required: true },
        { name: "Iron hoops", qty: 1, required: false },
      ],
      output: [{ name: "Charred Oak Cask", qty: 1 }],
    },
    { id: "r2", name: "White <b>Rum</b>", instructions: [], crafter: [], craftingTools: [], ingredients: [], output: [{ name: "White Rum", qty: 40 }] },
  ],
};

const other = { id: "b2", name: "Silver Against the Dark", profession: ["Weaponsmith"], recipes: [{ id: "r3", name: "Silvered Dagger" }] };

function setUpPage(search) {
  document.head.innerHTML = "";
  document.body.innerHTML =
    '<a id="backLink" href="home.html"></a><h1 id="booksTitle">Recipe Books</h1><p id="booksLead"></p><div id="booksBody"></div>';
  window.history.replaceState(null, "", "/books.html" + (search || ""));
  globalThis.ContentStore = { getTable: vi.fn().mockResolvedValue([book, other]) };
}

beforeEach(() => {
  loadScript("assets/js/books.js", { expose: ["BOOK_HANDS", "BOOK_PAGE_SIZES"] });
});

describe("books.js library", () => {
  it("shelves every book with its sketch and a link to read it", async () => {
    setUpPage("");
    await initBooksPage();
    const cards = document.querySelectorAll(".book-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute("href")).toBe("books.html?book=" + encodeURIComponent(book.id));
    expect(cards[0].querySelector("img").getAttribute("src")).toBe("data/" + book.sketch);
    expect(cards[0].querySelector(".book-card-sub").textContent).toBe("A Competent Brewer's Primer");
    expect(cards[1].querySelector("img")).toBeNull();
  });

  it("searches book names, trades, authors and the recipes inside", async () => {
    setUpPage("");
    await initBooksPage();
    const search = document.querySelector(".book-search");
    search.value = "silvered";
    search.dispatchEvent(new Event("input"));
    expect([...document.querySelectorAll(".book-card-title")].map((t) => t.textContent)).toEqual(["Silver Against the Dark"]);
    search.value = "ashcask";
    search.dispatchEvent(new Event("input"));
    expect([...document.querySelectorAll(".book-card-title")].map((t) => t.textContent)).toEqual(["Fire and Oak"]);
  });

  it("says so when nothing has been published", async () => {
    setUpPage("");
    ContentStore.getTable.mockResolvedValue(null);
    await initBooksPage();
    expect(document.querySelector(".empty-state").textContent).toMatch(/No recipe books/);
  });
});

describe("books.js reader", () => {
  it("lays a book out as cover, contents, one page per recipe and a closing page", async () => {
    setUpPage("?book=" + encodeURIComponent(book.id));
    await initBooksPage();
    const sheets = [...document.querySelectorAll(".book-volume .book-sheet")];
    expect(sheets.map((s) => s.className.replace("book-sheet book-sheet--", ""))).toEqual([
      "cover", "contents", "recipe", "recipe", "closing",
    ]);
    expect(document.getElementById("booksTitle").textContent).toBe("Fire and Oak");
    expect(document.getElementById("backLink").getAttribute("href")).toBe("books.html");

    const cover = sheets[0];
    expect(cover.querySelector(".book-cover-title").textContent).toBe("Fire and Oak");
    expect(cover.querySelector(".book-cover-author").textContent).toBe("set down by Master Distiller Corwen Ashcask");
    expect(cover.querySelector("img").getAttribute("src")).toBe("data/" + book.sketch);

    const contents = sheets[1];
    expect([...contents.querySelectorAll(".book-foreword")].map((p) => p.textContent)).toEqual([
      "A distiller's journeyman book.",
      "Any Brewer already knows these.",
    ]);
    expect([...contents.querySelectorAll(".book-contents li")].map((li) => li.textContent)).toEqual([
      "Charred Oak Cask",
      "White <b>Rum</b>",
    ]);
  });

  it("writes out a recipe page in full", async () => {
    setUpPage("?book=" + encodeURIComponent(book.id));
    await initBooksPage();
    const page = document.querySelectorAll(".book-sheet--recipe")[0];
    const text = (sel) => [...page.querySelectorAll(sel)].map((e) => e.textContent);

    expect(text(".book-recipe-number")).toEqual(["No. 1"]);
    expect(text(".book-recipe-title")).toEqual(["Charred Oak Cask"]);
    expect(page.querySelector(".book-recipe-sketch img").getAttribute("src")).toBe("data/" + book.recipes[0].sketch);
    expect(text(".book-recipe-body")).toEqual(["Oak staves bent over a fire pit."]);
    expect(text(".book-recipe-facts")).toEqual(["Competent · Brewer, Carpenter · 3 days · 70% to succeed"]);
    expect(text(".book-recipe-makes")).toEqual(["Makes 1 Charred Oak Cask"]);
    expect(text(".book-ingredients li")).toEqual(["4 × Seasoned Timber", "1 Iron hoops (if you have it)"]);
    expect(page.querySelector(".book-ingredients li.book-optional")).not.toBeNull();
    expect(text(".book-recipe-tools")).toEqual(["Tools: Woodcarvers Tools"]);
    expect(text(".book-method li")).toEqual(["Split the staves.", "Char the inside."]);
    expect(text(".book-margin-note p")).toEqual(["Ashcask's grandfather's pattern."]);
    // the hand-drawn rules are real SVG strokes
    expect(page.querySelector("svg.ink-rule path").getAttribute("d")).toMatch(/^M[\d.\- ]+(L[\d.\- ]+)+$/);
  });

  it("copes with a sparse recipe and never renders text as HTML", async () => {
    setUpPage("?book=" + encodeURIComponent(book.id));
    await initBooksPage();
    const page = document.querySelectorAll(".book-sheet--recipe")[1];
    expect(page.querySelector(".book-recipe-title").textContent).toBe("White <b>Rum</b>");
    expect(page.querySelector("b")).toBeNull();
    expect(page.querySelector(".book-recipe-sketch")).toBeNull();
    expect(page.querySelector(".book-method")).toBeNull();
    expect(page.querySelector(".book-margin-note")).toBeNull();
    expect(page.querySelector(".book-recipe-makes").textContent).toBe("Makes 40 × White Rum");
    expect(page.querySelector(".book-recipe-body").textContent).toBe("Nothing but the tools and the time.");
  });

  it("draws the same book the same way every time", async () => {
    setUpPage("?book=" + encodeURIComponent(book.id));
    await initBooksPage();
    const first = document.querySelector(".book-volume").innerHTML;
    setUpPage("?book=" + encodeURIComponent(book.id));
    await initBooksPage();
    expect(document.querySelector(".book-volume").innerHTML).toBe(first);
    expect(BOOK_HANDS).toContain(bookHand(book));
  });

  it("reports a book that isn't on the shelf", async () => {
    setUpPage("?book=missing");
    await initBooksPage();
    expect(document.querySelector(".empty-state").textContent).toMatch(/isn't on the shelf/);
  });

  it("sets the printed page size and remembers it", async () => {
    setUpPage("?book=" + encodeURIComponent(book.id));
    await initBooksPage();
    expect(document.getElementById("bookPageSize").textContent).toContain("size: A5");
    const select = document.querySelector(".book-toolbar select");
    select.value = "a4";
    select.dispatchEvent(new Event("change"));
    expect(document.getElementById("bookPageSize").textContent).toContain("size: A4");
    expect(document.documentElement.getAttribute("data-book-paper")).toBe("a4");
    expect(localStorage.getItem("aleuciaBookPaper")).toBe("a4");
    localStorage.removeItem("aleuciaBookPaper");
  });

  it("waits for fonts and sketches before opening the print dialog", async () => {
    setUpPage("?book=" + encodeURIComponent(book.id));
    await initBooksPage();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const done = printBook(null);
    await Promise.resolve();
    expect(print).not.toHaveBeenCalled();
    const images = document.querySelectorAll(".book-volume img");
    expect([...images].every((img) => img.loading === "eager")).toBe(true);
    images.forEach((img) => img.dispatchEvent(new Event("load")));
    await done;
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });
});

describe("books.js in another language", () => {
  const draconic = Object.assign({}, book, { language: "Draconic" });

  function setUpForeignBook(who, languages) {
    setUpPage("?book=" + encodeURIComponent(book.id));
    localStorage.clear();
    loadScript("assets/js/languages.js", { expose: ["LanguageScripts"] });
    globalThis.getSession = () => ({ username: who });
    ContentStore.getTable.mockImplementation((table) =>
      Promise.resolve(table === "characters" ? [{ name: who, languages }] : [draconic, other]));
  }

  afterEach(() => {
    delete globalThis.LanguageScripts;
    delete globalThis.getSession;
  });

  it("writes the whole book in the script for a reader who can't read it", async () => {
    setUpForeignBook("Yat", ["Common", "Orc"]);
    await initBooksPage();
    const volume = document.querySelector(".book-volume");
    expect(volume.classList.contains("in-script")).toBe(true);
    expect(volume.querySelector(".book-cover-title").textContent).toBe(LanguageScripts.encode("Fire and Oak", "Draconic"));
    expect(volume.querySelector(".book-optional-mark").textContent).not.toMatch(/[a-z]/i);
    expect(document.querySelector(".language-bar__note").textContent).toBe("Written in Draconic. Yat can't read it.");
    expect(document.querySelector(".language-switch")).toBeNull();
  });

  it("lets a reader who knows the language turn it into English", async () => {
    setUpForeignBook("Petra", ["Common", "Draconic"]);
    await initBooksPage();
    const english = [...document.querySelectorAll(".language-switch__btn")].find((b) => b.textContent === "English");
    english.click();
    const volume = document.querySelector(".book-volume");
    expect(volume.classList.contains("in-script")).toBe(false);
    expect(volume.querySelector(".book-cover-title").textContent).toBe("Fire and Oak");
    expect(document.querySelectorAll(".book-volume")).toHaveLength(1);
  });

  it("notes the language on the library card", async () => {
    setUpForeignBook("Yat", []);
    window.history.replaceState(null, "", "/books.html");
    await initBooksPage();
    expect(document.querySelector(".book-card-language").textContent).toBe("Written in Draconic");
    expect(document.querySelectorAll(".book-card-language")).toHaveLength(1);
  });
});
