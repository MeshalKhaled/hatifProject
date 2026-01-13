import { createHash } from 'crypto';
import { Readable, PassThrough } from 'stream';
import { StorageBackend } from './types.js';
import { Client } from 'basic-ftp';

export interface FTPConfig {
  host: string;
  user: string;
  password: string;
  dir: string;
}

export class FTPStorage implements StorageBackend {
  private config: FTPConfig;

  constructor(config: FTPConfig) {
    this.config = config;
  }

  private getStorageKey(id: string): string {
    return createHash('sha256').update(id).digest('hex');
  }

  private async withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client();
    try {
      await client.access({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
      });
      await client.ensureDir(this.config.dir);
      return await fn(client);
    } finally {
      client.close();
    }
  }

  async put(id: string, bytes: Buffer): Promise<{ storageKey: string }> {
    const storageKey = this.getStorageKey(id);
    const remotePath = `${this.config.dir}/${storageKey}`;

    await this.withClient(async (client) => {
      const stream = Readable.from(bytes);
      await client.uploadFrom(stream, remotePath);
    });

    return { storageKey };
  }

  async get(storageKey: string): Promise<Buffer | null> {
    const remotePath = `${this.config.dir}/${storageKey}`;
    let buffer: Buffer | null = null;

    try {
      await this.withClient(async (client) => {
        const chunks: Buffer[] = [];
        const writeStream = new PassThrough();
        
        const promise = new Promise<void>((resolve, reject) => {
          writeStream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          writeStream.on('end', () => {
            resolve();
          });
          writeStream.on('error', (err) => {
            reject(err);
          });
        });

        await client.downloadTo(writeStream, remotePath);
        await promise;
        buffer = Buffer.concat(chunks);
      });
    } catch (error: any) {
      if (error.code === 550) {
        // File not found
        return null;
      }
      throw error;
    }

    return buffer;
  }

  async delete(storageKey: string): Promise<void> {
    const remotePath = `${this.config.dir}/${storageKey}`;
    try {
      await this.withClient(async (client) => {
        await client.remove(remotePath);
      });
    } catch (error: any) {
      if (error.code !== 550) {
        throw error;
      }
    }
  }
}
