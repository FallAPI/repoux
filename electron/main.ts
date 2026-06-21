import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { detectGamePath, validateGamePath } from './modules/gameDetector';
import { checkBepInEx, installBepInEx } from './modules/bepinex';
import { readRegistry, setModEnabled } from './modules/modRegistry';
import { fetchAllMods, searchMods } from './modules/thunderstore';
import {
  installMod,
  installModFromZip,
  uninstallMod,
  toggleModEnabled,
  checkUpdates,
  checkConflicts,
  cancelInstall,
  scanPluginsFolder,
} from './modules/modInstaller';
import { launchGame } from './modules/launcher';
import { readSettings, writeSettings } from './modules/settings';
import {
  getProfileList,
  saveProfile,
  loadProfile,
  deleteProfile,
  applyProfile,
  createProfileFromCurrent,
} from './modules/profile';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0f',
    frame: false, 
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  registerIpcHandlers();
  registerWindowControls();
});

function registerWindowControls(): void {
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

async function registerIpcHandlers(): Promise<void> {
  // Settings
  ipcMain.handle('settings:get', async () => readSettings());

  ipcMain.handle('settings:setGamePath', async (_e, gamePath: string) => {
    return writeSettings({ gamePath, autoDetected: false });
  });

  // Game Detection
  ipcMain.handle('game:detect', async () => {
    const detected = await detectGamePath();
    if (detected)
      await writeSettings({ gamePath: detected, autoDetected: true });
    return detected;
  });

  ipcMain.handle('game:validate', async (_e, gamePath: string) => {
    return validateGamePath(gamePath);
  });

  ipcMain.handle('game:browse', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select REPO game folder',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const selected = result.filePaths[0];
    const valid = await validateGamePath(selected);
    if (valid) await writeSettings({ gamePath: selected, autoDetected: false });
    return valid ? selected : null;
  });

  ipcMain.handle('game:browseZip', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select mod zip file',
      properties: ['openFile'],
      filters: [{ name: 'Zip files', extensions: ['zip'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  // BepInEx
  ipcMain.handle('bepinex:check', async () => {
    const settings = await readSettings();
    if (!settings.gamePath)
      return { installed: false, version: null, pluginsPath: null };
    return checkBepInEx(settings.gamePath);
  });

  ipcMain.handle('bepinex:install', async () => {
    const settings = await readSettings();
    if (!settings.gamePath) throw new Error('Game path not set');
    await installBepInEx(settings.gamePath, (msg) => {
      mainWindow?.webContents.send('install:progress', {
        step: 'downloading',
        message: msg,
      });
    });
    return checkBepInEx(settings.gamePath);
  });


  ipcMain.handle('mods:getInstalled', async () => {
    const settings = await readSettings();
    if (settings.gamePath) {
      await scanPluginsFolder(settings.gamePath);
    }
    return (await readRegistry()).installedMods;
  });


  ipcMain.handle('thunderstore:fetchAll', async () => fetchAllMods());

  ipcMain.handle('thunderstore:search', async (_e, query: string) =>
    searchMods(query),
  );

  
  ipcMain.handle('mod:install', async (_e, modFullName: string) => {
    const settings = await readSettings();
    if (!settings.gamePath) throw new Error('Game path not set');

    const allMods = await fetchAllMods();
    const mod = allMods.find((m) => m.full_name === modFullName);
    if (!mod) throw new Error(`Mod not found: ${modFullName}`);

    return installMod(settings.gamePath, mod, (progress) => {
      mainWindow?.webContents.send('install:progress', progress);
    });
  });

  ipcMain.handle('mod:cancel', async (_e, modFullName: string) => {
    await cancelInstall(modFullName);
    return true;
  });

  ipcMain.handle('mod:installFromZip', async (_e, zipPath: string) => {
    const settings = await readSettings();
    if (!settings.gamePath) throw new Error('Game path not set');
    return installModFromZip(settings.gamePath, zipPath, (progress) => {
      mainWindow?.webContents.send('install:progress', progress);
    });
  });

  ipcMain.handle('mod:uninstall', async (_e, modId: string) => {
    const settings = await readSettings();
    if (!settings.gamePath) throw new Error('Game path not set');
    await uninstallMod(settings.gamePath, modId);
    return true;
  });

  ipcMain.handle('mod:toggle', async (_e, modId: string, enabled: boolean) => {
    const settings = await readSettings();
    if (!settings.gamePath) throw new Error('Game path not set');
    await toggleModEnabled(settings.gamePath, modId, enabled);
    await setModEnabled(modId, enabled);
    return true;
  });

  ipcMain.handle('mod:checkUpdates', async () => {
    const settings = await readSettings();
    if (!settings.gamePath) return {};
    return checkUpdates(settings.gamePath);
  });

  ipcMain.handle('mod:checkConflicts', async () => {
    const settings = await readSettings();
    if (!settings.gamePath) return [];
    return checkConflicts(settings.gamePath);
  });

  // Profiles
  ipcMain.handle('profile:getList', async () => getProfileList());

  ipcMain.handle('profile:save', async (_e, profile: { profileName: string; mods: string[] }) =>
    saveProfile(profile)
  );

  ipcMain.handle('profile:load', async (_e, profileName: string) =>
    loadProfile(profileName)
  );

  ipcMain.handle('profile:delete', async (_e, profileName: string) =>
    deleteProfile(profileName)
  );

  ipcMain.handle('profile:apply', async (_e, profileName: string) => {
    const settings = await readSettings();
    if (!settings.gamePath) throw new Error('Game path not set');
    return applyProfile(profileName, settings.gamePath);
  });

  ipcMain.handle('profile:createFromCurrent', async (_e, profileName: string) =>
    createProfileFromCurrent(profileName)
  );

 
  ipcMain.handle('game:launch', async () => {
    const settings = await readSettings();
    if (!settings.gamePath) throw new Error('Game path not set');
    launchGame(settings.gamePath);
    return true;
  });
}
