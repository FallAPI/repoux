import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { Worker } from 'worker_threads';
import type { InstallProgress } from './modInstaller';

interface ExtractOptions {
  zipPath: string;
  extractPath: string;
  modName: string;
  onProgress?: (progress: InstallProgress) => void;
}


function resolveWorkerPath(): string {
  const builtWorker = path.join(__dirname, 'extractWorker.js');
  if (fs.existsSync(builtWorker)) return builtWorker;

  return path.join(__dirname, 'extractWorker.ts');
}

export async function extractZipWithWorker(options: ExtractOptions): Promise<void> {
  const { zipPath, extractPath, modName, onProgress } = options;

  if (!(await fs.exists(zipPath))) {
    throw new Error('ZIP file not found');
  }

  const tempPath = path.join(
    os.tmpdir(),
    `repoux-extract-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.ensureDir(tempPath);

  try {
   
    await runWorker(resolveWorkerPath(), {
      zipPath,
      extractPath,
      modName,
      useTempFolder: true,
      tempPath,
    }, onProgress);

  
    onProgress?.({
      step: 'extracting',
      message: `Finalizing ${modName}...`,
      percent: 90,
    });

    await fs.ensureDir(extractPath);
    await fs.copy(tempPath, extractPath, { overwrite: true });

    const finalFiles = await fs.readdir(extractPath);
    if (finalFiles.length === 0) {
      throw new Error('Extraction failed: destination folder is empty after copy');
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



interface WorkerData {
  zipPath: string;
  extractPath: string;
  modName: string;
  useTempFolder: boolean;
  tempPath: string;
}

type WorkerMessage =
  | { type: 'progress'; data: InstallProgress }
  | { type: 'complete'; data: InstallProgress }
  | { type: 'error'; error: string };

function runWorker(
  workerPath: string,
  data: WorkerData,
  onProgress?: (p: InstallProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const execArgv = workerPath.endsWith('.ts')
      ? ['--require', 'ts-node/register']
      : [];

    const worker = new Worker(workerPath, {
      workerData: data,
      execArgv,
    });

    let settled = false;

    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      fn();
    }

    worker.on('message', (msg: WorkerMessage) => {
      switch (msg.type) {
        case 'progress':
          onProgress?.(msg.data);
          break;

        case 'complete':

          settle(resolve);
          break;

        case 'error':
          settle(() => reject(new Error(msg.error ?? 'Worker extraction failed')));
          break;
      }
    });

    worker.on('error', (err) => {
      settle(() => reject(err));
    });

    worker.on('exit', (code) => {
     
      if (settled) return;

      if (code === 0) {

        settle(resolve);
      } else {
        settle(() => reject(new Error(`Extract worker exited with code ${code}`)));
      }
    });
  });
}
