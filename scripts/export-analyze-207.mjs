import { execFileSync } from "node:child_process";
import { createGzip } from "node:zlib";
import {
  createReadStream,
  createWriteStream,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const temp = process.env.TEMP || process.env.TMPDIR || "/tmp";
const outDir = path.join(temp, "mg-207-analyze");
mkdirSync(outDir, { recursive: true });

async function exportSnap(cwd, snapshot, outFile) {
  const raw = `${outFile}.raw`;
  execFileSync(
    "npx",
    ["next", "analyze", "export", "--snapshot", snapshot],
    {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 512 * 1024 * 1024,
      encoding: "buffer",
    },
  );
  // Prefer file redirect for large graphs
  execFileSync(
    process.execPath,
    [
      "-e",
      `const {spawnSync}=require('child_process');const {writeFileSync}=require('fs');const r=spawnSync('npx',['next','analyze','export','--snapshot','${snapshot}'],{cwd:process.cwd(),shell:true,encoding:'buffer',maxBuffer:512*1024*1024});if(r.status) {console.error(r.stderr.toString());process.exit(r.status||1);} writeFileSync(process.argv[1], r.stdout);`,
      raw,
    ],
    { cwd, stdio: "inherit" },
  );
  await pipeline(createReadStream(raw), createGzip(), createWriteStream(outFile));
  unlinkSync(raw);
  console.log("wrote", outFile);
}

await exportSnap(
  path.join(temp, "mg-207-base"),
  "207-base-d09a5fa",
  path.join(outDir, "base.jsonl.gz"),
);
await exportSnap(
  path.join(temp, "mg-207-feat"),
  "207-feat-cc8676a",
  path.join(outDir, "feat.jsonl.gz"),
);
