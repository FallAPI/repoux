import path from 'path'
import fs from 'fs-extra'
import AdmZip from 'adm-zip'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'
import os from 'os'

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
    (await fs.exists(hookFile)) &&
    (await fs.exists(bepInExFolder)) &&
    (await fs.exists(pluginsFolder)) &&
    (await fs.exists(coreFolder))

  let version: string | null = null
  try {
    if (await fs.exists(coreFolder)) {
      const files = await fs.readdir(coreFolder)
      const bepInExDll = files.find((f) => f === 'BepInEx.dll')
      if (bepInExDll) version = '5.4.23.x'
    }
  } catch {
    // ignore
  }

  return {
    installed,
    version,
    pluginsPath: installed ? pluginsFolder : null,
  }
}

/**
 * Extracts a BepInEx ZIP archive without blocking the main-process event loop.
 *
 * AdmZip.getEntries() and entry.getData() are synchronous CPU operations.
 * We yield back to the event loop every YIELD_INTERVAL entries via
 * `setTimeout(resolve, 0)` so Electron can process IPC/OS messages between
 * bursts of work — preventing the "not responding" state during extraction.
 */
async function extractBepInExZip(
  zipPath: string,
  destDir: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()
  const fileEntries = entries.filter((e) => !e.isDirectory)
  const total = fileEntries.length

  // Yield to the event loop every N entries so the main process stays alive.
  const YIELD_INTERVAL = 5

  let done = 0
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]

    if (entry.isDirectory) continue

    const entryName = entry.entryName
    const parts = entryName.split('/')

    // BepInEx zips have a top-level folder — strip it.
    if (parts.length < 2) continue
    const relativePath = parts.slice(1).join('/')
    if (!relativePath) continue

    const destPath = path.join(destDir, relativePath)
    await fs.ensureDir(path.dirname(destPath))

    // getData() is synchronous but unavoidable with AdmZip.
    // We minimise its impact by yielding frequently.
    await fs.writeFile(destPath, entry.getData())

    done++

    // Yield every YIELD_INTERVAL files so IPC / OS events can be processed.
    if (done % YIELD_INTERVAL === 0) {
      onProgress?.(
        `Extracting BepInEx... (${done}/${total})`
      )
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }
}

export async function installBepInEx(
  gamePath: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  // Download to a temp folder outside the game directory so a crash or
  // cancellation doesn't leave a partial zip next to game files.
  const tmpDir = path.join(
    os.tmpdir(),
    `repoux-bepinex-${Date.now()}`
  )
  await fs.ensureDir(tmpDir)
  const tmpZip = path.join(tmpDir, '_bepinex_tmp.zip')

  try {
    onProgress?.('Downloading BepInEx...')

    const { default: got } = await import('got')

    const response = got.stream(BEPINEX_DOWNLOAD_URL, {
      headers: { 'User-Agent': 'REPO-Mod-Manager/1.0' },
      timeout: { request: 30000 },
    })

    await pipeline(response, createWriteStream(tmpZip))

    onProgress?.('Extracting BepInEx...')

    await extractBepInExZip(tmpZip, gamePath, onProgress)

    // Ensure required directories exist even if the zip didn't include them.
    await fs.ensureDir(path.join(gamePath, 'BepInEx', 'plugins'))
    await fs.ensureDir(path.join(gamePath, 'BepInEx', 'config'))

    onProgress?.('BepInEx installed successfully!')
  } finally {
    // Clean up temp directory regardless of success or failure.
    await fs.remove(tmpDir).catch(() => {})
  }
}
