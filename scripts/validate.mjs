#!/usr/bin/env node
// Structural validation for the merged CloudStream repository index.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(await readFile(path.join(ROOT, "plugins.json"), "utf8"));

const errors = [];
const warnings = [];
const seen = new Set();

if (!Array.isArray(data)) errors.push("root must be a JSON array");

data.forEach((entry, index) => {
  const label = `[${index}] ${entry?.internalName || entry?.name || "?"}`;
  if (!entry || typeof entry !== "object") {
    errors.push(`${label}: entry is not an object`);
    return;
  }
  for (const field of ["name", "internalName", "url"]) {
    if (typeof entry[field] !== "string" || !entry[field].trim()) {
      errors.push(`${label}: missing required string "${field}"`);
    }
  }
  if (typeof entry.url === "string" && !/^https?:\/\//i.test(entry.url)) {
    errors.push(`${label}: url is not http(s)`);
  }
  if (!Number.isInteger(entry.version) || entry.version < 0) {
    errors.push(`${label}: version must be a non-negative integer`);
  }
  if (!Number.isInteger(entry.apiVersion) || entry.apiVersion < 1) {
    errors.push(`${label}: apiVersion must be a positive integer`);
  }
  if (![0, 1, 3].includes(entry.status)) {
    warnings.push(`${label}: unexpected status ${entry.status}`);
  }
  if (!Array.isArray(entry.tvTypes) || entry.tvTypes.length === 0) {
    errors.push(`${label}: tvTypes must be a non-empty array`);
  }
  if (!Array.isArray(entry.authors)) {
    errors.push(`${label}: authors must be an array`);
  }
  const key = String(entry.internalName || "").toLowerCase();
  if (key && seen.has(key)) errors.push(`${label}: duplicate internalName`);
  seen.add(key);
});

const statusCounts = data.reduce((counts, entry) => {
  counts[entry.status] = (counts[entry.status] || 0) + 1;
  return counts;
}, {});

console.log(`providers: ${data.length}`);
console.log(`status: ${JSON.stringify(statusCounts)}`);
console.log(`total build size: ${(data.reduce((sum, entry) => sum + (Number(entry.fileSize) || 0), 0) / 1048576).toFixed(1)} MB`);
if (warnings.length) {
  console.log(`\nwarnings (${warnings.length}):`);
  warnings.forEach((warning) => console.log(`  - ${warning}`));
}
if (errors.length) {
  console.error(`\nerrors (${errors.length}):`);
  errors.forEach((error) => console.error(`  - ${error}`));
  process.exitCode = 1;
} else {
  console.log("\nOK: plugins.json matches the CloudStream index contract.");
}
