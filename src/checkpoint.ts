import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";

interface Checkpoint {
  id: number;
  timestamp: number;
  label: string;
  files: Map<string, string | null>; // path → original content (null = file didn't exist)
}

class CheckpointManager {
  private checkpoints: Checkpoint[] = [];
  private currentCheckpoint: Checkpoint | null = null;
  private nextId = 1;

  /** Start tracking a new checkpoint (call at start of user turn) */
  startCheckpoint(label: string): void {
    this.currentCheckpoint = {
      id: this.nextId++,
      timestamp: Date.now(),
      label,
      files: new Map(),
    };
  }

  /** Record original file content before a write (call before write_file) */
  trackFile(filePath: string): void {
    if (!this.currentCheckpoint) return;
    if (this.currentCheckpoint.files.has(filePath)) return; // already tracked
    try {
      const content = existsSync(filePath) ? readFileSync(filePath, "utf-8") : null;
      this.currentCheckpoint.files.set(filePath, content);
    } catch {
      // If we can't read, record null
      this.currentCheckpoint.files.set(filePath, null);
    }
  }

  /** Commit current checkpoint (call after turn completes) */
  commitCheckpoint(): void {
    if (!this.currentCheckpoint) return;
    if (this.currentCheckpoint.files.size > 0) {
      this.checkpoints.push(this.currentCheckpoint);
      // Keep max 20 checkpoints
      if (this.checkpoints.length > 20) this.checkpoints.shift();
    }
    this.currentCheckpoint = null;
  }

  /** Rollback to a checkpoint — restores all files to their pre-edit state */
  rollback(checkpointId: number): { restored: number; errors: string[] } {
    const idx = this.checkpoints.findIndex((c) => c.id === checkpointId);
    if (idx === -1) return { restored: 0, errors: [`Checkpoint ${checkpointId} not found`] };

    const checkpoint = this.checkpoints[idx];
    let restored = 0;
    const errors: string[] = [];

    for (const [filePath, originalContent] of checkpoint.files) {
      try {
        if (originalContent === null) {
          // File didn't exist before — delete it
          if (existsSync(filePath)) unlinkSync(filePath);
        } else {
          writeFileSync(filePath, originalContent, "utf-8");
        }
        restored++;
      } catch (err) {
        errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Remove this and all later checkpoints
    this.checkpoints.splice(idx);
    return { restored, errors };
  }

  /** List recent checkpoints */
  list(count = 10): Array<{ id: number; label: string; fileCount: number; timestamp: number }> {
    return this.checkpoints
      .slice(-count)
      .reverse()
      .map((c) => ({
        id: c.id,
        label: c.label,
        fileCount: c.files.size,
        timestamp: c.timestamp,
      }));
  }
}

export const checkpointManager = new CheckpointManager();
