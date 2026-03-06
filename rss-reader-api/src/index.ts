import { buildApp } from './app.js';
import { closePool } from './lib/db.js';
import { getEnv } from './lib/env.js';

async function main(): Promise<void> {
  const env = getEnv();
  const app = await buildApp();

  const shutdown = async (): Promise<void> => {
    await app.close();
    await closePool();
  };

  process.on('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
