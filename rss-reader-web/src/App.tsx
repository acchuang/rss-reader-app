import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';

type FeedStatus = 'active' | 'degraded' | 'failing' | 'disabled';

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
    status: FeedStatus;
    unreadCount: number;
  }>;
};

type Subscription = {
  id: string;
  folderId: string | null;
  titleOverride: string | null;
  createdAt: string;
  updatedAt: string;
  feed: {
    id: string;
    title: string | null;
    feedUrl: string;
    siteUrl: string | null;
    status: FeedStatus;
  };
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

type ArticleStateMutationResponse = {
  articleId: string;
  isRead: boolean;
  readAt: string | null;
  isSaved: boolean;
  savedAt: string | null;
};

type BulkMarkReadResponse = {
  articleIds: string[];
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

type PendingAction = 'read' | 'unread' | 'save' | 'unsave';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://api-production-c2fc.up.railway.app';

const KEYBOARD_CARDS = [
  { key: 'J / K', label: 'Move selection' },
  { key: 'M', label: 'Mark read/unread' },
  { key: 'S', label: 'Save/unsave' },
  { key: 'O', label: 'Open original' },
  { key: '/', label: 'Focus search' }
];

function formatDate(value: string | null): string {
  if (!value) {
    return 'Freshly filed';
  }

  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function timeAgo(value: string | null): string {
  if (!value) {
    return 'Now';
  }

  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function estimateReadTime(article: Pick<ArticleDetail, 'contentText' | 'summary'>): string {
  const text = article.contentText ?? article.summary ?? '';
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 180));
  return `${minutes} min read`;
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

function statusLabel(status: FeedStatus): string {
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

function getPreviousReadAt(article: ArticleSummary | ArticleDetail): string | null {
  return 'readAt' in article ? article.readAt : null;
}

function getPreviousSavedAt(article: ArticleSummary | ArticleDetail): string | null {
  return 'savedAt' in article ? article.savedAt : null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function App() {
  const [sidebar, setSidebar] = useState<SidebarResponse | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('unread');
  const [scope, setScope] = useState<Scope>({ kind: 'home' });
  const [searchDraft, setSearchDraft] = useState('');
  const [searchResults, setSearchResults] = useState<ArticleSummary[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [loadingSidebar, setLoadingSidebar] = useState(true);
  const [pendingMap, setPendingMap] = useState<Record<string, PendingAction | undefined>>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const deferredSearch = useDeferredValue(searchDraft.trim());
  const visibleArticles = searchResults ?? articles;
  const selectedIndex = visibleArticles.findIndex((article) => article.id === selectedArticleId);

  const selectedTitle =
    scope.kind === 'home'
      ? viewMode === 'unread'
        ? 'All unread'
        : 'Saved shelf'
      : scope.title;

  const folderLookup = new Map((sidebar?.folders ?? []).map((folder) => [folder.id, folder.name]));

  function clearSearchState() {
    setSearchDraft('');
    setSearchResults(null);
  }

  function selectHome(nextViewMode: ViewMode = 'unread') {
    setViewMode(nextViewMode);
    setScope({ kind: 'home' });
    clearSearchState();
  }

  function selectFolder(folderId: string, title: string) {
    setViewMode('unread');
    setScope({ kind: 'folder', folderId, title });
    clearSearchState();
  }

  function selectFeed(subscriptionId: string, title: string) {
    setViewMode('unread');
    setScope({ kind: 'feed', subscriptionId, title });
    clearSearchState();
    setSourceDrawerOpen(false);
  }

  async function refreshSidebar() {
    setLoadingSidebar(true);
    try {
      const data = await fetchJson<SidebarResponse>(`${API_BASE_URL}/api/sidebar`, {
        headers: {}
      });
      setSidebar(data);
    } finally {
      setLoadingSidebar(false);
    }
  }

  async function refreshSubscriptions() {
    const data = await fetchJson<Subscription[]>(`${API_BASE_URL}/api/subscriptions`, {
      headers: {}
    });
    setSubscriptions(data);
  }

  async function refreshArticles(nextViewMode: ViewMode, nextScope: Scope) {
    setLoadingList(true);
    setError(null);

    try {
      const data = await fetchJson<ArticleListResponse>(buildArticlesUrl(nextViewMode, nextScope), {
        headers: {}
      });
      setArticles(data.items);
      startTransition(() => {
        setSelectedArticleId(data.items[0]?.id ?? null);
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load articles');
      setArticles([]);
      setSelectedArticleId(null);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [sidebarData, subscriptionData, articleData] = await Promise.all([
          fetchJson<SidebarResponse>(`${API_BASE_URL}/api/sidebar`),
          fetchJson<Subscription[]>(`${API_BASE_URL}/api/subscriptions`),
          fetchJson<ArticleListResponse>(buildArticlesUrl('unread', { kind: 'home' }))
        ]);

        if (cancelled) {
          return;
        }

        setSidebar(sidebarData);
        setSubscriptions(subscriptionData);
        setArticles(articleData.items);
        setSelectedArticleId(articleData.items[0]?.id ?? null);
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load reader');
        }
      } finally {
        if (!cancelled) {
          setLoadingSidebar(false);
          setLoadingList(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refreshArticles(viewMode, scope);

    return () => {
      cancelled = true;
      void cancelled;
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
        const data = await fetchJson<ArticleDetail>(`${API_BASE_URL}/api/articles/${selectedArticleId}`);
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
        const data = await fetchJson<SearchResponse>(url.toString());

        if (cancelled) {
          return;
        }

        setSearchResults(data.items);
        if (data.items[0]) {
          setSelectedArticleId(data.items[0].id);
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.getAttribute('contenteditable') === 'true';

      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (isTyping) {
        return;
      }

      if (event.key.toLowerCase() === 'j') {
        event.preventDefault();
        const next = visibleArticles[Math.min(visibleArticles.length - 1, selectedIndex + 1)];
        if (next) {
          setSelectedArticleId(next.id);
        }
      }

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const next = visibleArticles[Math.max(0, selectedIndex - 1)];
        if (next) {
          setSelectedArticleId(next.id);
        }
      }

      if (event.key.toLowerCase() === 'm' && selectedArticle) {
        event.preventDefault();
        void handleToggleRead(selectedArticle.id, !selectedArticle.isRead);
      }

      if (event.key.toLowerCase() === 's' && selectedArticle) {
        event.preventDefault();
        void handleToggleSaved(selectedArticle.id, !selectedArticle.isSaved);
      }

      if (event.key.toLowerCase() === 'o' && selectedArticle) {
        event.preventDefault();
        window.open(selectedArticle.canonicalUrl, '_blank', 'noopener,noreferrer');
      }

      if (event.key === 'Escape') {
        setSearchDraft('');
        setSearchResults(null);
        setSourceDrawerOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedArticle, selectedIndex, visibleArticles]);

  function updateArticleState(articleId: string, patch: Partial<ArticleSummary & ArticleDetail>) {
    setArticles((current) =>
      current.map((article) => (article.id === articleId ? { ...article, ...patch } : article))
    );
    setSearchResults((current) =>
      current?.map((article) => (article.id === articleId ? { ...article, ...patch } : article)) ?? null
    );
    setSelectedArticle((current) =>
      current && current.id === articleId ? { ...current, ...patch } : current
    );
  }

  function removeArticleFromUnread(articleId: string) {
    setArticles((current) => current.filter((article) => article.id !== articleId));
    setSearchResults((current) => current?.filter((article) => article.id !== articleId) ?? null);

    if (selectedArticleId === articleId) {
      const fallback = visibleArticles.find((article) => article.id !== articleId) ?? null;
      setSelectedArticleId(fallback?.id ?? null);
    }
  }

  async function handleToggleRead(articleId: string, shouldRead: boolean) {
    const previous = visibleArticles.find((article) => article.id === articleId) ?? selectedArticle;
    if (!previous) {
      return;
    }

    setPendingMap((current) => ({ ...current, [articleId]: shouldRead ? 'read' : 'unread' }));
    updateArticleState(articleId, {
      isRead: shouldRead,
      readAt: shouldRead ? new Date().toISOString() : null
    });

    if (viewMode === 'unread' && shouldRead && !searchResults) {
      removeArticleFromUnread(articleId);
    }

    try {
      const endpoint = shouldRead ? 'read' : 'unread';
      const result = await fetchJson<ArticleStateMutationResponse>(
        `${API_BASE_URL}/api/articles/${articleId}/${endpoint}`,
        { method: 'POST', body: '{}' }
      );

      updateArticleState(articleId, {
        isRead: result.isRead,
        readAt: result.readAt
      });

      await refreshSidebar();
      if (viewMode === 'saved') {
        await refreshArticles(viewMode, scope);
      }
    } catch (caughtError) {
      updateArticleState(articleId, {
        isRead: previous.isRead,
        readAt: getPreviousReadAt(previous)
      });
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update read state');
      await refreshArticles(viewMode, scope);
      await refreshSidebar();
    } finally {
      setPendingMap((current) => ({ ...current, [articleId]: undefined }));
    }
  }

  async function handleToggleSaved(articleId: string, shouldSave: boolean) {
    const previous = visibleArticles.find((article) => article.id === articleId) ?? selectedArticle;
    if (!previous) {
      return;
    }

    setPendingMap((current) => ({ ...current, [articleId]: shouldSave ? 'save' : 'unsave' }));
    updateArticleState(articleId, {
      isSaved: shouldSave,
      savedAt: shouldSave ? new Date().toISOString() : null
    });

    if (viewMode === 'saved' && !shouldSave && !searchResults) {
      setArticles((current) => current.filter((article) => article.id !== articleId));
      if (selectedArticleId === articleId) {
        const fallback = visibleArticles.find((article) => article.id !== articleId) ?? null;
        setSelectedArticleId(fallback?.id ?? null);
      }
    }

    try {
      const endpoint = shouldSave ? 'save' : 'unsave';
      const result = await fetchJson<ArticleStateMutationResponse>(
        `${API_BASE_URL}/api/articles/${articleId}/${endpoint}`,
        { method: 'POST', body: '{}' }
      );

      updateArticleState(articleId, {
        isSaved: result.isSaved,
        savedAt: result.savedAt
      });

      await refreshSidebar();
      if (viewMode === 'saved') {
        await refreshArticles(viewMode, scope);
      }
    } catch (caughtError) {
      updateArticleState(articleId, {
        isSaved: previous.isSaved,
        savedAt: getPreviousSavedAt(previous)
      });
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update saved state');
      await refreshArticles(viewMode, scope);
      await refreshSidebar();
    } finally {
      setPendingMap((current) => ({ ...current, [articleId]: undefined }));
    }
  }

  async function handleMarkVisibleRead() {
    const unreadIds = visibleArticles.filter((article) => !article.isRead).map((article) => article.id);
    if (unreadIds.length === 0) {
      return;
    }

    setBulkLoading(true);
    const previous = articles;
    const previousSearch = searchResults;

    setArticles((current) => current.filter((article) => article.isRead));
    setSearchResults((current) => current?.filter((article) => article.isRead) ?? null);

    try {
      await fetchJson<BulkMarkReadResponse>(`${API_BASE_URL}/api/articles/bulk-mark-read`, {
        method: 'POST',
        body: JSON.stringify({ articleIds: unreadIds })
      });

      await refreshSidebar();
      await refreshArticles(viewMode, scope);
    } catch (caughtError) {
      setArticles(previous);
      setSearchResults(previousSearch);
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to bulk mark articles as read');
    } finally {
      setBulkLoading(false);
    }
  }

  const groupedFeeds = (sidebar?.folders ?? []).map((folder) => ({
    ...folder,
    feeds: (sidebar?.feeds ?? []).filter((feed) => feed.folderId === folder.id)
  }));
  const rootFeeds = (sidebar?.feeds ?? []).filter((feed) => feed.folderId === null);

  return (
    <div className="shell shell--editorial">
      <div className="shell__glow shell__glow--amber" />
      <div className="shell__glow shell__glow--teal" />
      <div className="shell__glow shell__glow--ink" />

      <header className="topbar topbar--magazine">
        <div className="topbar__headline">
          <p className="eyebrow">Signal Cabinet</p>
          <h1>Feedly-style reading, now upgraded into a full editorial desk.</h1>
          <p className="lede">
            Triage the live Railway feed set, jump by folder, search the archive, and manage read/save state
            without leaving the stream.
          </p>
        </div>

        <div className="topbar__controls topbar__controls--stacked">
          <label className="search search--hero">
            <span>Search archive</span>
            <input
              ref={searchInputRef}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Press / to focus"
            />
          </label>

          <div className="topbar__actions">
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

            <button className="utility-button" onClick={() => setSourceDrawerOpen((current) => !current)} type="button">
              {sourceDrawerOpen ? 'Hide sources' : 'Source directory'}
            </button>
          </div>
        </div>
      </header>

      <section className="headline-strip">
        <article className="headline-card">
          <span>Unread cabinet</span>
          <strong>{loadingSidebar ? '...' : sidebar?.views.unreadCount ?? 0}</strong>
          <small>live queue</small>
        </article>
        <article className="headline-card">
          <span>Saved shelf</span>
          <strong>{loadingSidebar ? '...' : sidebar?.views.savedCount ?? 0}</strong>
          <small>kept for later</small>
        </article>
        <article className="headline-card">
          <span>Current lane</span>
          <strong>{selectedTitle}</strong>
          <small>{searchResults ? 'search results' : `${visibleArticles.length} visible stories`}</small>
        </article>
      </section>

      <main className="reader-grid reader-grid--enhanced">
        <aside className="panel panel--nav">
          <section className="nav-block nav-block--hero">
            <h2>Desk</h2>
            <button
              className={scope.kind === 'home' ? 'nav-item is-active' : 'nav-item'}
              onClick={() => selectHome('unread')}
              type="button"
            >
              <span>Everything</span>
              <em>{sidebar?.views.unreadCount ?? 0}</em>
            </button>
            <button
              className={viewMode === 'saved' && scope.kind === 'home' ? 'nav-item is-active' : 'nav-item'}
              onClick={() => selectHome('saved')}
              type="button"
            >
              <span>Saved shelf</span>
              <em>{sidebar?.views.savedCount ?? 0}</em>
            </button>
          </section>

          <section className="nav-block">
            <h2>Cabinets</h2>
            {sidebar?.folders.map((folder) => (
              <button
                key={folder.id}
                className={
                  scope.kind === 'folder' && scope.folderId === folder.id ? 'nav-item is-active' : 'nav-item'
                }
                onClick={() => selectFolder(folder.id, folder.name)}
                type="button"
              >
                <span>{folder.name}</span>
                <em>{folder.unreadCount}</em>
              </button>
            ))}
          </section>

          <section className="nav-block">
            <h2>Feeds</h2>
            <div className="nav-feed-list">
              {(sidebar?.feeds ?? []).map((feed) => (
                <button
                  key={feed.subscriptionId}
                  className={
                    scope.kind === 'feed' && scope.subscriptionId === feed.subscriptionId
                      ? 'nav-item is-active'
                      : 'nav-item'
                  }
                  onClick={() => selectFeed(feed.subscriptionId, feed.title)}
                  type="button"
                >
                  <span>{feed.title}</span>
                  <em>{feed.unreadCount}</em>
                </button>
              ))}
            </div>
          </section>

          <section className="nav-block">
            <h2>Keyboard</h2>
            <div className="shortcut-stack">
              {KEYBOARD_CARDS.map((shortcut) => (
                <div key={shortcut.key} className="shortcut-card">
                  <strong>{shortcut.key}</strong>
                  <span>{shortcut.label}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="panel panel--list panel--list-rich">
          <header className="panel__header panel__header--rich">
            <div>
              <p className="eyebrow">{searchResults ? 'Archive query' : 'Reading queue'}</p>
              <h2>{searchResults ? `Results for "${deferredSearch}"` : selectedTitle}</h2>
            </div>

            <div className="panel__header-actions">
              <span className="panel__count">{visibleArticles.length} stories</span>
              <button
                className="utility-button"
                disabled={bulkLoading || visibleArticles.every((article) => article.isRead)}
                onClick={() => void handleMarkVisibleRead()}
                type="button"
              >
                {bulkLoading ? 'Marking…' : 'Mark visible read'}
              </button>
            </div>
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
              <article
                key={article.id}
                className={article.id === selectedArticleId ? 'story-card is-active' : 'story-card'}
                style={{ animationDelay: `${index * 55}ms` }}
              >
                <button className="story-card__hit" onClick={() => setSelectedArticleId(article.id)} type="button">
                  <div className="story-card__meta">
                    <span>{article.feed.title}</span>
                    <time>{timeAgo(article.publishedAt)}</time>
                  </div>
                  <h3>{article.title}</h3>
                  <p>{article.summary ?? 'No summary included in the feed.'}</p>
                </button>

                <div className="story-card__footer">
                  <div className="story-card__flags">
                    {article.isSaved ? <span>Saved</span> : null}
                    {!article.isRead ? <span>Unread</span> : <span>Read</span>}
                    <span>{formatDate(article.publishedAt)}</span>
                  </div>

                  <div className="story-card__actions">
                    <button
                      className="icon-button"
                      disabled={Boolean(pendingMap[article.id])}
                      onClick={() => void handleToggleRead(article.id, !article.isRead)}
                      type="button"
                    >
                      {article.isRead ? 'Unread' : 'Read'}
                    </button>
                    <button
                      className="icon-button"
                      disabled={Boolean(pendingMap[article.id])}
                      onClick={() => void handleToggleSaved(article.id, !article.isSaved)}
                      type="button"
                    >
                      {article.isSaved ? 'Unsave' : 'Save'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <article className="panel panel--detail panel--detail-rich">
          {selectedArticle && !loadingArticle ? (
            <>
              <header className="detail-header">
                <div className="detail-header__eyebrow">
                  <p className="eyebrow">{selectedArticle.feed.title}</p>
                  <span>{statusLabel(subscriptions.find((entry) => entry.feed.id === selectedArticle.feed.id)?.feed.status ?? 'active')}</span>
                </div>
                <h2>{selectedArticle.title}</h2>
                <div className="detail-header__meta">
                  <span>{selectedArticle.author ?? 'Unknown author'}</span>
                  <time>{formatDate(selectedArticle.publishedAt)}</time>
                  <span>{estimateReadTime(selectedArticle)}</span>
                </div>
              </header>

              <div className="detail-toolbar detail-toolbar--actions">
                <div className="detail-toolbar__group">
                  <button
                    className="utility-button"
                    disabled={Boolean(pendingMap[selectedArticle.id])}
                    onClick={() => void handleToggleRead(selectedArticle.id, !selectedArticle.isRead)}
                    type="button"
                  >
                    {selectedArticle.isRead ? 'Mark unread' : 'Mark read'}
                  </button>
                  <button
                    className="utility-button"
                    disabled={Boolean(pendingMap[selectedArticle.id])}
                    onClick={() => void handleToggleSaved(selectedArticle.id, !selectedArticle.isSaved)}
                    type="button"
                  >
                    {selectedArticle.isSaved ? 'Remove from saved' : 'Save article'}
                  </button>
                </div>

                <a href={selectedArticle.canonicalUrl} rel="noreferrer" target="_blank">
                  Open original
                </a>
              </div>

              <section className="detail-body">
                <div className="detail-summary-card">
                  <div>
                    <span>Summary</span>
                    <strong>{selectedArticle.summary ?? 'No summary provided'}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{selectedArticle.isSaved ? 'Saved' : 'Live in queue'}</strong>
                  </div>
                </div>

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

      <aside className={sourceDrawerOpen ? 'source-drawer is-open' : 'source-drawer'}>
        <header className="source-drawer__header">
          <div>
            <p className="eyebrow">Source directory</p>
            <h2>All connected feeds</h2>
          </div>
          <button className="utility-button" onClick={() => setSourceDrawerOpen(false)} type="button">
            Close
          </button>
        </header>

        <div className="source-drawer__body">
          {groupedFeeds.map((group) => (
            <section key={group.id} className="source-cluster">
              <h3>{group.name}</h3>
              {group.feeds.map((feed) => {
                const subscription = subscriptions.find((entry) => entry.id === feed.subscriptionId);
                return (
                  <button
                    key={feed.subscriptionId}
                    className="source-card"
                    onClick={() => selectFeed(feed.subscriptionId, feed.title)}
                    type="button"
                  >
                    <div>
                      <strong>{feed.title}</strong>
                      <p>{subscription?.feed.siteUrl ?? subscription?.feed.feedUrl ?? 'Feed URL unavailable'}</p>
                    </div>
                    <div className="source-card__meta">
                      <span data-status={feed.status}>{statusLabel(feed.status)}</span>
                      <em>{feed.unreadCount} unread</em>
                    </div>
                  </button>
                );
              })}
            </section>
          ))}

          {rootFeeds.length > 0 ? (
            <section className="source-cluster">
              <h3>Unsorted feeds</h3>
              {rootFeeds.map((feed) => {
                const subscription = subscriptions.find((entry) => entry.id === feed.subscriptionId);
                return (
                  <button
                    key={feed.subscriptionId}
                    className="source-card"
                    onClick={() => selectFeed(feed.subscriptionId, feed.title)}
                    type="button"
                  >
                    <div>
                      <strong>{feed.title}</strong>
                      <p>{subscription?.feed.siteUrl ?? subscription?.feed.feedUrl ?? 'Feed URL unavailable'}</p>
                    </div>
                    <div className="source-card__meta">
                      <span data-status={feed.status}>{statusLabel(feed.status)}</span>
                      <em>{feed.unreadCount} unread</em>
                    </div>
                  </button>
                );
              })}
            </section>
          ) : null}

          <section className="source-cluster">
            <h3>Subscription ledger</h3>
            {subscriptions.map((subscription) => (
              <article key={subscription.id} className="source-card source-card--ledger">
                <div>
                  <strong>{subscription.titleOverride ?? subscription.feed.title ?? 'Untitled feed'}</strong>
                  <p>{subscription.feed.feedUrl}</p>
                </div>
                <div className="source-card__meta">
                  <span data-status={subscription.feed.status}>{statusLabel(subscription.feed.status)}</span>
                  <em>{folderLookup.get(subscription.folderId ?? '') ?? 'No folder'}</em>
                </div>
              </article>
            ))}
          </section>
        </div>
      </aside>
    </div>
  );
}
