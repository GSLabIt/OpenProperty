// Fails when a t("...") key has no Italian entry; warns on English text still hard-coded in JSX
// (what an upstream merge typically brings in). Run: npx tsx scripts/check-i18n.mts
import fs from "node:fs";
import path from "node:path";
import { IT } from "../src/client/locales/index.ts";

const root = new URL("../src/client", import.meta.url).pathname;
const files: string[] = [];
(function walk(d: string) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (f.name !== "ui" && f.name !== "locales") walk(p); }
    else if (/\.tsx?$/.test(f.name)) files.push(p);
  }
})(root);

const missing = new Set<string>();
const hardcoded: string[] = [];
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(/\bt\((["'])((?:(?!\1).|\\.)*)\1/g)) {
    const k = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
    if (!(k in IT)) missing.add(k);
  }
  s.split("\n").forEach((line, i) => {
    if (/OpenProperty/.test(line) || /\bt\(/.test(line) || /className=|import |\/\//.test(line.trim().slice(0, 12))) return;
    // JSX text node or common props holding user-facing English
    if (/>\s*[A-Z][a-z]+(?:[ ,.'’][A-Za-z]+){0,8}[.!?…]?\s*</.test(line) || /(?:placeholder|title|aria-label|label)="[A-Z][a-z]+[^"]*"/.test(line)) {
      hardcoded.push(`${path.relative(root, f)}:${i + 1}: ${line.trim().slice(0, 110)}`);
    }
  });
}
if (hardcoded.length) console.warn(`Possibly untranslated (${hardcoded.length}):\n` + hardcoded.join("\n"));
if (missing.size) {
  console.error(`Missing Italian entries (${missing.size}):\n` + [...missing].join("\n"));
  process.exit(1);
}
console.log("i18n ok");
