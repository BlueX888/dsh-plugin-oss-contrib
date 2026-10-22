#!/usr/bin/env python3
"""
Python Bridge for dsh-plugin-oss-contrib
Provides JSON-based IPC interface to Python modules from Node.js
"""

import json
import sys
import os
from pathlib import Path
from typing import Any, Dict

# Add PR bin directory to path
PR_BIN = Path(os.environ.get('OSS_BIN', 'F:/PR/bin'))
if PR_BIN.exists():
    sys.path.insert(0, str(PR_BIN))


def call_module(module: str, method: str, args: list, kwargs: dict) -> Dict[str, Any]:
    """
    Dynamically import and call a Python module method

    Args:
        module: Module name (e.g., 'state', 'publish')
        method: Method/function name
        args: Positional arguments
        kwargs: Keyword arguments

    Returns:
        {"status": "ok", "result": ...} or {"status": "error", "error": ...}
    """
    try:
        # Import module
        mod = __import__(module)

        # Get function/method
        func = getattr(mod, method)

        # Call with args
        result = func(*args, **kwargs)

        return {
            "status": "ok",
            "result": result
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "type": type(e).__name__
        }


def main():
    """
    Main IPC loop - reads JSON commands from stdin, writes JSON responses to stdout

    Input format: {"module": "state", "method": "brief", "args": [], "kwargs": {}}
    Output format: {"status": "ok", "result": ...} or {"status": "error", "error": ...}
    """
    # Read command from stdin
    try:
        command = json.loads(sys.stdin.read())

        module = command.get('module')
        method = command.get('method')
        args = command.get('args', [])
        kwargs = command.get('kwargs', {})

        if not module or not method:
            print(json.dumps({
                "status": "error",
                "error": "Missing 'module' or 'method' in command"
            }))
            sys.exit(1)

        # Execute
        response = call_module(module, method, args, kwargs)

        # Write response
        print(json.dumps(response))
        sys.exit(0 if response['status'] == 'ok' else 1)

    except json.JSONDecodeError as e:
        print(json.dumps({
            "status": "error",
            "error": f"Invalid JSON input: {e}"
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "error": str(e),
            "type": type(e).__name__
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
