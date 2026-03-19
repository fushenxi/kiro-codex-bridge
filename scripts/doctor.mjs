import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

const settingsPath = process.env.KIRO_SETTINGS_PATH || resolveDefaultSettingsPath();
const result = {
  settingsPath,
  settingsExists: fs.existsSync(settingsPath),
  endpointConfigured: false,
  modelSelection: null,
  bridgeHealth: null
};

if (result.settingsExists) {
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  result.endpointConfigured = Array.isArray(settings["codewhisperer.config.endpoints"]) && settings["codewhisperer.config.endpoints"].length > 0;
  result.modelSelection = settings["kiroAgent.modelSelection"] || null;
}

try {
  const response = await fetch("http://127.0.0.1:8765/health");
  result.bridgeHealth = response.ok ? await response.json() : { ok: false, status: response.status };
} catch (error) {
  result.bridgeHealth = {
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  };
}

console.log(JSON.stringify(result, null, 2));
