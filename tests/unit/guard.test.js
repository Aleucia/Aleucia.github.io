import { beforeEach, describe, expect, it } from "vitest";
import { loadScript } from "../helpers/load-script.js";

const SESSION_KEY = "aleucia_session";
const RETURN_KEY = "aleucia_return_url";

function validSession(overrides = {}) {
  return {
    username: "Aerin",
    token: "some-token",
    expiry: Date.now() + 60_000,
    ...overrides,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  document.documentElement.style.visibility = "";
});

describe("guard.js", () => {
  it("hides then reveals the page when the session is valid", () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(validSession()));

    loadScript("assets/js/guard.js");

    expect(document.documentElement.style.visibility).toBe("");
  });

  it("redirects and saves the return url when there is no session", () => {
    expect(() => loadScript("assets/js/guard.js")).not.toThrow();

    expect(document.documentElement.style.visibility).toBe("hidden");
    expect(sessionStorage.getItem(RETURN_KEY)).toBe(window.location.href);
  });

  it("clears and redirects on an expired session", () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(validSession({ expiry: Date.now() - 1000 })));

    expect(() => loadScript("assets/js/guard.js")).not.toThrow();

    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(document.documentElement.style.visibility).toBe("hidden");
  });

  it("clears and redirects on a malformed session payload", () => {
    sessionStorage.setItem(SESSION_KEY, "{not json");

    expect(() => loadScript("assets/js/guard.js")).not.toThrow();

    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(document.documentElement.style.visibility).toBe("hidden");
  });

  it("redirects when required session fields are the wrong type", () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(validSession({ expiry: "soon" })));

    expect(() => loadScript("assets/js/guard.js")).not.toThrow();

    expect(document.documentElement.style.visibility).toBe("hidden");
  });
});
