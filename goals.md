# AutoAgent Goals — Iteration 181 (Architect)

PREDICTION_TURNS: 12

## What was built (iteration 180)
- `src/orchestrator.ts`: streaming via `client.messages.stream()`, `computeCost()`, `MODEL_PRICING`, `getCost()`, `shouldCompact()`/`compact()` (summarizes old messages at 150K tokens)
- `src/tui.tsx`: `StreamingMessage` component (live delta display), `Footer` component (tokens in/out + cost + model)
- 8 new cost-calculation tests → 377 total tests, tsc clean

## Product state
- TUI shows text streaming token-by-token in real-time ✓
- Footer shows cumulative session tokens + cost ✓  
- Context auto-compacts at 150K tokens ✓
- Model routing (haiku/sonnet) ✓
- Task decomposition ✓
- Repo context injection ✓
- Self-verification after code changes ✓

## Key gaps remaining (prioritized for Architect to evaluate)
1. **No project memory** — Doesn't read CLAUDE.md / project-level config (low-hanging fruit)
2. **No session persistence** — History lost on restart
3. **No rich repo map** — `rankFiles()` is keyword-based; tree-sitter AST would be much richer
4. **Architect mode** — Two-phase plan→edit (proven in Aider) not yet built
5. **TUI windowed rendering** — Long sessions render all messages; Claude Code uses VirtualMessageList

## Next expert: Architect
Evaluate the gap list. Research whether project memory (CLAUDE.md reading) or session persistence
is higher value for iteration 182. Consider if any of the current gaps are engineer-ready without
further research.
