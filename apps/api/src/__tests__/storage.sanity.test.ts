import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { DatabaseStorage } from '../storage/db.js';

const prisma = new PrismaClient();
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/simpledrive';
process.env.STORAGE_BACKEND = 'db';

describe('Storage Sanity (DB Backend)', () => {
  const storage = new DatabaseStorage();

  beforeAll(async () => {
    // Clean up test data
    await prisma.blob.deleteMany({});
    await prisma.blobDataStore.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create BlobDataStore row when storing blob', async () => {
    const testId = `sanity-${Date.now()}`;
    const testData = Buffer.from('test data');

    // Store blob directly via storage backend (this only creates BlobDataStore row)
    const { storageKey } = await storage.put(testId, testData);

    // Verify BlobDataStore row exists
    const dataRow = await prisma.blobDataStore.findUnique({
      where: { key: storageKey },
    });
    expect(dataRow).toBeDefined();
    expect(dataRow?.key).toBe(storageKey);
    expect(Buffer.from(dataRow!.data).toString()).toBe('test data');
    
    // Note: Blob metadata row is created by the API routes handler, not the storage backend
    // So we only verify the storage backend creates the BlobDataStore row correctly
  });
});
