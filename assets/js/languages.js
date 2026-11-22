/**
 * Aleucia Languages — writing in the world's own scripts
 *
 * A letter (data/correspondence.json) or recipe book (data/books.json) can
 * name the language it is written in, from its vault note's `language`
 * frontmatter. The vault holds the text in English; this module writes it
 * out in that language's script, the way a tabletop handout would: each
 * English letter becomes a glyph of the script, so the page reads as Elvish
 * or Draconic to anyone who doesn't know it.
 *
 * A character who knows the language (their `char_language`, exported as
 * characters.json's `languages`) gets a switch between the original and the
 * English translation. Anyone else sees only the original.
 *
 * Several languages share a script, as in the Player's Handbook (Giant,
 * Gnomish, Goblin and Orc are all written in Dwarvish runes), so a reader
 * who knows Dwarvish can still recognise the letters of an Orcish note
 * without being able to read it.
 *
 * A letter's note can also hold its own original text (its "Content -
 * Original" section, exported as `original`); that is what the original view
 * shows, and the English (`body`) is the translation. Without one, the
 * English is written out in the script instead.
 *
 * FONTS
 * Draconic, Dwarvish, Elvish and Infernal (and the languages that share
 * their scripts) use the same Pixel Sagas fonts as the vault's FantasyFonts
 * snippet (Iokharic, Davek, Rellanic, Barazhad), served from assets/fonts/.
 * They draw ordinary English letters as their own glyphs, so the text is
 * left as it is. The rest use a free Google Font for a real Unicode script,
 * with `glyphs` listing which character stands in for a, b, c … z.
 *
 * To change a language's font, put the .woff2 in assets/fonts/ and give its
 * script `src` (and no `glyphs`). To give a new language a script, add it
 * to LANGUAGE_SCRIPT.
 *
 * Client-side only, like the rest of the site (see SECURITY.md): the English
 * is in the page data, and the letter swap is a simple cipher a determined
 * player could undo.
 */

const LanguageScripts = (function () {
  const SCRIPTS = {
    // The vault's own language fonts (FantasyFonts.css): Pixel Sagas faces
    // that draw English letters as the script's glyphs.
    rellanic: {
      label: "Rellanic",
      family: "Rellanic",
      src: "assets/fonts/rellanic.woff2",
      scale: 1.4
    },
    iokharic: {
      label: "Iokharic",
      family: "Iokharic",
      src: "assets/fonts/iokharic.woff2",
      scale: 1.4
    },
    davek: {
      label: "Davek",
      family: "Davek",
      src: "assets/fonts/davek.woff2",
      scale: 1.4
    },
    barazhad: {
      label: "Barazhad",
      family: "Barazhad",
      src: "assets/fonts/barazhad.woff2",
      scale: 1.4
    },
    // Unknown tongues: Elder/Younger Futhark runes.
    runes: {
      label: "Runes",
      family: "Noto Sans Runic",
      glyphs: "ᚨᛒᚲᛞᛖᚠᚷᚺᛁᛃᚴᛚᛗᚾᛟᛈᛩᚱᛋᛏᚢᚡᚹᛪᛦᛉ",
      scale: 1.1
    },
    // Celestial: Ol Chiki.
    celestial: {
      label: "Celestial",
      family: "Noto Sans Ol Chiki",
      glyphs: cps(0x1C5A, 26),
      scale: 1.05
    },
    // Druidic: Ogham, every word hung from one stem line.
    ogham: {
      label: "Ogham",
      family: "Noto Sans Ogham",
      glyphs: cps(0x1681, 26),
      space: " ",
      scale: 1.1
    },
    // Thieves' Cant: Linear B signs, chalked marks more than letters.
    cant: {
      label: "Thieves' marks",
      family: "Noto Sans Linear B",
      glyphs: cps(0x10000, 11).concat(cps(0x1000D, 15)),
      scale: 1.05
    }
  };

  // Keys are normalised language names (lowercase letters only), so
  // "Thieves' Cant", "thieves cant" and "ThievesCant" all match.
  // Matches the vault's language classes in FantasyFonts.css.
  const LANGUAGE_SCRIPT = {
    elvish: "rellanic",
    sylvan: "rellanic",
    undercommon: "rellanic",
    draconic: "iokharic",
    dwarvish: "davek",
    giant: "davek",
    gnomish: "davek",
    goblin: "davek",
    orc: "davek",
    primordial: "davek",
    aquan: "davek",
    auran: "davek",
    ignan: "davek",
    terran: "davek",
    infernal: "barazhad",
    abyssal: "barazhad",
    celestial: "celestial",
    druidic: "ogham",
    thievescant: "cant"
  };

  // Languages written in the same letters as these pages: no script to show.
  const PLAIN = { common: true, halfling: true, commonsignlanguage: true, english: true };

  // Misspellings the vault already uses (template-languages, char_language).
  const ALIASES = { theivescant: "thievescant", dwarish: "dwarvish" };

  // Anything else (Deep Speech, Sahuagin, a homebrew tongue) still gets a script.
  const FALLBACK_SCRIPT = "runes";

  const loadedFonts = {};

  function cps(start, count) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(String.fromCodePoint(start + i));
    return out;
  }

  function glyphList(script) {
    if (!script.glyphs) return null;
    if (!script._glyphs) script._glyphs = Array.isArray(script.glyphs) ? script.glyphs : Array.from(script.glyphs);
    return script._glyphs;
  }

  function normalise(language) {
    const key = String(language || "").toLowerCase().replace(/[^a-z]/g, "");
    return ALIASES[key] || key;
  }

  // True when the language needs no script of its own (blank, Common, …).
  function isPlain(language) {
    const key = normalise(language);
    return !key || !!PLAIN[key];
  }

  function scriptFor(language) {
    if (isPlain(language)) return null;
    const id = LANGUAGE_SCRIPT[normalise(language)] || FALLBACK_SCRIPT;
    const script = SCRIPTS[id];
    return script ? Object.assign({ id: id }, script) : null;
  }

  // Whether someone who speaks `known` (a character's languages) can read a
  // text written in `language`.
  function canRead(known, language) {
    if (isPlain(language)) return true;
    const want = normalise(language);
    return (known || []).some(function (k) { return normalise(k) === want; });
  }

  // The text written out in the language's script. For a font that draws
  // English letters itself it comes back unchanged; otherwise each letter
  // becomes a glyph, accents dropped first (é is written as e), digits and
  // punctuation as they are.
  function encode(text, language) {
    const script = scriptFor(language);
    if (text == null) return "";
    const str = String(text);
    if (!script) return str;
    const glyphs = glyphList(script);
    if (!glyphs) return str;
    const plain = str.normalize("NFD").replace(/[̀-ͯ]/g, "");
    let out = "";
    for (let i = 0; i < plain.length; i++) {
      const ch = plain[i];
      const code = ch.toLowerCase().charCodeAt(0) - 97;
      if (code >= 0 && code < 26 && /[a-z]/i.test(ch)) out += glyphs[code];
      else if (ch === " " && script.space) out += script.space;
      else out += ch;
    }
    return out;
  }

  // Adds the script's font to the page the first time it is needed, so pages
  // without any foreign text load nothing extra.
  function ensureFont(language) {
    const script = scriptFor(language);
    if (!script || loadedFonts[script.id] || typeof document === "undefined") return script;
    loadedFonts[script.id] = true;
    if (script.src) {
      const style = document.createElement("style");
      style.textContent = "@font-face { font-family: '" + script.family + "'; src: url('" + script.src +
        "'); font-display: swap; }";
      document.head.appendChild(style);
    } else {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=" +
        encodeURIComponent(script.family).replace(/%20/g, "+") + "&display=swap";
      document.head.appendChild(link);
    }
    return script;
  }

  // CSS font-family for text in this language, falling back to `fallback`
  // (the page's own hand) for digits and punctuation.
  function fontFamily(language, fallback) {
    const script = scriptFor(language);
    if (!script) return fallback || "";
    return "'" + script.family + "'" + (fallback ? ", " + fallback : "");
  }

  // Display name for a language as the vault spells it ("Elvish").
  function languageLabel(language) {
    const s = String(language || "").trim();
    if (normalise(s) === "thievescant") return "Thieves' Cant";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // The languages the logged-in character knows, from characters.json.
  // Resolves to [] when nobody is logged in or the table isn't there.
  function readerLanguages() {
    const session = typeof getSession === "function" ? getSession() : null;
    if (!session || typeof ContentStore === "undefined") return Promise.resolve([]);
    return ContentStore.getTable("characters").then(function (characters) {
      const me = (characters || []).find(function (c) { return c.name === session.username; });
      return (me && me.languages) || [];
    });
  }

  function readerName() {
    const session = typeof getSession === "function" ? getSession() : null;
    return session ? session.username : "";
  }

  // Remembered per browser, like the Spell Book's notation switch.
  const VIEW_KEY = "aleuciaTranslationView";
  function savedView() {
    try { return localStorage.getItem(VIEW_KEY) === "translation" ? "translation" : "original"; } catch (e) { return "original"; }
  }
  function saveView(view) {
    try { localStorage.setItem(VIEW_KEY, view); } catch (e) { /* private mode */ }
  }

  // The bar above a foreign text: which language it is written in and, for
  // a reader who knows it, an Original / English switch. `onChange(view)` is
  // called with "original" or "translation" now and on every switch.
  function languageBar(language, known, onChange, options) {
    const opts = options || {};
    const label = languageLabel(language);
    const readable = canRead(known, language);
    const bar = document.createElement("div");
    bar.className = "language-bar" + (opts.className ? " " + opts.className : "");

    const note = document.createElement("p");
    note.className = "language-bar__note";
    bar.appendChild(note);

    if (!readable) {
      const who = readerName();
      note.textContent = "Written in " + label + ". " +
        (who ? who + " can't read it." : "You can't read it.");
      onChange("original");
      return bar;
    }

    note.textContent = "Written in " + label + ", which " + (readerName() || "you") + " can read.";
    const group = document.createElement("div");
    group.className = "language-switch";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Show the text as");
    const buttons = {};
    [["original", label], ["translation", "English"]].forEach(function (pair) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "language-switch__btn";
      btn.textContent = pair[1];
      btn.dataset.view = pair[0];
      btn.addEventListener("click", function () { select(pair[0], true); });
      buttons[pair[0]] = btn;
      group.appendChild(btn);
    });
    bar.appendChild(group);

    function select(view, remember) {
      Object.keys(buttons).forEach(function (k) {
        buttons[k].setAttribute("aria-pressed", k === view ? "true" : "false");
      });
      if (remember) saveView(view);
      onChange(view);
    }
    select(savedView(), false);
    return bar;
  }

  return {
    SCRIPTS: SCRIPTS,
    LANGUAGE_SCRIPT: LANGUAGE_SCRIPT,
    normalise: normalise,
    isPlain: isPlain,
    scriptFor: scriptFor,
    canRead: canRead,
    encode: encode,
    ensureFont: ensureFont,
    fontFamily: fontFamily,
    languageLabel: languageLabel,
    readerLanguages: readerLanguages,
    languageBar: languageBar
  };
}());
