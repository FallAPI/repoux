import fs from 'fs-extra'
import path from 'path'

export async function atomicWriteJson<T>(filePath: string, data: T): Promise<void> {
  const tmpPath = `${filePath}.${Date.now()}.tmp`
  const dir = path.dirname(filePath)
  await fs.ensureDir(dir)
  await fs.writeJson(tmpPath, data, { spaces: 2 })
  await fs.rename(tmpPath, filePath)
}

export async function atomicReadJson<T>(
  filePath: string,
  fallback: T,
): Promise<T> {
  if (!(await fs.exists(filePath))) return fallback
  try {
    return (await fs.readJson(filePath)) as T
  } catch {
    return fallback
  }
}
