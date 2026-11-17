import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { pathToFileURL } from "node:url";
// Preserve the relevant production build shape: bundled dependencies, Node ESM,
// linked source map, and the CommonJS compatibility banner.
const require = createRequire(import.meta.url);

function installedVersion(packageName, entry) {
  let directory = dirname(entry);
  while (directory !== parse(directory).root) {
    try {
      const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      if (manifest.name === packageName && typeof manifest.version === "string") {
        return manifest.version;
      }
    } catch {
      // Continue upward until this package's own manifest is found.
    }
    directory = dirname(directory);
  }
  throw new Error(`Unable to resolve installed version for ${packageName}`);
}

export function logInstalledClerkVersions() {
  const expressEntry = require.resolve("@clerk/express");
  const expressRequire = createRequire(expressEntry);
  const backendEntry = expressRequire.resolve("@clerk/backend");
  const backendRequire = createRequire(backendEntry);
  const sharedEntry = backendRequire.resolve("@clerk/shared");
  const chain = [
    `@clerk/express@${installedVersion("@clerk/express", expressEntry)}`,
    `@clerk/backend@${installedVersion("@clerk/backend", backendEntry)}`,
    `@clerk/shared@${installedVersion("@clerk/shared", sharedEntry)}`,
  ];
  console.log(`Clerk build dependency chain: ${chain.join(" -> ")}`);
}

export const options = {
  platform: "node",
  bundle: true,
  format: "esm",
  sourcemap: "linked",
  external: ["*.node"],
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);`,
  },
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  logInstalledClerkVersions();
  await build({ ...options, entryPoints: ["src/index.ts"], outfile: "dist/index.mjs" });
}
