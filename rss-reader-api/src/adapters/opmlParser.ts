import { readFile } from 'node:fs/promises';

import { XMLParser } from 'fast-xml-parser';

import type { OpmlParserPort } from '../types/ports.js';

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function walkOutlines(
  nodes: Array<Record<string, unknown>>,
  folderName: string | undefined,
  entries: Array<{ xmlUrl: string; title?: string; folderName?: string }>
): void {
  for (const node of nodes) {
    const xmlUrl = typeof node.xmlUrl === 'string' ? node.xmlUrl : undefined;
    const title = typeof node.title === 'string'
      ? node.title
      : typeof node.text === 'string'
        ? node.text
        : undefined;

    if (xmlUrl) {
      entries.push({
        xmlUrl,
        title,
        folderName
      });
      continue;
    }

    const nextFolder = typeof node.title === 'string'
      ? node.title
      : typeof node.text === 'string'
        ? node.text
        : folderName;

    walkOutlines(ensureArray(node.outline as Array<Record<string, unknown>> | Record<string, unknown> | undefined), nextFolder, entries);
  }
}

export class OpmlFileParser implements OpmlParserPort {
  async parse(input: {
    uploadPath?: string;
    opmlContent?: string;
  }): Promise<Array<{ xmlUrl: string; title?: string; folderName?: string }>> {
    const xml = input.opmlContent ?? (input.uploadPath ? await readFile(input.uploadPath, 'utf8') : null);
    if (!xml) {
      throw new Error('OPML content or upload path is required');
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      trimValues: true,
      parseTagValue: false
    });

    const document = parser.parse(xml) as Record<string, any>;
    const outlines = ensureArray(document.opml?.body?.outline);
    const entries: Array<{ xmlUrl: string; title?: string; folderName?: string }> = [];

    walkOutlines(outlines, undefined, entries);

    return entries;
  }
}
