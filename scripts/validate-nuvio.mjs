#!/usr/bin/env node
// Validates manifest.json against Nuvio's provider-manifest contract and
// checks that every referenced provider is reachable and syntactically valid.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_CODE_BYTES = 1024 * 1024; // Nuvio TV "limited" platform quota

const manifest = JSON.parse(await readFile(path.join(ROOT, "manifest.json"), "utf8"));
const errors = [];
const warnings = [];

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringList(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
  errors.push("manifest.json root must be an object");
} else {
  if (!isText(manifest.name)) errors.push("manifest.name is required");
  if (!isText(manifest.version)) errors.push("manifest.version is required");
  if (!Array.isArray(manifest.scrapers)) errors.push("manifest.scrapers must be an array");
}

const scrapers = Array.isArray(manifest.scrapers) ? manifest.scrapers : [];
const seen = new Set();

scrapers.forEach((entry, index) => {
  const label = `[${index}] ${entry?.id || entry?.name || "?"}`;
  for (const field of ["id", "name", "version", "filename"]) {
    if (!isText(entry?.[field])) errors.push(`${label}: missing string "${field}"`);
  }
  if (!isStringList(entry?.supportedTypes) || entry.supportedTypes.length === 0) {
    errors.push(`${label}: supportedTypes must be a non-empty string array`);
  }
  if (entry?.contentLanguage != null && !isStringList(entry.contentLanguage)) {
    errors.push(`${label}: contentLanguage must be a string array`);
  }
  if (entry?.enabled !== undefined && typeof entry.enabled !== "boolean") {
    errors.push(`${label}: enabled must be boolean`);
  }
  if (entry?.disabledPlatforms != null && !isStringList(entry.disabledPlatforms)) {
    errors.push(`${label}: disabledPlatforms must be a string array`);
  }
  if (entry?.formats != null && !isStringList(entry.formats)) {
    errors.push(`${label}: formats must be a string array`);
  }
  if (entry?.logo != null && !isText(entry.logo)) {
    errors.push(`${label}: logo must be a string`);
  }
  if (isText(entry?.filename) && !/^https:\/\//i.test(entry.filename)) {
    errors.push(`${label}: filename must be an absolute https URL`);
  }
  const id = String(entry?.id || "").toLowerCase();
  if (id && seen.has(id)) errors.push(`${label}: duplicate id`);
  seen.add(id);
});

async function checkProvider(entry) {
  const result = { id: entry.id, ok: false, bytes: 0, error: "" };
  try {
    const response = await fetch(entry.filename, {
      headers: { "user-agent": "nuvio-plugins-validate/1.0" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const code = await response.text();
    result.bytes = Buffer.byteLength(code, "utf8");
    if (!code.trim()) throw new Error("empty provider");
    if (result.bytes > MAX_CODE_BYTES) {
      throw new Error(`code exceeds ${MAX_CODE_BYTES} byte TV quota`);
    }
    // Parse only; module/exports are injected by the Nuvio runtime.
    new Function(code);
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error);
  }
  return result;
}

const results = [];
const queue = [...scrapers];
const workers = Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const entry = queue.shift();
    results.push(await checkProvider(entry));
  }
});
await Promise.all(workers);

for (const result of results) {
  if (!result.ok) {
    errors.push(`${result.id}: ${result.error}`);
  } else if (result.bytes > 400 * 1024) {
    warnings.push(`${result.id}: ${Math.round(result.bytes / 1024)} KB (slow on older TVs)`);
  }
}

const totalBytes = results.reduce((sum, result) => sum + result.bytes, 0);
console.log(`providers: ${scrapers.length}`);
console.log(`reachable: ${results.filter((result) => result.ok).length}`);
console.log(`total provider code: ${(totalBytes / 1024).toFixed(0)} KB`);
if (warnings.length) {
  console.log(`\nwarnings (${warnings.length}):`);
  warnings.forEach((warning) => console.log(`  - ${warning}`));
}
if (errors.length) {
  console.error(`\nerrors (${errors.length}):`);
  errors.forEach((error) => console.error(`  - ${error}`));
  process.exitCode = 1;
} else {
  console.log("\nOK: manifest.json and all providers are valid.");
}
