#!/usr/bin/env node

import { Monitor } from "./monitor.js";

let config;
try {
  let mod;
  try {
    mod = await import("./config.js");
  } catch {
    console.log("[claw-bot] No config.js found — using config.example.js with environment variables");
    mod = await import("./config.example.js");
  }
  config = mod.default ?? mod;
} catch (err) {
  console.error("\x1b[31m[claw-bot] Failed to load config:\x1b[0m", err);
  process.exit(1);
}

if (
  !config.lrs?.endpoint ||
  !config.lrs?.key ||
  config.lrs.key === "YOUR_LRS_KEY" ||
  !config.lrs?.secret ||
  config.lrs.secret === "YOUR_LRS_SECRET"
) {
  console.error(
    "\x1b[31m[claw-bot] LRS credentials not configured.\x1b[0m\n" +
      "  Local:   copy src/config.example.js → src/config.js and fill in your credentials.\n" +
      "  Railway: set LRS_ENDPOINT, LRS_KEY, and LRS_SECRET environment variables.\n"
  );
  process.exit(1);
}

const monitor = new Monitor(config);
monitor.start();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`\nReceived ${signal}`);
    monitor.stop();
    process.exit(0);
  });
}
