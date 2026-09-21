import { beforeEach, describe, expect, it } from "vitest";
import { loadScript } from "../helpers/load-script.js";

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = "";
  loadScript("assets/js/auth.js");
});

describe("nav-menu.js", () => {
  it("renders nothing when there is no active session", () => {
    loadScript("assets/js/nav-menu.js");

    expect(document.querySelector(".nav-menu-toggle")).toBeNull();
    expect(document.querySelector(".nav-menu-panel")).toBeNull();
  });

  it("renders the toggle and panel for the logged-in character", () => {
    login("Ser Gillard");

    loadScript("assets/js/nav-menu.js");

    expect(document.querySelector(".nav-menu-toggle")).not.toBeNull();
    const heading = document.querySelector(".nav-menu-heading");
    expect(heading.textContent).toBe("Ser Gillard");

    const links = Array.from(document.querySelectorAll(".nav-menu-link")).map((a) => a.getAttribute("href"));
    expect(links).toContain("character.html?section=timeline");
    expect(links).toContain("player.html");
  });

  it("opens and closes the panel via the toggle button", () => {
    login("Aerin");
    loadScript("assets/js/nav-menu.js");

    const toggle = document.querySelector(".nav-menu-toggle");
    expect(document.body.classList.contains("nav-menu-open")).toBe(false);

    toggle.dispatchEvent(new window.Event("click", { bubbles: true }));
    expect(document.body.classList.contains("nav-menu-open")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    toggle.dispatchEvent(new window.Event("click", { bubbles: true }));
    expect(document.body.classList.contains("nav-menu-open")).toBe(false);
  });

  it("closes the panel on Escape", () => {
    login("Aerin");
    loadScript("assets/js/nav-menu.js");

    document.querySelector(".nav-menu-toggle").dispatchEvent(new window.Event("click", { bubbles: true }));
    expect(document.body.classList.contains("nav-menu-open")).toBe(true);

    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.body.classList.contains("nav-menu-open")).toBe(false);
  });
});
