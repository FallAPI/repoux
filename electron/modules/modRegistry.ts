import path from 'path';
import fs from 'fs-extra';
import { app } from 'electron';
import { atomicReadJson, atomicWriteJson } from './atomicFs';

export type InstallStatus = 'installed' | 'downloading' | 'extracting';

export interface InstalledMod {
  id: string; // e.g. "Author-ModName"
  name: string;
  version: string;
  author: string;
  description: string;
  installPath: string; // relative to BepInEx/plugins/
  enabled: boolean;
  installedAt: string;
  status: InstallStatus;
  dependencies: string[];
  sizeMB?: number;
  iconUrl?: string;
}

export interface ModRegistry {
  gameVersion: string;
  lastUpdated: string;
  installedMods: InstalledMod[];
}

function getRegistryPath(): string {
  const dataDir = path.join(app.getPath('userData'), 'REPX');
  return path.join(dataDir, 'mods.json');
}

function getOldRegistryPath(): string {
  return path.join(app.getPath('userData'), 'REPO-ModManager', 'mods.json');
}

export async function readRegistry(): Promise<ModRegistry> {
  const registryPath = getRegistryPath();
  const oldPath = getOldRegistryPath();
  if ((await fs.exists(oldPath)) && !(await fs.exists(registryPath))) {
    await fs.ensureDir(path.dirname(registryPath));
    await fs.move(oldPath, registryPath);
  }
  const fallback: ModRegistry = {
    gameVersion: 'unknown',
    lastUpdated: new Date().toISOString(),
    installedMods: [],
  };
  return atomicReadJson<ModRegistry>(registryPath, fallback);
}

export async function writeRegistry(registry: ModRegistry): Promise<void> {
  registry.lastUpdated = new Date().toISOString();
  await atomicWriteJson(getRegistryPath(), registry);
}

export async function addMod(mod: InstalledMod): Promise<void> {
  const registry = await readRegistry();
  const existing = registry.installedMods.findIndex((m) => m.id === mod.id);
  if (existing >= 0) {
    registry.installedMods[existing] = mod;
  } else {
    registry.installedMods.push(mod);
  }
  await writeRegistry(registry);
}

export async function removeMod(modId: string): Promise<void> {
  const registry = await readRegistry();
  registry.installedMods = registry.installedMods.filter((m) => m.id !== modId);
  await writeRegistry(registry);
}

export async function setModEnabled(
  modId: string,
  enabled: boolean,
): Promise<void> {
  const registry = await readRegistry();
  const mod = registry.installedMods.find((m) => m.id === modId);
  if (mod) {
    mod.enabled = enabled;
    await writeRegistry(registry);
  }
}

export async function getInstalledMod(
  modId: string,
): Promise<InstalledMod | undefined> {
  return (await readRegistry()).installedMods.find((m) => m.id === modId);
}
