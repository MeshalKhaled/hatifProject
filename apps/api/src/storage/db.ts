import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { StorageBackend } from './types.js';

const prisma = new PrismaClient();

export class DatabaseStorage implements StorageBackend {
  constructor() {
    // Log DB backend configuration at startup
    console.log('[DatabaseStorage] Backend: db, Table: BlobDataStore');
  }

  private getStorageKey(id: string): string {
    return createHash('sha256').update(id).digest('hex');
  }

  async put(id: string, bytes: Buffer): Promise<{ storageKey: string }> {
    const storageKey = this.getStorageKey(id);
    
    await prisma.blobDataStore.upsert({
      where: { key: storageKey },
      update: { 
        data: bytes,
        created_at: new Date(),
      },
      create: { 
        key: storageKey,
        data: bytes,
      },
    });

    return { storageKey };
  }

  async get(storageKey: string): Promise<Buffer | null> {
    const result = await prisma.blobDataStore.findUnique({
      where: { key: storageKey },
      select: { data: true },
    });

    if (!result) {
      return null;
    }

    return Buffer.from(result.data);
  }

  async delete(storageKey: string): Promise<void> {
    await prisma.blobDataStore.delete({
      where: { key: storageKey },
    }).catch(() => {
      // Ignore if already deleted (404)
    });
  }
}
