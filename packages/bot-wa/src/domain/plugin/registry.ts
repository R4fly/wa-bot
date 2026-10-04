import { PluginError } from "../../kernel/errors/index.js";
import type { PluginManifest } from "./manifest.js";
import type { SandboxHost } from "./sandbox/host.js";

/** One loaded plugin instance plus its sandbox host. */
export interface PluginHandle {
  readonly manifest: PluginManifest;
  readonly host: SandboxHost;
}

/** Registry of loaded plugins keyed by manifest name. */
export class PluginRegistry {
  private readonly handles = new Map<string, PluginHandle>();

  /** Registers a loaded plugin. Duplicate names throw PluginError. */
  set(handle: PluginHandle): void {
    if (this.handles.has(handle.manifest.name)) {
      throw new PluginError({
        message: `plugin already loaded: ${handle.manifest.name}`,
        context: { plugin: handle.manifest.name },
      });
    }
    this.handles.set(handle.manifest.name, handle);
  }

  /** Returns one loaded plugin by name. */
  get(name: string): PluginHandle | undefined {
    return this.handles.get(name);
  }

  /** Lists manifests of all loaded plugins. */
  list(): readonly PluginManifest[] {
    return [...this.handles.values()].map((handle) => handle.manifest);
  }

  /** Closes and removes one plugin. Returns false when absent. */
  async unload(name: string): Promise<boolean> {
    const handle = this.handles.get(name);
    if (handle === undefined) {
      return false;
    }
    handle.host.close();
    this.handles.delete(name);
    return true;
  }
}

/** Creates an empty plugin registry. */
export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistry();
}
