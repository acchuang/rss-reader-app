import { createServices } from '../lib/container.js';
import { closePool } from '../lib/db.js';

async function main(): Promise<void> {
  const importId = process.env.IMPORT_ID;
  const userId = process.env.USER_ID;
  const uploadPath = process.env.UPLOAD_PATH;

  if (!importId || !userId || !uploadPath) {
    throw new Error('IMPORT_ID, USER_ID, and UPLOAD_PATH must be set');
  }

  const services = createServices();
  await services.opmlImportWorker.process({ importId, userId, uploadPath });
  await closePool();
  process.stdout.write('OPML import processed\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
