import { beforeEach, describe, expect, it } from "vitest";
import { loadScript } from "../helpers/load-script.js";

beforeEach(() => {
  sessionStorage.clear();
  loadScript("assets/js/auth.js");
});

describe("auth.js", () => {
  it("lists every roster character's name", () => {
    const names = getCharacterNames();
    expect(names).toContain("Aerin");
    expect(names.length).toBeGreaterThan(0);
  });

  it("logs in a known character and stores a session", () => {
    const ok = login("Aerin");
    expect(ok).toBe(true);

    const session = getSession();
    expect(session).not.toBeNull();
    expect(session.username).toBe("Aerin");
    expect(typeof session.token).toBe("string");
    expect(session.expiry).toBeGreaterThan(Date.now());
  });

  it("refuses to log in an unknown character", () => {
    expect(login("Nobody")).toBe(false);
    expect(getSession()).toBeNull();
  });

  it("treats an expired session as unauthenticated and clears it", () => {
    login("Aerin");
    const raw = JSON.parse(sessionStorage.getItem("aleucia_session"));
    raw.expiry = Date.now() - 1000;
    sessionStorage.setItem("aleucia_session", JSON.stringify(raw));

    expect(getSession()).toBeNull();
    expect(sessionStorage.getItem("aleucia_session")).toBeNull();
  });

  it("returns non-sensitive character data for a known character", () => {
    const data = getCharacterData("Aerin");
    expect(data).toEqual({ name: "Aerin", spellcaster: true });
  });

  it("returns null character data for an unknown character", () => {
    expect(getCharacterData("Nobody")).toBeNull();
  });

  it("logout clears the session and any saved return url", () => {
    login("Aerin");
    sessionStorage.setItem("aleucia_return_url", "world.html");

    // jsdom doesn't implement real navigation; logging that it's
    // unimplemented is fine, actually throwing means the assertions below
    // wouldn't run.
    expect(() => logout()).not.toThrow();

    expect(sessionStorage.getItem("aleucia_session")).toBeNull();
    expect(sessionStorage.getItem("aleucia_return_url")).toBeNull();
  });
});
