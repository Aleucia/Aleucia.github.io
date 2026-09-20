import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");

/**
 * Loads one of the site's plain <script> files (assets/js/*.js) into the
 * current jsdom global scope, exactly as a browser <script> tag would. These
 * files declare plain top-level functions (no export/module.exports) since
 * they're loaded directly by the HTML pages, so this is what lets tests
 * reach them without changing production code.
 *
 * A top-level `function` declaration is automatically visible as a global
 * after this returns (that's how classic scripts behave). A top-level
 * `const`/`let` (e.g. content-store.js's `const ContentStore = ...`) is not
 * — list its name in `expose` to have it copied onto globalThis too.
 */
export function loadScript(relativePath, { expose = [] } = {}) {
  const code = readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
  const exposeStatements = expose.map((name) => `\nglobalThis[${JSON.stringify(name)}] = ${name};`).join("");
  // Indirect eval runs in global scope, so top-level function declarations
  // land on globalThis just like a real <script> tag would. The expose
  // statements run inside the same eval call so they can still see any
  // top-level const/let bindings from the script above.
  (0, eval)(code + exposeStatements);
}
