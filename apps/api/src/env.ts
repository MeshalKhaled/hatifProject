export interface Env {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  API_TOKEN: string;
  STORAGE_BACKEND: 'local' | 'db' | 's3' | 'ftp';
  LOCAL_DIR?: string;
  S3_ENDPOINT?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY?: string;
  S3_SECRET_KEY?: string;
  S3_REGION?: string;
  FTP_HOST?: string;
  FTP_USER?: string;
  FTP_PASS?: string;
  FTP_DIR?: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadEnv(): Env {
  const storageBackend = (process.env.STORAGE_BACKEND || 'local') as Env['STORAGE_BACKEND'];
  
  if (!['local', 'db', 's3', 'ftp'].includes(storageBackend)) {
    throw new Error(`Invalid STORAGE_BACKEND: ${storageBackend}. Must be one of: local, db, s3, ftp`);
  }

  const env: Env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '8080', 10),
    DATABASE_URL: requireEnv('DATABASE_URL'),
    API_TOKEN: requireEnv('API_TOKEN'),
    STORAGE_BACKEND: storageBackend,
  };

  if (storageBackend === 'local') {
    env.LOCAL_DIR = process.env.LOCAL_DIR || '/data/blobs';
  }

  if (storageBackend === 's3') {
    env.S3_ENDPOINT = requireEnv('S3_ENDPOINT');
    env.S3_BUCKET = requireEnv('S3_BUCKET');
    env.S3_ACCESS_KEY = requireEnv('S3_ACCESS_KEY');
    env.S3_SECRET_KEY = requireEnv('S3_SECRET_KEY');
    env.S3_REGION = process.env.S3_REGION || 'us-east-1';
  }

  if (storageBackend === 'ftp') {
    env.FTP_HOST = requireEnv('FTP_HOST');
    env.FTP_USER = requireEnv('FTP_USER');
    env.FTP_PASS = requireEnv('FTP_PASS');
    env.FTP_DIR = process.env.FTP_DIR || '/';
  }

  return env;
}
