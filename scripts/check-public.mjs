import { readFile, readdir, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

// A conservative staging aid, not a substitute for reviewing every public file.
const root = process.cwd();
const files = (await readFile("PUBLIC-CONTENTS.txt", "utf8")).trim().split("\n");
if (new Set(files).size !== files.length) throw new Error("Duplicate public entry");
const allowed = new Set(files);
for (const file of files) {
  if (file.startsWith("/") || file.split("/").includes("..")) throw new Error("Invalid public path");
}
const ignored = new Set(["node_modules", "dist", ".expo", "web-build", "coverage"]);
async function walk(relative = "") {
  for (const name of await readdir(join(root, relative))) {
    const file = relative ? `${relative}/${name}` : name;
    // Local validation dependencies and build output are never public inputs.
    if (ignored.has(name)) continue;
    const stat = await lstat(join(root, file));
    if (stat.isSymbolicLink()) throw new Error("Unexpected symlink in public tree");
    if (stat.isDirectory()) await walk(file);
    else if (!allowed.has(file)) throw new Error("Unexpected file outside public allowlist");
  }
}
await walk();
const sensitive = [
  /(?:sk|pk)_(?:test|live)_[A-Za-z0-9]{16,}/,
  /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/,
  /-----BEGIN (?:RSA |EC )?(?:PRIVATE|PUBLIC) KEY-----/,
  /postgres(?:ql)?:\/\//i,
  /https?:\/\/[^/\s]+:[^/\s]+@/i,
];
for (const file of files) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Public entry must be an ordinary file");
  const text = await readFile(file, "utf8");
  if (text.includes("\0") || sensitive.some(pattern => pattern.test(text))) {
    throw new Error("Potential sensitive public content; review privately");
  }
  const hash = createHash("sha256").update(text).digest("hex");
  console.log(`${hash}  ${file}`);
}
console.log(`Checked ${files.length} explicitly allowlisted text files. Manual review remains required.`);
