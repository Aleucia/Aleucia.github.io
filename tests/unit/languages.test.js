import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "../helpers/load-script.js";

beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  delete globalThis.getSession;
  delete globalThis.ContentStore;
  loadScript("assets/js/languages.js", { expose: ["LanguageScripts"] });
});

describe("languages.js scripts", () => {
  it("gives every script 26 distinct glyphs", () => {
    Object.entries(LanguageScripts.SCRIPTS).forEach(([id, script]) => {
      const glyphs = Array.isArray(script.glyphs) ? script.glyphs : Array.from(script.glyphs);
      expect(glyphs, id).toHaveLength(26);
      expect(new Set(glyphs).size, id).toBe(26);
      glyphs.forEach((g) => expect(/[a-z]/i.test(g), id).toBe(false));
    });
  });

  it("maps every listed language to a script that exists", () => {
    Object.entries(LanguageScripts.LANGUAGE_SCRIPT).forEach(([lang, id]) => {
      expect(LanguageScripts.SCRIPTS[id], lang).toBeDefined();
    });
  });

  it("treats blank, Common and Halfling as plain English", () => {
    ["", undefined, null, "Common", "common", "Halfling", "Common Sign Language"].forEach((lang) => {
      expect(LanguageScripts.isPlain(lang)).toBe(true);
      expect(LanguageScripts.scriptFor(lang)).toBeNull();
    });
    expect(LanguageScripts.isPlain("Elvish")).toBe(false);
  });

  it("shares scripts the way the Player's Handbook does", () => {
    expect(LanguageScripts.scriptFor("Orc").id).toBe("dethek");
    expect(LanguageScripts.scriptFor("Dwarvish").id).toBe("dethek");
    expect(LanguageScripts.scriptFor("Sylvan").id).toBe("espruar");
    expect(LanguageScripts.scriptFor("Abyssal").id).toBe("infernal");
  });

  it("still gives an unknown language a script", () => {
    expect(LanguageScripts.scriptFor("Deep Speech")).not.toBeNull();
  });

  it("matches language names however they are spelled", () => {
    expect(LanguageScripts.normalise("Thieves' Cant")).toBe("thievescant");
    expect(LanguageScripts.normalise("Theives Cant")).toBe("thievescant");
    expect(LanguageScripts.languageLabel("theives cant")).toBe("Thieves' Cant");
    expect(LanguageScripts.languageLabel("elvish")).toBe("Elvish");
  });
});

describe("languages.js encode", () => {
  it("writes each letter as a glyph and keeps digits, punctuation and line breaks", () => {
    const out = LanguageScripts.encode("Dear Petra,\n12 gems!", "Elvish");
    expect(out).not.toMatch(/[a-z]/i);
    expect(out).toContain(",\n12 ");
    expect(out.endsWith("!")).toBe(true);
  });

  it("writes upper and lower case, and accented letters, the same", () => {
    expect(LanguageScripts.encode("Abc", "Draconic")).toBe(LanguageScripts.encode("abc", "Draconic"));
    expect(LanguageScripts.encode("café", "Elvish")).toBe(LanguageScripts.encode("cafe", "Elvish"));
  });

  it("joins Ogham words on the stem line", () => {
    expect(LanguageScripts.encode("a b", "Druidic")).toBe("ᚁ ᚂ");
  });

  it("leaves Common text alone", () => {
    expect(LanguageScripts.encode("Hello", "Common")).toBe("Hello");
    expect(LanguageScripts.encode(null, "Elvish")).toBe("");
  });

  it("leaves the letters for a script whose font draws them itself", () => {
    LanguageScripts.SCRIPTS.espruar = { label: "Espruar", family: "Espruar", src: "assets/fonts/espruar.woff2" };
    expect(LanguageScripts.encode("Hello", "Elvish")).toBe("Hello");
    LanguageScripts.ensureFont("Elvish");
    expect(document.head.querySelector("style").textContent).toContain("assets/fonts/espruar.woff2");
  });
});

describe("languages.js canRead", () => {
  it("reads Common always, and other languages only when known", () => {
    expect(LanguageScripts.canRead([], "Common")).toBe(true);
    expect(LanguageScripts.canRead(["Common", "Elvish"], "elvish")).toBe(true);
    expect(LanguageScripts.canRead(["Common", "Dwarvish"], "Orc")).toBe(false);
    expect(LanguageScripts.canRead(["Theives Cant"], "Thieves' Cant")).toBe(true);
  });
});

describe("languages.js ensureFont", () => {
  it("loads each script's Google Font once, and nothing for Common", () => {
    LanguageScripts.ensureFont("Common");
    expect(document.head.children).toHaveLength(0);
    LanguageScripts.ensureFont("Dwarvish");
    LanguageScripts.ensureFont("Orc");
    const links = document.head.querySelectorAll("link");
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe("https://fonts.googleapis.com/css2?family=Noto+Sans+Runic&display=swap");
  });
});

describe("languages.js readerLanguages", () => {
  it("looks up the logged-in character's languages", async () => {
    globalThis.getSession = () => ({ username: "Petra" });
    globalThis.ContentStore = {
      getTable: vi.fn().mockResolvedValue([{ name: "Yat", languages: ["Orc"] }, { name: "Petra", languages: ["Elvish"] }]),
    };
    expect(await LanguageScripts.readerLanguages()).toEqual(["Elvish"]);
    expect(ContentStore.getTable).toHaveBeenCalledWith("characters");
  });

  it("knows no languages when nobody is logged in", async () => {
    globalThis.getSession = () => null;
    expect(await LanguageScripts.readerLanguages()).toEqual([]);
  });
});

describe("languages.js languageBar", () => {
  it("tells a reader who doesn't know the language, with no switch", () => {
    globalThis.getSession = () => ({ username: "Yat" });
    const onChange = vi.fn();
    const bar = LanguageScripts.languageBar("Elvish", ["Common", "Orc"], onChange);
    expect(bar.querySelector(".language-bar__note").textContent).toBe("Written in Elvish. Yat can't read it.");
    expect(bar.querySelector("button")).toBeNull();
    expect(onChange).toHaveBeenCalledWith("original");
  });

  it("lets a reader who knows the language switch, and remembers the choice", () => {
    globalThis.getSession = () => ({ username: "Petra" });
    const onChange = vi.fn();
    const bar = LanguageScripts.languageBar("Elvish", ["Elvish"], onChange);
    const [original, english] = bar.querySelectorAll("button");
    expect(original.textContent).toBe("Elvish");
    expect(original.getAttribute("aria-pressed")).toBe("true");
    expect(onChange).toHaveBeenLastCalledWith("original");

    english.click();
    expect(onChange).toHaveBeenLastCalledWith("translation");
    expect(english.getAttribute("aria-pressed")).toBe("true");
    expect(original.getAttribute("aria-pressed")).toBe("false");

    const again = vi.fn();
    LanguageScripts.languageBar("Draconic", ["Draconic"], again);
    expect(again).toHaveBeenCalledWith("translation");
  });
});
