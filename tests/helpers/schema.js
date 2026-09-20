import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");

export function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, relativePath), "utf-8"));
}

export function repoPath(...segments) {
  return path.join(REPO_ROOT, ...segments);
}

export function loadDataSchema() {
  return readJson("data-schema.json");
}

export function loadManifest() {
  return readJson("data/manifest.json");
}

// data-schema.json's field "type" strings aren't a fixed enum (see SCHEMA.md)
// — anything beyond the plain scalar/array-of-scalar cases below is
// deliberately treated as unchecked here rather than guessed at.
function checkScalarType(type, value) {
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "string[]") return Array.isArray(value) && value.every((v) => typeof v === "string");
  if (type.startsWith("link[]")) return Array.isArray(value) && value.every((v) => typeof v === "string");
  if (type.startsWith("link")) return typeof value === "string";
  return null; // not a type this validator checks
}

/**
 * Validates every record of an `entity`-kind table against its
 * data-schema.json field list: every `required` field must be present, and
 * any field whose declared type is one of the plain scalar/array-of-scalar
 * shapes must actually be that type when present. Complex shapes (objects,
 * nested arrays) are intentionally left unchecked — data-schema.json
 * documents those informally (see e.g. items.crafting), not as a strict
 * grammar this validator can generically enforce.
 *
 * Returns a list of human-readable problem strings; empty means valid.
 */
export function validateEntityRecords(tableDef, records) {
  const problems = [];
  const fields = tableDef.fields || [];
  const seenIds = new Set();

  records.forEach((record, i) => {
    const label = record && record.id ? record.id : "record #" + i;

    fields.forEach((field) => {
      const value = record ? record[field.name] : undefined;
      if (field.required && (value === undefined || value === null)) {
        problems.push(label + ": missing required field '" + field.name + "'");
        return;
      }
      if (value === undefined) return;

      const ok = checkScalarType(field.type, value);
      if (ok === false) {
        problems.push(label + ": field '" + field.name + "' should be " + field.type + ", got " + JSON.stringify(value));
      }
    });

    if (tableDef.primaryKey === "id" && record && record.id !== undefined) {
      if (seenIds.has(record.id)) problems.push("duplicate id: " + record.id);
      seenIds.add(record.id);
    }
  });

  return problems;
}
