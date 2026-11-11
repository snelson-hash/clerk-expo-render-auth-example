import { build } from "esbuild";
import { pathToFileURL } from "node:url";
// Preserve the relevant production build shape: bundled dependencies, Node ESM,
// linked source map, and the CommonJS compatibility banner.
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
  await build({ ...options, entryPoints: ["src/index.ts"], outfile: "dist/index.mjs" });
}
