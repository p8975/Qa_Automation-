"""
Repository pattern base interface for data access abstraction.
Enables easy migration from filesystem to PostgreSQL in future.
"""

from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional, List

T = TypeVar('T')


class BaseRepository(ABC, Generic[T]):
    """Abstract base class for all repositories."""

    @abstractmethod
    def save(self, entity: T) -> str:
        """
        Save entity and return its ID.

        Args:
            entity: Entity to save

        Returns:
            str: Entity ID
        """
        pass

    @abstractmethod
    def get(self, entity_id: str) -> Optional[T]:
        """
        Retrieve entity by ID.

        Args:
            entity_id: Unique identifier

        Returns:
            Optional[T]: Entity if found, None otherwise
        """
        pass

    @abstractmethod
    def list(self) -> List[T]:
        """
        List all entities.

        Returns:
            List[T]: All entities
        """
        pass

    @abstractmethod
    def delete(self, entity_id: str) -> bool:
        """
        Delete entity by ID.

        Args:
            entity_id: Unique identifier

        Returns:
            bool: True if deleted, False if not found
        """
        pass
