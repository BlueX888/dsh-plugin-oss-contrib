"""Offline regression suite for the configured external core (never uses the live ledger)."""
import os
import subprocess
import sys
from pathlib import Path
root = Path(os.environ.get("OSS_TEST_ROOT", Path(__file__).resolve().parents[2]))
patterns = ["test_cycle.py", "test_workflow_adapter.py", "test_publication.py", "test_repo_policy.py", "test_evidence_layers.py"]
for pattern in patterns:
    completed = subprocess.run([sys.executable, "-B", "-m", "unittest", "discover", "-s", "tests", "-p", pattern], cwd=root)
    if completed.returncode:
        raise SystemExit(completed.returncode)
raise SystemExit(subprocess.run([sys.executable, "-B", "-m", "unittest", "discover", "-s", "tests/e2e", "-p", "test_lifecycle.py"], cwd=root).returncode)
