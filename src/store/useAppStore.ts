import { create } from 'zustand'
import type {
  AppSettings,
  BepInExStatus,
  InstalledMod,
  ThunderstoreMod,
  InstallProgress,
  ProfileSummary,
  ModConflict
} from '../types'

interface AppState {
  settings: AppSettings | null
  bepinexStatus: BepInExStatus | null
  isInitialized: boolean

  installedMods: InstalledMod[]
  browseMods: ThunderstoreMod[]
  isLoadingBrowse: boolean
  searchQuery: string

  installProgress: InstallProgress | null
  installingModId: string | null
  updates: Record<string, { hasUpdate: boolean; latestVersion: string }>
  conflicts: ModConflict[]

  profiles: ProfileSummary[]
  activeProfile: string | null

  page: 'home' | 'browse' | 'installed' | 'settings'

  setPage: (page: AppState['page']) => void
  setSettings: (s: AppSettings) => void
  setBepInEx: (s: BepInExStatus) => void
  setInstalledMods: (mods: InstalledMod[]) => void
  setBrowseMods: (mods: ThunderstoreMod[]) => void
  setLoadingBrowse: (v: boolean) => void
  setSearchQuery: (q: string) => void
  setInstallProgress: (p: InstallProgress | null) => void
  setInstallingModId: (id: string | null) => void
  setUpdates: (u: Record<string, { hasUpdate: boolean; latestVersion: string }>) => void
  setConflicts: (c: ModConflict[]) => void
  setInitialized: (v: boolean) => void
  setProfiles: (profiles: ProfileSummary[]) => void
  setActiveProfile: (name: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  settings: null,
  bepinexStatus: null,
  isInitialized: false,
  installedMods: [],
  browseMods: [],
  isLoadingBrowse: false,
  searchQuery: '',
  installProgress: null,
  installingModId: null,
  updates: {},
  conflicts: [],
  profiles: [],
  activeProfile: null,
  page: 'home',

  setPage: (page) => set({ page }),
  setSettings: (settings) => set({ settings }),
  setBepInEx: (bepinexStatus) => set({ bepinexStatus }),
  setInstalledMods: (installedMods) => set({ installedMods }),
  setBrowseMods: (browseMods) => set({ browseMods }),
  setLoadingBrowse: (isLoadingBrowse) => set({ isLoadingBrowse }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setInstallProgress: (installProgress) => set({ installProgress }),
  setInstallingModId: (installingModId) => set({ installingModId }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setUpdates: (updates) => set({ updates }),
  setConflicts: (conflicts) => set({ conflicts }),
  setProfiles: (profiles) => set({ profiles }),
  setActiveProfile: (activeProfile) => set({ activeProfile })
}))
