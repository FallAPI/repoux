import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs-extra'

const execAsync = promisify(exec)

const REPO_STEAM_APP_ID = '3241660'
const REPO_EXE = 'REPO.exe'

async function getSteamPathFromRegistry(): Promise<string | null> {
  try {
    const result = await execAsync(
      'reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath',
    )
    const match = result.stdout.match(/SteamPath\s+REG_SZ\s+(.+)/)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}

async function getSteamLibraryPaths(steamPath: string): Promise<string[]> {
  const vdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf')
  const base = path.join(steamPath, 'steamapps')

  if (!(await fs.exists(vdfPath))) return [base]

  const content = await fs.readFile(vdfPath, 'utf-8')
  const matches = [...content.matchAll(/"path"\s+"([^"]+)"/g)]

  return [base, ...matches.map(m => path.join(m[1], 'steamapps'))]
}

async function findRepoInLibraries(libraries: string[]): Promise<string | null> {
  for (const lib of libraries) {
    const manifestPath = path.join(lib, `appmanifest_${REPO_STEAM_APP_ID}.acf`)
    if (await fs.exists(manifestPath)) {
      const content = await fs.readFile(manifestPath, 'utf-8')
      const match = content.match(/"installdir"\s+"([^"]+)"/)
      if (match) {
        const gamePath = path.join(lib, 'common', match[1])
        if (await fs.exists(path.join(gamePath, REPO_EXE))) {
          return gamePath
        }
      }
    }
  }
  return null
}

export async function detectGamePath(): Promise<string | null> {
  const steamPath = await getSteamPathFromRegistry()
  if (!steamPath) return null

  const libraries = await getSteamLibraryPaths(steamPath)
  return findRepoInLibraries(libraries)
}

export async function validateGamePath(gamePath: string): Promise<boolean> {
  return fs.exists(path.join(gamePath, REPO_EXE))
}
