import { ConfigError } from "./errors/index.js";

/** Factory that receives the container for lazy dependency resolution. */
export type Factory<T> = (container: Container) => T;

/**
 * Lightweight DI container. Lazy singleton resolution per container instance.
 * No module-level singletons, no global state.
 */
export class Container {
  private readonly factories = new Map<string, Factory<unknown>>();
  private readonly instances = new Map<string, unknown>();
  private readonly resolving: string[] = [];

  /** Registers a factory under a key. Duplicate registration is a config error. */
  register<T>(key: string, factory: Factory<T>): void {
    if (this.factories.has(key)) {
      throw new ConfigError({
        message: `container key already registered: ${key}`,
        context: { key },
      });
    }
    this.factories.set(key, factory as Factory<unknown>);
  }

  /** Reports whether a key is registered. */
  has(key: string): boolean {
    return this.factories.has(key);
  }

  /** Resolves a key once and caches the instance. Detects circular resolution. */
  resolve<T>(key: string): T {
    if (this.instances.has(key)) {
      return this.instances.get(key) as T;
    }
    const factory = this.factories.get(key);
    if (factory === undefined) {
      throw new ConfigError({
        message: `container key not registered: ${key}`,
        context: { key },
      });
    }
    if (this.resolving.includes(key)) {
      const cycle = [...this.resolving, key].join(" -> ");
      throw new ConfigError({
        message: `circular dependency detected: ${cycle}`,
        context: { cycle },
      });
    }
    this.resolving.push(key);
    try {
      const instance = factory(this) as T;
      this.instances.set(key, instance);
      return instance;
    } finally {
      this.resolving.pop();
    }
  }
}

/** Creates an empty container. */
export function createContainer(): Container {
  return new Container();
}
