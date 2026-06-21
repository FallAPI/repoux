import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setGamePath: (gamePath: string) => ipcRenderer.invoke('settings:setGamePath', gamePath),
  detectGamePath: () => ipcRenderer.invoke('game:detect'),
  validateGamePath: (p: string) => ipcRenderer.invoke('game:validate', p),
  browseForGamePath: () => ipcRenderer.invoke('game:browse'),
  browseForZip: () => ipcRenderer.invoke('game:browseZip'),
  checkBepInEx: () => ipcRenderer.invoke('bepinex:check'),
  installBepInEx: () => ipcRenderer.invoke('bepinex:install'),
  getInstalledMods: () => ipcRenderer.invoke('mods:getInstalled'),
  fetchMods: () => ipcRenderer.invoke('thunderstore:fetchAll'),
  searchMods: (query: string) => ipcRenderer.invoke('thunderstore:search', query),
  installMod: (modFullName: string) => ipcRenderer.invoke('mod:install', modFullName),
  installModFromZip: (zipPath: string) => ipcRenderer.invoke('mod:installFromZip', zipPath),
  uninstallMod: (modId: string) => ipcRenderer.invoke('mod:uninstall', modId),
  toggleMod: (modId: string, enabled: boolean) => ipcRenderer.invoke('mod:toggle', modId, enabled),
  launchGame: () => ipcRenderer.invoke('game:launch'),
  checkUpdates: () => ipcRenderer.invoke('mod:checkUpdates'),
  checkConflicts: () => ipcRenderer.invoke('mod:checkConflicts'),
  cancelInstall: (modId: string) => ipcRenderer.invoke('mod:cancel', modId),

  // Profile management
  getProfiles: () => ipcRenderer.invoke('profile:getList'),
  saveProfile: (profile: { profileName: string; mods: string[] }) =>
    ipcRenderer.invoke('profile:save', profile),
  loadProfile: (profileName: string) => ipcRenderer.invoke('profile:load', profileName),
  deleteProfile: (profileName: string) => ipcRenderer.invoke('profile:delete', profileName),
  applyProfile: (profileName: string) => ipcRenderer.invoke('profile:apply', profileName),
  createProfileFromCurrent: (profileName: string) =>
    ipcRenderer.invoke('profile:createFromCurrent', profileName),

  /**
   * Subscribe to install progress events.
   *
   * Returns a cleanup function that removes ONLY the registered handler,
   * so multiple concurrent subscriptions (e.g. different components) do not
   * interfere with each other.
   */
  onProgress: (cb: (data: { step: string; message: string; percent?: number }) => void) => {
    // Wrap in a named function so we can remove exactly this listener later.
    const handler = (_event: Electron.IpcRendererEvent, data: { step: string; message: string; percent?: number }) => {
      cb(data)
    }
    ipcRenderer.on('install:progress', handler)
    // Return a cleanup function that only removes this specific handler.
    return () => ipcRenderer.removeListener('install:progress', handler)
  },

  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
})
