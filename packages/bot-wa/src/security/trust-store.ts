import type { StorageAdapter } from "../infra/storage/contract.js";
import { keyFingerprint } from "./hash.js";

/** One publisher entry in the trust store. */
export interface TrustEntry {
  readonly publicKey: string;
  readonly fingerprint: string;
  readonly addedAt: string;
  readonly revoked: boolean;
  readonly revokedAt?: string;
}

/** Publisher trust store. Bootstrap is manual trust add, no bundled keys. */
export interface TrustStore {
  add(publicKey: string, addedAt: string): Promise<void>;
  remove(publicKey: string): Promise<boolean>;
  revoke(publicKey: string, revokedAt: string): Promise<boolean>;
  has(publicKey: string): Promise<boolean>;
  isRevoked(publicKey: string): Promise<boolean>;
  isTrusted(publicKey: string): Promise<boolean>;
  list(): Promise<readonly TrustEntry[]>;
}

function isTrustEntry(value: unknown): value is TrustEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record["publicKey"] === "string" && typeof record["revoked"] === "boolean";
}

/** Creates a trust store over any storage adapter, namespace trust-store. */
export function createTrustStore(storage: StorageAdapter): TrustStore {
  const namespace = "trust-store";

  async function readEntry(publicKey: string): Promise<TrustEntry | undefined> {
    const raw = await storage.get(namespace, keyFingerprint(publicKey));
    return isTrustEntry(raw) ? raw : undefined;
  }

  return {
    async add(publicKey: string, addedAt: string): Promise<void> {
      await storage.set(namespace, keyFingerprint(publicKey), {
        publicKey,
        fingerprint: keyFingerprint(publicKey),
        addedAt,
        revoked: false,
      });
    },
    async remove(publicKey: string): Promise<boolean> {
      return storage.delete(namespace, keyFingerprint(publicKey));
    },
    async revoke(publicKey: string, revokedAt: string): Promise<boolean> {
      const existing = await readEntry(publicKey);
      if (existing === undefined) {
        return false;
      }
      await storage.set(namespace, keyFingerprint(publicKey), {
        publicKey: existing.publicKey,
        fingerprint: existing.fingerprint,
        addedAt: existing.addedAt,
        revoked: true,
        revokedAt,
      });
      return true;
    },
    async has(publicKey: string): Promise<boolean> {
      return (await readEntry(publicKey)) !== undefined;
    },
    async isRevoked(publicKey: string): Promise<boolean> {
      const entry = await readEntry(publicKey);
      return entry !== undefined && entry.revoked;
    },
    async isTrusted(publicKey: string): Promise<boolean> {
      const entry = await readEntry(publicKey);
      return entry !== undefined && !entry.revoked;
    },
    async list(): Promise<readonly TrustEntry[]> {
      const keys = await storage.keys(namespace);
      const entries: TrustEntry[] = [];
      for (const key of keys) {
        const raw = await storage.get(namespace, key);
        if (isTrustEntry(raw)) {
          entries.push(raw);
        }
      }
      return entries;
    },
  };
}
