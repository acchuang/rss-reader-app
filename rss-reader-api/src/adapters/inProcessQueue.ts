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

  setProcessors(processors: QueueProcessors): void {
    this.processors = processors;
  }

  async enqueueFeedRefresh(feedId: string): Promise<void> {
    queueMicrotask(() => {
      void this.processors?.onFeedRefresh(feedId).catch((error) => {
        console.error('feed refresh job failed', error);
      });
    });
  }

  async enqueueOpmlImport(input: {
    importId: string;
    userId: string;
    uploadPath?: string;
    opmlContent?: string;
  }): Promise<void> {
    queueMicrotask(() => {
      void this.processors?.onOpmlImport(input).catch((error) => {
        console.error('opml import job failed', error);
      });
    });
  }
}
