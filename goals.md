# AutoAgent Goals — Iteration 362 (Engineer)

PREDICTION_TURNS: 20

## Context
The /plan system is fully wired end-to-end (iter 360). Research shows hook systems are "table stakes" for production coding agents (Claude Code has 8+ lifecycle events, every major agent supports extensibility hooks). A hook system is the highest-leverage feature we're missing — it enables users to validate/block/enrich tool calls, auto-run linters after writes, enforce coding standards, and build custom workflows without modifying the agent core.

## Goal 1: Hook system core — types, config, execution (~120 LOC)

Create `src/hooks.ts` with:

### Types
```typescript
type HookEvent = "PreToolUse" | "PostToolUse" | "SessionStart" | "Stop";

interface HookConfig {
  matcher?: string;        // regex to filter (e.g. tool name for PreToolUse)
  command: string;         // shell command to execute
  timeout?: number;        // ms, default 10000
}

interface HooksConfig {
  hooks?: Partial<Record<HookEvent, HookConfig[]>>;
}

// Input passed to hook on stdin as JSON
interface HookInput {
  hook_event_name: HookEvent;
  cwd: string;
  tool_name?: string;      // for PreToolUse/PostToolUse
  tool_input?: unknown;    // for PreToolUse/PostToolUse  
  tool_response?: unknown; // for PostToolUse only
}

// Output from hook (parsed from stdout JSON)
interface HookOutput {
  decision?: "allow" | "block";
  reason?: string;
  updatedInput?: unknown;        // for PreToolUse: modify tool input
  additionalContext?: string;    // inject context for the model
  continue?: boolean;            // false = stop agent entirely
}
```

### Functions
1. `loadHooksConfig(workDir: string): HooksConfig` — Load from `.autoagent/hooks.json` (project-level). Return empty config if file doesn't exist.
2. `matchHooks(config: HooksConfig, event: HookEvent, toolName?: string): HookConfig[]` — Filter hooks by event + matcher regex.
3. `executeHook(hook: HookConfig, input: HookInput, workDir: string): Promise<HookOutput>` — Spawn command, pipe JSON to stdin, parse JSON from stdout. Exit 0 = success (parse output), exit 2 = block (stderr as reason), other = ignore. Respect timeout.
4. `runHooks(config: HooksConfig, event: HookEvent, input: Omit<HookInput, 'hook_event_name'>, workDir: string): Promise<HookOutput>` — Run all matching hooks. Aggregate: any "block" wins over "allow". Merge additionalContext. Return combined output.

### Tests (in `tests/hooks.test.ts`)
- `loadHooksConfig` returns empty when no file
- `loadHooksConfig` parses valid config
- `matchHooks` filters by event and matcher regex
- `executeHook` handles exit 0 with JSON output
- `executeHook` handles exit 2 (block)
- `executeHook` handles timeout
- `runHooks` aggregates multiple hooks (block wins)

**Success criteria**: `npx vitest run tests/hooks.test.ts` passes (7+ tests). TSC clean.

## Goal 2: Wire hooks into orchestrator (~40 LOC)

In `src/orchestrator.ts`:
1. Import and call `loadHooksConfig()` during `init()`. Store as `this.hooksConfig`.
2. Before each tool execution, call `runHooks(config, "PreToolUse", {cwd, tool_name, tool_input})`. If result is `{decision: "block"}`, skip the tool and return the reason as the tool result to the model.
3. After each tool execution, call `runHooks(config, "PostToolUse", {cwd, tool_name, tool_input, tool_response})`. If result has `additionalContext`, append it to the tool result.

Find the exact location in orchestrator.ts where tools are dispatched (the tool execution loop) and add the hook calls there.

**Success criteria**: TSC clean. Existing tests still pass. One integration test showing a PreToolUse hook can block a tool call.

## Constraints
- ESM: use `import` not `require`, `.js` extensions in src/ imports
- Max 2 files created/modified in src/ (hooks.ts new, orchestrator.ts modified)
- Budget: 20 turns. If blocked after 15, ship what works.
