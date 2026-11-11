import { createApp } from "./app.js";
try {
  const server = createApp().listen(Number(process.env.PORT || 3000), "0.0.0.0");
  server.on("error", () => {
    process.stderr.write("API startup failed; inspect local setup privately.\n");
    process.exitCode = 1;
  });
} catch {
  process.stderr.write("API startup failed; inspect local setup privately.\n");
  process.exitCode = 1;
}
