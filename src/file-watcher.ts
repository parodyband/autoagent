import fs from "fs";
import path from "path";

/**
 * FileWatcher — watches files for external changes and fires onChange callback.
 * Uses Node built-in fs.watch(). Debounces 500ms per file.
 * Supports muting (suppress own-write events for 2s).
 */
export class FileWatcher {
  /** Callback fired when a watched file changes externally. */
  onChange: ((filePath: string) => void) | null = null;

  private watchers = new Map<string, fs.FSWatcher>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private mutedPaths = new Map<string, ReturnType<typeof setTimeout>>();
  private debounceMs: number;

  constructor(debounceMs = 500) {
    this.debounceMs = debounceMs;
  }

  /**
   * Start watching a file. No-op if already watching.
   */
  watch(filePath: string): void {
    const abs = path.resolve(filePath);
    if (this.watchers.has(abs)) return;

    try {
      const watcher = fs.watch(abs, (eventType) => {
        if (eventType !== "change" && eventType !== "rename") return;
        if (this.mutedPaths.has(abs)) return;

        // Debounce: coalesce rapid successive events into one callback
        const existing = this.debounceTimers.get(abs);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
          this.debounceTimers.delete(abs);
          this.onChange?.(abs);
        }, this.debounceMs);

        this.debounceTimers.set(abs, timer);
      });

      watcher.on("error", () => {
        // Silently clean up on error (file deleted, permission change, etc.)
        this.unwatch(abs);
      });

      this.watchers.set(abs, watcher);
    } catch {
      // File may not exist yet — ignore
    }
  }

  /**
   * Stop watching a specific file.
   */
  unwatch(filePath: string): void {
    const abs = path.resolve(filePath);

    const watcher = this.watchers.get(abs);
    if (watcher) {
      watcher.close();
      this.watchers.delete(abs);
    }

    const timer = this.debounceTimers.get(abs);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(abs);
    }

    const muteTimer = this.mutedPaths.get(abs);
    if (muteTimer) {
      clearTimeout(muteTimer);
      this.mutedPaths.delete(abs);
    }
  }

  /**
   * Stop watching all files and clean up.
   */
  unwatchAll(): void {
    for (const abs of [...this.watchers.keys()]) {
      this.unwatch(abs);
    }
  }

  /**
   * Suppress the next change event for this path (call before agent writes).
   * Auto-unmutes after 2s.
   */
  mute(filePath: string): void {
    const abs = path.resolve(filePath);

    // Clear any existing mute timer
    const existing = this.mutedPaths.get(abs);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.mutedPaths.delete(abs);
    }, 2000);

    this.mutedPaths.set(abs, timer);
  }

  /**
   * Manually clear mute for a path.
   */
  unmute(filePath: string): void {
    const abs = path.resolve(filePath);
    const timer = this.mutedPaths.get(abs);
    if (timer) {
      clearTimeout(timer);
      this.mutedPaths.delete(abs);
    }
  }

  /** Number of currently watched files. */
  get watchedCount(): number {
    return this.watchers.size;
  }

  /** Whether a path is currently muted. */
  isMuted(filePath: string): boolean {
    return this.mutedPaths.has(path.resolve(filePath));
  }
}
