import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

let __dirname = process.cwd();
try {
  // Prefer ESM-style import.meta.url, but fall back to CJS/workdir when unavailable
  // (esbuild may emit CJS where import.meta is not available)
  __dirname = path.dirname(fileURLToPath((import.meta as any)?.url));
} catch (e) {
  // keep process.cwd() as fallback
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "..", "client", "dist");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
