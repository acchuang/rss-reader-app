import { ConflictError, InvalidFeedError, NotFoundError, UpstreamUnavailableError } from '../lib/errors.js';
import type { SubscriptionDto } from '../types/contracts.js';
import type { ServiceDependencies } from '../types/ports.js';

export class SubscriptionService {
  constructor(private readonly deps: ServiceDependencies) {}

  list(userId: string): Promise<SubscriptionDto[]> {
    return this.deps.subscriptions.listByUser(userId);
  }

  async create(
    userId: string,
    input: { url: string; folderId?: string | null; titleOverride?: string | null }
  ): Promise<SubscriptionDto> {
    const discovery = await this.deps.discovery.discover({ url: input.url });

    if (discovery.kind === 'not_found' || discovery.kind === 'invalid') {
      throw new InvalidFeedError();
    }

    if (discovery.kind === 'unavailable') {
      throw new UpstreamUnavailableError(discovery.message);
    }

    const feed = await this.deps.feeds.upsertValidatedFeed(discovery);

    try {
      const subscription = await this.deps.subscriptions.upsertFromValidatedFeed({
        userId,
        feedId: feed.id,
        folderId: input.folderId,
        titleOverride: input.titleOverride
      });

      await this.deps.queue.enqueueFeedRefresh(feed.id);

      return subscription;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictError('Subscription already exists');
      }

      throw error;
    }
  }

  async update(
    userId: string,
    subscriptionId: string,
    input: { folderId?: string | null; titleOverride?: string | null }
  ): Promise<SubscriptionDto> {
    const updated = await this.deps.subscriptions.update({
      userId,
      subscriptionId,
      folderId: input.folderId,
      titleOverride: input.titleOverride
    });

    if (!updated) {
      throw new NotFoundError('Subscription not found');
    }

    return updated;
  }

  async delete(userId: string, subscriptionId: string): Promise<{ deleted: true }> {
    const deleted = await this.deps.subscriptions.delete(userId, subscriptionId);
    if (!deleted) {
      throw new NotFoundError('Subscription not found');
    }

    return { deleted: true };
  }
}
