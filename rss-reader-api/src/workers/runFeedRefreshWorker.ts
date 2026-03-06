import { createServices } from '../lib/container.js';

async function main(): Promise<void> {
  const services = createServices();
  const result = await services.feedRefreshWorker.refreshNextDueFeed();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
