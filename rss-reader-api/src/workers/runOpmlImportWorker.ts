import { createServices } from '../lib/container.js';
import { closePool } from '../lib/db.js';

async function main(): Promise<void> {
  const importId = process.env.IMPORT_ID;
  const userId = process.env.USER_ID;
  const uploadPath = process.env.UPLOAD_PATH;
  const opmlContent = process.env.OPML_CONTENT;

  if (!importId || !userId || (!uploadPath && !opmlContent)) {
    throw new Error('IMPORT_ID, USER_ID, and either UPLOAD_PATH or OPML_CONTENT must be set');
  }

  const services = createServices();
  await services.opmlImportWorker.process({ importId, userId, uploadPath, opmlContent });
  await closePool();
  process.stdout.write('OPML import processed\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
