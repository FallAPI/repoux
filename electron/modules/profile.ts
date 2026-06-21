import path from 'path';
import fs from 'fs-extra';
import { app } from 'electron';
import { readRegistry, setModEnabled } from './modRegistry';

export interface ModProfile {
  profileName: string;
  mods: string[];
}

export interface ProfileSummary {
  profileName: string;
  modCount: number;
}

function getProfilesDir(): string {
  return path.join(app.getPath('userData'), 'REPO-ModManager', 'profiles');
}

function getProfilePath(profileName: string): string {
  const sanitized = profileName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getProfilesDir(), `${sanitized}.json`);
}

// ─── Async helpers ───────────────────────────────────────────────────────────

async function ensureProfilesDir(): Promise<void> {
  await fs.ensureDir(getProfilesDir());
}

async function getProfiles(): Promise<ModProfile[]> {
  const dir = getProfilesDir();
  await fs.ensureDir(dir);

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }

  const profiles: ModProfile[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = (await fs.readJson(path.join(dir, file))) as ModProfile;
      if (data.profileName && Array.isArray(data.mods)) {
        profiles.push(data);
      }
    } catch {
      // skip corrupted profiles
    }
  }

  return profiles.sort((a, b) => a.profileName.localeCompare(b.profileName));
}

// ─── Exported functions (all async) ─────────────────────────────────────────

export async function getProfileList(): Promise<ProfileSummary[]> {
  const profiles = await getProfiles();
  return profiles.map((p) => ({
    profileName: p.profileName,
    modCount: p.mods.length,
  }));
}

export async function saveProfile(profile: ModProfile): Promise<void> {
  if (!profile.profileName.trim()) throw new Error('Profile name is required');
  await ensureProfilesDir();
  await fs.writeJson(getProfilePath(profile.profileName), profile, { spaces: 2 });
}

export async function loadProfile(profileName: string): Promise<ModProfile | null> {
  const fp = getProfilePath(profileName);
  if (!(await fs.exists(fp))) return null;
  return fs.readJson(fp) as Promise<ModProfile>;
}

export async function deleteProfile(profileName: string): Promise<boolean> {
  const fp = getProfilePath(profileName);
  if (!(await fs.exists(fp))) return false;
  await fs.remove(fp);
  return true;
}

export async function applyProfile(profileName: string, gamePath: string): Promise<void> {
  const profile = await loadProfile(profileName);
  if (!profile) throw new Error('Profile not found');

  // readRegistry is async — await it properly
  const registry = await readRegistry();
  const installedMap = new Map(registry.installedMods.map((m) => [m.id, m]));
  const targetEnabled = new Set(profile.mods);

  const toggleTasks: Promise<void>[] = [];

  for (const modId of targetEnabled) {
    const mod = installedMap.get(modId);
    if (mod && !mod.enabled) {
      toggleTasks.push(setModEnabled(modId, true));
    }
  }

  for (const [modId, mod] of installedMap) {
    if (!targetEnabled.has(modId) && mod.enabled) {
      toggleTasks.push(setModEnabled(modId, false));
    }
  }

  // Run all toggle operations in parallel for speed
  await Promise.all(toggleTasks);
}

export async function createProfileFromCurrent(profileName: string): Promise<void> {
  const registry = await readRegistry();
  const enabledMods = registry.installedMods
    .filter((m) => m.enabled)
    .map((m) => m.id);
  await saveProfile({ profileName, mods: enabledMods });
}
