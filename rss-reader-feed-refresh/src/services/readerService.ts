import type { SidebarSummary } from '../types/contracts.js';
import type { ServiceDependencies } from '../types/ports.js';

export class ReaderService {
  constructor(private readonly deps: ServiceDependencies) {}

  getSidebar(userId: string): Promise<SidebarSummary> {
    return this.deps.sidebar.getSummary(userId);
  }
}
