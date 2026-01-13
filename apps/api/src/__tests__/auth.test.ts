import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../server.js';

const API_TOKEN = 'supersecret';
process.env.API_TOKEN = API_TOKEN;
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/simpledrive';
process.env.STORAGE_BACKEND = 'db';

describe('Auth', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/blobs/anything without Authorization => 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/blobs/anything',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Unauthorized');
  });

  it('GET /v1/blobs/anything with "Bearer wrong" => 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/blobs/anything',
      headers: {
        Authorization: 'Bearer wrong',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Unauthorized');
  });

  it('GET /health without Authorization => 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
  });
});
