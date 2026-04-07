"""
BuildService: Business logic for build management.
"""

import os
import hashlib
import uuid
from datetime import datetime
from typing import List, Optional

from app.models import BuildEntity
from app.repositories.build_repository import BuildRepository
from app.utils.apk_parser import parse_apk


class BuildService:
    """Service for managing APK builds."""

    def __init__(self, build_repository: BuildRepository):
        """
        Initialize build service.

        Args:
            build_repository: Build repository instance
        """
        self.build_repository = build_repository

    def upload_build(self, file_path: str, filename: str) -> BuildEntity:
        """
        Upload and process APK build.

        Args:
            file_path: Temporary file path
            filename: Original filename

        Returns:
            BuildEntity: Created build metadata

        Raises:
            ValueError: If APK is invalid or processing fails
        """
        # Validate file exists
        if not os.path.exists(file_path):
            raise ValueError("APK file not found")

        # Validate file size
        file_size = os.path.getsize(file_path)
        MAX_SIZE = 150 * 1024 * 1024  # 150MB
        if file_size > MAX_SIZE:
            raise ValueError(f"APK size exceeds 150MB limit. Size: {file_size / (1024*1024):.2f}MB")

        # Calculate MD5 hash
        md5_hash = self._calculate_md5(file_path)

        # Parse APK metadata
        try:
            apk_metadata = parse_apk(file_path)
        except Exception as e:
            raise ValueError(f"Failed to parse APK: {str(e)}")

        # Create build entity
        build_id = str(uuid.uuid4())
        build_entity = BuildEntity(
            build_id=build_id,
            file_name=filename,
            file_path="",  # Will be set by repository
            app_package=apk_metadata['package'],
            app_version=apk_metadata['version'],
            uploaded_at=datetime.now(),
            file_size_bytes=file_size,
            md5_hash=md5_hash
        )

        # Save via repository
        self.build_repository.save(file_path, build_entity)

        return build_entity

    def get_build(self, build_id: str) -> Optional[BuildEntity]:
        """
        Get build by ID.

        Args:
            build_id: Build identifier

        Returns:
            Optional[BuildEntity]: Build if found
        """
        return self.build_repository.get(build_id)

    def list_builds(self) -> List[BuildEntity]:
        """
        List all builds.

        Returns:
            List[BuildEntity]: All builds
        """
        return self.build_repository.list()

    def delete_build(self, build_id: str) -> bool:
        """
        Delete build.

        Args:
            build_id: Build identifier

        Returns:
            bool: True if deleted
        """
        return self.build_repository.delete(build_id)

    def get_apk_path(self, build_id: str) -> Optional[str]:
        """
        Get filesystem path to APK.

        Args:
            build_id: Build identifier

        Returns:
            Optional[str]: APK path if found
        """
        return self.build_repository.get_apk_path(build_id)

    def _calculate_md5(self, file_path: str) -> str:
        """Calculate MD5 hash of file."""
        md5 = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                md5.update(chunk)
        return md5.hexdigest()
