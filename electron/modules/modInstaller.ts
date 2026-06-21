import path from 'path';
import fs from 'fs-extra';
import AdmZip from 'adm-zip';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import {
  type ThunderstoreMod,
  getLatestVersion,
  fetchAllMods,
} from './thunderstore';
import {
  addMod,
  removeMod,
  getInstalledMod,
  readRegistry,
  writeRegistry,
  type InstalledMod,
} from './modRegistry';
import { app } from 'electron';
import { extractZipWithWorker } from './extractHelper';

export interface InstallProgress {
  step: 'downloading' | 'extracting' | 'registering' | 'done' | 'error';
  message: string;
  percent?: number;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
}

export interface ModConflict {
  modA: string;
  modB: string;
  reason: string;
}

const CONFLICT_RULES: Array<{ a: string; b: string; reason: string }> = [
  { a: 'REPOLib', b: 'REPOLib-Redux', reason: 'REPOLib vs REPOLib-Redux' },
  {
    a: 'BepInExPack',
    b: 'BepInExPack-IL2CPP',
    reason: 'BepInExPack vs BepInExPack-IL2CPP',
  },
];

export async function checkConflicts(gamePath: string): Promise<ModConflict[]> {
  const registry = await readRegistry();
  const installed = registry.installedMods;
  const conflicts: ModConflict[] = [];

  const modIds = new Set(installed.map((m) => m.id));

  for (const [modA, modB, reason] of CONFLICT_RULES.flatMap((rule) => {
    if (modIds.has(rule.a) && modIds.has(rule.b))
      return [[rule.a, rule.b, rule.reason]];
    return [];
  })) {
    conflicts.push({ modA, modB, reason });
  }

  return conflicts;
}

async function assertNotInstalled(
  gamePath: string,
  candidate: { id: string; folder: string },
): Promise<void> {
  const registry = await readRegistry();
  const installed = registry.installedMods;

  const byId = installed.find((m) => m.id === candidate.id);
  if (byId) {
    throw new Error(`Mod ${candidate.id} sudah terinstall`);
  }

  const pluginsPath = path.join(gamePath, 'BepInEx', 'plugins');
  const targetPath = path.join(pluginsPath, candidate.folder);

  if (await fs.exists(targetPath)) {
    throw new Error(`Mod ${candidate.id} sudah terinstall (folder conflict)`);
  }

  const entries = await fs.readdir(pluginsPath);
  for (const f of entries) {
    const full = path.join(pluginsPath, f);
    if (f === candidate.folder && (await fs.stat(full)).isDirectory()) {
      throw new Error(`Mod ${candidate.id} sudah terinstall (folder conflict)`);
    }
  }
}

const activeControllers = new Map<string, AbortController>();

export function getActiveController(modId: string): AbortController | undefined {
  return activeControllers.get(modId);
}

export function registerController(modId: string, controller: AbortController): void {
  activeControllers.set(modId, controller);
}

export function clearController(modId: string): void {
  activeControllers.delete(modId);
}

export async function cancelInstall(modId: string): Promise<void> {
  const controller = activeControllers.get(modId);
  controller?.abort();
  activeControllers.delete(modId);
  await removeMod(modId).catch(() => {});
}

export async function installMod(
  gamePath: string,
  mod: ThunderstoreMod,
  onProgress?: (progress: InstallProgress) => void,
  signal?: AbortSignal,
): Promise<InstalledMod> {
  const controller = signal
    ? undefined
    : new AbortController();
  const effectiveSignal = signal ?? controller?.signal;
  if (controller) registerController(mod.full_name, controller);

  try {
    const version = getLatestVersion(mod);
    const modFolderName = `${mod.owner}-${mod.name}`;

    await assertNotInstalled(gamePath, { id: mod.full_name, folder: modFolderName });

    // Don't add placeholder to registry - mod will be added after successful installation
    // Progress is shown via Ghost Card in UI instead

    await resolveAndInstallDependencies(gamePath, mod, onProgress);

    return installModDirect(gamePath, mod, onProgress, effectiveSignal);
  } catch (error) {
    if (controller) clearController(mod.full_name);
    throw error;
  }
}

async function resolveAndInstallDependencies(
  gamePath: string,
  mod: ThunderstoreMod,
  onProgress?: (progress: InstallProgress) => void,
  visited: Set<string> = new Set(),
  signal?: AbortSignal,
): Promise<void> {
  if (visited.has(mod.full_name)) return;
  visited.add(mod.full_name);

  const version = getLatestVersion(mod);
  const dependencies = version.dependencies || [];

  onProgress?.({
    step: 'registering',
    message: `Checking ${mod.name} dependencies...`,
    percent: undefined,
  });

  const registry = await readRegistry();
  const installed = registry.installedMods;
  const installedMap = new Map(installed.map((m) => [m.id, m]));
  const missing: ThunderstoreMod[] = [];

  for (const depFullName of dependencies) {
    if (installedMap.has(depFullName)) continue;
    const allMods = await fetchAllMods();
    const depMod = allMods.find((m) => m.full_name === depFullName);
    if (!depMod) continue;
    missing.push(depMod);
  }

  for (const dep of missing) {
    if (installedMap.has(dep.full_name)) continue;
    await resolveAndInstallDependencies(
      gamePath,
      dep,
      onProgress,
      new Set(visited),
      signal,
    );
    await installModDirect(gamePath, dep, onProgress, signal);
  }
}

async function installModDirect(
  gamePath: string,
  mod: ThunderstoreMod,
  onProgress?: (progress: InstallProgress) => void,
  signal?: AbortSignal,
): Promise<InstalledMod> {
  const version = getLatestVersion(mod);
  const pluginsPath = path.join(gamePath, 'BepInEx', 'plugins');
  const modFolderName = `${mod.owner}-${mod.name}`;
  const modInstallPath = path.join(pluginsPath, modFolderName);
  const tmpZip = path.join(pluginsPath, `_tmp_${modFolderName}.zip`);

  try {
    const { default: got } = await import('got');
    const total = version.file_size || 0;
    let bytesReceived = 0;

    const stream = got.stream(version.download_url, {
      headers: { 'User-Agent': 'REPX/1.0' },
      signal,
    });

    let lastProgressTime = 0;
    const PROGRESS_THROTTLE_MS = 200;

    stream.on('data', (chunk: Buffer) => {
      bytesReceived += chunk.length;
      const now = Date.now();
      if (total > 0 && now - lastProgressTime >= PROGRESS_THROTTLE_MS) {
        lastProgressTime = now;
        onProgress?.({
          step: 'downloading',
          message: `Downloading ${mod.name}...`,
          percent: Math.round((bytesReceived / total) * 100),
        });
      }
    });

    await pipeline(stream, createWriteStream(tmpZip));

    await fs.ensureDir(modInstallPath);
    
    onProgress?.({
      step: 'extracting',
      message: `Extracting ${mod.name}...`,
      percent: 0,
    });

    // Use worker thread for extraction to prevent UI blocking
    await extractZipWithWorker({
      zipPath: tmpZip,
      extractPath: modInstallPath,
      modName: mod.name,
      onProgress,
    });

    // Verify extraction succeeded before registering mod
    const files = await fs.readdir(modInstallPath);
    if (files.length === 0) {
      throw new Error('Extraction failed: mod folder is empty');
    }

    const installedMod: InstalledMod = {
      id: mod.full_name,
      name: mod.name,
      version: version.version_number,
      author: mod.owner,
      description: version.description,
      installPath: modFolderName,
      enabled: true,
      installedAt: new Date().toISOString(),
      status: 'installed',
      dependencies: version.dependencies,
      sizeMB: version.file_size
        ? Math.round(version.file_size / 1024 / 1024)
        : undefined,
      iconUrl: version.icon,
    };

    await addMod(installedMod);

    return installedMod;
  } catch (error) {
    await removeMod(mod.full_name).catch(() => {});
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }
    throw error;
  } finally {
    await fs.remove(tmpZip).catch(() => {});
  }
}

export async function uninstallMod(
  gamePath: string,
  modId: string,
): Promise<void> {
  const mod = await getInstalledMod(modId);
  if (!mod) throw new Error(`Mod ${modId} not found in registry`);

  const modPath = path.join(gamePath, 'BepInEx', 'plugins', mod.installPath);
  await fs.remove(modPath);
  await removeMod(modId);
}

export async function toggleModEnabled(
  gamePath: string,
  modId: string,
  enabled: boolean,
): Promise<void> {
  const mod = await getInstalledMod(modId);
  if (!mod) throw new Error(`Mod ${modId} not found in registry`);

  const modPath = path.join(gamePath, 'BepInEx', 'plugins', mod.installPath);
  if (!(await fs.exists(modPath))) return;

  const files = await fs.readdir(modPath);

  for (const file of files) {
    const filePath = path.join(modPath, file);

    if (enabled && file.endsWith('.dll.disabled')) {
      await fs.rename(filePath, filePath.replace('.dll.disabled', '.dll'));
    } else if (!enabled && file.endsWith('.dll')) {
      await fs.rename(filePath, filePath + '.disabled');
    }
  }
}

function zipHasDll(zipPath: string): boolean {
  const zip = new AdmZip(zipPath);
  return zip
    .getEntries()
    .some(
      (entry) =>
        !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.dll'),
    );
}

export async function installModFromZip(
  gamePath: string,
  zipPath: string,
  onProgress?: (progress: InstallProgress) => void,
): Promise<InstalledMod> {
  if (!(await fs.exists(zipPath))) {
    throw new Error('Zip file not found');
  }

  onProgress?.({
    step: 'registering',
    message: 'Validating zip...',
    percent: 10,
  });

  if (!zipHasDll(zipPath)) {
    throw new Error('Zip does not contain any .dll file');
  }

  const pluginsPath = path.join(gamePath, 'BepInEx', 'plugins');
  const modFolderName = path.basename(zipPath, '.zip');

  await assertNotInstalled(gamePath, { id: modFolderName, folder: modFolderName });

  onProgress?.({
    step: 'extracting',
    message: `Installing ${modFolderName}...`,
    percent: 50,
  });

  await fs.ensureDir(pluginsPath);
  const modInstallPath = path.join(pluginsPath, modFolderName);

  // Use worker thread for extraction
  await extractZipWithWorker({
    zipPath: zipPath,
    extractPath: modInstallPath,
    modName: modFolderName,
    onProgress: (progress) => {
      // Adjust progress to start from 50%
      if (progress.percent !== undefined) {
        const adjustedPercent = 50 + Math.round(progress.percent * 0.4);
        onProgress?.({ ...progress, percent: adjustedPercent });
      } else {
        onProgress?.(progress);
      }
    },
  });

  const version = '1.0.0'; // Default version for local zips
  const installedMod: InstalledMod = {
    id: modFolderName,
    name: modFolderName,
    version,
    author: 'Local',
    description: 'Installed from local zip',
    installPath: modFolderName,
    enabled: true,
    installedAt: new Date().toISOString(),
    dependencies: [],
    status: 'installed',
  };

  await addMod(installedMod);

  onProgress?.({
    step: 'done',
    message: `${modFolderName} installed!`,
    percent: 100,
  });

  return installedMod;
}

export async function scanPluginsFolder(gamePath: string): Promise<InstalledMod[]> {
  const pluginsPath = path.join(gamePath, 'BepInEx', 'plugins');
  if (!(await fs.exists(pluginsPath))) return [];

  const entries = await fs.readdir(pluginsPath);
  const registry = await readRegistry();
  const existing = new Set(registry.installedMods.map(m => m.installPath));

  const newMods: InstalledMod[] = [];
  for (const entry of entries) {
    const full = path.join(pluginsPath, entry);
    if (!(await fs.stat(full)).isDirectory()) continue;
    if (existing.has(entry)) continue;

    const parts = entry.split('-');
    const author = parts[0] || 'Local';
    const name = parts.slice(1).join('-') || entry;

    const mod: InstalledMod = {
      id: entry,
      name,
      version: 'unknown',
      author,
      description: 'Recovered from folder',
      installPath: entry,
      enabled: true,
      installedAt: new Date().toISOString(),
      dependencies: [],
      status: 'installed',
    };

    newMods.push(mod);
    registry.installedMods.push(mod);
  }

  if (!newMods.length) return [];

  await writeRegistry(registry);
  return newMods;
}

export async function checkUpdates(
  gamePath: string,
): Promise<Record<string, UpdateInfo>> {
  const registry = await readRegistry();
  const installedMods = registry.installedMods;
  const allMods = await fetchAllMods();
  const updates: Record<string, UpdateInfo> = {};

  for (const installed of installedMods) {
    const remote = allMods.find((m) => m.full_name === installed.id);
    if (!remote) continue;
    const latest = getLatestVersion(remote);
    if (latest.version_number !== installed.version) {
      updates[installed.id] = {
        hasUpdate: true,
        latestVersion: latest.version_number,
      };
    }
  }

  return updates;
}
