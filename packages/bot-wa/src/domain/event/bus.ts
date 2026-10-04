import type {
  NormalizedAuthEvent,
  NormalizedConnectionEvent,
  NormalizedMessageEvent,
} from "../../adapters/contract.js";

/** Event emitted when a plugin fails any verification check. */
export interface PluginRejectedEvent {
  readonly kind: "plugin:rejected";
  readonly name: string;
  readonly reason: string;
  readonly correlationId: string;
}

/** Event emitted when a plugin passes verification and is loaded. */
export interface PluginLoadedEvent {
  readonly kind: "plugin:loaded";
  readonly name: string;
  readonly version: string;
  readonly correlationId: string;
}

/** Event emitted when a sandboxed plugin violates policy or protocol. */
export interface SandboxViolationEvent {
  readonly kind: "sandbox:violation";
  readonly name: string;
  readonly reason: string;
  readonly correlationId: string;
}

/** Payload map for all domain level events. */
export interface DomainEvents {
  message: NormalizedMessageEvent;
  connection: NormalizedConnectionEvent;
  auth: NormalizedAuthEvent;
  "plugin:rejected": PluginRejectedEvent;
  "plugin:loaded": PluginLoadedEvent;
  "sandbox:violation": SandboxViolationEvent;
}

/** Names of typed domain events. */
export type DomainEventName = keyof DomainEvents;

/** Options for bus creation. onError receives isolated listener failures. */
export interface EventBusOptions {
  readonly onError?: (error: unknown, eventName: string) => void;
}

/** Options for listener registration. Higher priority runs first. */
export interface ListenerOptions {
  readonly priority?: number;
  readonly once?: boolean;
}

interface Entry {
  readonly handler: (payload: unknown) => void;
  readonly priority: number;
  once: boolean;
}

interface WildcardEntry {
  readonly handler: (name: DomainEventName, payload: unknown) => void;
  readonly priority: number;
  once: boolean;
}

/**
 * Typed event bus with wildcard, priority, once, and error isolation.
 * A throwing listener never prevents the remaining listeners from running.
 */
export class TypedEventBus {
  private readonly listeners = new Map<DomainEventName, Entry[]>();
  private readonly wildcards: WildcardEntry[] = [];
  private readonly options: EventBusOptions;

  constructor(options: EventBusOptions = {}) {
    this.options = options;
  }

  /** Registers a typed listener. Returns an unsubscribe function. */
  on<K extends DomainEventName>(
    eventName: K,
    handler: (payload: DomainEvents[K]) => void,
    options: ListenerOptions = {},
  ): () => void {
    const entry: Entry = {
      handler: (payload: unknown) => {
        handler(payload as DomainEvents[K]);
      },
      priority: options.priority ?? 0,
      once: options.once ?? false,
    };
    const existing = this.listeners.get(eventName);
    if (existing === undefined) {
      this.listeners.set(eventName, [entry]);
    } else {
      existing.push(entry);
    }
    return () => {
      this.removeEntry(eventName, entry);
    };
  }

  /** Registers a listener for every event name. Returns an unsubscribe function. */
  onWildcard(
    handler: (name: DomainEventName, payload: unknown) => void,
    options: ListenerOptions = {},
  ): () => void {
    const entry: WildcardEntry = {
      handler,
      priority: options.priority ?? 0,
      once: options.once ?? false,
    };
    this.wildcards.push(entry);
    return () => {
      const index = this.wildcards.indexOf(entry);
      if (index >= 0) {
        this.wildcards.splice(index, 1);
      }
    };
  }

  /** Emits an event. Listener errors are isolated and routed to onError. */
  emit<K extends DomainEventName>(eventName: K, payload: DomainEvents[K]): void {
    const named = this.listeners.get(eventName);
    const namedRun = named === undefined ? [] : [...named];
    namedRun.sort((a, b) => b.priority - a.priority);
    for (const entry of namedRun) {
      if (entry.once) {
        this.removeEntry(eventName, entry);
      }
      this.invoke(entry.handler, payload, eventName);
    }
    const wildcardRun = [...this.wildcards];
    wildcardRun.sort((a, b) => b.priority - a.priority);
    for (const entry of wildcardRun) {
      if (entry.once) {
        const index = this.wildcards.indexOf(entry);
        if (index >= 0) {
          this.wildcards.splice(index, 1);
        }
      }
      this.invoke((p: unknown) => entry.handler(eventName, p), payload, eventName);
    }
  }

  private invoke(handler: (payload: unknown) => void, payload: unknown, eventName: string): void {
    try {
      handler(payload);
    } catch (error) {
      if (this.options.onError !== undefined) {
        this.options.onError(error, eventName);
      }
    }
  }

  private removeEntry(eventName: DomainEventName, entry: Entry): void {
    const existing = this.listeners.get(eventName);
    if (existing === undefined) {
      return;
    }
    const index = existing.indexOf(entry);
    if (index >= 0) {
      existing.splice(index, 1);
    }
  }
}

/** Creates a typed event bus. */
export function createEventBus(options: EventBusOptions = {}): TypedEventBus {
  return new TypedEventBus(options);
}
