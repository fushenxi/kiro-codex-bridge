import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);

function getArg(name, defaultValue) {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index === args.length - 1) {
    return defaultValue;
  }

  return args[index + 1];
}

function resolveDefaultSettingsPath() {
  const home = os.homedir();

  switch (process.platform) {
    case "darwin":
      return path.join(home, "Library", "Application Support", "Kiro", "User", "settings.json");
    case "win32":
      return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Kiro", "User", "settings.json");
    default:
      return path.join(home, ".config", "Kiro", "User", "settings.json");
  }
}

const settingsPath = process.env.KIRO_SETTINGS_PATH || getArg("settings", resolveDefaultSettingsPath());
const endpoint = getArg("endpoint", process.env.KIRO_ENDPOINT || "http://127.0.0.1:8765");
const region = getArg("region", process.env.KIRO_SHIM_REGION || "us-east-1");
const model = getArg("model", process.env.KIRO_SHIM_MODEL_ID || process.env.OPENAI_MODEL || "gpt-5.4");

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

let settings = {};
if (fs.existsSync(settingsPath)) {
  settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
}

const backupPath = `${settingsPath}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
if (fs.existsSync(settingsPath)) {
  fs.copyFileSync(settingsPath, backupPath);
}

settings["codewhisperer.config.endpoints"] = [
  {
    region,
    endpoint
  }
];
settings["kiroAgent.modelSelection"] = model;

fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  settingsPath,
  backupPath: fs.existsSync(backupPath) ? backupPath : null,
  endpoint,
  region,
  model
}, null, 2));
