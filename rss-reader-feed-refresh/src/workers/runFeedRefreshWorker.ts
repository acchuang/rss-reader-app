import { createServices } from '../lib/container.js';
import { closePool } from '../lib/db.js';

async function main(): Promise<void> {
  const services = createServices();
  const result = await services.feedRefreshWorker.refreshNextDueFeed();
  await closePool();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
