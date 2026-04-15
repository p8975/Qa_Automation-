"""
TestCaseRepository: Filesystem-based storage for test cases.
"""

import json
from typing import Optional, List
from pathlib import Path

from app.models import TestCaseEntity


class TestCaseRepository:
    """Repository for managing test cases with filesystem storage."""

    def __init__(self, storage_root: str = "./storage"):
        """
        Initialize repository with storage root directory.

        Args:
            storage_root: Base directory for all storage
        """
        self.storage_root = Path(storage_root)
        self.test_cases_dir = self.storage_root / "test-cases"
        self.test_cases_dir.mkdir(parents=True, exist_ok=True)

    def save(self, test_case: TestCaseEntity) -> str:
        """
        Save test case.

        Args:
            test_case: Test case entity

        Returns:
            str: tc_id
        """
        # Organize by PRD hash
        prd_dir = self.test_cases_dir / test_case.prd_hash
        prd_dir.mkdir(parents=True, exist_ok=True)

        tc_path = prd_dir / f"{test_case.tc_id}.json"
        with open(tc_path, 'w') as f:
            json.dump(test_case.model_dump(mode='json'), f, indent=2, default=str)

        return test_case.tc_id

    def get(self, tc_id: str) -> Optional[TestCaseEntity]:
        """
        Retrieve test case by ID (searches across all PRD hashes).
        Also supports lookup by original ID (TC001 format) by searching all test cases.

        Args:
            tc_id: Test case identifier (UUID or TC001 format)

        Returns:
            Optional[TestCaseEntity]: Test case if found
        """
        if not self.test_cases_dir.exists():
            return None

        # First try direct lookup by tc_id (UUID format)
        for prd_dir in self.test_cases_dir.iterdir():
            if prd_dir.is_dir():
                tc_path = prd_dir / f"{tc_id}.json"
                if tc_path.exists():
                    with open(tc_path, 'r') as f:
                        data = json.load(f)
                        return TestCaseEntity(**data)

        # If not found and looks like TC### format, search by original_id field
        if tc_id.upper().startswith('TC') and tc_id[2:].isdigit():
            for prd_dir in self.test_cases_dir.iterdir():
                if prd_dir.is_dir():
                    for tc_file in prd_dir.glob("*.json"):
                        with open(tc_file, 'r') as f:
                            data = json.load(f)
                            # Check if original_id matches
                            if data.get('original_id', '').upper() == tc_id.upper():
                                return TestCaseEntity(**data)

        return None

    def list(self, prd_hash: Optional[str] = None) -> List[TestCaseEntity]:
        """
        List test cases, optionally filtered by PRD hash.

        Args:
            prd_hash: Optional PRD hash to filter by

        Returns:
            List[TestCaseEntity]: Test cases
        """
        test_cases = []
        if not self.test_cases_dir.exists():
            return test_cases

        # Determine which directories to search
        if prd_hash:
            search_dirs = [self.test_cases_dir / prd_hash]
        else:
            search_dirs = [d for d in self.test_cases_dir.iterdir() if d.is_dir()]

        # Load all test cases
        for prd_dir in search_dirs:
            if prd_dir.exists() and prd_dir.is_dir():
                for tc_file in prd_dir.glob("*.json"):
                    with open(tc_file, 'r') as f:
                        data = json.load(f)
                        test_cases.append(TestCaseEntity(**data))

        # Sort by creation time, newest first
        test_cases.sort(key=lambda tc: tc.created_at, reverse=True)
        return test_cases

    def update(self, tc_id: str, updates: dict) -> bool:
        """
        Update test case fields.

        Args:
            tc_id: Test case identifier
            updates: Dictionary of fields to update

        Returns:
            bool: True if updated, False if not found
        """
        test_case = self.get(tc_id)
        if not test_case:
            return False

        # Update fields
        for key, value in updates.items():
            if hasattr(test_case, key):
                setattr(test_case, key, value)

        # Save updated test case
        self.save(test_case)
        return True

    def delete(self, tc_id: str) -> bool:
        """
        Delete test case.

        Args:
            tc_id: Test case identifier

        Returns:
            bool: True if deleted, False if not found
        """
        if not self.test_cases_dir.exists():
            return False

        # Search and delete
        for prd_dir in self.test_cases_dir.iterdir():
            if prd_dir.is_dir():
                tc_path = prd_dir / f"{tc_id}.json"
                if tc_path.exists():
                    tc_path.unlink()
                    return True

        return False
