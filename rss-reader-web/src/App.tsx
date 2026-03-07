import { startTransition, useEffect, useDeferredValue, useState } from 'react';

type SidebarResponse = {
  views: {
    unreadCount: number;
    savedCount: number;
  };
  folders: Array<{
    id: string;
    name: string;
    position: number;
    unreadCount: number;
  }>;
  feeds: Array<{
    subscriptionId: string;
    folderId: string | null;
    title: string;
    status: 'active' | 'degraded' | 'failing' | 'disabled';
    unreadCount: number;
  }>;
};

type ArticleSummary = {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  isRead: boolean;
  isSaved: boolean;
  feed: {
    id: string;
    title: string;
  };
};

type ArticleDetail = ArticleSummary & {
  canonicalUrl: string;
  author: string | null;
  contentHtml: string | null;
  contentText: string | null;
  readAt: string | null;
  savedAt: string | null;
};

type ArticleListResponse = {
  items: ArticleSummary[];
  nextCursor: { publishedAt: string; articleId: string } | null;
};

type SearchResponse = {
  items: ArticleSummary[];
  nextCursor: { rank: number; articleId: string } | null;
};

type ViewMode = 'unread' | 'saved';
type Scope =
  | { kind: 'home' }
  | { kind: 'folder'; folderId: string; title: string }
  | { kind: 'feed'; subscriptionId: string; title: string };

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://api-production-c2fc.up.railway.app';

function formatDate(value: string | null): string {
  if (!value) {
    return 'Freshly filed';
  }

  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function buildArticlesUrl(viewMode: ViewMode, scope: Scope): string {
  const url = new URL('/api/articles', API_BASE_URL);
  url.searchParams.set('view', viewMode);

  if (scope.kind === 'folder') {
    url.searchParams.set('folderId', scope.folderId);
  }

  if (scope.kind === 'feed') {
    url.searchParams.set('subscriptionId', scope.subscriptionId);
  }

  return url.toString();
}

function statusLabel(status: SidebarResponse['feeds'][number]['status']): string {
  switch (status) {
    case 'active':
      return 'steady';
    case 'degraded':
      return 'lagging';
    case 'failing':
      return 'stalled';
    case 'disabled':
      return 'paused';
  }
}

export function App() {
  const [sidebar, setSidebar] = useState<SidebarResponse | null>(null);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('unread');
  const [scope, setScope] = useState<Scope>({ kind: 'home' });
  const [searchDraft, setSearchDraft] = useState('');
  const [searchResults, setSearchResults] = useState<ArticleSummary[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(searchDraft.trim());

  useEffect(() => {
    let cancelled = false;

    async function loadSidebar() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/sidebar`);
        if (!response.ok) {
          throw new Error(`Sidebar request failed with ${response.status}`);
        }
        const data = (await response.json()) as SidebarResponse;
        if (!cancelled) {
          setSidebar(data);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load sources');
        }
      }
    }

    void loadSidebar();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadArticles() {
      setLoadingList(true);
      setError(null);

      try {
        const response = await fetch(buildArticlesUrl(viewMode, scope));
        if (!response.ok) {
          throw new Error(`Article request failed with ${response.status}`);
        }

        const data = (await response.json()) as ArticleListResponse;
        if (cancelled) {
          return;
        }

        setArticles(data.items);
        const nextId = data.items[0]?.id ?? null;
        startTransition(() => {
          setSelectedArticleId(nextId);
        });
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load articles');
          setArticles([]);
          setSelectedArticleId(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    }

    void loadArticles();

    return () => {
      cancelled = true;
    };
  }, [scope, viewMode]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedArticle() {
      if (!selectedArticleId) {
        setSelectedArticle(null);
        return;
      }

      setLoadingArticle(true);

      try {
        const response = await fetch(`${API_BASE_URL}/api/articles/${selectedArticleId}`);
        if (!response.ok) {
          throw new Error(`Article detail failed with ${response.status}`);
        }

        const data = (await response.json()) as ArticleDetail;
        if (!cancelled) {
          setSelectedArticle(data);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load article detail');
        }
      } finally {
        if (!cancelled) {
          setLoadingArticle(false);
        }
      }
    }

    void loadSelectedArticle();

    return () => {
      cancelled = true;
    };
  }, [selectedArticleId]);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (deferredSearch.length < 2) {
        setSearchResults(null);
        return;
      }

      try {
        const url = new URL('/api/search', API_BASE_URL);
        url.searchParams.set('q', deferredSearch);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Search failed with ${response.status}`);
        }

        const data = (await response.json()) as SearchResponse;
        if (!cancelled) {
          setSearchResults(data.items);
          if (data.items[0]) {
            setSelectedArticleId(data.items[0].id);
          }
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to search');
        }
      }
    }

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [deferredSearch]);

  const visibleArticles = searchResults ?? articles;
  const selectedTitle =
    scope.kind === 'home'
      ? viewMode === 'unread'
        ? 'All unread'
        : 'Saved shelf'
      : scope.title;

  return (
    <div className="shell">
      <div className="shell__glow shell__glow--amber" />
      <div className="shell__glow shell__glow--teal" />

      <header className="topbar">
        <div>
          <p className="eyebrow">Signal Cabinet</p>
          <h1>Live reader, powered by the Railway backend.</h1>
        </div>

        <div className="topbar__controls">
          <label className="search">
            <span>Search</span>
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search the seeded archive"
            />
          </label>

          <div className="segmented">
            <button
              className={viewMode === 'unread' ? 'is-active' : ''}
              onClick={() => setViewMode('unread')}
              type="button"
            >
              Unread
            </button>
            <button
              className={viewMode === 'saved' ? 'is-active' : ''}
              onClick={() => setViewMode('saved')}
              type="button"
            >
              Saved
            </button>
          </div>
        </div>
      </header>

      <main className="reader-grid">
        <aside className="panel panel--nav">
          <section className="metric-strip">
            <article>
              <span>Unread</span>
              <strong>{sidebar?.views.unreadCount ?? '...'}</strong>
            </article>
            <article>
              <span>Saved</span>
              <strong>{sidebar?.views.savedCount ?? '...'}</strong>
            </article>
          </section>

          <section className="nav-block">
            <h2>Cabinets</h2>
            <button
              className={scope.kind === 'home' ? 'nav-item is-active' : 'nav-item'}
              onClick={() => {
                setScope({ kind: 'home' });
                setSearchDraft('');
              }}
              type="button"
            >
              <span>Everything</span>
              <em>{sidebar?.views.unreadCount ?? 0}</em>
            </button>
            {sidebar?.folders.map((folder) => (
              <button
                key={folder.id}
                className={
                  scope.kind === 'folder' && scope.folderId === folder.id
                    ? 'nav-item is-active'
                    : 'nav-item'
                }
                onClick={() => {
                  setScope({ kind: 'folder', folderId: folder.id, title: folder.name });
                  setSearchDraft('');
                }}
                type="button"
              >
                <span>{folder.name}</span>
                <em>{folder.unreadCount}</em>
              </button>
            ))}
          </section>

          <section className="nav-block">
            <h2>Feeds</h2>
            {sidebar?.feeds.map((feed) => (
              <button
                key={feed.subscriptionId}
                className={
                  scope.kind === 'feed' && scope.subscriptionId === feed.subscriptionId
                    ? 'nav-item is-active'
                    : 'nav-item'
                }
                onClick={() => {
                  setScope({
                    kind: 'feed',
                    subscriptionId: feed.subscriptionId,
                    title: feed.title
                  });
                  setSearchDraft('');
                }}
                type="button"
              >
                <span>{feed.title}</span>
                <div className="nav-item__meta">
                  <small data-status={feed.status}>{statusLabel(feed.status)}</small>
                  <em>{feed.unreadCount}</em>
                </div>
              </button>
            ))}
          </section>
        </aside>

        <section className="panel panel--list">
          <header className="panel__header">
            <div>
              <p className="eyebrow">{searchResults ? 'Search Results' : 'Reading Queue'}</p>
              <h2>{searchResults ? `Results for "${deferredSearch}"` : selectedTitle}</h2>
            </div>
            <span className="panel__count">{visibleArticles.length} items</span>
          </header>

          {loadingList ? <p className="empty-state">Loading dispatches…</p> : null}
          {error ? <p className="empty-state empty-state--error">{error}</p> : null}
          {!loadingList && !error && visibleArticles.length === 0 ? (
            <p className="empty-state">
              {searchResults ? 'No matches in the seeded archive yet.' : 'This lane is clear.'}
            </p>
          ) : null}

          <div className="article-stack">
            {visibleArticles.map((article, index) => (
              <button
                key={article.id}
                className={article.id === selectedArticleId ? 'story-card is-active' : 'story-card'}
                onClick={() => setSelectedArticleId(article.id)}
                style={{ animationDelay: `${index * 60}ms` }}
                type="button"
              >
                <div className="story-card__meta">
                  <span>{article.feed.title}</span>
                  <time>{formatDate(article.publishedAt)}</time>
                </div>
                <h3>{article.title}</h3>
                <p>{article.summary ?? 'No summary included in the feed.'}</p>
                <div className="story-card__flags">
                  {article.isSaved ? <span>Saved</span> : null}
                  {!article.isRead ? <span>Unread</span> : <span>Read</span>}
                </div>
              </button>
            ))}
          </div>
        </section>

        <article className="panel panel--detail">
          {selectedArticle && !loadingArticle ? (
            <>
              <header className="detail-header">
                <p className="eyebrow">{selectedArticle.feed.title}</p>
                <h2>{selectedArticle.title}</h2>
                <div className="detail-header__meta">
                  <span>{selectedArticle.author ?? 'Unknown author'}</span>
                  <time>{formatDate(selectedArticle.publishedAt)}</time>
                </div>
              </header>

              <div className="detail-toolbar">
                <span>{selectedArticle.isSaved ? 'Saved in shelf' : 'Not saved'}</span>
                <a href={selectedArticle.canonicalUrl} rel="noreferrer" target="_blank">
                  Open original
                </a>
              </div>

              <section className="detail-body">
                <p className="detail-lead">
                  {selectedArticle.summary ?? 'This entry landed without a summary, so the live content is shown below.'}
                </p>
                <div
                  className="detail-content"
                  dangerouslySetInnerHTML={{
                    __html:
                      selectedArticle.contentHtml ??
                      `<p>${selectedArticle.contentText ?? 'No additional content was stored.'}</p>`
                  }}
                />
              </section>
            </>
          ) : null}

          {loadingArticle ? <p className="empty-state">Pulling article detail…</p> : null}
          {!loadingArticle && !selectedArticle ? (
            <p className="empty-state">Pick a story to inspect the full entry.</p>
          ) : null}
        </article>
      </main>
    </div>
  );
}
