import { ConflictError, NotFoundError } from '../lib/errors.js';
import type { FolderDto } from '../types/contracts.js';
import type { ServiceDependencies } from '../types/ports.js';

export class FolderService {
  constructor(private readonly deps: ServiceDependencies) {}

  list(userId: string): Promise<FolderDto[]> {
    return this.deps.folders.listByUser(userId);
  }

  async create(userId: string, input: { name: string }): Promise<FolderDto> {
    try {
      return await this.deps.folders.create(userId, input.name);
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictError('Folder name already exists');
      }

      throw error;
    }
  }

  async rename(userId: string, folderId: string, input: { name: string }): Promise<FolderDto> {
    try {
      const folder = await this.deps.folders.rename(userId, folderId, input.name);
      if (!folder) {
        throw new NotFoundError('Folder not found');
      }
      return folder;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictError('Folder name already exists');
      }
      throw error;
    }
  }

  async delete(userId: string, folderId: string): Promise<{ deleted: true }> {
    const deleted = await this.deps.folders.delete(userId, folderId);
    if (!deleted) {
      throw new NotFoundError('Folder not found');
    }

    return { deleted: true };
  }
}
