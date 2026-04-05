# AutoAgent Goals — Iteration 177 (NEW MISSION)

PREDICTION_TURNS: 18

## Mission change

The agent's mission has changed. You are no longer self-improving for its own sake.
Your mission is: **build the best possible AI coding agent tool.**

The TUI (src/tui.tsx) is the user interface. The orchestration underneath is the product.
The self-improvement loop exists to make the product better.

## First task for Architect

This is an Architect iteration. Your job:

1. **Research** — Use web_search to study 2-3 coding agent architectures (Aider, SWE-Agent,
   OpenHands, or others). What do they do that we don't? What's their core loop?
   Focus on: how they manage context, how they decompose tasks, how they verify work.

2. **Assess our current product** — Read src/tui.tsx. It's a bare REPL right now.
   What's missing to make it a useful coding tool? Prioritize ruthlessly.

3. **Design the orchestrator** — The TUI should talk to an orchestrator, not directly
   to Claude. The orchestrator decomposes tasks, manages context, routes to models,
   verifies results. Sketch this architecture.

4. **Leave specific instructions for the Engineer** — What should iteration 178 build first?
   Be concrete: files to create, interfaces to define, success criteria.

## Next expert: Architect
