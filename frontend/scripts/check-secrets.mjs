// Fails if any secret name or value appears in the browser bundle (.next/static) or in
// server output that could be served. Values are read from the repo-root .env and never printed.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const NAMES = ["QLOO_API_KEY", "OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "DATABASE_URL"];

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...readEnv(path.join(root, "..", ".env")), ...readEnv(path.join(root, ".env.local")), ...process.env };
const needles = [
  ...NAMES.map((n) => ({ label: `name ${n}`, value: n })),
  ...NAMES.filter((n) => (env[n] ?? "").length >= 12).map((n) => ({ label: `value of ${n}`, value: env[n] })),
];

const dirs = [path.join(root, ".next", "static"), path.join(root, ".next", "server", "app")];
if (!fs.existsSync(dirs[0])) {
  console.error("No build found. Run `npm run build` first.");
  process.exit(2);
}

let files = 0;
const hits = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html|json|css|txt|rsc|map)$/.test(e.name)) {
      files++;
      const text = fs.readFileSync(p, "utf8");
      for (const n of needles) if (text.includes(n.value)) hits.push(`${n.label} in ${path.relative(root, p)}`);
    }
  }
}
dirs.forEach(walk);

console.log(`Scanned ${files} build files for ${needles.length} secret names/values.`);
if (hits.length) {
  console.error("SECRET LEAK:\n  " + hits.join("\n  "));
  process.exit(1);
}
console.log("OK: no secret names or values found in the client bundle or rendered pages.");
