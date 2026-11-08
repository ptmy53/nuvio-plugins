#!/usr/bin/env node
// Merges several CloudStream plugin repositories into one plugins.json.
//
// Usage:
//   node scripts/build.mjs            # fetch upstreams, write plugins.json + report
//   node scripts/build.mjs --offline  # reuse .cache/fetched.json
//
// The merged file stays a plain CloudStream repository array so it can be
// consumed by CloudStream itself and by clients with a CS3 loader (Nuvio TV).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OFFLINE = process.argv.includes("--offline");

const SOURCES = [
  {
    id: "plt-stream",
    name: "PLT Stream",
    url: "https://raw.githubusercontent.com/pltmustafa/plt-stream/builds/plugins.json"
  },
  {
    id: "manitux-cs-plugins",
    name: "Manitux CS Plugins",
    url: "https://raw.githubusercontent.com/manitux-app/cs-plugins/main/builds/plugins.json"
  },
  {
    id: "btvault",
    name: "BTVault",
    url: "https://raw.githubusercontent.com/baristomruk-max/BTVault/builds/plugins.json"
  },
  {
    id: "cloudstreamhub",
    name: "CloudStreamHub",
    url: "https://raw.githubusercontent.com/Emre-Kahveci/CloudStreamHub/builds/plugins.json"
  },
  {
    id: "personal-cloudstream",
    name: "Personal CloudStream",
    url: "https://raw.githubusercontent.com/patr0nq/personal_cloudstream/refs/heads/builds/plugins.json"
  }
];

const CACHE_DIR = path.join(ROOT, ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "fetched.json");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : value == null ? fallback : String(value).trim();
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeEntry(raw, source) {
  const name = asText(raw.name) || asText(raw.internalName);
  const internalName = asText(raw.internalName) || name;
  const url = asText(raw.url);
  if (!name || !internalName || !/^https?:\/\//i.test(url)) return null;

  const entry = {
    url,
    status: asNumber(raw.status, 0),
    version: asNumber(raw.version, 0),
    name,
    internalName,
    authors: asArray(raw.authors).map((author) => asText(author)).filter(Boolean),
    description: asText(raw.description)
  };
  if (raw.fileHash) entry.fileHash = asText(raw.fileHash);
  if (raw.fileSize != null) entry.fileSize = asNumber(raw.fileSize, 0);
  entry.repositoryUrl = asText(raw.repositoryUrl) || source.url.replace(/\/builds\/.*$/, "");
  if (raw.iconUrl) entry.iconUrl = asText(raw.iconUrl);
  entry.language = asText(raw.language);
  const tvTypes = asArray(raw.tvTypes).map((type) => asText(type)).filter(Boolean);
  entry.tvTypes = tvTypes.length ? tvTypes : ["All"];
  entry.apiVersion = asNumber(raw.apiVersion, 1);
  return entry;
}

// CloudStream repositories bump their own build numbers independently, so
// version values are only comparable inside one repository. Prefer a working
// entry, then the highest version, then the largest build.
function better(a, b) {
  const workingA = a.status === 1 ? 1 : 0;
  const workingB = b.status === 1 ? 1 : 0;
  if (workingA !== workingB) return workingA > workingB;
  if (a.version !== b.version) return a.version > b.version;
  return (a.fileSize || 0) > (b.fileSize || 0);
}

async function loadSources() {
  if (OFFLINE) {
    const cached = JSON.parse(await readFile(CACHE_FILE, "utf8"));
    return cached.map((item) => ({
      ...SOURCES.find((source) => source.id === item.id),
      ...item
    }));
  }
  const loaded = [];
  for (const source of SOURCES) {
    const response = await fetch(source.url, {
      headers: { "user-agent": "nuvio-plugins-merge/1.0" }
    });
    if (!response.ok) {
      throw new Error(`${source.id}: HTTP ${response.status} for ${source.url}`);
    }
    const data = JSON.parse(await response.text());
    if (!Array.isArray(data)) {
      throw new Error(`${source.id}: repository root must be a JSON array`);
    }
    loaded.push({ ...source, data });
  }
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(loaded, null, 2) + "\n");
  return loaded;
}

function merge(sources) {
  const groups = new Map();
  const report = {
    generatedAt: new Date().toISOString(),
    sources: sources.map((source) => ({
      id: source.id,
      name: source.name,
      url: source.url,
      entries: source.data.length
    })),
    totals: { raw: 0, invalid: 0, unique: 0, duplicates: 0 },
    duplicates: []
  };

  for (const source of sources) {
    for (const raw of source.data) {
      report.totals.raw += 1;
      const entry = normalizeEntry(raw, source);
      if (!entry) {
        report.totals.invalid += 1;
        continue;
      }
      const key = entry.internalName.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ entry, sourceId: source.id });
    }
  }

  const merged = [];
  for (const [key, candidates] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const winner = candidates.reduce((best, candidate) =>
      better(candidate.entry, best.entry) ? candidate : best
    );
    merged.push(winner.entry);
    if (candidates.length > 1) {
      report.totals.duplicates += 1;
      report.duplicates.push({
        internalName: key,
        kept: { source: winner.sourceId, version: winner.entry.version, status: winner.entry.status },
        dropped: candidates
          .filter((candidate) => candidate !== winner)
          .map((candidate) => ({
            source: candidate.sourceId,
            version: candidate.entry.version,
            status: candidate.entry.status
          }))
      });
    }
  }

  report.totals.unique = merged.length;
  return { merged, report };
}

const sources = await loadSources();
const { merged, report } = merge(sources);

await mkdir(CACHE_DIR, { recursive: true });
await writeFile(path.join(ROOT, "plugins.json"), JSON.stringify(merged, null, 2) + "\n");
await writeFile(path.join(CACHE_DIR, "merge-report.json"), JSON.stringify(report, null, 2) + "\n");

const byStatus = merged.reduce((counts, entry) => {
  counts[entry.status] = (counts[entry.status] || 0) + 1;
  return counts;
}, {});
console.log(
  `merged ${report.totals.raw} entries -> ${report.totals.unique} providers ` +
    `(${report.totals.invalid} invalid, ${report.totals.duplicates} duplicate groups)`
);
console.log("status counts:", byStatus);
console.log("wrote plugins.json");
