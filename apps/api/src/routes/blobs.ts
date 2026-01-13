import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { StorageBackend } from '../storage/types.js';
import { createStorageBackend } from '../storage/factory.js';
import { loadEnv } from '../env.js';

const prisma = new PrismaClient();
const env = loadEnv();
const storage: StorageBackend = createStorageBackend(env);

interface PostBlobBody {
  id: string;
  data: string;
}

interface GetBlobParams {
  id: string;
}

function validateId(id: string): void {
  if (!id || typeof id !== 'string') {
    throw new Error('id must be a non-empty string');
  }
  if (id.length < 1 || id.length > 512) {
    throw new Error('id must be between 1 and 512 characters');
  }
}

function validateBase64(base64: string): Buffer {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('data must be a non-empty base64 string');
  }

  try {
    const buffer = Buffer.from(base64, 'base64');
    // Verify it's valid base64 by encoding back
    const reencoded = buffer.toString('base64');
    // Handle padding differences
    const normalized = base64.replace(/=+$/, '');
    const normalizedReencoded = reencoded.replace(/=+$/, '');
    
    if (normalized !== normalizedReencoded) {
      throw new Error('Invalid base64 encoding');
    }
    
    return buffer;
  } catch (error: any) {
    throw new Error(`Invalid base64 data: ${error.message}`);
  }
}

export async function blobRoutes(fastify: FastifyInstance) {
  // POST /v1/blobs
  fastify.post<{ Body: PostBlobBody }>(
    '/v1/blobs',
    async (request: FastifyRequest<{ Body: PostBlobBody }>, reply: FastifyReply) => {
      try {
        const { id, data } = request.body;

        // Validate id
        try {
          validateId(id);
        } catch (error: any) {
          return reply.code(400).send({ error: error.message });
        }

        // Validate and decode base64
        let bytes: Buffer;
        try {
          bytes = validateBase64(data);
        } catch (error: any) {
          return reply.code(400).send({ error: error.message });
        }

        // Check if blob already exists
        const existing = await prisma.blob.findUnique({
          where: { id },
        });

        if (existing) {
          return reply.code(409).send({ error: 'Blob with this id already exists' });
        }

        // Store in backend
        const { storageKey } = await storage.put(id, bytes);
        const checksum = createHash('sha256').update(bytes).digest('hex');

        // Store metadata
        const blob = await prisma.blob.create({
          data: {
            id,
            backend: env.STORAGE_BACKEND,
            storage_key: storageKey,
            size_bytes: bytes.length,
            checksum_sha256: checksum,
          },
        });

        return reply.code(201).send({
          id: blob.id,
          size: blob.size_bytes.toString(),
          created_at: blob.created_at.toISOString(),
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // GET /v1/blobs/:id
  fastify.get<{ Params: GetBlobParams }>(
    '/v1/blobs/:id',
    async (request: FastifyRequest<{ Params: GetBlobParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // Find metadata
        const blob = await prisma.blob.findUnique({
          where: { id },
        });

        if (!blob) {
          return reply.code(404).send({ error: 'Blob not found' });
        }

        // Retrieve from backend
        const bytes = await storage.get(blob.storage_key);

        if (!bytes) {
          return reply.code(404).send({ error: 'Blob data not found in storage backend' });
        }

        // Convert to base64
        const base64Data = bytes.toString('base64');

        return reply.send({
          id: blob.id,
          data: base64Data,
          size: blob.size_bytes.toString(),
          created_at: blob.created_at.toISOString(),
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
}
