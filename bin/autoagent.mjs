#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Forward all args to the TUI entry point via tsx
// Use the tsx CLI module directly so paths with spaces work on Windows
const tsxCli = resolve(root, "node_modules/tsx/dist/cli.mjs");
execFileSync(
  process.execPath,
  [tsxCli, resolve(root, "src/tui.tsx"), ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, DOTENV_CONFIG_PATH: resolve(root, ".env") } }
);
