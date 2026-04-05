#!/usr/bin/env bash
# Pre-commit validation script for AutoAgent.
# Called by agent.ts before committing each iteration.
# Runs the runtime self-test suite to catch runtime bugs (not just type errors).

set -e

echo "Running AutoAgent self-test suite..."
npx tsx scripts/self-test.ts

echo "Pre-commit checks passed."
