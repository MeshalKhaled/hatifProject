import { Env } from '../env.js';
import { StorageBackend } from './types.js';
import { LocalStorage } from './local.js';
import { DatabaseStorage } from './db.js';
import { S3Storage } from './s3/client.js';
import { FTPStorage } from './ftp.js';

export function createStorageBackend(env: Env): StorageBackend {
  switch (env.STORAGE_BACKEND) {
    case 'local':
      return new LocalStorage(env.LOCAL_DIR!);
    case 'db':
      return new DatabaseStorage();
    case 's3':
      return new S3Storage({
        endpoint: env.S3_ENDPOINT!,
        bucket: env.S3_BUCKET!,
        accessKey: env.S3_ACCESS_KEY!,
        secretKey: env.S3_SECRET_KEY!,
        region: env.S3_REGION!,
      });
    case 'ftp':
      return new FTPStorage({
        host: env.FTP_HOST!,
        user: env.FTP_USER!,
        password: env.FTP_PASS!,
        dir: env.FTP_DIR!,
      });
    default:
      throw new Error(`Unsupported storage backend: ${env.STORAGE_BACKEND}`);
  }
}
