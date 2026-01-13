import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { blobRoutes } from './routes/blobs.js';
import { loadEnv } from './env.js';

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadEnv();
  
  const fastify = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
  });

  // Global Bearer auth hook - applies to all routes except /health
  fastify.addHook('onRequest', async (request, reply) => {
    // Allow /health without authentication
    if (request.url === '/health') {
      return;
    }

    // Require Authorization header for all other routes
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const expectedToken = env.API_TOKEN;
    
    if (!expectedToken) {
      return reply.code(500).send({ error: 'Server configuration error' });
    }

    if (token !== expectedToken) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Health check (must be registered after hook to allow unauthenticated access)
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Register routes
  await fastify.register(blobRoutes);

  return fastify;
}

// Production entry point - only run if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('server.js') ||
                     process.argv[1]?.includes('dist/server.js');

if (isMainModule) {
  const start = async () => {
    try {
      const env = loadEnv();
      const app = await buildApp();
      await app.listen({ port: env.PORT, host: '0.0.0.0' });
      app.log.info(`Server listening on port ${env.PORT}`);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  };

  start();
}
