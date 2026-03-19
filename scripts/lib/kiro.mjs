import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function getArg(args, name, defaultValue) {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index === args.length - 1) {
    return defaultValue;
  }

  return args[index + 1];
}

export function resolveDefaultSettingsPath() {
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

export function resolveDefaultKiroResourcesCandidates() {
  const home = os.homedir();

  switch (process.platform) {
    case "darwin":
      return [
        "/Applications/Kiro.app/Contents/Resources/app",
        path.join(home, "Applications", "Kiro.app", "Contents", "Resources", "app")
      ];
    case "win32":
      return [
        path.join(process.env.LOCALAPPDATA || path.join(home, "AppData", "Local"), "Programs", "Kiro", "resources", "app"),
        path.join("C:\\", "Program Files", "Kiro", "resources", "app")
      ];
    default:
      return [
        "/opt/Kiro/resources/app",
        path.join(home, ".local", "share", "Kiro", "resources", "app")
      ];
  }
}

export function findKiroResourcesPath(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.KIRO_APP_PATH,
    ...resolveDefaultKiroResourcesCandidates()
  ].filter(Boolean);

  for (const candidate of candidates) {
    const productPath = path.join(candidate, "product.json");
    if (fs.existsSync(productPath)) {
      return candidate;
    }
  }

  return null;
}

export function readKiroVersionInfo(resourcesPath) {
  if (!resourcesPath) {
    return {
      found: false
    };
  }

  const productPath = path.join(resourcesPath, "product.json");
  const packagePath = path.join(resourcesPath, "package.json");

  const product = fs.existsSync(productPath)
    ? JSON.parse(fs.readFileSync(productPath, "utf8"))
    : null;
  const pkg = fs.existsSync(packagePath)
    ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
    : null;

  if (!product) {
    return {
      found: false,
      resourcesPath
    };
  }

  return {
    found: true,
    resourcesPath,
    productPath,
    packagePath: fs.existsSync(packagePath) ? packagePath : null,
    kiroVersion: product.version || null,
    vscodeVersion: product.vsCodeVersion || null,
    commit: product.commit || null,
    date: product.date || null,
    electronVersion: pkg?.devDependencies?.electron || null
  };
}

export function applyBridgeSettings({ settingsPath, endpoint, region, model }) {
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

  return {
    settingsPath,
    backupPath: fs.existsSync(backupPath) ? backupPath : null,
    endpoint,
    region,
    model
  };
}
