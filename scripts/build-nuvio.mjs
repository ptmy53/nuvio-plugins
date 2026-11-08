#!/usr/bin/env node
// Builds a Nuvio-native provider manifest from maintained Turkish provider
// repositories. Nuvio Mobile only executes JavaScript providers; CloudStream
// .cs3 extensions are handled separately by plugins.json (Nuvio TV / Android TV
// full builds only).
//
// Provider code stays in its upstream repository. This manifest only references
// each provider by absolute URL, so upstream fixes reach users without a rebuild
// here and no third-party code is redistributed.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SOURCES = [
  {
    id: "anthology",
    repo: "https://github.com/falsisdev/anthology",
    manifestUrl: "https://raw.githubusercontent.com/falsisdev/anthology/main/manifest.json",
    // Live/channel catalog entries are not stream providers for a TMDB id and
    // would be invoked on every series search. Keep the manifest streams-only.
    excludeTypes: ["channel"],
    excludeIds: ["anthology_m3u"]
  },
  {
    id: "csnuvio",
    repo: "https://github.com/csprofesor/csnuvio",
    manifestUrl: "https://raw.githubusercontent.com/csprofesor/csnuvio/main/manifest.json",
    includeIds: [
      "csnuvio-selcukflix",
      "csnuvio-dizilla",
      "csnuvio-dizipal",
      "csnuvio-fullhdfilm",
      "csnuvio-filmmakinesi",
      "csnuvio-filmkovasi",
      "csnuvio-jetfilmizle",
      "csnuvio-dizigom",
      "csnuvio-dizikorea",
      "csnuvio-dizimag",
      "csnuvio-tavsiyefilmizle",
      "csnuvio-hintfilmizle",
      "csnuvio-sezonlukdizi",
      "csnuvio-sinematv",
      "csnuvio-watch2movies"
    ]
  },
  {
    id: "mooncrown",
    repo: "https://github.com/mooncrown04/nuviotr",
    manifestUrl: "https://raw.githubusercontent.com/mooncrown04/nuviotr/main/manifest.json",
    includeIds: ["netmirror", "rec", "altiyuzaltmisaltifilm", "cinemacity"]
  },
  {
    id: "turkish-nuvio",
    repo: "https://github.com/fmustafayaman/turkish-nuvio",
    manifestUrl: "https://raw.githubusercontent.com/fmustafayaman/turkish-nuvio/main/manifest.json",
    includeIds: ["dizifilm", "dizibal"]
  }
];

const MANIFEST_HEADER = {
  name: "PT Nuvio Türkçe",
  version: "1.0.0",
  description:
    "Türkçe film, dizi ve anime için Nuvio yerel JavaScript sağlayıcıları. Mobil, TV ve Android dahil tüm Nuvio tam sürümlerinde çalışır.",
  author: "ptmy53"
};

function absoluteUrl(value, base) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const resolved = new URL(raw, base);
    if (resolved.protocol !== "https:") {
      throw new Error(`unexpected URL scheme ${resolved.protocol} for ${raw}`);
    }
    return resolved.toString();
  } catch (error) {
    if (error?.message?.startsWith("unexpected URL scheme")) throw error;
    return raw;
  }
}

function stringList(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeEntry(scraper, source) {
  const supportedTypes = stringList(scraper.supportedTypes);
  const contentLanguage = stringList(scraper.contentLanguage);
  const formats = stringList(scraper.formats);
  const filename = absoluteUrl(scraper.filename, source.manifestUrl);
  return {
    ...scraper,
    id: String(scraper.id || "").trim(),
    name: String(scraper.name || "").trim(),
    description: String(scraper.description || "").trim(),
    version: String(scraper.version || "1.0.0").trim(),
    author: String(scraper.author || "").trim(),
    supportedTypes: supportedTypes.length ? supportedTypes : ["movie", "tv"],
    filename,
    enabled: scraper.enabled !== false,
    logo: absoluteUrl(scraper.logo, source.manifestUrl) || undefined,
    contentLanguage: contentLanguage.length ? contentLanguage : ["tr"],
    formats: formats.length ? formats : ["m3u8", "mp4"]
  };
}

async function fetchManifest(source) {
  const response = await fetch(source.manifestUrl, {
    headers: { "user-agent": "nuvio-plugins-merge/1.0" }
  });
  if (!response.ok) {
    throw new Error(`${source.id}: HTTP ${response.status} for ${source.manifestUrl}`);
  }
  const manifest = await response.json();
  if (!manifest || !Array.isArray(manifest.scrapers)) {
    throw new Error(`${source.id}: not a Nuvio provider manifest`);
  }
  return manifest;
}

const scrapers = [];
const report = { generatedAt: new Date().toISOString(), sources: [], providers: [] };
const seenIds = new Map();
const seenName = new Map();

for (const source of SOURCES) {
  const manifest = await fetchManifest(source);
  const include = source.includeIds ? new Set(source.includeIds) : null;
  const exclude = new Set(source.excludeIds || []);
  const excludeTypes = new Set(source.excludeTypes || []);
  let selected = 0;

  for (const scraper of manifest.scrapers) {
    if (!scraper || typeof scraper !== "object") continue;
    if (include && !include.has(scraper.id)) continue;
    if (exclude.has(scraper.id)) continue;
    if (stringList(scraper.supportedTypes).some((type) => excludeTypes.has(type.toLowerCase()))) {
      continue;
    }
    const entry = normalizeEntry(scraper, source);
    if (!entry.id || !entry.name || !entry.filename) {
      throw new Error(`${source.id}: scraper ${scraper.id || "?"} is missing id/name/filename`);
    }
    if (!/^https:\/\//i.test(entry.filename)) {
      throw new Error(`${source.id}/${entry.id}: provider URL is not https`);
    }
    if (seenIds.has(entry.id)) {
      throw new Error(
        `${source.id}/${entry.id}: duplicate provider id (already from ${seenIds.get(entry.id)})`
      );
    }
    seenIds.set(entry.id, source.id);

    const nameKey = entry.name.toLocaleLowerCase("tr");
    if (seenName.has(nameKey)) {
      throw new Error(
        `${source.id}/${entry.id}: display name "${entry.name}" already used by ${seenName.get(nameKey)}`
      );
    }
    seenName.set(nameKey, `${source.id}/${entry.id}`);
    scrapers.push(entry);
    report.providers.push({
      id: entry.id,
      name: entry.name,
      source: source.id,
      version: entry.version,
      filename: entry.filename,
      supportedTypes: entry.supportedTypes
    });
    selected += 1;
  }

  if (include) {
    const missing = [...include].filter((id) => !manifest.scrapers.some((scraper) => scraper.id === id));
    if (missing.length) {
      throw new Error(`${source.id}: missing expected provider(s): ${missing.join(", ")}`);
    }
  }

  report.sources.push({
    id: source.id,
    repo: source.repo,
    manifestUrl: source.manifestUrl,
    upstreamScrapers: manifest.scrapers.length,
    selected
  });
}

scrapers.sort((a, b) => a.name.localeCompare(b.name, "tr"));

const manifest = { ...MANIFEST_HEADER, scrapers };
report.total = scrapers.length;

await mkdir(path.join(ROOT, ".cache"), { recursive: true });
await writeFile(path.join(ROOT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
await writeFile(
  path.join(ROOT, ".cache", "nuvio-report.json"),
  JSON.stringify(report, null, 2) + "\n"
);

const sourceLabels = new Map(SOURCES.map((source) => [source.id, source.repo]));
const rows = scrapers
  .map((entry) => {
    const platforms = entry.disabledPlatforms?.length
      ? `kapalı: ${entry.disabledPlatforms.join(", ")}`
      : "tümü";
    const settings = entry.hasSettings ? "var" : "—";
    return `| ${entry.name.replaceAll("|", "\\|")} | ${stringList(entry.supportedTypes).join(", ")} | ${stringList(entry.formats).join(", ")} | ${settings} | ${platforms} | ${entry.version} | ${sourceLabels.get(report.providers.find((item) => item.id === entry.id)?.source) || ""} |`;
  })
  .join("\n");

const providersDoc = `# Nuvio Sağlayıcıları

\`manifest.json\` tarafından yüklenen ${scrapers.length} yerel JavaScript sağlayıcısı.
Bu dosya \`npm run build:nuvio\` ile otomatik üretilir.

| Sağlayıcı | Türler | Formatlar | Ayarlar | Platform | Sürüm | Kaynak |
|---|---|---|---|---|---|---|
${rows}
`;
await writeFile(path.join(ROOT, "PROVIDERS.md"), providersDoc);

console.log(`manifest.json: ${scrapers.length} Nuvio providers`);
for (const source of report.sources) {
  console.log(`  ${source.id}: ${source.selected}/${source.upstreamScrapers} selected`);
}
