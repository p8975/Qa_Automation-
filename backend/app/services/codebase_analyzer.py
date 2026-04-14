"""
CodebaseAnalyzer: Analyzes Flutter codebase to discover navigation routes and screen structure.
"""

import os
import re
from typing import Dict, List, Optional
from pathlib import Path


class CodebaseAnalyzer:
    """Service for analyzing Flutter codebase to understand app structure."""

    def __init__(self, flutter_project_path: str):
        """
        Initialize codebase analyzer.

        Args:
            flutter_project_path: Path to Flutter project root
        """
        self.project_path = Path(flutter_project_path)
        self.routes_cache = None
        self.screens_cache = None

    def discover_routes(self) -> Dict[str, Dict]:
        """
        Discover all GoRouter routes in the Flutter app.

        Returns:
            dict: {route_path: {name, file_path, screen_class}}
        """
        if self.routes_cache:
            return self.routes_cache

        routes = {}

        # Search for router configuration files
        router_files = self._find_files_with_pattern("router", ".dart")

        for router_file in router_files:
            file_routes = self._parse_router_file(router_file)
            routes.update(file_routes)

        self.routes_cache = routes
        return routes

    def find_screen_by_keyword(self, keyword: str) -> Optional[Dict]:
        """
        Find screen/route containing keyword (e.g., "trial", "subscription").

        Args:
            keyword: Search keyword

        Returns:
            Optional[dict]: {route_path, screen_name, file_path}
        """
        keyword_lower = keyword.lower()
        routes = self.discover_routes()

        # Search in route paths and names
        for route_path, route_info in routes.items():
            if keyword_lower in route_path.lower():
                return {
                    "route_path": route_path,
                    "screen_name": route_info.get("name"),
                    "file_path": route_info.get("file_path"),
                    "screen_class": route_info.get("screen_class")
                }
            if keyword_lower in route_info.get("name", "").lower():
                return route_info

        # Search in screen files
        screen_files = self._find_files_with_pattern(keyword, ".dart")
        if screen_files:
            return {
                "file_path": str(screen_files[0]),
                "screen_name": screen_files[0].stem
            }

        return None

    def extract_widget_keys(self, screen_file_path: str) -> List[str]:
        """
        Extract all Key() definitions from a screen file.

        Args:
            screen_file_path: Path to screen Dart file

        Returns:
            list: Key identifiers found in the file
        """
        keys = []

        if not os.path.exists(screen_file_path):
            return keys

        with open(screen_file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Pattern: key: Key('some_key')
        key_pattern = r"key:\s*(?:const\s+)?(?:Key|ValueKey)\(['\"]([^'\"]+)['\"]\)"
        keys.extend(re.findall(key_pattern, content))

        # Pattern: Semantics(label: 'some_label')
        semantic_pattern = r"Semantics\s*\([^)]*label:\s*['\"]([^'\"]+)['\"]"
        keys.extend(re.findall(semantic_pattern, content))

        return keys

    def get_navigation_path_to_screen(self, screen_keyword: str) -> Optional[str]:
        """
        Get navigation route path to reach a screen.

        Args:
            screen_keyword: Keyword to identify screen

        Returns:
            Optional[str]: Route path (e.g., '/trial-corner')
        """
        screen_info = self.find_screen_by_keyword(screen_keyword)
        if screen_info and "route_path" in screen_info:
            return screen_info["route_path"]
        return None

    def analyze_test_case_context(self, test_title: str, test_steps: List[str]) -> Dict:
        """
        Analyze test case to extract context (target screen, features, etc.).

        Args:
            test_title: Test case title
            test_steps: List of test step descriptions

        Returns:
            dict: {target_screen, navigation_route, keywords}
        """
        # Extract keywords from title and steps
        all_text = test_title + " " + " ".join(test_steps)

        # Common screen keywords
        screen_keywords = [
            "trial corner", "trial", "subscription", "payment", "profile",
            "home", "settings", "content", "onboarding", "login", "signup"
        ]

        detected_keywords = []
        target_screen = None

        for keyword in screen_keywords:
            if keyword.lower() in all_text.lower():
                detected_keywords.append(keyword)
                if not target_screen:
                    target_screen = keyword

        navigation_route = None
        if target_screen:
            navigation_route = self.get_navigation_path_to_screen(target_screen)

        return {
            "target_screen": target_screen,
            "navigation_route": navigation_route,
            "keywords": detected_keywords,
            "test_title": test_title
        }

    def _find_files_with_pattern(self, pattern: str, extension: str) -> List[Path]:
        """Find files matching pattern in project."""
        matching_files = []
        search_dirs = [
            self.project_path / "lib",
            self.project_path / "lib" / "features",
            self.project_path / "lib" / "app"
        ]

        for search_dir in search_dirs:
            if not search_dir.exists():
                continue

            for file_path in search_dir.rglob(f"*{extension}"):
                if pattern.lower() in file_path.name.lower():
                    matching_files.append(file_path)

        return matching_files

    def _parse_router_file(self, router_file: Path) -> Dict:
        """Parse GoRouter configuration file."""
        routes = {}

        try:
            with open(router_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Pattern: GoRoute(path: '/some-path', name: 'some_name', builder: ...)
            route_pattern = r"GoRoute\s*\([^)]*path:\s*['\"]([^'\"]+)['\"][^)]*name:\s*['\"]([^'\"]+)['\"]"
            matches = re.findall(route_pattern, content)

            for path, name in matches:
                routes[path] = {
                    "name": name,
                    "route_path": path,
                    "file_path": str(router_file)
                }

        except Exception as e:
            print(f"Error parsing router file {router_file}: {e}")

        return routes
