import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../server.js';
import { request } from 'undici';

const API_TOKEN = 'supersecret';
process.env.API_TOKEN = API_TOKEN;
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/simpledrive';
process.env.STORAGE_BACKEND = 'db';

describe('Blobs Integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let baseUrl: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    // Start server on ephemeral port
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    const port = typeof address === 'string' ? 0 : address?.port || 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST invalid base64 => 400', async () => {
    const response = await request(`${baseUrl}/v1/blobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({
        id: 'test-invalid',
        data: 'invalid-base64!!!',
      }),
    });

    expect(response.statusCode).toBe(400);
    const body = await response.body.json() as { error: string };
    expect(body.error).toContain('Invalid base64');
  });

  it('POST valid => 201 with correct response format', async () => {
    const testId = `test-${Date.now()}`;
    const testData = 'SGVsbG8='; // "Hello" in base64 (5 bytes)

    const response = await request(`${baseUrl}/v1/blobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({
        id: testId,
        data: testData,
      }),
    });

    expect(response.statusCode).toBe(201);
    const body = await response.body.json() as { id: string; size: string; created_at: string };
    expect(body.id).toBe(testId);
    expect(body.size).toBe('5');
    expect(body.created_at).toBeDefined();
    // Verify ISO format and UTC-like
    expect(new Date(body.created_at).toISOString()).toBe(body.created_at);
    expect(body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('GET existing blob => 200 with data', async () => {
    const testId = `test-get-${Date.now()}`;
    const testData = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64

    // Create blob
    await request(`${baseUrl}/v1/blobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({
        id: testId,
        data: testData,
      }),
    });

    // Retrieve blob
    const response = await request(`${baseUrl}/v1/blobs/${testId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = await response.body.json() as { id: string; data: string; size: string; created_at: string };
    expect(body.id).toBe(testId);
    expect(body.data).toBe(testData);
    expect(body.size).toBe('11');
    expect(body.created_at).toBeDefined();
    expect(new Date(body.created_at).toISOString()).toBe(body.created_at);
  });

  it('POST duplicate id => 409', async () => {
    const testId = `test-dup-${Date.now()}`;
    const testData = 'dGVzdA==';

    // First upload
    await request(`${baseUrl}/v1/blobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({
        id: testId,
        data: testData,
      }),
    });

    // Second upload with same id
    const response = await request(`${baseUrl}/v1/blobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({
        id: testId,
        data: testData,
      }),
    });

    expect(response.statusCode).toBe(409);
    const body = await response.body.json() as { error: string };
    expect(body.error).toContain('already exists');
  });

  it('GET missing blob => 404 with error message', async () => {
    const response = await request(`${baseUrl}/v1/blobs/non-existent-id-12345`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
    });

    expect(response.statusCode).toBe(404);
    const body = await response.body.json() as { error: string };
    expect(body.error).toBe('Blob not found');
  });
});
