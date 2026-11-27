import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

const file = process.argv[2];
const label = process.argv[3] || "run";
const focus = [
  "/client",
  "/client/notifications",
  "/client/login",
  "/masseur/login",
  "/masseur/notifications",
  "/admin",
];

const outputsByRoute = new Map();
const parts = [];

const rl = createInterface({
  input: createReadStream(file).pipe(createGunzip()),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  const row = JSON.parse(line);
  if (row.type === "output") {
    const route = row.route;
    if (!route) continue;
    if (!outputsByRoute.has(route)) outputsByRoute.set(route, []);
    outputsByRoute.get(route).push(row);
  }
  if (row.type === "part" && focus.includes(row.route)) {
    parts.push(row);
  }
}

function isClientOutput(o) {
  const hay = `${o.kind || ""} ${o.layer || ""} ${o.filename || ""} ${o.path || ""}`.toLowerCase();
  return (
    hay.includes("client") &&
    !hay.includes("ssr") &&
    !hay.includes("rsc") &&
    (hay.includes("/_next/static") ||
      hay.includes("static/chunks") ||
      hay.includes("[client]") ||
      o.entry_kind === "client_bootstrap" ||
      o.output_kind === "client")
  );
}

const summary = {};
for (const route of focus) {
  const outs = (outputsByRoute.get(route) || []).filter(isClientOutput);
  const routeParts = parts.filter((p) => p.route === route);
  // Prefer parts that land in browser static chunks
  const browserParts = routeParts.filter((p) =>
    String(p.filename || "").includes("/static/"),
  );
  const seen = new Set();
  let compressed = 0;
  let raw = 0;
  for (const p of browserParts) {
    const key = `${p.filename}|${p.source_path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    compressed += p.compressed_size || 0;
    raw += p.size || 0;
  }
  summary[route] = {
    clientOutputCount: outs.length,
    browserPartEntries: seen.size,
    browserRawBytes: raw,
    browserCompressedBytes: compressed,
    sampleOutputs: outs.slice(0, 5).map((o) => ({
      filename: o.filename,
      kind: o.kind,
      layer: o.layer,
      size: o.size,
      compressed_size: o.compressed_size,
    })),
  };
}

console.log(JSON.stringify({ label, summary }, null, 2));
