#!/usr/bin/env node
// Runs new Nuvio providers through the real getStreams contract in Node,
// using a sandbox that mimics Nuvio's provider runtime (cheerio, fetch, crypto).

const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const targets = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

async function fetchText(url, opts = {}) {
  const response = await fetch(url, {
    ...opts,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ...(opts.headers || {})
    }
  });
  return response;
}

async function loadProvider(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const code = await response.text();

  const module = { exports: {} };
  const sandbox = {
    console,
    module,
    exports: module.exports,
    global: undefined,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: fetchText,
    URL,
    URLSearchParams,
    Buffer,
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    performance: { now: () => Date.now() },
    __get_scraper_id: () => "",
    __get_scraper_settings: () => "{}"
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.require = (name) => {
    const normalized = String(name || "").toLowerCase();
    if (normalized === "cheerio" || normalized.startsWith("cheerio")) {
      return require("cheerio");
    }
    if (normalized === "crypto") {
      return crypto;
    }
    if (normalized === "crypto-js" || normalized === "cryptojs") {
      return require("crypto-js");
    }
    if (normalized === "axios") {
      return require("axios");
    }
    throw new Error(`module not allowed in test harness: ${name}`);
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: url, timeout: 15000 });
  const exported = module.exports || {};
  const fn = exported.getStreams || sandbox.getStreams || sandbox.global.getStreams;
  if (typeof fn !== "function") throw new Error("no getStreams export");
  return fn;
}

async function callWithTimeout(fn, args, ms) {
  return Promise.race([
    fn(...args),
    new Promise((_, reject) => setTimeout(() => reject(new Error("provider timeout")), ms))
  ]);
}

async function main() {
  const providers = manifest.scrapers.filter((entry) =>
    targets.length
      ? targets.includes(entry.id)
      : ["belgeselx", "dizibox", "inattvdizi", "inattvfilmler", "rectv", "tlctr",
         "webdramaturkey2", "yesilcamtv", "dmax", "dizikorea3", "filmekseni",
         "patron-setfilm", "diziyo", "cizgimax", "cizgivedizi", "dizilife",
         "fullhdfilm"].includes(entry.id)
  );
  let passed = 0;
  for (const entry of providers) {
    const started = Date.now();
    try {
      const getStreams = await loadProvider(entry.filename);
      const type = (entry.supportedTypes || []).includes("tv") && !(entry.supportedTypes || []).includes("movie")
        ? "tv"
        : (entry.supportedTypes || []).includes("movie") && !(entry.supportedTypes || []).includes("tv")
          ? "movie"
          : "movie";
      const streams =
        type === "movie"
          ? await callWithTimeout(getStreams, ["603", "movie", null, null], 60000)
          : await callWithTimeout(getStreams, ["1396", "tv", 1, 1], 60000);
      const list = Array.isArray(streams) ? streams : [];
      const playable = list.filter((stream) => stream && typeof stream.url === "string" && /^https?:\/\//i.test(stream.url));
      passed += 1;
      console.log(
        `OK ${entry.id} (${entry.name}) -> ${list.length} streams, ${playable.length} with URL | ${Date.now() - started}ms`
      );
      if (playable[0]) {
        const domain = (() => { try { return new URL(playable[0].url).host; } catch { return "?"; } })();
        console.log(`   sample: ${playable[0].name || playable[0].title || ""} :: ${domain}`);
      }
    } catch (error) {
      console.log(`ERROR ${entry.id} (${entry.name}) -> ${String(error?.message || error).slice(0, 200)}`);
    }
  }
  console.log(`\ncompleted ${passed}/${providers.length} providers`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
