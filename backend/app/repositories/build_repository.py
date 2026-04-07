"""
BuildRepository: Filesystem-based storage for APK builds and metadata.
"""

import os
import json
import shutil
from typing import Optional, List
from pathlib import Path

from app.models import BuildEntity


class BuildRepository:
    """Repository for managing APK builds with filesystem storage."""

    def __init__(self, storage_root: str = "./storage"):
        """
        Initialize repository with storage root directory.

        Args:
            storage_root: Base directory for all storage
        """
        self.storage_root = Path(storage_root)
        self.builds_dir = self.storage_root / "builds"
        self.builds_dir.mkdir(parents=True, exist_ok=True)

    def save(self, apk_file_path: str, metadata: BuildEntity) -> str:
        """
        Save APK file and metadata.

        Args:
            apk_file_path: Path to APK file to store
            metadata: Build metadata

        Returns:
            str: build_id
        """
        build_dir = self.builds_dir / metadata.build_id
        build_dir.mkdir(parents=True, exist_ok=True)

        # Copy APK file
        apk_dest = build_dir / metadata.file_name
        shutil.copy2(apk_file_path, apk_dest)

        # Update file_path in metadata with absolute path
        metadata.file_path = str(apk_dest.absolute())

        # Save metadata as JSON
        metadata_path = build_dir / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata.model_dump(mode='json'), f, indent=2, default=str)

        return metadata.build_id

    def get(self, build_id: str) -> Optional[BuildEntity]:
        """
        Retrieve build metadata by ID.

        Args:
            build_id: Build identifier

        Returns:
            Optional[BuildEntity]: Build metadata if found
        """
        metadata_path = self.builds_dir / build_id / "metadata.json"
        if not metadata_path.exists():
            return None

        with open(metadata_path, 'r') as f:
            data = json.load(f)
            return BuildEntity(**data)

    def list(self) -> List[BuildEntity]:
        """
        List all builds.

        Returns:
            List[BuildEntity]: All build metadata
        """
        builds = []
        if not self.builds_dir.exists():
            return builds

        for build_dir in self.builds_dir.iterdir():
            if build_dir.is_dir():
                metadata_path = build_dir / "metadata.json"
                if metadata_path.exists():
                    with open(metadata_path, 'r') as f:
                        data = json.load(f)
                        builds.append(BuildEntity(**data))

        # Sort by upload time, newest first
        builds.sort(key=lambda b: b.uploaded_at, reverse=True)
        return builds

    def delete(self, build_id: str) -> bool:
        """
        Delete build and all associated files.

        Args:
            build_id: Build identifier

        Returns:
            bool: True if deleted, False if not found
        """
        build_dir = self.builds_dir / build_id
        if not build_dir.exists():
            return False

        shutil.rmtree(build_dir)
        return True

    def get_apk_path(self, build_id: str) -> Optional[str]:
        """
        Get filesystem path to APK file.

        Args:
            build_id: Build identifier

        Returns:
            Optional[str]: Path to APK file if found
        """
        build = self.get(build_id)
        if build and os.path.exists(build.file_path):
            return build.file_path
        return None

    def create_build(self, apk_file_path: str, file_name: str) -> str:
        """
        Create a build from an APK file path.

        Args:
            apk_file_path: Path to APK file
            file_name: Name of the APK file

        Returns:
            str: build_id
        """
        import uuid
        from datetime import datetime
        from app.models import BuildEntity

        # Extract metadata from APK
        metadata = BuildEntity(
            build_id=str(uuid.uuid4()),
            file_name=file_name,
            app_package="com.stage.app",  # Default - can be extracted from APK
            app_version="1.0.0",  # Default - can be extracted from APK
            file_path=apk_file_path,
            file_size=os.path.getsize(apk_file_path),
            uploaded_at=datetime.now()
        )

        return self.save(apk_file_path, metadata)
