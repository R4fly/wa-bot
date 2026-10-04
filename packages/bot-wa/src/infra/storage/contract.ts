/** Options for one set operation. TTL is optional and adapter enforced. */
export interface StorageSetOptions {
  readonly ttlMs?: number;
}

/** Contract every storage adapter must implement. */
export interface StorageAdapter {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  get(namespace: string, key: string): Promise<unknown>;
  set(namespace: string, key: string, value: unknown, options?: StorageSetOptions): Promise<void>;
  delete(namespace: string, key: string): Promise<boolean>;
  has(namespace: string, key: string): Promise<boolean>;
  keys(namespace: string, prefix?: string): Promise<readonly string[]>;
  clear(namespace: string): Promise<void>;
}
