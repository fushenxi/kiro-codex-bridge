import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyBridgeSettings, findKiroResourcesPath, getArg, readKiroVersionInfo, resolveDefaultSettingsPath } from "./lib/kiro.mjs";

const args = process.argv.slice(2);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const validatedBaseline = {
  kiroVersion: "0.11.34",
  vscodeVersion: "1.107.1",
  commit: "7b506f30719296ba4f1aebfe383b426ffce0913e",
  date: "2026-03-12T22:08:23.020Z",
  electronVersion: "39.6.0",
  os: "Darwin arm64 25.2.0"
};

const settingsPath = process.env.KIRO_SETTINGS_PATH || getArg(args, "settings", resolveDefaultSettingsPath());
const endpoint = getArg(args, "endpoint", process.env.KIRO_ENDPOINT || "http://127.0.0.1:8765");
const region = getArg(args, "region", process.env.KIRO_SHIM_REGION || "us-east-1");
const model = getArg(args, "model", process.env.KIRO_SHIM_MODEL_ID || process.env.OPENAI_MODEL || "gpt-5.4");
const resourcesPath = findKiroResourcesPath(getArg(args, "app", null));
const kiroVersion = readKiroVersionInfo(resourcesPath);

const settingsResult = applyBridgeSettings({
  settingsPath,
  endpoint,
  region,
  model
});

const exactVersionMatch =
  kiroVersion.kiroVersion === validatedBaseline.kiroVersion &&
  kiroVersion.vscodeVersion === validatedBaseline.vscodeVersion &&
  kiroVersion.commit === validatedBaseline.commit;

const sameMajorMinor =
  typeof kiroVersion.kiroVersion === "string" &&
  kiroVersion.kiroVersion.split(".").slice(0, 2).join(".") ===
    validatedBaseline.kiroVersion.split(".").slice(0, 2).join(".");

const report = {
  adaptedAt: new Date().toISOString(),
  settings: settingsResult,
  detectedKiro: kiroVersion,
  validatedBaseline,
  compatibility: {
    exactVersionMatch,
    sameMajorMinor,
    supportedStatus: exactVersionMatch ? "verified" : sameMajorMinor ? "nearby-version" : "unknown",
    recommendedRegressionChecklist: [
      "file create + read",
      "pwd",
      "short background process start -> read -> stop",
      "one MCP browser action",
      "one spec generation",
      "one tasks.md execution"
    ]
  }
};

const runtimeDir = path.join(SCRIPT_DIR, "..", ".runtime");
fs.mkdirSync(runtimeDir, { recursive: true });
const reportPath = path.join(runtimeDir, "kiro-adaptation-report.json");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  reportPath,
  ...report
}, null, 2));
