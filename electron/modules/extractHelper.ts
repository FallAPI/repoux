import path from 'path';
import fs from 'fs-extra';
import AdmZip from 'adm-zip';
import os from 'os';
import type { InstallProgress } from './modInstaller';

interface ExtractOptions {
  zipPath: string;
  extractPath: string;
  modName: string;
  onProgress?: (progress: InstallProgress) => void;
}

/**
 * Extract ZIP with antivirus workaround + async yield
 * Strategy: Extract to temp folder first, then move to final location
 * This avoids real-time antivirus scanning during extraction
 */
export async function extractZipWithWorker(options: ExtractOptions): Promise<void> {
  const { zipPath, extractPath, modName, onProgress } = options;

  // Validate zip exists
  if (!(await fs.exists(zipPath))) {
    throw new Error('ZIP file not found');
  }

  // Create temp folder for extraction (antivirus workaround)
  const tempPath = path.join(os.tmpdir(), `repoux-extract-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.ensureDir(tempPath);

  try {
    onProgress?.({
      step: 'extracting',
      message: `Extracting ${modName}...`,
      percent: 0,
    });

    // Load ZIP
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    const totalEntries = entries.filter(e => !e.isDirectory).length;
    let extractedCount = 0;

    // Extract to temp folder with async yield
    const YIELD_INTERVAL = 10;
    const PROGRESS_UPDATE_INTERVAL = 200;
    let lastProgressUpdate = Date.now();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      // Skip directories
      if (entry.isDirectory) continue;

      // Calculate relative path (strip first folder)
      const entryName = entry.entryName;
      const parts = entryName.split('/');
      const relativePath = parts.length > 1 ? parts.slice(1).join('/') : entryName;
      
      if (!relativePath) continue;

      // Write to temp folder (less antivirus scanning)
      const destPath = path.join(tempPath, relativePath);
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, entry.getData());

      extractedCount++;

      // Yield to event loop periodically
      if (extractedCount % YIELD_INTERVAL === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // Update progress with throttling
      const now = Date.now();
      if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL && totalEntries > 0) {
        lastProgressUpdate = now;
        const percent = Math.round((extractedCount / totalEntries) * 80); // 0-80% for extraction
        onProgress?.({
          step: 'extracting',
          message: `Extracting ${modName}... (${extractedCount}/${totalEntries})`,
          percent,
        });
      }
    }

    // Move from temp to final location (faster than write)
    onProgress?.({
      step: 'extracting',
      message: `Finalizing ${modName}...`,
      percent: 85,
    });

    await fs.ensureDir(extractPath);
    await fs.copy(tempPath, extractPath, { overwrite: true });

    // Verify extraction succeeded
    const finalFiles = await fs.readdir(extractPath);
    if (finalFiles.length === 0) {
      throw new Error('Extraction failed: final folder is empty');
    }

    onProgress?.({
      step: 'extracting',
      message: `Extracting ${modName}...`,
      percent: 100,
    });

  } finally {
    // Cleanup temp folder
    await fs.remove(tempPath).catch(() => {});
  }
}
