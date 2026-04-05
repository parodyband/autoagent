#!/usr/bin/env bash
# Pre-commit validation script for AutoAgent.
# Called by agent.ts before committing each iteration.
# Runs the runtime self-test suite, memory compaction, and dashboard generation.

set -e

echo "Running AutoAgent self-test suite..."
npx tsx scripts/self-test.ts

echo "Running memory compaction..."
npx tsx scripts/compact-memory.ts

echo "Generating dashboard..."
npx tsx scripts/dashboard.ts

echo "Pre-commit checks passed."
