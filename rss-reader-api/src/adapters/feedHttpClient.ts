import { XMLParser } from 'fast-xml-parser';

import type { FeedDiscoveryPort, FeedFetchPort } from '../types/ports.js';

type ParsedFeed = {
  title?: string | null;
  entries: Array<{
    guid?: string | null;
    url: string;
    canonicalUrl: string;
    title: string;
    author?: string | null;
    summary?: string | null;
    contentHtml?: string | null;
    contentText?: string | null;
    publishedAt?: string | null;
  }>;
};

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function stripHtml(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(rawUrl: string, baseUrl?: string): string {
  const url = new URL(rawUrl, baseUrl);
  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
  for (const param of trackingParams) {
    url.searchParams.delete(param);
  }
  url.hash = '';
  return url.toString();
}

function pickAtomLink(linkNode: unknown, baseUrl?: string): string | null {
  const links = ensureArray(linkNode as Array<Record<string, unknown>>);

  for (const link of links) {
    const rel = typeof link.rel === 'string' ? link.rel : 'alternate';
    const href = typeof link.href === 'string' ? link.href : null;
    if (href && rel === 'alternate') {
      return normalizeUrl(href, baseUrl);
    }
  }

  const fallback = links.find((link) => typeof link.href === 'string');
  return fallback?.href ? normalizeUrl(String(fallback.href), baseUrl) : null;
}

function parseRssFeed(document: Record<string, any>, baseUrl?: string): ParsedFeed {
  const rss = document.rss;
  const channel = rss?.channel ?? rss;
  const items = ensureArray(channel?.item);

  return {
    title: channel?.title ? String(channel.title) : null,
    entries: items
      .map((item) => {
        const rawLink = typeof item.link === 'string' ? item.link : null;
        if (!rawLink) {
          return null;
        }

        const title = item.title ? String(item.title) : rawLink;
        const contentHtml = item['content:encoded']
          ? String(item['content:encoded'])
          : item.description
            ? String(item.description)
            : null;

        const publishedAt = item.pubDate
          ? new Date(String(item.pubDate)).toISOString()
          : item.isoDate
            ? new Date(String(item.isoDate)).toISOString()
            : null;

        return {
          guid: item.guid ? String(item.guid) : null,
          url: normalizeUrl(rawLink, baseUrl),
          canonicalUrl: normalizeUrl(rawLink, baseUrl),
          title,
          author: item.author ? String(item.author) : null,
          summary: item.description ? stripHtml(String(item.description)) : null,
          contentHtml,
          contentText: stripHtml(contentHtml),
          publishedAt
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  };
}

function parseAtomFeed(document: Record<string, any>, baseUrl?: string): ParsedFeed {
  const feed = document.feed;
  const entries = ensureArray(feed?.entry);

  return {
    title: feed?.title ? String(feed.title) : null,
    entries: entries
      .map((entry) => {
        const link = pickAtomLink(entry.link, baseUrl);
        if (!link) {
          return null;
        }

        const contentHtml = entry.content
          ? typeof entry.content === 'string'
            ? entry.content
            : typeof entry.content['#text'] === 'string'
              ? entry.content['#text']
              : null
          : entry.summary
            ? typeof entry.summary === 'string'
              ? entry.summary
              : typeof entry.summary['#text'] === 'string'
                ? entry.summary['#text']
                : null
            : null;

        const publishedRaw = entry.published ?? entry.updated ?? null;
        const publishedAt = publishedRaw ? new Date(String(publishedRaw)).toISOString() : null;

        return {
          guid: entry.id ? String(entry.id) : null,
          url: link,
          canonicalUrl: link,
          title: entry.title ? String(entry.title) : link,
          author: entry.author?.name ? String(entry.author.name) : null,
          summary: entry.summary ? stripHtml(typeof entry.summary === 'string' ? entry.summary : entry.summary['#text']) : null,
          contentHtml,
          contentText: stripHtml(contentHtml),
          publishedAt
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  };
}

function parseFeedXml(xml: string, baseUrl?: string): ParsedFeed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
    parseTagValue: false
  });

  const document = parser.parse(xml) as Record<string, any>;

  if (document.rss) {
    return parseRssFeed(document, baseUrl);
  }

  if (document.feed) {
    return parseAtomFeed(document, baseUrl);
  }

  throw new Error('Unsupported feed format');
}

function extractAlternateFeedUrl(html: string, baseUrl: string): string | null {
  const linkRegex = /<link\b[^>]*rel=["'][^"']*alternate[^"']*["'][^>]*type=["']application\/(?:rss\+xml|atom\+xml|xml)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const match = linkRegex.exec(html);
  if (!match?.[1]) {
    return null;
  }

  return normalizeUrl(match[1], baseUrl);
}

export class FeedHttpClient implements FeedDiscoveryPort, FeedFetchPort {
  async discover(input: { url: string }) {
    const response = await fetch(input.url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'rss-reader-api/0.1'
      }
    });

    if (!response.ok) {
      return { kind: 'unavailable' as const, message: `Upstream responded with ${response.status}` };
    }

    const contentType = response.headers.get('content-type') ?? '';
    const body = await response.text();
    const finalUrl = response.url;

    try {
      if (contentType.includes('xml') || body.trimStart().startsWith('<?xml') || body.includes('<rss') || body.includes('<feed')) {
        const parsed = parseFeedXml(body, finalUrl);
        return {
          kind: 'feed' as const,
          feedUrl: finalUrl,
          siteUrl: new URL(finalUrl).origin,
          title: parsed.title ?? null
        };
      }
    } catch {
      return { kind: 'invalid' as const };
    }

    const discoveredUrl = extractAlternateFeedUrl(body, finalUrl);
    if (!discoveredUrl) {
      return { kind: 'not_found' as const };
    }

    return {
      kind: 'feed' as const,
      feedUrl: discoveredUrl,
      siteUrl: finalUrl
    };
  }

  async fetchFeed(input: {
    feedUrl: string;
    etag?: string | null;
    lastModified?: string | null;
  }) {
    const headers = new Headers({
      'user-agent': 'rss-reader-api/0.1'
    });

    if (input.etag) {
      headers.set('if-none-match', input.etag);
    }

    if (input.lastModified) {
      headers.set('if-modified-since', input.lastModified);
    }

    const response = await fetch(input.feedUrl, {
      redirect: 'follow',
      headers
    });

    if (response.status === 304) {
      return {
        kind: 'not_modified' as const,
        statusCode: 304
      };
    }

    if (!response.ok) {
      throw new Error(`Feed fetch failed with status ${response.status}`);
    }

    const xml = await response.text();
    const parsed = parseFeedXml(xml, response.url);

    return {
      kind: 'success' as const,
      statusCode: response.status,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
      entries: parsed.entries
    };
  }
}
