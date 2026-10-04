/** Bidirectional line channel between host and sandbox. Transport agnostic. */
export interface SandboxChannel {
  readonly closed: boolean;
  send(line: string): void;
  onLine(handler: (line: string) => void): void;
  onClose(handler: () => void): void;
  close(): void;
}

/** In-memory channel pair for tests and development. Synchronous delivery. */
export interface MemoryChannelPair {
  readonly host: SandboxChannel;
  readonly worker: SandboxChannel;
}

class MemoryEndpoint implements SandboxChannel {
  closed = false;
  private peer: MemoryEndpoint | null = null;
  private lineHandlers: Array<(line: string) => void> = [];
  private closeHandlers: Array<() => void> = [];

  attach(peer: MemoryEndpoint): void {
    this.peer = peer;
  }

  send(line: string): void {
    if (this.closed || this.peer === null || this.peer.closed) {
      return;
    }
    for (const handler of [...this.peer.lineHandlers]) {
      handler(line);
    }
  }

  onLine(handler: (line: string) => void): void {
    this.lineHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const handler of [...this.closeHandlers]) {
      handler();
    }
    if (this.peer !== null && !this.peer.closed) {
      this.peer.close();
    }
  }
}

/** Creates two connected in-memory endpoints, one per side. */
export function createMemoryChannelPair(): MemoryChannelPair {
  const host = new MemoryEndpoint();
  const worker = new MemoryEndpoint();
  host.attach(worker);
  worker.attach(host);
  return { host, worker };
}
