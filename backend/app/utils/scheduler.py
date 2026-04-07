"""
Scheduler utility for periodic test execution.
Uses schedule library for cron-style scheduling.
"""

import schedule
import threading
import time
from typing import Dict, List, Callable
from datetime import datetime
import uuid


class TestScheduler:
    """Manages scheduled test runs using cron-style expressions."""

    def __init__(self):
        self._schedules: Dict[str, dict] = {}
        self._running = False
        self._thread = None

    def schedule_test_run(
        self,
        build_id: str,
        test_case_ids: List[str],
        device_id: str,
        cron_expression: str,
        executor_callback: Callable
    ) -> str:
        """
        Schedule a test run using cron expression.

        Args:
            build_id: Build to test
            test_case_ids: Test cases to run
            device_id: Device to use
            cron_expression: Cron-style expression (e.g., "every 1 hour", "every day at 10:00")
            executor_callback: Function to call for execution

        Returns:
            str: Schedule ID

        Note:
            For simplicity, supports schedule library syntax:
            - "every 1 hour"
            - "every day at 10:00"
            - "every monday at 09:00"
        """
        schedule_id = str(uuid.uuid4())

        # Parse and create schedule
        job = self._parse_cron_expression(cron_expression, executor_callback, build_id, test_case_ids, device_id)

        self._schedules[schedule_id] = {
            "schedule_id": schedule_id,
            "build_id": build_id,
            "test_case_ids": test_case_ids,
            "device_id": device_id,
            "cron_expression": cron_expression,
            "created_at": datetime.now(),
            "job": job
        }

        # Start scheduler thread if not running
        if not self._running:
            self._start_scheduler()

        return schedule_id

    def _parse_cron_expression(
        self,
        cron_expression: str,
        callback: Callable,
        build_id: str,
        test_case_ids: List[str],
        device_id: str
    ):
        """
        Parse cron expression and create schedule job.

        Args:
            cron_expression: Cron-style expression
            callback: Function to call
            build_id: Build ID
            test_case_ids: Test case IDs
            device_id: Device ID

        Returns:
            schedule.Job: Scheduled job
        """
        # Simplified parsing for common patterns
        expr = cron_expression.lower().strip()

        def execute_job():
            callback(build_id, test_case_ids, device_id)

        if "every" in expr:
            if "hour" in expr:
                # Extract hour interval
                parts = expr.split()
                if len(parts) >= 2 and parts[1].isdigit():
                    hours = int(parts[1])
                    job = schedule.every(hours).hours.do(execute_job)
                else:
                    job = schedule.every().hour.do(execute_job)
            elif "minute" in expr:
                # Extract minute interval
                parts = expr.split()
                if len(parts) >= 2 and parts[1].isdigit():
                    minutes = int(parts[1])
                    job = schedule.every(minutes).minutes.do(execute_job)
                else:
                    job = schedule.every().minute.do(execute_job)
            elif "day" in expr:
                # Check for time specification
                if "at" in expr:
                    time_str = expr.split("at")[-1].strip()
                    job = schedule.every().day.at(time_str).do(execute_job)
                else:
                    job = schedule.every().day.do(execute_job)
            elif "monday" in expr:
                if "at" in expr:
                    time_str = expr.split("at")[-1].strip()
                    job = schedule.every().monday.at(time_str).do(execute_job)
                else:
                    job = schedule.every().monday.do(execute_job)
            elif "tuesday" in expr:
                if "at" in expr:
                    time_str = expr.split("at")[-1].strip()
                    job = schedule.every().tuesday.at(time_str).do(execute_job)
                else:
                    job = schedule.every().tuesday.do(execute_job)
            elif "wednesday" in expr:
                if "at" in expr:
                    time_str = expr.split("at")[-1].strip()
                    job = schedule.every().wednesday.at(time_str).do(execute_job)
                else:
                    job = schedule.every().wednesday.do(execute_job)
            elif "thursday" in expr:
                if "at" in expr:
                    time_str = expr.split("at")[-1].strip()
                    job = schedule.every().thursday.at(time_str).do(execute_job)
                else:
                    job = schedule.every().thursday.do(execute_job)
            elif "friday" in expr:
                if "at" in expr:
                    time_str = expr.split("at")[-1].strip()
                    job = schedule.every().friday.at(time_str).do(execute_job)
                else:
                    job = schedule.every().friday.do(execute_job)
            elif "saturday" in expr:
                if "at" in expr:
                    time_str = expr.split("at")[-1].strip()
                    job = schedule.every().saturday.at(time_str).do(execute_job)
                else:
                    job = schedule.every().saturday.do(execute_job)
            elif "sunday" in expr:
                if "at" in expr:
                    time_str = expr.split("at")[-1].strip()
                    job = schedule.every().sunday.at(time_str).do(execute_job)
                else:
                    job = schedule.every().sunday.do(execute_job)
            else:
                raise ValueError(f"Unsupported cron expression: {cron_expression}")
        else:
            raise ValueError(f"Invalid cron expression format: {cron_expression}")

        return job

    def list_schedules(self) -> List[dict]:
        """
        List all active schedules.

        Returns:
            List[dict]: All schedules
        """
        return [
            {
                "schedule_id": s["schedule_id"],
                "build_id": s["build_id"],
                "test_case_ids": s["test_case_ids"],
                "device_id": s["device_id"],
                "cron_expression": s["cron_expression"],
                "created_at": s["created_at"].isoformat()
            }
            for s in self._schedules.values()
        ]

    def cancel_schedule(self, schedule_id: str) -> bool:
        """
        Cancel scheduled test run.

        Args:
            schedule_id: Schedule identifier

        Returns:
            bool: True if cancelled, False if not found
        """
        if schedule_id not in self._schedules:
            return False

        # Cancel the job
        schedule_info = self._schedules[schedule_id]
        schedule.cancel_job(schedule_info["job"])

        # Remove from tracking
        del self._schedules[schedule_id]

        return True

    def _start_scheduler(self):
        """Start the scheduler thread."""
        self._running = True
        self._thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self._thread.start()

    def _run_scheduler(self):
        """Run the scheduler loop."""
        while self._running:
            schedule.run_pending()
            time.sleep(1)

    def stop(self):
        """Stop the scheduler."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
