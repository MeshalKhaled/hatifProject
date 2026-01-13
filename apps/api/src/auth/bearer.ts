import { FastifyRequest, FastifyReply } from 'fastify';

export async function bearerAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  token: string
): Promise<void> {
  const expectedToken = process.env.API_TOKEN;
  
  if (!expectedToken) {
    reply.code(500).send({ error: 'Server configuration error' });
    return;
  }

  if (!token || token !== expectedToken) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
}
