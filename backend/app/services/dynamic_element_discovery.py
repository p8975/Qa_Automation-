"""
DynamicElementDiscovery: Inspects current screen UI and extracts real element identifiers.
"""

import re
from typing import Dict, List, Optional
from appium.webdriver.common.appiumby import AppiumBy


class DynamicElementDiscovery:
    """Service for discovering UI elements on the current screen."""

    # System packages to filter out during element discovery
    SYSTEM_PACKAGES = [
        "com.android.permissioncontroller",
        "com.android.systemui",
        "com.android.packageinstaller",
        "com.google.android.permissioncontroller",
        "android:",  # Generic android system elements
    ]

    def __init__(self, driver):
        """
        Initialize element discovery service.

        Args:
            driver: Appium WebDriver instance
        """
        self.driver = driver

    def _is_system_element(self, resource_id: str) -> bool:
        """Check if an element belongs to a system package (should be filtered out)."""
        if not resource_id:
            return False
        for pkg in self.SYSTEM_PACKAGES:
            if resource_id.startswith(pkg):
                return True
        return False

    def inspect_current_screen(self) -> Dict[str, Dict]:
        """
        Inspect current screen and extract all interactive elements.
        Filters out system UI elements (permission dialogs, etc.)

        Returns:
            dict: {element_id: {type, text, resource_id, content_desc, bounds}}
        """
        elements = {}

        try:
            # Get page source XML
            page_source = self.driver.page_source

            # Parse interactive elements
            interactive_classes = [
                "android.widget.Button",
                "android.widget.ImageButton",
                "android.widget.TextView",
                "android.widget.EditText",
                "android.view.View"
            ]

            for class_name in interactive_classes:
                class_elements = self.driver.find_elements(AppiumBy.CLASS_NAME, class_name)

                for idx, element in enumerate(class_elements):
                    try:
                        resource_id = element.get_attribute("resource-id") or ""

                        # Skip system UI elements (permission dialogs, etc.)
                        if self._is_system_element(resource_id):
                            continue

                        element_id = self._generate_element_id(element, idx)
                        if element_id:
                            elements[element_id] = {
                                "type": class_name,
                                "text": element.text or "",
                                "resource_id": resource_id,
                                "content_desc": element.get_attribute("content-desc") or "",
                                "clickable": element.get_attribute("clickable") == "true",
                                "enabled": element.get_attribute("enabled") == "true"
                            }
                    except Exception:
                        continue

        except Exception as e:
            print(f"Error inspecting screen: {e}")

        return elements

    def find_element_by_keyword(self, keyword: str,         elements: Optional[Dict] = None) -> Optional[Dict]:
        """
        Find element on current screen by keyword match.

        Args:
            keyword: Keyword to search (e.g., "cancel", "trial", "pause")
            elements: Optional pre-fetched elements dict

        Returns:
            Optional[dict]: Element info if found
        """
        keyword_lower = keyword.lower()
        
        if elements is None:
            elements = self.inspect_current_screen()
        
        # First pass: exact match in element_id
        for element_id, element_info in elements.items():
            if keyword_lower == element_id.lower():
                return {"element_id": element_id, **element_info}
        
        # Second pass: partial match in element_id
        for element_id, element_info in elements.items():
            if keyword_lower in element_id.lower():
                return {"element_id": element_id, **element_info}
        
        # Third pass: match in text
        for element_id, element_info in elements.items():
            if keyword_lower in element_info.get("text", "").lower():
                return {"element_id": element_id, **element_info}
        
        # Fourth pass: match in content-desc
        for element_id, element_info in elements.items():
            if keyword_lower in element_info.get("content_desc", "").lower():
                return {"element_id": element_id, **element_info}

        return None

    def find_elements_by_keywords(self, keywords: List[str]) -> Dict[str, Dict]:
        """
        Find multiple elements by keywords.

        Args:
            keywords: List of keywords to search

        Returns:
            dict: {keyword: element_info}
        """
        results = {}
        elements = self.inspect_current_screen()

        for keyword in keywords:
            keyword_lower = keyword.lower()
            for element_id, element_info in elements.items():
                if (keyword_lower in element_id.lower() or
                    keyword_lower in element_info.get("text", "").lower() or
                    keyword_lower in element_info.get("content_desc", "").lower()):
                    results[keyword] = {"element_id": element_id, **element_info}
                    break

        return results

    def get_locator_for_element(self, element_info: Dict) -> tuple:
        """
        Get best locator strategy for element.

        Args:
            element_info: Element information

        Returns:
            tuple: (locator_type, locator_value)
        """
        # Priority: content-desc > resource-id > text > xpath
        content_desc = element_info.get("content_desc", "").strip()
        resource_id = element_info.get("resource_id", "").strip()
        text = element_info.get("text", "").strip()
        
        if content_desc and content_desc != "null":
            return (AppiumBy.ACCESSIBILITY_ID, content_desc)
        elif resource_id and resource_id != "null":
            resource_id_val = element_info["resource_id"]
            if "/" in resource_id_val:
                return (AppiumBy.ID, resource_id_val)
            else:
                return (AppiumBy.ID, resource_id_val)
        elif text and text != "null":
            return (AppiumBy.XPATH, f"//*[@text='{text}']")
        else:
            # Fallback: use class type + index
            elem_type = element_info.get("type", "android.widget.Button")
            return (AppiumBy.CLASS_NAME, elem_type)
    
    def find_element_by_text_fallback(self, keywords: List[str], elements: Dict) -> Optional[Dict]:
        """Find element by searching text content of all elements."""
        if not keywords or not elements:
            return None
        
        keywords_lower = [k.lower() for k in keywords]
        
        # Search all elements for text match
        for elem_id, elem_info in elements.items():
            elem_text = (elem_info.get("text", "") or "").lower()
            elem_desc = (elem_info.get("content_desc", "") or "").lower()
            elem_resource = (elem_info.get("resource_id", "") or "").lower()
            
            for kw in keywords_lower:
                # Check if keyword matches any element text
                if kw in elem_text or kw in elem_desc or kw in elem_resource:
                    # Return element with valid text for XPath
                    if elem_text:
                        return {
                            "element_id": elem_id,
                            "text": elem_info.get("text", ""),
                            "content_desc": elem_info.get("content_desc", ""),
                            "resource_id": elem_info.get("resource_id", ""),
                            "type": elem_info.get("type", "android.widget.TextView"),
                            "use_text_locator": True
                        }
        
        return None

    def extract_step_keywords(self, step_description: str) -> List[str]:
        """
        Extract action keywords from step description.

        Args:
            step_description: Test step description

        Returns:
            list: Keywords to search for in UI
        """
        # Remove common test words
        common_words = ["the", "a", "an", "and", "or", "to", "from", "in", "on", "at", "by"]
        words = re.findall(r'\b\w+\b', step_description.lower())

        # Action keywords to look for
        action_keywords = ["tap", "click", "enter", "input", "scroll", "swipe", "select", "verify"]

        # Extract meaningful keywords (not action words, not common words)
        keywords = [w for w in words if w not in common_words and w not in action_keywords and len(w) > 2]

        return keywords

    def generate_appium_command_from_element(
        self,
        element_info: Dict,
        action: str = "click",
        text_input: Optional[str] = None
    ) -> str:
        """
        Generate Appium command for interacting with element.

        Args:
            element_info: Element information
            action: Action to perform (click, send_keys, etc.)
            text_input: Text to input for send_keys action

        Returns:
            str: Executable Appium command string
        """
        locator_type, locator_value = self.get_locator_for_element(element_info)

        # Get string representation of locator type
        # Map AppiumBy enum values to their attribute names
        locator_map = {
            AppiumBy.ID: "ID",
            AppiumBy.XPATH: "XPATH",
            AppiumBy.CLASS_NAME: "CLASS_NAME",
            AppiumBy.ACCESSIBILITY_ID: "ACCESSIBILITY_ID",
        }

        locator_str = locator_map.get(locator_type)
        if not locator_str:
            # Fallback: try to extract from string representation
            locator_str = str(locator_type).split('.')[-1].upper().replace(' ', '_')

        if action == "click":
            return f'driver.find_element(AppiumBy.{locator_str}, "{locator_value}").click()'
        elif action == "send_keys":
            text = text_input or "test_input"
            return f'driver.find_element(AppiumBy.{locator_str}, "{locator_value}").send_keys("{text}")'
        elif action == "is_displayed":
            return f'driver.find_element(AppiumBy.{locator_str}, "{locator_value}").is_displayed()'
        elif action == "scroll":
            return f'driver.find_element(AppiumBy.{locator_str}, "{locator_value}").click()'
        else:
            return f'driver.find_element(AppiumBy.{locator_str}, "{locator_value}").click()'

    def find_element_by_fuzzy_match(self, keywords: List[str], elements: Dict) -> Optional[Dict]:
        """Find element using fuzzy matching on keywords."""
        if not keywords or not elements:
            return None
            
        # Score each element based on keyword matches
        best_match = None
        best_score = 0
        
        for element_id, element_info in elements.items():
            score = 0
            elem_text = (element_info.get("text", "") + " " + element_info.get("content_desc", "") + " " + element_info.get("resource_id", "")).lower()
            
            for keyword in keywords:
                # Partial match scores
                if keyword in element_id.lower():
                    score += 5
                if keyword in elem_text:
                    score += 3
                # Character overlap
                for char in keyword:
                    if char in elem_text:
                        score += 0.5
            
            if score > best_score:
                best_score = score
                best_match = {"element_id": element_id, **element_info}
        
        # Only return if we have a decent match
        if best_score >= 3:
            return best_match
        return None

    def _generate_element_id(self, element, index: int) -> Optional[str]:
        """Generate unique element ID for caching."""
        try:
            # Try content-desc first
            content_desc = element.get_attribute("content-desc")
            if content_desc:
                return content_desc

            # Try resource-id
            resource_id = element.get_attribute("resource-id")
            if resource_id:
                return resource_id.split("/")[-1]  # Get last part after package

            # Try text
            text = element.text
            if text and len(text) < 50:
                # Clean text for use as ID
                clean_text = re.sub(r'[^a-zA-Z0-9_]', '_', text.lower())
                return f"{clean_text}_{index}"

        except Exception:
            pass

        return None
