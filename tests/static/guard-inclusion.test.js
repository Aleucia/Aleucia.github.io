import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPath } from "../helpers/schema.js";

// Mirrors the PreToolUse hook in .claude/settings.json and the checklist in
// SECURITY.md: every full HTML page except the public login page must load
// guard.js as its first <script>, with no defer/async, so protected content
// never paints before the session check runs.
const PROTECTED_PAGES = globSync(repoPath("**/*.html"), {
  exclude: (p) => p.endsWith("index.html") || p.includes("/tools/"),
});

describe("every protected page includes the auth guard first", () => {
  it("found at least one protected page to check", () => {
    expect(PROTECTED_PAGES.length).toBeGreaterThan(0);
  });

  PROTECTED_PAGES.forEach((filePath) => {
    const relative = filePath.slice(repoPath().length + 1);

    it(`${relative}: guard.js is the first <script>, no defer/async`, () => {
      const content = readFileSync(filePath, "utf-8");
      if (!/<head[\s>]/i.test(content)) return; // not a full page (partial/fragment)

      const scriptMatch = content.match(/<script\b[^>]*>/i);
      expect(scriptMatch, "page has no <script> tag at all").not.toBeNull();

      const tag = scriptMatch[0];
      expect(tag, "first <script> tag must load assets/js/guard.js").toMatch(/src=["']assets\/js\/guard\.js["']/);
      expect(tag).not.toMatch(/\bdefer\b/);
      expect(tag).not.toMatch(/\basync\b/);
    });
  });
});
