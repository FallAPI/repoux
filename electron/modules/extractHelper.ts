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

/**
 * Resolves the path to the compiled extractWorker bundle.
 * electron-vite outputs it to the same directory as main (out/main/).
 */
function resolveWorkerPath(): string {
  const builtWorker = path.join(__dirname, 'extractWorker.js');
  if (fs.existsSync(builtWorker)) return builtWorker;

  // Dev-mode fallback (ts source alongside this file)
  return path.join(__dirname, 'extractWorker.ts');
}

/**
 * Extracts a ZIP archive using a dedicated worker thread so the main-process
 * event loop (and the Electron UI) is never blocked during extraction.
 *
 * Flow:
 *  1. Worker extracts into a temp folder and sends progress messages.
 *  2. Worker sends { type: 'complete' } when done — we resolve the Promise
 *     at that point (not on the 'exit' event) to avoid race conditions.
 *  3. After the Promise resolves, we copy the temp folder to the real
 *     destination and verify it is non-empty.
 *  4. Temp folder is always cleaned up in the finally block.
 */
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
    // ── Phase 1: extraction inside worker thread ───────────────────────────
    await runWorker(resolveWorkerPath(), {
      zipPath,
      extractPath,
      modName,
      useTempFolder: true,
      tempPath,
    }, onProgress);

    // ── Phase 2: move files to final destination ───────────────────────────
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

// ── Internal helper ──────────────────────────────────────────────────────────

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
          // Worker is done with extraction — resolve immediately.
          // We do NOT wait for the 'exit' event because it may fire before
          // all queued messages have been processed by this listener.
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
      // If we already resolved/rejected from a message, ignore this.
      if (settled) return;

      // Worker exited without sending 'complete' or 'error' — treat as error.
      if (code === 0) {
        // Exited cleanly but never sent 'complete' — resolve anyway so we
        // don't hang forever (e.g. empty zip with no file entries).
        settle(resolve);
      } else {
        settle(() => reject(new Error(`Extract worker exited with code ${code}`)));
      }
    });
  });
}
