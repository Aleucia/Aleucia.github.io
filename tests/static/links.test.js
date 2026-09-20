import { existsSync, globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPath } from "../helpers/schema.js";

const HTML_FILES = globSync(repoPath("**/*.html"));

// Every href/src in these pages is root-relative (no leading "/"), and every
// nested page under characters/ sets <base href="/"> for exactly that
// reason (see SECURITY.md's "Path note"). So every reference below resolves
// against the repo root, regardless of which file it's found in.
const REF_PATTERN = /\b(?:href|src)=["']([^"']+)["']/g;

function isCheckable(ref) {
  if (!ref) return false;
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(ref)) return false; // absolute URL (http:, //cdn, etc.)
  if (ref.startsWith("mailto:") || ref.startsWith("tel:") || ref.startsWith("#")) return false;
  if (ref.startsWith("/")) return false; // site-root absolute; not a repo-relative file check here
  return true;
}

function stripQueryAndHash(ref) {
  return ref.split("#")[0].split("?")[0];
}

describe("internal links and asset references resolve to real files", () => {
  HTML_FILES.forEach((filePath) => {
    const relative = filePath.slice(repoPath().length + 1);
    const content = readFileSync(filePath, "utf-8");
    const refs = new Set();
    for (const match of content.matchAll(REF_PATTERN)) {
      const target = stripQueryAndHash(match[1]);
      if (isCheckable(match[1]) && target) refs.add(target);
    }

    refs.forEach((ref) => {
      it(`${relative}: '${ref}' exists`, () => {
        expect(existsSync(repoPath(ref)), `${relative} references missing file '${ref}'`).toBe(true);
      });
    });
  });
});
