import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../server.js';
import { PrismaClient } from '@prisma/client';

const API_TOKEN = 'test-token';
process.env.API_TOKEN = API_TOKEN;
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/simpledrive_test';
process.env.STORAGE_BACKEND = 'db';

const prisma = new PrismaClient();

describe('Blob API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    // Clean up test data
    await prisma.blob.deleteMany({});
    await prisma.blobDataStore.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /v1/blobs', () => {
    it('should return 401 when missing token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/blobs',
        payload: { id: 'test', data: 'dGVzdA==' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 when token is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/blobs',
        headers: {
          Authorization: 'Bearer wrong-token',
        },
        payload: { id: 'test', data: 'dGVzdA==' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for invalid base64', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/blobs',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
        payload: { id: 'test', data: 'invalid-base64!!!' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid base64');
    });

    it('should return 400 for empty id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/blobs',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
        payload: { id: '', data: 'dGVzdA==' },
      });

      expect(response.statusCode).toBe(400); // Validation error
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should create a blob successfully', async () => {
      const testId = `test-${Date.now()}`;
      const testData = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64

      const response = await app.inject({
        method: 'POST',
        url: '/v1/blobs',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
        payload: { id: testId, data: testData },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(testId);
      expect(body.size).toBe('11'); // "Hello World" is 11 bytes
      expect(body.created_at).toBeDefined();
      expect(new Date(body.created_at).toISOString()).toBe(body.created_at);
    });

    it('should return 409 for duplicate id', async () => {
      const testId = `test-dup-${Date.now()}`;
      const testData = 'dGVzdA==';

      // First upload
      await app.inject({
        method: 'POST',
        url: '/v1/blobs',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
        payload: { id: testId, data: testData },
      });

      // Second upload with same id
      const response = await app.inject({
        method: 'POST',
        url: '/v1/blobs',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
        payload: { id: testId, data: testData },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('already exists');
    });
  });

  describe('GET /v1/blobs/:id', () => {
    it('should return 401 when missing token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/blobs/test',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent blob', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/blobs/non-existent-id',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Blob not found');
    });

    it('should retrieve a blob successfully', async () => {
      const testId = `test-get-${Date.now()}`;
      const testData = 'SGVsbG8gV29ybGQ='; // "Hello World"

      // Create blob
      await app.inject({
        method: 'POST',
        url: '/v1/blobs',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
        payload: { id: testId, data: testData },
      });

      // Retrieve blob
      const response = await app.inject({
        method: 'GET',
        url: `/v1/blobs/${testId}`,
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(testId);
      expect(body.data).toBe(testData);
      expect(body.size).toBe('11');
      expect(body.created_at).toBeDefined();
      expect(new Date(body.created_at).toISOString()).toBe(body.created_at);
    });
  });
});
