import { parentPort, workerData } from 'worker_threads';
import path from 'path';
import fs from 'fs-extra';
import AdmZip from 'adm-zip';

interface WorkerExtractData {
  zipPath: string;
  extractPath: string;
  modName: string;
  useTempFolder?: boolean;
  tempPath?: string;
}

async function extractWithWorker(): Promise<void> {
  const { zipPath, extractPath, modName, useTempFolder, tempPath } = workerData as WorkerExtractData;

  try {
    if (!parentPort) {
      throw new Error('No parent port available');
    }

    // Validate zip exists
    if (!(await fs.exists(zipPath))) {
      throw new Error('ZIP file not found');
    }

    // Use temp folder if enabled (antivirus workaround)
    const targetPath = (useTempFolder && tempPath) ? tempPath : extractPath;
    
    // Ensure target directory exists
    await fs.ensureDir(targetPath);

    // Load ZIP
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    const totalEntries = entries.filter(e => !e.isDirectory).length;
    let extractedCount = 0;

    // Extract files with progress updates
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

      // Write file to target path (temp or final)
      const destPath = path.join(targetPath, relativePath);
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, entry.getData());

      extractedCount++;

      // Yield to event loop periodically
      if (extractedCount % YIELD_INTERVAL === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // Send progress update to main thread
      const now = Date.now();
      if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL && totalEntries > 0) {
        lastProgressUpdate = now;
        const percent = Math.round((extractedCount / totalEntries) * 100);
        
        parentPort.postMessage({
          type: 'progress',
          data: {
            step: 'extracting',
            message: `Extracting ${modName}... (${extractedCount}/${totalEntries})`,
            percent,
            extractedCount,
            totalEntries,
          }
        });
      }
    }

    // Send completion message
    parentPort.postMessage({
      type: 'complete',
      data: {
        step: 'extracting',
        message: `Extracting ${modName}...`,
        percent: 100,
        extractedCount,
        totalEntries,
      }
    });

  } catch (error) {
    // Send error to main thread
    if (parentPort) {
      parentPort.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error during extraction',
      });
    }
  }
}

// Start extraction
extractWithWorker();
