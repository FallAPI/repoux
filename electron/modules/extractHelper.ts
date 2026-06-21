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


export async function extractZipWithWorker(options: ExtractOptions): Promise<void> {
  const { zipPath, extractPath, modName, onProgress } = options;


  if (!(await fs.exists(zipPath))) {
    throw new Error('ZIP file not found');
  }


  const tempPath = path.join(os.tmpdir(), `repoux-extract-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.ensureDir(tempPath);

  try {
    onProgress?.({
      step: 'extracting',
      message: `Extracting ${modName}...`,
      percent: 0,
    });


    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    const totalEntries = entries.filter(e => !e.isDirectory).length;
    let extractedCount = 0;


    const YIELD_INTERVAL = 10;
    const PROGRESS_UPDATE_INTERVAL = 200;
    let lastProgressUpdate = Date.now();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      

      if (entry.isDirectory) continue;

  
      const entryName = entry.entryName;
      const parts = entryName.split('/');
      const relativePath = parts.length > 1 ? parts.slice(1).join('/') : entryName;
      
      if (!relativePath) continue;

      
      const destPath = path.join(tempPath, relativePath);
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, entry.getData());

      extractedCount++;

    
      if (extractedCount % YIELD_INTERVAL === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // Update progress with throttling
      const now = Date.now();
      if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL && totalEntries > 0) {
        lastProgressUpdate = now;
        const percent = Math.round((extractedCount / totalEntries) * 80); 
        onProgress?.({
          step: 'extracting',
          message: `Extracting ${modName}... (${extractedCount}/${totalEntries})`,
          percent,
        });
      }
    }


    onProgress?.({
      step: 'extracting',
      message: `Finalizing ${modName}...`,
      percent: 85,
    });

    await fs.ensureDir(extractPath);
    await fs.copy(tempPath, extractPath, { overwrite: true });


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

    await fs.remove(tempPath).catch(() => {});
  }
}
