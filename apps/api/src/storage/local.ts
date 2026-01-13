import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { StorageBackend } from './types.js';

export class LocalStorage implements StorageBackend {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private getStorageKey(id: string): string {
    return createHash('sha256').update(id).digest('hex');
  }

  private getFilePath(storageKey: string): string {
    return join(this.baseDir, storageKey);
  }

  async put(id: string, bytes: Buffer): Promise<{ storageKey: string }> {
    const storageKey = this.getStorageKey(id);
    const filePath = this.getFilePath(storageKey);
    const tempPath = `${filePath}.tmp`;

    // Ensure directory exists
    await fs.mkdir(dirname(filePath), { recursive: true });

    // Atomic write: write to temp file then rename
    await fs.writeFile(tempPath, bytes);
    await fs.rename(tempPath, filePath);

    return { storageKey };
  }

  async get(storageKey: string): Promise<Buffer | null> {
    const filePath = this.getFilePath(storageKey);
    
    try {
      return await fs.readFile(filePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = this.getFilePath(storageKey);
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
