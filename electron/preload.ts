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
  onProgress: (cb: (data: { step: string; message: string; percent?: number }) => void) => {
    ipcRenderer.on('install:progress', (_e, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('install:progress')
  },

  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
})
