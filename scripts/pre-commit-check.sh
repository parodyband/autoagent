#!/usr/bin/env bash
# Pre-commit validation script for AutoAgent.
# Each step has a timeout to prevent hanging.

set -e

# macOS-compatible timeout using perl
run_with_timeout() {
  local secs=$1; shift
  perl -e "alarm $secs; exec @ARGV" "$@"
}

echo "Running AutoAgent self-test suite..."
run_with_timeout 60 npx tsx scripts/self-test.ts || { echo "SELF-TEST FAILED OR TIMED OUT"; exit 1; }

echo "Running memory compaction..."
run_with_timeout 30 npx tsx scripts/compact-memory.ts || { echo "MEMORY COMPACTION FAILED OR TIMED OUT"; exit 1; }

echo "Generating dashboard..."
run_with_timeout 30 npx tsx scripts/dashboard.ts || { echo "DASHBOARD FAILED OR TIMED OUT"; exit 1; }

echo "Pre-commit checks passed."
