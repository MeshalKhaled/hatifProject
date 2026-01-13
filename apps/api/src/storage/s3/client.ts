import { createHash } from 'crypto';
import { StorageBackend } from '../types.js';
import {
  S3Config,
  hashPayload,
  getCanonicalRequest,
  getAuthorizationHeader,
  getAmzDate,
} from './sigv4.js';

export class S3Storage implements StorageBackend {
  private config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
    // Log S3 configuration at startup (no secrets)
    console.log(`[S3Storage] Backend: s3, Endpoint: ${config.endpoint}, Bucket: ${config.bucket}, Region: ${config.region}`);
  }

  private getStorageKey(id: string): string {
    return createHash('sha256').update(id).digest('hex');
  }

  private getUrl(key: string): string {
    const endpoint = this.config.endpoint.replace(/\/$/, '');
    return `${endpoint}/${this.config.bucket}/${key}`;
  }

  private async makeRequest(
    method: string,
    key: string,
    body?: Buffer
  ): Promise<Response> {
    // Force path-style: http://minio:9000/blobs/key
    const url = this.getUrl(key);
    const date = new Date();
    const amzDate = getAmzDate(date);
    
    // Calculate payload hash - must match x-amz-content-sha256
    // For GET/DELETE, use empty string hash; for PUT, hash the actual body
    const payloadHash = body ? hashPayload(body) : hashPayload('');

    // Extract host from endpoint URL (includes port if present)
    const endpointUrl = new URL(this.config.endpoint);
    const host = endpointUrl.host; // e.g., "minio:9000" or "localhost:9000"

    // Build headers - only include signed headers
    const headers: Record<string, string> = {
      host: host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
    };

    // Add content headers for PUT requests
    if (body) {
      headers['content-type'] = 'application/octet-stream';
      headers['content-length'] = body.length.toString();
    }

    // Canonical URI: path-style format /bucket/key
    // Key is hex string (no special chars), but ensure proper encoding
    const canonicalUri = `/${this.config.bucket}/${key}`;

    const canonicalRequest = getCanonicalRequest(
      method,
      canonicalUri,
      '',
      headers,
      payloadHash
    );

    const authorization = getAuthorizationHeader(
      this.config.accessKey,
      this.config.secretKey,
      this.config.region,
      date,
      canonicalRequest,
      headers
    );

    // Build request headers - only include signed headers in fetch
    const requestHeaders = new Headers();
    requestHeaders.set('host', host);
    requestHeaders.set('x-amz-date', amzDate);
    requestHeaders.set('x-amz-content-sha256', payloadHash);
    requestHeaders.set('Authorization', authorization);
    
    if (body) {
      requestHeaders.set('content-type', 'application/octet-stream');
      requestHeaders.set('content-length', body.length.toString());
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body || undefined,
    });

    return response;
  }

  async put(id: string, bytes: Buffer): Promise<{ storageKey: string }> {
    const storageKey = this.getStorageKey(id);
    const response = await this.makeRequest('PUT', storageKey, bytes);

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      throw new Error(`S3 PUT failed: ${response.status} ${text}`);
    }

    return { storageKey };
  }

  async get(storageKey: string): Promise<Buffer | null> {
    const response = await this.makeRequest('GET', storageKey);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      throw new Error(`S3 GET failed: ${response.status} ${text}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(storageKey: string): Promise<void> {
    const response = await this.makeRequest('DELETE', storageKey);

    if (response.status !== 204 && response.status !== 404) {
      const text = await response.text().catch(() => 'Unknown error');
      throw new Error(`S3 DELETE failed: ${response.status} ${text}`);
    }
  }
}
