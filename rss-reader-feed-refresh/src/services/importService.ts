import { NotFoundError } from '../lib/errors.js';
import type { ImportStatusDto } from '../types/contracts.js';
import type { ServiceDependencies } from '../types/ports.js';

export class ImportService {
  constructor(private readonly deps: ServiceDependencies) {}

  async createOpmlImport(userId: string, input: { uploadPath: string }): Promise<{ id: string; status: 'pending' }> {
    const opmlImport = await this.deps.imports.create(userId);
    await this.deps.queue.enqueueOpmlImport({
      importId: opmlImport.id,
      userId,
      uploadPath: input.uploadPath
    });
    return opmlImport;
  }

  async getStatus(userId: string, importId: string): Promise<ImportStatusDto> {
    const status = await this.deps.imports.getById(userId, importId);
    if (!status) {
      throw new NotFoundError('Import not found');
    }
    return status;
  }
}
