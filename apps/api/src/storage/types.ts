export interface StorageBackend {
  put(id: string, bytes: Buffer): Promise<{ storageKey: string }>;
  get(storageKey: string): Promise<Buffer | null>;
  delete?(storageKey: string): Promise<void>;
}
