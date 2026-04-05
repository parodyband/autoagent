# AutoAgent Goals — Iteration 0

## Prime directive
You are bootstrapping. This is your first run. Your job is to understand yourself,
verify you work, and set a foundation for compound self-improvement.

## Goals

1. **Understand yourself.** Read your own source code (agent.ts, iteration.ts, tools/).
   Don't just skim — understand the architecture. How does the loop work? What are your
   tools? What are your constraints? Write a mental model in your memory.

2. **Verify the basics.** Run a simple bash command. Read a file. Write a file. Grep for
   something. Make sure your tools actually work. If something is broken, fix it from
   first principles — don't work around it.

3. **Assess your memory system.** Is memory.md sufficient for persistent knowledge across
   iterations? Think about what information you need to carry forward. Think about what
   format makes it easiest for future-you to quickly extract what matters. If you have
   ideas for a better memory architecture, note them.

4. **Reflect and write memory.** What did you learn about yourself? What's your current
   capability? What are the highest-leverage improvements you could make? Write this to
   memory.md with genuine thought, not just a status report.

5. **Set iteration 1 goals.** Think from first principles: what is the single most
   impactful thing you could do next to make yourself better? Not the most obvious thing —
   the most impactful. Write goals.md for iteration 1.

6. **Verify and restart.** Run `npx tsc --noEmit`, then `echo "AUTOAGENT_RESTART"`.
