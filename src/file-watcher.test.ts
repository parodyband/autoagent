// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { FileWatcher } from "./file-watcher.js";

let tmpDir: string;
let watcher: FileWatcher;

afterEach(() => {
  watcher?.unwatchAll();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeTmp(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fw-test-"));
  return tmpDir;
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

describe("FileWatcher", () => {
  it("watch fires onChange", async () => {
    const dir = makeTmp();
    const file = path.join(dir, "a.txt");
    fs.writeFileSync(file, "init");
    watcher = new FileWatcher(50);
    const calls: string[] = [];
    watcher.onChange = (p) => calls.push(p);
    watcher.watch(file);
    await sleep(100);
    fs.writeFileSync(file, "changed");
    await sleep(300);
    expect(calls).toContain(file);
  });

  it("mute suppresses onChange", async () => {
    const dir = makeTmp();
    const file = path.join(dir, "b.txt");
    fs.writeFileSync(file, "init");
    watcher = new FileWatcher(50);
    const calls: string[] = [];
    watcher.onChange = (p) => calls.push(p);
    watcher.watch(file);
    watcher.mute(file);
    await sleep(100);
    fs.writeFileSync(file, "changed");
    await sleep(300);
    expect(calls).toHaveLength(0);
  });

  it("unmute re-enables onChange", async () => {
    const dir = makeTmp();
    const file = path.join(dir, "c.txt");
    fs.writeFileSync(file, "init");
    watcher = new FileWatcher(50);
    const calls: string[] = [];
    watcher.onChange = (p) => calls.push(p);
    watcher.watch(file);
    watcher.mute(file);
    watcher.unmute(file);
    await sleep(100);
    fs.writeFileSync(file, "changed");
    await sleep(300);
    expect(calls).toContain(file);
  });

  it("unwatch stops events", async () => {
    const dir = makeTmp();
    const file = path.join(dir, "d.txt");
    fs.writeFileSync(file, "init");
    watcher = new FileWatcher(50);
    const calls: string[] = [];
    watcher.onChange = (p) => calls.push(p);
    watcher.watch(file);
    watcher.unwatch(file);
    await sleep(100);
    fs.writeFileSync(file, "changed");
    await sleep(300);
    expect(calls).toHaveLength(0);
  });

  it("debounce coalesces rapid writes", async () => {
    const dir = makeTmp();
    const file = path.join(dir, "e.txt");
    fs.writeFileSync(file, "init");
    watcher = new FileWatcher(150);
    const calls: string[] = [];
    watcher.onChange = (p) => calls.push(p);
    watcher.watch(file);
    await sleep(100);
    fs.writeFileSync(file, "v1");
    fs.writeFileSync(file, "v2");
    fs.writeFileSync(file, "v3");
    await sleep(600);
    expect(calls.length).toBe(1);
  });

  it("accessors return correct state", () => {
    const dir = makeTmp();
    const f1 = path.join(dir, "f1.txt");
    const f2 = path.join(dir, "f2.txt");
    fs.writeFileSync(f1, "");
    fs.writeFileSync(f2, "");
    watcher = new FileWatcher(50);
    expect(watcher.watchedCount).toBe(0);
    expect(watcher.isMuted(f1)).toBe(false);
    watcher.watch(f1);
    watcher.watch(f2);
    expect(watcher.watchedCount).toBe(2);
    watcher.mute(f1);
    expect(watcher.isMuted(f1)).toBe(true);
    watcher.unmute(f1);
    expect(watcher.isMuted(f1)).toBe(false);
  });
});
