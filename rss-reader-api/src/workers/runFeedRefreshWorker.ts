import { createServices } from '../lib/container.js';
import { closePool } from '../lib/db.js';

async function main(): Promise<void> {
  const services = createServices();
  const maxFeeds = Number(process.env.MAX_FEEDS_PER_RUN ?? '50');
  const result = await services.feedRefreshWorker.refreshDueFeeds({ maxFeeds });
  await closePool();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
