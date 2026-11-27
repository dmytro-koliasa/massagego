/**
 * #207 pre-PR performance capture (production server).
 * Usage:
 *   node scripts/verify-207-perf.mjs --label base --base-url http://127.0.0.1:3101 --out path.json
 * Requires E2E fixture credentials via env:
 *   PERF_CLIENT_PHONE, PERF_CLIENT_PASSWORD
 * Optional:
 *   PERF_RUNS=3
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const label = arg("label", "run");
const baseURL = arg("base-url", "http://127.0.0.1:3001");
const outPath = arg("out", path.join(process.env.TEMP || "/tmp", `mg-207-${label}.json`));
const runs = Number(process.env.PERF_RUNS || arg("runs", "3"));
const expectUrlFilters = arg("url-filters", "0") === "1";
const phone = process.env.PERF_CLIENT_PHONE;
const password = process.env.PERF_CLIENT_PASSWORD;

if (!phone || !password) {
  console.error("PERF_CLIENT_PHONE and PERF_CLIENT_PASSWORD are required");
  process.exit(1);
}

function median(values) {
  const sorted = [...values].filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarizeSizes(resources) {
  let transferSize = 0;
  let encodedBodySize = 0;
  let decodedBodySize = 0;
  for (const r of resources) {
    transferSize += r.transferSize || 0;
    encodedBodySize += r.encodedBodySize || 0;
    decodedBodySize += r.decodedBodySize || 0;
  }
  return { transferSize, encodedBodySize, decodedBodySize, count: resources.length };
}

async function switchToLoginTab(page) {
  const loginTab = page.getByRole("tab", {
    name: /I am registered already|Я вже зареєстрований/i,
  });
  await loginTab.waitFor({ state: "visible", timeout: 30_000 });
  for (let i = 0; i < 5; i += 1) {
    await loginTab.click();
    if ((await loginTab.getAttribute("aria-selected")) === "true") return;
    await page.waitForTimeout(250);
  }
}

async function signIn(page) {
  await page.goto(`${baseURL}/client/login`, { waitUntil: "domcontentloaded" });
  await page.waitForResponse(
    (res) => res.url().includes("/api/auth/client/session") && res.status() < 500,
    { timeout: 30_000 },
  );
  await switchToLoginTab(page);
  await page.locator('input[type="tel"]').first().fill(phone);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /Sign in|Увійти/i }).click();
  await page.waitForURL(/\/client(?!\/login)/, { timeout: 45_000 });
}

async function measureRoute(page, routePath, opts = {}) {
  const apiHits = [];
  const onRequest = (req) => {
    const url = req.url();
    if (!url.startsWith(baseURL)) return;
    const u = new URL(url);
    if (u.pathname.startsWith("/api/")) {
      apiHits.push({
        method: req.method(),
        path: u.pathname + u.search,
        resourceType: req.resourceType(),
        at: Date.now(),
      });
    }
  };
  page.on("request", onRequest);

  const started = Date.now();
  const response = await page.goto(`${baseURL}${routePath}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const ttfb = response ? response.request().timing()?.responseStart : null;
  // Prefer Navigation Timing when available.
  const nav = await page.evaluate(() => {
    const navEntry = performance.getEntriesByType("navigation")[0];
    if (!navEntry) return null;
    return {
      responseStart: navEntry.responseStart,
      domContentLoaded: navEntry.domContentLoadedEventEnd,
      loadEventEnd: navEntry.loadEventEnd,
      transferSize: navEntry.transferSize,
      encodedBodySize: navEntry.encodedBodySize,
      decodedBodySize: navEntry.decodedBodySize,
    };
  });

  let catalogVisibleMs = null;
  let notifVisibleMs = null;
  if (opts.waitCatalog) {
    const city = page.getByLabel(/Locality|Населений пункт/i);
    await city.waitFor({ state: "visible", timeout: 30_000 });
    catalogVisibleMs = Date.now() - started;
  }
  if (opts.waitNotif) {
    const title = page.getByRole("heading", {
      name: /Notifications|Сповіщення|Notification/i,
    });
    await title.first().waitFor({ state: "visible", timeout: 30_000 });
    // Prefer preference checkboxes or inbox section text
    await page.waitForTimeout(300);
    notifVisibleMs = Date.now() - started;
  }

  // Allow post-hydration fetches to settle.
  await page.waitForTimeout(opts.settleMs ?? 2500);

  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((r) => ({
      name: r.name,
      initiatorType: r.initiatorType,
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
      decodedBodySize: r.decodedBodySize,
      responseStart: r.responseStart,
      duration: r.duration,
    })),
  );

  page.off("request", onRequest);

  const doc = nav || {
    responseStart: ttfb,
    transferSize: null,
    encodedBodySize: null,
    decodedBodySize: null,
  };

  const apiPaths = apiHits.map((h) => h.path);
  const masseursGets = apiHits.filter(
    (h) => h.method === "GET" && h.path.startsWith("/api/masseurs"),
  );
  const prefsGets = apiHits.filter(
    (h) => h.method === "GET" && h.path.startsWith("/api/notifications/preferences"),
  );
  const inboxGets = apiHits.filter(
    (h) => h.method === "GET" && h.path.startsWith("/api/notifications/inbox"),
  );

  const jsResources = resources.filter(
    (r) => r.name.includes("/_next/static/chunks/") && r.name.endsWith(".js"),
  );

  return {
    route: routePath,
    finalUrl: page.url(),
    ttfbMs: doc.responseStart ?? null,
    catalogVisibleMs,
    notifVisibleMs,
    document: {
      transferSize: doc.transferSize ?? null,
      encodedBodySize: doc.encodedBodySize ?? null,
      decodedBodySize: doc.decodedBodySize ?? null,
    },
    api: {
      total: apiHits.length,
      paths: apiPaths,
      masseursGets: masseursGets.length,
      prefsGets: prefsGets.length,
      inboxGets: inboxGets.length,
    },
    js: summarizeSizes(jsResources),
    consoleErrors: [],
  };
}

async function measureCatalogNav(page) {
  const apiHits = [];
  const onRequest = (req) => {
    const url = req.url();
    if (!url.startsWith(baseURL)) return;
    const u = new URL(url);
    if (u.pathname.startsWith("/api/")) {
      apiHits.push({ method: req.method(), path: u.pathname + u.search });
    }
  };
  page.on("request", onRequest);
  const city = page.getByLabel(/Locality|Населений пункт/i);
  await city.selectOption({ value: "all" });
  if (expectUrlFilters) {
    await page.waitForURL(/[?&]city=all/, { timeout: 30_000 });
  } else {
    // Baseline keeps city in React state and refetches via API.
    await page.waitForResponse(
      (res) =>
        res.url().includes("/api/masseurs") && res.request().method() === "GET",
      { timeout: 30_000 },
    );
  }
  await page.waitForTimeout(2000);
  page.off("request", onRequest);
  const masseursGets = apiHits.filter(
    (h) => h.method === "GET" && h.path.startsWith("/api/masseurs"),
  );
  return {
    apiTotal: apiHits.length,
    masseursGets: masseursGets.length,
    paths: apiHits.map((h) => `${h.method} ${h.path}`),
    urlAfter: page.url(),
  };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
page.on("pageerror", (err) => consoleErrors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

await signIn(page);

const catalogRuns = [];
const notifRuns = [];
const navRuns = [];

for (let i = 0; i < runs; i += 1) {
  catalogRuns.push(await measureRoute(page, "/client", { waitCatalog: true }));
  notifRuns.push(
    await measureRoute(page, "/client/notifications", { waitNotif: true }),
  );
  // Navigate back to catalog then measure filter change
  await page.goto(`${baseURL}/client`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/Locality|Населений пункт/i).waitFor({ state: "visible" });
  navRuns.push(await measureCatalogNav(page));
}

await browser.close();

function pack(runsArr, pick) {
  const values = runsArr.map(pick);
  return { values, median: median(values) };
}

const report = {
  label,
  baseURL,
  runs,
  phoneMasked: `${phone.slice(0, 4)}…`,
  generatedAt: new Date().toISOString(),
  catalog: {
    ttfbMs: pack(catalogRuns, (r) => r.ttfbMs),
    catalogVisibleMs: pack(catalogRuns, (r) => r.catalogVisibleMs),
    apiTotal: pack(catalogRuns, (r) => r.api.total),
    masseursGets: pack(catalogRuns, (r) => r.api.masseursGets),
    documentTransfer: pack(catalogRuns, (r) => r.document.transferSize),
    documentEncoded: pack(catalogRuns, (r) => r.document.encodedBodySize),
    documentDecoded: pack(catalogRuns, (r) => r.document.decodedBodySize),
    jsTransfer: pack(catalogRuns, (r) => r.js.transferSize),
    jsEncoded: pack(catalogRuns, (r) => r.js.encodedBodySize),
    jsDecoded: pack(catalogRuns, (r) => r.js.decodedBodySize),
    sampleApiPaths: catalogRuns[0]?.api.paths ?? [],
    runs: catalogRuns,
  },
  notifications: {
    ttfbMs: pack(notifRuns, (r) => r.ttfbMs),
    notifVisibleMs: pack(notifRuns, (r) => r.notifVisibleMs),
    apiTotal: pack(notifRuns, (r) => r.api.total),
    prefsGets: pack(notifRuns, (r) => r.api.prefsGets),
    inboxGets: pack(notifRuns, (r) => r.api.inboxGets),
    documentTransfer: pack(notifRuns, (r) => r.document.transferSize),
    documentEncoded: pack(notifRuns, (r) => r.document.encodedBodySize),
    documentDecoded: pack(notifRuns, (r) => r.document.decodedBodySize),
    sampleApiPaths: notifRuns[0]?.api.paths ?? [],
    runs: notifRuns,
  },
  catalogFilterNav: {
    apiTotal: pack(navRuns, (r) => r.apiTotal),
    masseursGets: pack(navRuns, (r) => r.masseursGets),
    samplePaths: navRuns[0]?.paths ?? [],
    runs: navRuns,
  },
  consoleErrors,
};

fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ wrote: outPath, summary: {
  catalogMasseursGetsMedian: report.catalog.masseursGets.median,
  notifPrefsGetsMedian: report.notifications.prefsGets.median,
  notifInboxGetsMedian: report.notifications.inboxGets.median,
  filterNavMasseursGetsMedian: report.catalogFilterNav.masseursGets.median,
  catalogTtfbMedian: report.catalog.ttfbMs.median,
  catalogVisibleMedian: report.catalog.catalogVisibleMs.median,
}}, null, 2));
