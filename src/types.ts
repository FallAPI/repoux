export interface InstalledMod {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  installPath: string;
  enabled: boolean;
  installedAt: string;
  status: InstallStatus;
  dependencies: string[];
  sizeMB?: number;
  iconUrl?: string;
}

export interface ThunderstoreVersion {
  name: string;
  full_name: string;
  description: string;
  icon: string;
  version_number: string;
  dependencies: string[];
  download_url: string;
  downloads: number;
  date_created: string;
  file_size: number;
}

export interface ThunderstoreMod {
  name: string;
  full_name: string;
  owner: string;
  package_url: string;
  date_created: string;
  date_updated: string;
  rating_score: number;
  is_pinned: boolean;
  is_deprecated: boolean;
  categories: string[];
  versions: ThunderstoreVersion[];
}

export interface ProfileSummary {
  profileName: string;
  modCount: number;
}

export interface ModProfile {
  profileName: string;
  mods: string[];
}

export interface AppSettings {
  gamePath: string | null
  autoDetected: boolean
  lastLaunched: string | null
  theme: 'dark'
  activeProfile?: string | null
}

export type InstallStatus = 'installed' | 'downloading' | 'extracting'

export interface BepInExStatus {
  installed: boolean;
  version: string | null;
  pluginsPath: string | null;
}

export interface ModConflict {
  modA: string;
  modB: string;
  reason: string;
}

export interface InstallProgress {
  step: 'downloading' | 'extracting' | 'registering' | 'done' | 'error';
  message: string;
  percent?: number;
}

declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<AppSettings>;
      setGamePath: (path: string) => Promise<AppSettings>;
      detectGamePath: () => Promise<string | null>;
      validateGamePath: (path: string) => Promise<boolean>;
      browseForGamePath: () => Promise<string | null>;
      checkBepInEx: () => Promise<BepInExStatus>;
      installBepInEx: () => Promise<BepInExStatus>;
      getInstalledMods: () => Promise<InstalledMod[]>;
      fetchMods: () => Promise<ThunderstoreMod[]>;
      searchMods: (query: string) => Promise<ThunderstoreMod[]>;
      installMod: (modFullName: string) => Promise<InstalledMod>;
      installModFromZip: (zipPath: string) => Promise<InstalledMod>;
      uninstallMod: (modId: string) => Promise<boolean>;
      toggleMod: (modId: string, enabled: boolean) => Promise<boolean>;
      launchGame: () => Promise<boolean>;
      onProgress: (cb: (data: InstallProgress) => void) => () => void;
      browseForZip: () => Promise<string | null>;
      checkUpdates: () => Promise<
        Record<string, { hasUpdate: boolean; latestVersion: string }>
      >;
    checkConflicts: () => Promise<ModConflict[]>;
    cancelInstall: (modId: string) => Promise<boolean>;
    };
  }
}
