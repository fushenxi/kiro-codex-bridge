import { applyBridgeSettings, getArg, resolveDefaultSettingsPath } from "./lib/kiro.mjs";

const args = process.argv.slice(2);
const settingsPath = process.env.KIRO_SETTINGS_PATH || getArg(args, "settings", resolveDefaultSettingsPath());
const endpoint = getArg(args, "endpoint", process.env.KIRO_ENDPOINT || "http://127.0.0.1:8765");
const region = getArg(args, "region", process.env.KIRO_SHIM_REGION || "us-east-1");
const model = getArg(args, "model", process.env.KIRO_SHIM_MODEL_ID || process.env.OPENAI_MODEL || "gpt-5.4");

const result = applyBridgeSettings({
  settingsPath,
  endpoint,
  region,
  model
});

console.log(JSON.stringify({ ok: true, ...result }, null, 2));
