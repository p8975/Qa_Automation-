"""
TestModuleRepository: Filesystem-based storage for test modules/suites.
"""

import json
import uuid
from typing import Optional, List
from pathlib import Path
from datetime import datetime

from app.models import TestModule


class TestModuleRepository:
    """Repository for managing test modules with filesystem storage."""

    def __init__(self, storage_root: str = "./storage"):
        """
        Initialize repository with storage root directory.

        Args:
            storage_root: Base directory for all storage
        """
        self.storage_root = Path(storage_root)
        self.modules_dir = self.storage_root / "test-modules"
        self.modules_dir.mkdir(parents=True, exist_ok=True)

    def create(self, name: str, description: Optional[str] = None, test_case_ids: List[str] = None) -> TestModule:
        """
        Create a new test module.

        Args:
            name: Module name
            description: Optional description
            test_case_ids: Initial list of test case IDs

        Returns:
            TestModule: Created module
        """
        module_id = str(uuid.uuid4())
        now = datetime.utcnow()

        module = TestModule(
            module_id=module_id,
            name=name,
            description=description,
            test_case_ids=test_case_ids or [],
            created_at=now,
            updated_at=now
        )

        self._save(module)
        return module

    def _save(self, module: TestModule) -> None:
        """Save module to filesystem."""
        module_path = self.modules_dir / f"{module.module_id}.json"
        with open(module_path, 'w') as f:
            json.dump(module.model_dump(mode='json'), f, indent=2, default=str)

    def get(self, module_id: str) -> Optional[TestModule]:
        """
        Retrieve module by ID.

        Args:
            module_id: Module identifier

        Returns:
            Optional[TestModule]: Module if found
        """
        module_path = self.modules_dir / f"{module_id}.json"
        if not module_path.exists():
            return None

        with open(module_path, 'r') as f:
            data = json.load(f)
            return TestModule(**data)

    def get_by_name(self, name: str) -> Optional[TestModule]:
        """
        Retrieve module by name (case-insensitive).

        Args:
            name: Module name

        Returns:
            Optional[TestModule]: Module if found
        """
        modules = self.list()
        for module in modules:
            if module.name.lower() == name.lower():
                return module
        return None

    def list(self) -> List[TestModule]:
        """
        List all test modules.

        Returns:
            List[TestModule]: All modules sorted by name
        """
        modules = []
        if not self.modules_dir.exists():
            return modules

        for module_file in self.modules_dir.glob("*.json"):
            with open(module_file, 'r') as f:
                data = json.load(f)
                modules.append(TestModule(**data))

        # Sort by name alphabetically
        modules.sort(key=lambda m: m.name.lower())
        return modules

    def update(self, module_id: str, name: Optional[str] = None,
               description: Optional[str] = None,
               test_case_ids: Optional[List[str]] = None) -> Optional[TestModule]:
        """
        Update module fields.

        Args:
            module_id: Module identifier
            name: New name (optional)
            description: New description (optional)
            test_case_ids: New test case IDs (optional)

        Returns:
            Optional[TestModule]: Updated module if found
        """
        module = self.get(module_id)
        if not module:
            return None

        if name is not None:
            module.name = name
        if description is not None:
            module.description = description
        if test_case_ids is not None:
            module.test_case_ids = test_case_ids

        module.updated_at = datetime.utcnow()
        self._save(module)
        return module

    def add_test_cases(self, module_id: str, test_case_ids: List[str]) -> Optional[TestModule]:
        """
        Add test cases to a module.

        Args:
            module_id: Module identifier
            test_case_ids: Test case IDs to add

        Returns:
            Optional[TestModule]: Updated module if found
        """
        module = self.get(module_id)
        if not module:
            return None

        # Add only new IDs
        existing_ids = set(module.test_case_ids)
        for tc_id in test_case_ids:
            if tc_id not in existing_ids:
                module.test_case_ids.append(tc_id)

        module.updated_at = datetime.utcnow()
        self._save(module)
        return module

    def remove_test_cases(self, module_id: str, test_case_ids: List[str]) -> Optional[TestModule]:
        """
        Remove test cases from a module.

        Args:
            module_id: Module identifier
            test_case_ids: Test case IDs to remove

        Returns:
            Optional[TestModule]: Updated module if found
        """
        module = self.get(module_id)
        if not module:
            return None

        ids_to_remove = set(test_case_ids)
        module.test_case_ids = [tc_id for tc_id in module.test_case_ids if tc_id not in ids_to_remove]

        module.updated_at = datetime.utcnow()
        self._save(module)
        return module

    def delete(self, module_id: str) -> bool:
        """
        Delete module.

        Args:
            module_id: Module identifier

        Returns:
            bool: True if deleted, False if not found
        """
        module_path = self.modules_dir / f"{module_id}.json"
        if module_path.exists():
            module_path.unlink()
            return True
        return False
