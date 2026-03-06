import type { ServiceDependencies } from '../types/ports.js';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export class ExportService {
  constructor(private readonly deps: ServiceDependencies) {}

  async getOpml(userId: string): Promise<string> {
    const rows = await this.deps.subscriptions.listExportRows(userId);

    const folders = new Map<string | null, typeof rows>();
    for (const row of rows) {
      const existing = folders.get(row.folderName) ?? [];
      existing.push(row);
      folders.set(row.folderName, existing);
    }

    const body = Array.from(folders.entries())
      .map(([folderName, entries]) => {
        const outlines = entries
          .map((entry) => {
            const text = escapeXml(entry.title);
            const xmlUrl = escapeXml(entry.feedUrl);
            const htmlUrl = entry.siteUrl ? ` htmlUrl="${escapeXml(entry.siteUrl)}"` : '';
            return `<outline type="rss" text="${text}" title="${text}" xmlUrl="${xmlUrl}"${htmlUrl} />`;
          })
          .join('');

        if (!folderName) {
          return outlines;
        }

        return `<outline text="${escapeXml(folderName)}" title="${escapeXml(folderName)}">${outlines}</outline>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?><opml version="2.0"><head><title>RSS Reader Export</title></head><body>${body}</body></opml>`;
  }
}
