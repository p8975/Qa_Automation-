"""
TestRunRepository: Filesystem-based storage for test runs and results.
"""

import json
import shutil
from typing import Optional, List
from pathlib import Path

from app.models import TestRunEntity, TestRunStatus


class TestRunRepository:
    """Repository for managing test runs with filesystem storage."""

    def __init__(self, storage_root: str = "./storage"):
        """
        Initialize repository with storage root directory.

        Args:
            storage_root: Base directory for all storage
        """
        self.storage_root = Path(storage_root)
        self.test_runs_dir = self.storage_root / "test-runs"
        self.test_runs_dir.mkdir(parents=True, exist_ok=True)

    def save(self, test_run: TestRunEntity) -> str:
        """
        Save test run.

        Args:
            test_run: Test run entity

        Returns:
            str: run_id
        """
        run_dir = self.test_runs_dir / test_run.run_id
        run_dir.mkdir(parents=True, exist_ok=True)

        # Create subdirectories
        (run_dir / "screenshots").mkdir(exist_ok=True)
        (run_dir / "logs").mkdir(exist_ok=True)

        # Save metadata
        metadata_path = run_dir / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(test_run.model_dump(mode='json'), f, indent=2, default=str)

        return test_run.run_id

    def get(self, run_id: str) -> Optional[TestRunEntity]:
        """
        Retrieve test run by ID.

        Args:
            run_id: Test run identifier

        Returns:
            Optional[TestRunEntity]: Test run if found
        """
        metadata_path = self.test_runs_dir / run_id / "metadata.json"
        if not metadata_path.exists():
            return None

        with open(metadata_path, 'r') as f:
            data = json.load(f)
            return TestRunEntity(**data)

    def list_by_build(self, build_id: str) -> List[TestRunEntity]:
        """
        List all test runs for a specific build.

        Args:
            build_id: Build identifier

        Returns:
            List[TestRunEntity]: Test runs for this build
        """
        runs = []
        if not self.test_runs_dir.exists():
            return runs

        for run_dir in self.test_runs_dir.iterdir():
            if run_dir.is_dir():
                metadata_path = run_dir / "metadata.json"
                if metadata_path.exists():
                    with open(metadata_path, 'r') as f:
                        data = json.load(f)
                        test_run = TestRunEntity(**data)
                        if test_run.build_id == build_id:
                            runs.append(test_run)

        # Sort by start time, newest first
        runs.sort(key=lambda r: r.started_at, reverse=True)
        return runs

    def list(self) -> List[TestRunEntity]:
        """
        List all test runs.

        Returns:
            List[TestRunEntity]: All test runs
        """
        runs = []
        if not self.test_runs_dir.exists():
            return runs

        for run_dir in self.test_runs_dir.iterdir():
            if run_dir.is_dir():
                metadata_path = run_dir / "metadata.json"
                if metadata_path.exists():
                    with open(metadata_path, 'r') as f:
                        data = json.load(f)
                        runs.append(TestRunEntity(**data))

        runs.sort(key=lambda r: r.started_at, reverse=True)
        return runs

    def update_status(self, run_id: str, status: TestRunStatus) -> bool:
        """
        Update test run status.

        Args:
            run_id: Test run identifier
            status: New status

        Returns:
            bool: True if updated, False if not found
        """
        test_run = self.get(run_id)
        if not test_run:
            return False

        test_run.status = status
        self.save(test_run)
        return True

    def delete(self, run_id: str) -> bool:
        """
        Delete test run and all associated files.

        Args:
            run_id: Test run identifier

        Returns:
            bool: True if deleted, False if not found
        """
        run_dir = self.test_runs_dir / run_id
        if not run_dir.exists():
            return False

        shutil.rmtree(run_dir)
        return True

    def get_screenshot_dir(self, run_id: str) -> Path:
        """Get directory for storing screenshots."""
        return self.test_runs_dir / run_id / "screenshots"

    def get_logs_dir(self, run_id: str) -> Path:
        """Get directory for storing logs."""
        return self.test_runs_dir / run_id / "logs"
