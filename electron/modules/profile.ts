import path from 'path';
import fs from 'fs-extra';
import { app } from 'electron';
import { readRegistry, toggleModEnabled } from './modRegistry';

export interface ModProfile {
  profileName: string;
  mods: string[];
}

export interface ProfileSummary {
  profileName: string;
  modCount: number;
}

function getProfilesDir(): string {
  const dir = path.join(app.getPath('userData'), 'REPO-ModManager', 'profiles');
  fs.ensureDirSync(dir);
  return dir;
}

function getProfilePath(profileName: string): string {
  const sanitized = profileName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getProfilesDir(), `${sanitized}.json`);
}

export function getProfiles(): ModProfile[] {
  const dir = getProfilesDir();
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const profiles: ModProfile[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = fs.readJsonSync(path.join(dir, file)) as ModProfile;
      if (data.profileName && Array.isArray(data.mods)) {
        profiles.push(data);
      }
    } catch {
      // skip corrupted profiles
    }
  }

  return profiles.sort((a, b) => a.profileName.localeCompare(b.profileName));
}

export function saveProfileImpl(profile: ModProfile): void {
  if (!profile.profileName.trim()) throw new Error('Profile name is required');
  fs.writeJsonSync(getProfilePath(profile.profileName), profile, { spaces: 2 });
}

export function loadProfileImpl(profileName: string): ModProfile | null {
  const fp = getProfilePath(profileName);
  if (!fs.existsSync(fp)) return null;
  return fs.readJsonSync(fp) as ModProfile;
}

export function deleteProfileImpl(profileName: string): boolean {
  const fp = getProfilePath(profileName);
  if (!fs.existsSync(fp)) return false;
  fs.removeSync(fp);
  return true;
}

export function applyProfileImpl(profile: ModProfile, gamePath: string): void {
  const registry = readRegistry();
  const installedMap = new Map(registry.installedMods.map((m) => [m.id, m]));

  const targetEnabled = new Set(profile.mods);
  for (const modId of targetEnabled) {
    const mod = installedMap.get(modId);
    if (mod && !mod.enabled) {
      toggleModEnabled(gamePath, mod.id, true);
    }
  }

  for (const [modId, mod] of installedMap) {
    if (!targetEnabled.has(modId) && mod.enabled) {
      toggleModEnabled(gamePath, mod.id, false);
    }
  }
}

export async function getProfileList(): Promise<ProfileSummary[]> {
  const profiles = getProfiles();
  return profiles.map((p) => ({
    profileName: p.profileName,
    modCount: p.mods.length,
  }));
}

export async function saveProfile(profile: ModProfile): Promise<void> {
  saveProfileImpl(profile);
}

export async function loadProfile(
  profileName: string,
): Promise<ModProfile | null> {
  return loadProfileImpl(profileName);
}

export async function deleteProfile(profileName: string): Promise<boolean> {
  return deleteProfileImpl(profileName);
}

export async function applyProfile(
  profileName: string,
  gamePath: string,
): Promise<void> {
  const profile = loadProfileImpl(profileName);
  if (!profile) throw new Error('Profile not found');
  applyProfileImpl(profile, gamePath);
}

export async function createProfileFromCurrent(
  profileName: string,
): Promise<void> {
  const registry = readRegistry();
  const enabledMods = registry.installedMods
    .filter((m) => m.enabled)
    .map((m) => m.id);
  saveProfileImpl({ profileName, mods: enabledMods });
}
