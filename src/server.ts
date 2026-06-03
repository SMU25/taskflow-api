import Fastify from "fastify";

const server = Fastify({logger: true});

    
server.get('/ping', async (request, reply) => {
  return { status: 'OK', message: 'Server is running!' };
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀 Server running at http://localhost:3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();