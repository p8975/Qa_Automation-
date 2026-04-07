"""
ExecutionLogger: Shared module for real-time execution logging.
Avoids circular imports by being independent of main.py.
"""

from datetime import datetime
from typing import Dict, List

# Global execution log store
_execution_logs: Dict[str, List[dict]] = {}


def add_log(run_id: str, message: str, level: str = "info") -> None:
    """
    Add a log entry for real-time tracking.

    Args:
        run_id: Test run ID
        message: Log message
        level: Log level (info, debug, success, error)
    """
    if run_id not in _execution_logs:
        _execution_logs[run_id] = []

    _execution_logs[run_id].append({
        "timestamp": datetime.now().isoformat(),
        "level": level,
        "message": message
    })

    # Keep only last 100 entries per run
    if len(_execution_logs[run_id]) > 100:
        _execution_logs[run_id] = _execution_logs[run_id][-100:]


def get_logs(run_id: str, limit: int = 20) -> List[dict]:
    """
    Get execution logs for a run.

    Args:
        run_id: Test run ID
        limit: Maximum number of logs to return

    Returns:
        List of log entries
    """
    logs = _execution_logs.get(run_id, [])
    return logs[-limit:] if limit else logs


def clear_logs(run_id: str) -> None:
    """Clear logs for a run."""
    if run_id in _execution_logs:
        del _execution_logs[run_id]
