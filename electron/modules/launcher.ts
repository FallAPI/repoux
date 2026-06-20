import path from 'path'
import { spawn } from 'child_process'
import fs from 'fs-extra'
import { writeSettings } from './settings'

export async function launchGame(gamePath: string): Promise<void> {
  const exePath = path.join(gamePath, 'REPO.exe')

  if (!(await fs.exists(exePath))) {
    throw new Error(`REPO.exe not found at: ${exePath}`)
  }

  const child = spawn(exePath, [], {
    cwd: gamePath,
    detached: true,
    stdio: 'ignore'
  })

  child.unref()

  await writeSettings({ lastLaunched: new Date().toISOString() })
}
