import '@fastify/jwt';

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: any;
  }
}
