import { buildApp } from './app.js';
import { getEnv } from './lib/env.js';

async function main(): Promise<void> {
  const env = getEnv();
  const app = await buildApp();
  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
