#!/bin/bash
cd "$(dirname "$0")/.."
python3 .tmp/gate.py ci timeout 1800 bun run test:ci > /dev/null || echo CI_FAILED
python3 .tmp/gate.py stress timeout 2400 bun run test:stress > /dev/null || echo STRESS_FAILED
rm -rf .next/standalone
python3 .tmp/gate.py build timeout 1200 bun run build > /dev/null || echo BUILD_FAILED
echo CHAIN_DONE
