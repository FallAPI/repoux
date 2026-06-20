import path from 'path'
import fs from 'fs-extra'
import { app } from 'electron'
import { atomicReadJson, atomicWriteJson } from './atomicFs'

export interface AppSettings {
  gamePath: string | null
  autoDetected: boolean
  lastLaunched: string | null
  theme: 'dark'
}

const DEFAULT_SETTINGS: AppSettings = {
  gamePath: null,
  autoDetected: false,
  lastLaunched: null,
  theme: 'dark'
}

const APP_DATA_FOLDER = process.env.APP_DATA_FOLDER || 'REPX'
const OLD_APP_DATA_FOLDER = process.env.OLD_APP_DATA_FOLDER || 'REPO-ModManager'

function getOldSettingsPath(): string {
  return path.join(app.getPath('userData'), OLD_APP_DATA_FOLDER, 'settings.json')
}

function getSettingsPath(): string {
  const dataDir = path.join(app.getPath('userData'), APP_DATA_FOLDER)
  return path.join(dataDir, 'settings.json')
}

function getSettingsDir(): string {
  return path.join(app.getPath('userData'), APP_DATA_FOLDER)
}

export async function readSettings(): Promise<AppSettings> {
  const settingsPath = getSettingsPath()
  const oldPath = getOldSettingsPath()
  if (await fs.exists(oldPath) && !(await fs.exists(settingsPath))) {
    await fs.ensureDir(getSettingsDir())
    await fs.move(oldPath, settingsPath)
    const parent = path.dirname(oldPath)
    try { await fs.rmdir(parent) } catch { /* ignore */ }
  }
  return atomicReadJson<AppSettings>(settingsPath, { ...DEFAULT_SETTINGS })
}

export async function writeSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await readSettings()
  const updated = { ...current, ...settings }
  await atomicWriteJson(getSettingsPath(), updated)
  return updated
}
