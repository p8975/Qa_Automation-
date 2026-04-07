"""
ElementMapRepository: Filesystem-based storage for cached element locations.
"""

import json
from typing import Optional
from pathlib import Path

from app.models import ElementMap


class ElementMapRepository:
    """Repository for managing element maps with filesystem storage."""

    def __init__(self, storage_root: str = "./storage"):
        """
        Initialize repository with storage root directory.

        Args:
            storage_root: Base directory for all storage
        """
        self.storage_root = Path(storage_root)
        self.element_maps_dir = self.storage_root / "element-maps"
        self.element_maps_dir.mkdir(parents=True, exist_ok=True)

    def save(self, build_id: str, element_map: ElementMap) -> None:
        """
        Save or update element map for a build.

        Args:
            build_id: Build identifier
            element_map: Element map to save
        """
        map_path = self.element_maps_dir / f"{build_id}.json"
        with open(map_path, 'w') as f:
            json.dump(element_map.model_dump(mode='json'), f, indent=2, default=str)

    def get(self, build_id: str) -> Optional[ElementMap]:
        """
        Retrieve element map for a build.

        Args:
            build_id: Build identifier

        Returns:
            Optional[ElementMap]: Element map if found
        """
        map_path = self.element_maps_dir / f"{build_id}.json"
        if not map_path.exists():
            return None

        with open(map_path, 'r') as f:
            data = json.load(f)
            return ElementMap(**data)

    def update(self, build_id: str, screen_name: str, elements: list) -> bool:
        """
        Update elements for a specific screen in the map.

        Args:
            build_id: Build identifier
            screen_name: Screen identifier
            elements: List of ElementInfo to update

        Returns:
            bool: True if updated, False if build not found
        """
        element_map = self.get(build_id)
        if not element_map:
            return False

        # Update screen elements
        if element_map.screen_name == screen_name:
            element_map.elements = elements
            self.save(build_id, element_map)
            return True

        return False

    def delete(self, build_id: str) -> bool:
        """
        Delete element map for a build.

        Args:
            build_id: Build identifier

        Returns:
            bool: True if deleted, False if not found
        """
        map_path = self.element_maps_dir / f"{build_id}.json"
        if not map_path.exists():
            return False

        map_path.unlink()
        return True
