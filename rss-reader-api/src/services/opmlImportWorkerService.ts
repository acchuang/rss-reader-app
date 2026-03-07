import type { FolderDto } from '../types/contracts.js';
import type { ServiceDependencies } from '../types/ports.js';

export class OpmlImportWorkerService {
  constructor(private readonly deps: ServiceDependencies) {}

  async process(input: {
    importId: string;
    userId: string;
    uploadPath?: string;
    opmlContent?: string;
  }): Promise<void> {
    const entries = await this.deps.opmlParser.parse({
      uploadPath: input.uploadPath,
      opmlContent: input.opmlContent
    });
    await this.deps.imports.markProcessing(input.userId, input.importId, entries.length);

    const folders = await this.deps.folders.listByUser(input.userId);
    const folderMap = new Map<string, FolderDto>(folders.map((folder) => [folder.name.toLowerCase(), folder]));

    let feedsAdded = 0;
    let skipped = 0;

    for (const entry of entries) {
      try {
        let folderId: string | null | undefined = null;

        if (entry.folderName) {
          const key = entry.folderName.toLowerCase();
          let folder = folderMap.get(key);
          if (!folder) {
            folder = await this.deps.folders.create(input.userId, entry.folderName);
            folderMap.set(key, folder);
          }
          folderId = folder.id;
        }

        const discovery = await this.deps.discovery.discover({ url: entry.xmlUrl });
        if (discovery.kind !== 'feed') {
          skipped += 1;
          continue;
        }

        const feed = await this.deps.feeds.upsertValidatedFeed(discovery);
        await this.deps.subscriptions.upsertFromValidatedFeed({
          userId: input.userId,
          feedId: feed.id,
          folderId,
          titleOverride: entry.title ?? null
        });
        feedsAdded += 1;
      } catch {
        skipped += 1;
      }
    }

    await this.deps.imports.markCompleted({
      userId: input.userId,
      importId: input.importId,
      feedsAdded,
      errorMessage: skipped > 0 ? `${skipped} feed(s) skipped` : null
    });
  }
}
