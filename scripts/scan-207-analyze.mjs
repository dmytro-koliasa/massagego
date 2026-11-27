import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

const file = process.argv[2];
const label = process.argv[3] || "scan";

const suspiciousPathRe =
  /masseur-catalog-query|preferences-payload|server-only|\/prisma\/|generated\/prisma|lib\/prisma/;

const modules = new Map();
const routeClient = new Map();
const possibleLeaks = [];

async function readJsonlGz(filePath) {
  const rl = createInterface({
    input: createReadStream(filePath).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (row.type === "module") {
      modules.set(row.ident, row);
      const p = row.path || "";
      const ident = row.ident || "";
      if (
        suspiciousPathRe.test(p) ||
        suspiciousPathRe.test(ident)
      ) {
        const isClient =
          ident.includes("[app-client]") ||
          ident.includes(" [client] ") ||
          ident.includes("(client)");
        possibleLeaks.push({
          path: p,
          ident,
          isClientVariant: isClient,
        });
      }
    }
    if (row.type === "route" || row.type === "output") {
      // collect loosely; schema may vary
      const route = row.route || row.path || row.name;
      if (!route) continue;
      if (row.layer === "client" || row.kind === "client" || row.output_type === "client") {
        routeClient.set(route, row);
      }
    }
    if (row.type === "route_output" || row.type === "chunk") {
      const route = row.route;
      if (!route) continue;
      if (String(row.kind || row.layer || "").includes("client")) {
        routeClient.set(route, {
          ...(routeClient.get(route) || {}),
          ...row,
        });
      }
    }
  }
}

await readJsonlGz(file);

const clientLeaks = possibleLeaks.filter((l) => l.isClientVariant);
const serverOnlyHits = possibleLeaks.filter((l) => !l.isClientVariant);

const routeHits = [];
for (const [ident, mod] of modules) {
  if (!suspiciousPathRe.test(ident) && !suspiciousPathRe.test(mod.path || "")) continue;
  routeHits.push({
    ident: ident.slice(0, 180),
    path: mod.path,
    clientish: /\[app-client\]|\[client\]|\(client\)/.test(ident),
  });
}

console.log(
  JSON.stringify(
    {
      label,
      file,
      moduleCount: modules.size,
      suspiciousTotal: possibleLeaks.length,
      clientVariantSuspicious: clientLeaks.length,
      nonClientSuspicious: serverOnlyHits.length,
      clientVariantSamples: clientLeaks.slice(0, 20),
      nonClientSamples: serverOnlyHits.slice(0, 20),
      routeOutputKeys: [...routeClient.keys()].slice(0, 40),
      focusSuspiciousModules: routeHits.slice(0, 40),
    },
    null,
    2,
  ),
);
