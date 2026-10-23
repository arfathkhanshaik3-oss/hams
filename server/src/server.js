import http from 'node:http';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { startNoShowJob } from './jobs/noShowJob.js';
import { app } from './app.js';
import { attachSockets } from './sockets/index.js';

const server = http.createServer(app);
attachSockets(server);

let stopJob = () => {};
server.listen(env.port, () => {
  console.log(`\nHAMS API running on http://localhost:${env.port}  (${env.nodeEnv})`);
  console.log('Health check: http://localhost:' + env.port + '/api/health\n');
  if (env.enableJobs) stopJob = startNoShowJob();
});

async function shutdown(signal) {
  console.log(`\n${signal} received - shutting down...`);
  stopJob();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
