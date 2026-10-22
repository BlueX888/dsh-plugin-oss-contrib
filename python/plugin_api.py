"""JSON operations missing from the native text CLI. Native state owns writes."""
import ast
from pathlib import Path
import state
import paths

def read_state(key=None):
    value = state.load()
    return value if key is None else value.get(key)

def set_state(key, value, apply=False):
    if not apply:
        return {"applied": False, "key": key, "before": state.load().get(key), "after": value}
    state.mutate(lambda store: store.__setitem__(key, value))
    return {"applied": True, "key": key}

def update_state(updates, apply=False):
    if not isinstance(updates, dict):
        raise ValueError('updates must be an object of top-level state keys')
    if apply:
        state.mutate(lambda store: store.update(updates))
    return {"applied": apply, "keys": list(updates)}

def diagnostics(expected_user=None, threshold=None, daily_cap=None):
    required = ['oss', 'cycle.py', 'workflow_adapter.py', 'publish.py', 'evidence.py']
    errors = ['missing core file: '+name for name in required if not (paths.bin_dir()/name).is_file()]
    publisher = None
    source = paths.bin_dir()/'publish.py'
    if source.exists():
        for node in ast.parse(source.read_text(encoding='utf-8-sig')).body:
            if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'ME' for t in node.targets):
                if isinstance(node.value, ast.Constant):
                    publisher = node.value.value
    store = state.load()
    effective_threshold = store.get('pause_threshold_unresponded_open_prs', 10)
    effective_cap = (store.get('daily_caps') or {}).get('prs', store.get('daily_cap_prs'))
    if expected_user and expected_user != publisher:
        errors.append('configured identity does not match native publisher identity')
    if threshold is not None and threshold != effective_threshold:
        errors.append('configured pauseThreshold does not match native ledger')
    if daily_cap is not None and daily_cap != effective_cap:
        errors.append('configured dailyCap does not match native ledger')
    return {'compatible': not errors, 'errors': errors, 'root': str(paths.root()), 'state': paths.state_dir(),
            'tasks': str(paths.tasks_dir()), 'archive': str(paths.archive_dir()), 'publisher': publisher,
            'quota': {'pauseThreshold': effective_threshold, 'dailyCap': effective_cap}}
