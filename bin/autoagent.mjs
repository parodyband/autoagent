#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Forward all args to the TUI entry point via tsx
execFileSync(
  resolve(root, "node_modules/.bin/tsx"),
  [resolve(root, "src/tui.tsx"), ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, DOTENV_CONFIG_PATH: resolve(root, ".env") } }
);
