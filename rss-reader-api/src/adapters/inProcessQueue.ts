import type { QueuePort } from '../types/ports.js';

type QueueProcessors = {
  onFeedRefresh: (feedId: string) => Promise<void>;
  onOpmlImport: (job: {
    importId: string;
    userId: string;
    uploadPath?: string;
    opmlContent?: string;
  }) => Promise<void>;
};

export class InProcessQueue implements QueuePort {
  private processors?: QueueProcessors;
  private readonly pendingFeedIds = new Set<string>();
  private readonly feedQueue: string[] = [];
  private processingFeeds = false;
  private readonly opmlQueue: Array<{
    importId: string;
    userId: string;
    uploadPath?: string;
    opmlContent?: string;
  }> = [];
  private processingOpmlImports = false;

  setProcessors(processors: QueueProcessors): void {
    this.processors = processors;
    void this.drainFeedQueue();
    void this.drainOpmlQueue();
  }

  async enqueueFeedRefresh(feedId: string): Promise<void> {
    if (this.pendingFeedIds.has(feedId)) {
      return;
    }

    this.pendingFeedIds.add(feedId);
    this.feedQueue.push(feedId);

    queueMicrotask(() => {
      void this.drainFeedQueue();
    });
  }

  async enqueueOpmlImport(input: {
    importId: string;
    userId: string;
    uploadPath?: string;
    opmlContent?: string;
  }): Promise<void> {
    this.opmlQueue.push(input);

    queueMicrotask(() => {
      void this.drainOpmlQueue();
    });
  }

  private async drainFeedQueue(): Promise<void> {
    if (this.processingFeeds || !this.processors) {
      return;
    }

    this.processingFeeds = true;

    try {
      while (this.feedQueue.length > 0) {
        const feedId = this.feedQueue.shift();
        if (!feedId) {
          continue;
        }

        try {
          await this.processors.onFeedRefresh(feedId);
        } catch (error) {
          console.error('feed refresh job failed', error);
        } finally {
          this.pendingFeedIds.delete(feedId);
        }
      }
    } finally {
      this.processingFeeds = false;
    }
  }

  private async drainOpmlQueue(): Promise<void> {
    if (this.processingOpmlImports || !this.processors) {
      return;
    }

    this.processingOpmlImports = true;

    try {
      while (this.opmlQueue.length > 0) {
        const job = this.opmlQueue.shift();
        if (!job) {
          continue;
        }

        try {
          await this.processors.onOpmlImport(job);
        } catch (error) {
          console.error('opml import job failed', error);
        }
      }
    } finally {
      this.processingOpmlImports = false;
    }
  }
}
