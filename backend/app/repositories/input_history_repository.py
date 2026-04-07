"""
InputHistoryRepository: Filesystem-based storage for user inputs (PRDs and natural language).
"""

import json
import uuid
import shutil
from typing import Optional, List
from pathlib import Path
from datetime import datetime
from pydantic import BaseModel


class InputHistoryEntry(BaseModel):
    """Model for tracking user input history."""
    id: str
    input_type: str  # 'prd_upload' or 'natural_language'
    filename: Optional[str] = None  # For PRD uploads
    file_path: Optional[str] = None  # Path to stored file
    content_preview: str  # First 500 chars of content
    content_hash: str  # MD5 hash of content
    file_size_bytes: Optional[int] = None
    test_cases_generated: int = 0
    created_at: datetime
    metadata: dict = {}


class InputHistoryRepository:
    """Repository for managing user input history with filesystem storage."""

    def __init__(self, storage_root: str = "./storage"):
        """
        Initialize repository with storage root directory.

        Args:
            storage_root: Base directory for all storage
        """
        self.storage_root = Path(storage_root)
        self.history_dir = self.storage_root / "input-history"
        self.uploads_dir = self.storage_root / "uploads"
        self.history_dir.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)

    def save_prd_upload(
        self,
        filename: str,
        file_bytes: bytes,
        content_text: str,
        content_hash: str,
        test_cases_count: int = 0
    ) -> InputHistoryEntry:
        """
        Save uploaded PRD document.

        Args:
            filename: Original filename
            file_bytes: Raw file bytes
            content_text: Extracted text content
            content_hash: MD5 hash of file
            test_cases_count: Number of test cases generated

        Returns:
            InputHistoryEntry: Saved entry
        """
        entry_id = str(uuid.uuid4())
        timestamp = datetime.now()

        # Save the actual file
        date_folder = timestamp.strftime("%Y-%m-%d")
        upload_folder = self.uploads_dir / date_folder
        upload_folder.mkdir(parents=True, exist_ok=True)

        # Create unique filename
        safe_filename = f"{entry_id}_{filename}"
        file_path = upload_folder / safe_filename

        with open(file_path, 'wb') as f:
            f.write(file_bytes)

        # Create history entry
        entry = InputHistoryEntry(
            id=entry_id,
            input_type="prd_upload",
            filename=filename,
            file_path=str(file_path),
            content_preview=content_text[:500] if content_text else "",
            content_hash=content_hash,
            file_size_bytes=len(file_bytes),
            test_cases_generated=test_cases_count,
            created_at=timestamp,
            metadata={
                "original_filename": filename,
                "content_length": len(content_text) if content_text else 0
            }
        )

        # Save entry metadata
        self._save_entry(entry)
        return entry

    def save_natural_language_input(
        self,
        description: str,
        content_hash: str,
        test_case_generated: bool = False
    ) -> InputHistoryEntry:
        """
        Save natural language test case input.

        Args:
            description: Natural language description
            content_hash: MD5 hash of description
            test_case_generated: Whether a test case was successfully generated

        Returns:
            InputHistoryEntry: Saved entry
        """
        entry_id = str(uuid.uuid4())
        timestamp = datetime.now()

        entry = InputHistoryEntry(
            id=entry_id,
            input_type="natural_language",
            filename=None,
            file_path=None,
            content_preview=description[:500],
            content_hash=content_hash,
            file_size_bytes=len(description.encode('utf-8')),
            test_cases_generated=1 if test_case_generated else 0,
            created_at=timestamp,
            metadata={
                "full_description": description,
                "description_length": len(description)
            }
        )

        self._save_entry(entry)
        return entry

    def _save_entry(self, entry: InputHistoryEntry) -> None:
        """Save entry to filesystem."""
        # Organize by date
        date_folder = entry.created_at.strftime("%Y-%m-%d")
        entry_dir = self.history_dir / date_folder
        entry_dir.mkdir(parents=True, exist_ok=True)

        entry_path = entry_dir / f"{entry.id}.json"
        with open(entry_path, 'w') as f:
            json.dump(entry.model_dump(mode='json'), f, indent=2, default=str)

    def get(self, entry_id: str) -> Optional[InputHistoryEntry]:
        """
        Retrieve entry by ID.

        Args:
            entry_id: Entry identifier

        Returns:
            Optional[InputHistoryEntry]: Entry if found
        """
        # Search all date directories
        for date_dir in self.history_dir.iterdir():
            if date_dir.is_dir():
                entry_path = date_dir / f"{entry_id}.json"
                if entry_path.exists():
                    with open(entry_path, 'r') as f:
                        data = json.load(f)
                        return InputHistoryEntry(**data)
        return None

    def list(
        self,
        input_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[InputHistoryEntry]:
        """
        List input history entries.

        Args:
            input_type: Optional filter by type ('prd_upload' or 'natural_language')
            limit: Maximum entries to return
            offset: Offset for pagination

        Returns:
            List[InputHistoryEntry]: History entries
        """
        entries = []

        if not self.history_dir.exists():
            return entries

        # Collect all entries
        for date_dir in sorted(self.history_dir.iterdir(), reverse=True):
            if date_dir.is_dir():
                for entry_file in date_dir.glob("*.json"):
                    with open(entry_file, 'r') as f:
                        data = json.load(f)
                        entry = InputHistoryEntry(**data)

                        # Apply type filter
                        if input_type and entry.input_type != input_type:
                            continue

                        entries.append(entry)

        # Sort by created_at descending
        entries.sort(key=lambda e: e.created_at, reverse=True)

        # Apply pagination
        return entries[offset:offset + limit]

    def get_stats(self) -> dict:
        """
        Get statistics about input history.

        Returns:
            dict: Statistics including counts and totals
        """
        all_entries = self.list(limit=10000)

        prd_uploads = [e for e in all_entries if e.input_type == 'prd_upload']
        nl_inputs = [e for e in all_entries if e.input_type == 'natural_language']

        return {
            "total_inputs": len(all_entries),
            "prd_uploads": len(prd_uploads),
            "natural_language_inputs": len(nl_inputs),
            "total_test_cases_generated": sum(e.test_cases_generated for e in all_entries),
            "total_file_size_bytes": sum(e.file_size_bytes or 0 for e in prd_uploads),
        }

    def delete(self, entry_id: str) -> bool:
        """
        Delete entry and associated file.

        Args:
            entry_id: Entry identifier

        Returns:
            bool: True if deleted
        """
        entry = self.get(entry_id)
        if not entry:
            return False

        # Delete uploaded file if exists
        if entry.file_path:
            file_path = Path(entry.file_path)
            if file_path.exists():
                file_path.unlink()

        # Delete entry metadata
        for date_dir in self.history_dir.iterdir():
            if date_dir.is_dir():
                entry_path = date_dir / f"{entry_id}.json"
                if entry_path.exists():
                    entry_path.unlink()
                    return True

        return False
