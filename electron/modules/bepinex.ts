import path from 'path'
import fs from 'fs-extra'
import AdmZip from 'adm-zip'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'

const BEPINEX_DOWNLOAD_URL =
  'https://thunderstore.io/package/download/BepInEx/BepInExPack/5.4.2100/'

export interface BepInExStatus {
  installed: boolean
  version: string | null
  pluginsPath: string | null
}

export async function checkBepInEx(gamePath: string): Promise<BepInExStatus> {
  const hookFile = path.join(gamePath, 'winhttp.dll')
  const bepInExFolder = path.join(gamePath, 'BepInEx')
  const pluginsFolder = path.join(bepInExFolder, 'plugins')
  const coreFolder = path.join(bepInExFolder, 'core')

  const installed =
    await fs.exists(hookFile) &&
    await fs.exists(bepInExFolder) &&
    await fs.exists(pluginsFolder) &&
    await fs.exists(coreFolder)

  let version: string | null = null
  try {
    if (await fs.exists(coreFolder)) {
      const files = await fs.readdir(coreFolder)
      const bepInExDll = files.find(f => f === 'BepInEx.dll')
      if (bepInExDll) version = '5.4.23.x'
    }
  } catch {
    // ignore
  }

  return {
    installed,
    version,
    pluginsPath: installed ? pluginsFolder : null
  }
}

export async function installBepInEx(
  gamePath: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  const tmpZip = path.join(gamePath, '_bepinex_tmp.zip')

  try {
    onProgress?.('Downloading BepInEx...')

    const { default: got } = await import('got')

    const response = got.stream(BEPINEX_DOWNLOAD_URL, {
      headers: { 'User-Agent': 'REPO-Mod-Manager/1.0' }
    })

    await pipeline(response, createWriteStream(tmpZip))

    onProgress?.('Extracting BepInEx...')

    const zip = new AdmZip(tmpZip)
    const entries = zip.getEntries()

    for (const entry of entries) {
      if (entry.isDirectory) continue

      const entryName = entry.entryName
      const parts = entryName.split('/')
      if (parts.length < 2) continue

      const relativePath = parts.slice(1).join('/')
      if (!relativePath) continue

      const destPath = path.join(gamePath, relativePath)
      await fs.ensureDir(path.dirname(destPath))
      await fs.writeFile(destPath, entry.getData())
    }

    await fs.ensureDir(path.join(gamePath, 'BepInEx', 'plugins'))
    await fs.ensureDir(path.join(gamePath, 'BepInEx', 'config'))

    onProgress?.('BepInEx installed successfully!')
  } finally {
    await fs.remove(tmpZip).catch(() => {})
  }
}
