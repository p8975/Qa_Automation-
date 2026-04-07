"""
FlutterLocatorService: 5-tier locator strategy optimized for Stage Flutter app.
"""

from typing import Optional, Dict, List, Any
from enum import Enum
import re


class LocatorTier(Enum):
    """Locator strategy tiers in order of reliability."""
    VALUE_KEY = 1      # Key('login_button')
    WIDGET_TYPE = 2    # ElevatedButton, TextField
    TEXT = 3           # 'Login', 'लॉगिन करें'
    ICON = 4           # Icons.close
    NATIVE = 5         # UiAutomator2 fallback


class FlutterLocatorService:
    """5-tier locator strategy optimized for Stage Flutter app."""

    # Stage app key mappings (extracted from stage_keys.dart)
    STAGE_KEY_MAPPINGS = {
        'login': ['loginButton', 'phoneInput', 'otpInput'],
        'home': ['homeScreen', 'bottomNavBar', 'forYouTab'],
        'player': ['reelVideoPlayer', 'microDramaVideoPlayer', 'chromeCastButton'],
        'subscription': ['startTrialButton', 'subscribeButton', 'paymentSuccessActionButtonKey'],
        'settings': ['settings', 'logoutButton', 'profileScreen'],
    }

    # Material icon codepoints
    ICON_CODEPOINTS = {
        'close': 0xe5cd,
        'settings': 0xe8b8,
        'home': 0xe88a,
        'search': 0xe8b6,
        'play': 0xe037,
        'pause': 0xe034,
        'arrow_back': 0xe5c4,
        'menu': 0xe5d2,
        'more_vert': 0xe5d4,
        'favorite': 0xe87d,
        'share': 0xe80d,
        'download': 0xe2c4,
        'person': 0xe7fd,
        'notifications': 0xe7f4,
    }

    # Widget type mappings from action keywords
    ACTION_WIDGET_TYPES = {
        'tap': 'GestureDetector',
        'click': 'ElevatedButton',
        'press': 'ElevatedButton',
        'enter': 'TextField',
        'type': 'TextField',
        'input': 'TextField',
        'fill': 'TextField',
        'select': 'DropdownButton',
        'toggle': 'Switch',
        'check': 'Checkbox',
        'scroll': 'ListView',
        'swipe': 'PageView',
    }

    def __init__(self, driver):
        """
        Initialize Flutter locator service.

        Args:
            driver: Appium WebDriver instance with Flutter support
        """
        self.driver = driver
        self.current_context = "FLUTTER"
        self._last_successful_tier = None

    def find_element(self, hints: Dict[str, Any], timeout: int = 10) -> Optional[Any]:
        """
        Find element using 5-tier fallback strategy.

        Args:
            hints: Locator hints containing keys, text, widget_type, icon, action
            timeout: Maximum wait time in seconds

        Returns:
            Element if found, None otherwise
        """
        tiers = [
            (LocatorTier.VALUE_KEY, self._find_by_key),
            (LocatorTier.WIDGET_TYPE, self._find_by_type),
            (LocatorTier.TEXT, self._find_by_text),
            (LocatorTier.ICON, self._find_by_icon),
            (LocatorTier.NATIVE, self._find_by_native),
        ]

        for tier, finder in tiers:
            try:
                element = finder(hints, timeout)
                if element:
                    print(f"  ✓ Found via Tier {tier.value}: {tier.name}")
                    self._last_successful_tier = tier
                    return element
            except Exception as e:
                print(f"  ✗ Tier {tier.value} ({tier.name}): {e}")
                continue

        return None

    def _find_by_key(self, hints: Dict, timeout: int) -> Optional[Any]:
        """Tier 1: Find by Flutter Key (most reliable for Stage)."""
        keys_to_try = hints.get('keys', [])
        if not keys_to_try and hints.get('text'):
            # Generate possible keys from text
            keys_to_try = self._generate_key_variants(hints['text'])

        for key in keys_to_try:
            try:
                finder_json = {
                    'finderType': 'ByValueKey',
                    'keyValueString': key,
                    'keyValueType': 'String'
                }
                element = self.driver.execute_script(
                    'flutter:waitFor',
                    finder_json,
                    timeout * 1000
                )
                if element:
                    return element
            except Exception:
                continue
        return None

    def _find_by_type(self, hints: Dict, timeout: int) -> Optional[Any]:
        """Tier 2: Find by widget type."""
        widget_type = hints.get('widget_type')
        if not widget_type:
            widget_type = self._infer_widget_type(hints.get('action', ''))

        if widget_type:
            try:
                finder_json = {
                    'finderType': 'ByType',
                    'type': widget_type
                }
                return self.driver.execute_script(
                    'flutter:waitFor',
                    finder_json,
                    timeout * 1000
                )
            except Exception:
                pass
        return None

    def _find_by_text(self, hints: Dict, timeout: int) -> Optional[Any]:
        """Tier 3: Find by text content (supports Hindi)."""
        text = hints.get('text')
        if text:
            try:
                finder_json = {
                    'finderType': 'ByText',
                    'text': text
                }
                return self.driver.execute_script(
                    'flutter:waitFor',
                    finder_json,
                    timeout * 1000
                )
            except Exception:
                pass

            # Try partial text match
            try:
                finder_json = {
                    'finderType': 'ByText',
                    'text': text,
                    'substring': True
                }
                return self.driver.execute_script(
                    'flutter:waitFor',
                    finder_json,
                    timeout * 1000
                )
            except Exception:
                pass
        return None

    def _find_by_icon(self, hints: Dict, timeout: int) -> Optional[Any]:
        """Tier 4: Find by Material icon."""
        icon_name = hints.get('icon')
        if icon_name and icon_name in self.ICON_CODEPOINTS:
            try:
                finder_json = {
                    'finderType': 'ByIcon',
                    'codePoint': self.ICON_CODEPOINTS[icon_name]
                }
                return self.driver.execute_script(
                    'flutter:waitFor',
                    finder_json,
                    timeout * 1000
                )
            except Exception:
                pass
        return None

    def _find_by_native(self, hints: Dict, timeout: int) -> Optional[Any]:
        """Tier 5: Native UiAutomator2 fallback for system dialogs."""
        try:
            self.driver.switch_to.context("NATIVE_APP")
            from appium.webdriver.common.appiumby import AppiumBy
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC

            text = hints.get('text', '')
            if text:
                xpath = f"//*[contains(@text, '{text}') or contains(@content-desc, '{text}')]"
                wait = WebDriverWait(self.driver, timeout)
                element = wait.until(
                    EC.presence_of_element_located((AppiumBy.XPATH, xpath))
                )
                return element
        except Exception:
            pass
        finally:
            try:
                self.driver.switch_to.context("FLUTTER")
            except Exception:
                pass
        return None

    def _generate_key_variants(self, text: str) -> List[str]:
        """Generate possible key names from text."""
        # Clean the text
        base = text.lower().replace(' ', '_').replace("'", '').replace('"', '')
        base = re.sub(r'[^\w_]', '', base)

        return [
            f"{base}Button",
            f"{base}_button",
            f"btn_{base}",
            base,
            f"{base}Key",
            f"{base}_key",
            # CamelCase variants
            ''.join(word.title() for word in base.split('_')) + 'Button',
            ''.join(word.title() for word in base.split('_')),
        ]

    def _infer_widget_type(self, action: str) -> Optional[str]:
        """Infer widget type from action keyword."""
        action_lower = action.lower()
        for keyword, widget_type in self.ACTION_WIDGET_TYPES.items():
            if keyword in action_lower:
                return widget_type
        return None

    def tap(self, element) -> None:
        """Tap on a Flutter element."""
        self.driver.execute_script('flutter:tap', element)

    def enter_text(self, element, text: str) -> None:
        """Enter text into a Flutter element."""
        self.driver.execute_script('flutter:enterText', element, text)

    def scroll(self, element, dx: int = 0, dy: int = -300) -> None:
        """Scroll a Flutter element."""
        self.driver.execute_script('flutter:scroll', element, {'dx': dx, 'dy': dy})

    def wait_for_absent(self, hints: Dict[str, Any], timeout: int = 5) -> bool:
        """Wait for element to be absent (for loading states)."""
        keys = hints.get('keys', [])
        if keys:
            try:
                finder_json = {
                    'finderType': 'ByValueKey',
                    'keyValueString': keys[0],
                    'keyValueType': 'String'
                }
                self.driver.execute_script(
                    'flutter:waitForAbsent',
                    finder_json,
                    timeout * 1000
                )
                return True
            except Exception:
                return False
        return True

    def get_render_tree(self) -> str:
        """Get Flutter render tree for debugging."""
        try:
            return self.driver.execute_script('flutter:getRenderTree')
        except Exception:
            return ""

    def get_semantics_id(self, hints: Dict[str, Any]) -> Optional[int]:
        """Get semantics ID for an element (useful for accessibility testing)."""
        element = self.find_element(hints, timeout=5)
        if element:
            try:
                return self.driver.execute_script('flutter:getSemanticsId', element)
            except Exception:
                pass
        return None
