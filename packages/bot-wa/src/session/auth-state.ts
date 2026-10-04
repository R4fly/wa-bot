import type { StorageAdapter } from "../infra/storage/contract.js";

/** Engine agnostic auth state store scoped to one session namespace. */
export interface AuthStateStore {
  load(): Promise<unknown>;
  save(state: unknown): Promise<void>;
  clear(): Promise<boolean>;
}

/** Creates an auth state store over any storage adapter. */
export function createAuthStateStore(storage: StorageAdapter, sessionName: string): AuthStateStore {
  const namespace = `session:${sessionName}`;
  return {
    load(): Promise<unknown> {
      return storage.get(namespace, "auth");
    },
    save(state: unknown): Promise<void> {
      return storage.set(namespace, "auth", state);
    },
    clear(): Promise<boolean> {
      return storage.delete(namespace, "auth");
    },
  };
}
