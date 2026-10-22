#!/bin/bash
# Test Python bridge with real state.py
export OSS_BIN=F:/PR/bin
export OSS_STATE=F:/PR/state

# Test 1: Call state.py brief through bridge (simulated)
cd "$(dirname "$0")"
python python/bridge.py <<< '{"module": "subprocess", "method": "run", "args": [["python", "F:/PR/bin/state.py", "brief"]], "kwargs": {"capture_output": true, "text": true, "check": true}}'
