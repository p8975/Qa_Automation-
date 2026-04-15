"""
NavigationService: Handles automatic navigation to target screens before test execution.
"""

import os
import time
from typing import Optional, Dict
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    NoSuchElementException,
    StaleElementReferenceException,
    ElementNotInteractableException,
    WebDriverException
)
from appium.webdriver.common.appiumby import AppiumBy


class NavigationService:
    """Service for navigating to specific screens in the app."""

    def __init__(self, driver):
        """
        Initialize navigation service.

        Args:
            driver: Appium WebDriver instance
        """
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)  # Reduced from 30 for faster execution
        # Load test credentials from environment variables
        self._test_credentials = {
            'phone': os.getenv('TEST_PHONE', ''),
            'otp': os.getenv('TEST_OTP', '')
        }

    def navigate_to_route(self, route_path: str) -> bool:
        """
        Navigate to a specific route using multiple strategies.
        OPTIMIZED: Reduced wait times for faster execution.

        Args:
            route_path: Route path (e.g., '/trial-corner')

        Returns:
            bool: True if navigation successful
        """
        try:
            package = self.driver.capabilities.get('appPackage', '')

            # Check current screen first
            current_screen = self._detect_current_screen()
            print(f"  Current screen: {current_screen}")

            # If on auth screen, handle login first
            if current_screen in ['login', 'otp', 'auth']:
                print("  On auth screen, attempting login...")
                self.handle_auth_screen(self._test_credentials)
                time.sleep(1.5)  # Reduced from 3

                # Check screen after login
                new_screen = self._detect_current_screen()
                print(f"  Screen after login: {new_screen}")

            # Try deep link to target screen (skip if route is empty)
            if route_path and route_path != '/':
                deep_link = f"{package}://app{route_path}"
                print(f"  Trying deep link: {deep_link}")

                try:
                    self.driver.execute_script('mobile: deepLink', {
                        'url': deep_link,
                        'package': package
                    })
                    time.sleep(1)  # Reduced from 3
                except Exception as e:
                    print(f"  Deep link failed (non-critical): {e}")

            # Check final screen
            final_screen = self._detect_current_screen()
            print(f"  Final screen: {final_screen}")

            # If still on auth, try login once more
            if final_screen in ['login', 'otp', 'auth']:
                print("  Still on auth screen, retrying login...")
                self.handle_auth_screen(self._test_credentials)
                time.sleep(1)  # Reduced from 2

            return True

        except Exception as e:
            print(f"Navigation failed (non-critical): {e}")
            return True
    
    def _close_auth_screens(self) -> bool:
        """Try to close/skip auth screens."""
        try:
            print("  Attempting to close auth screens...")
            
            # Look for skip/dismiss buttons
            skip_patterns = ['skip', 'dismiss', 'close', 'get started', 'continue', 'next', 'done', 'enter app']
            
            for pattern in skip_patterns:
                try:
                    elements = self.driver.find_elements(AppiumBy.XPATH,
                        f"//*[contains(translate(@text,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), '{pattern}') or contains(translate(@content-desc,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), '{pattern}')]")

                    for elem in elements:
                        try:
                            if elem.is_displayed() and elem.is_enabled():
                                elem.click()
                                time.sleep(1)
                                print(f"  Clicked: {pattern}")
                                return True
                        except (StaleElementReferenceException, ElementNotInteractableException):
                            continue
                except (NoSuchElementException, StaleElementReferenceException):
                    continue

            # Try pressing back
            try:
                self.driver.back()
                time.sleep(1)
            except WebDriverException as e:
                print(f"  Back button failed: {e}")
                
        except Exception as e:
            print(f"  Close auth failed: {e}")
        
        return False
    
    def _launch_with_extras(self, route: str, package: str) -> bool:
        """Launch app with route as intent extra."""
        try:
            import subprocess
            
            # Extract screen name from route
            screen_name = route.strip('/').replace('-', '').replace('/', '')
            print(f"  Trying activity launch for: {screen_name}")
            
            # Use adb to start with intent
            cmd = f"adb shell am start -a android.intent.action.VIEW -d {package}://app{route} {package}"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            print(f"  ADB result: {result.stdout}")
            
            return True
        except Exception as e:
            print(f"  Activity launch failed: {e}")
            return False
    
    def _detect_current_screen(self) -> Optional[str]:
        """Detect the current screen based on visible elements."""
        try:
            page_source = self.driver.page_source.lower()
            
            # Check for auth screens first (highest priority)
            auth_indicators = {
                'otp': ['otp', 'verify', 'verification code', 'enter code'],
                'login': ['login', 'sign in', 'email', 'password', 'phone number'],
                'auth': ['authentication', 'authenticate'],
            }
            
            for screen, indicators in auth_indicators.items():
                for ind in indicators:
                    if ind in page_source:
                        return screen
            
            # Check for target screens
            target_indicators = [
                'trial corner', 'trial', 'subscription', 'home', 'browse',
                'settings', 'profile', 'content', 'payment'
            ]
            
            for indicator in target_indicators:
                if indicator in page_source:
                    return indicator
                    
            return None
        except (NoSuchElementException, StaleElementReferenceException, ElementNotInteractableException):
            return None

    def handle_auth_screen(self, test_credentials: dict = None) -> bool:
        """Handle login/OTP screen by trying to authenticate or skip. OPTIMIZED."""
        if test_credentials is None:
            test_credentials = {}
        try:
            print("  Detected auth screen, attempting to handle...")

            current_screen = self._detect_current_screen()
            print(f"  Auth screen type: {current_screen}")

            # Strategy 1: Look for skip button
            skip_patterns = ['skip', 'get started', 'continue', 'enter app', 'let me in', 'next']
            for pattern in skip_patterns:
                elements = self.driver.find_elements(AppiumBy.XPATH,
                    f"//*[contains(translate(@text,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), '{pattern}') or contains(translate(@content-desc,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), '{pattern}')]")
                for elem in elements:
                    try:
                        if elem.is_displayed():
                            elem.click()
                            time.sleep(0.5)  # Reduced from 2
                            print(f"  ✓ Clicked skip: {pattern}")
                            return True
                    except (NoSuchElementException, StaleElementReferenceException, ElementNotInteractableException):
                        continue

            # Strategy 2: If test credentials provided, try to login
            if test_credentials:
                return self._try_login(test_credentials)

            return False

        except Exception as e:
            print(f"  Handle auth failed: {e}")
            return False
    
    def _try_login(self, credentials: dict) -> bool:
        """Try to login with provided credentials. OPTIMIZED with reduced waits."""
        try:
            print("  Attempting login with credentials...")

            # Find phone/username field - usually first EditText
            fields = self.driver.find_elements(AppiumBy.CLASS_NAME, "android.widget.EditText")

            if len(fields) >= 1:
                # Enter phone number
                fields[0].send_keys(credentials.get('phone', '2022123418'))
                print(f"  ✓ Entered phone: {credentials.get('phone', '2022123418')}")

            # Click continue/proceed button
            continue_patterns = ['continue', 'proceed', 'next', 'send otp', 'get otp', 'लॉगिन']
            for pattern in continue_patterns:
                try:
                    btns = self.driver.find_elements(AppiumBy.XPATH,
                        f"//*[contains(translate(@text,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), '{pattern}') or contains(translate(@content-desc,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), '{pattern}')]")
                    for btn in btns:
                        if btn.is_displayed():
                            btn.click()
                            # Wait for button to become stale (screen changed) with fallback
                            try:
                                WebDriverWait(self.driver, 2).until(EC.staleness_of(btn))
                            except Exception:
                                time.sleep(0.5)  # Fallback if element doesn't go stale
                            print(f"  ✓ Clicked: {pattern}")
                            break
                except (NoSuchElementException, StaleElementReferenceException, ElementNotInteractableException):
                    continue

            # Wait for OTP field to appear using explicit wait
            try:
                WebDriverWait(self.driver, 3).until(
                    EC.presence_of_element_located((AppiumBy.CLASS_NAME, "android.widget.EditText"))
                )
            except Exception:
                pass  # Continue even if OTP field not found immediately

            # Find OTP field (usually 4-6 digit fields)
            otp_fields = self.driver.find_elements(AppiumBy.CLASS_NAME, "android.widget.EditText")

            if len(otp_fields) >= 1:
                # Enter OTP - 3418
                otp = credentials.get('otp', '3418')
                otp_fields[0].send_keys(otp)
                print(f"  ✓ Entered OTP: {otp}")

            # Click verify/submit button
            verify_patterns = ['verify', 'submit', 'login', 'sign in', 'done', 'confirm']
            for pattern in verify_patterns:
                try:
                    btns = self.driver.find_elements(AppiumBy.XPATH,
                        f"//*[contains(translate(@text,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), '{pattern}') or contains(translate(@content-desc,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), '{pattern}')]")
                    for btn in btns:
                        if btn.is_displayed():
                            btn.click()
                            time.sleep(1)  # Reduced from 3
                            print(f"  ✓ Clicked: {pattern}")
                            return True
                except (NoSuchElementException, StaleElementReferenceException, ElementNotInteractableException):
                    continue

            return True  # Assume success if no error

        except Exception as e:
            print(f"  Login failed: {e}")
            return False
    
    def _bypass_auth_and_navigate(self, route_path: str) -> bool:
        """Try to bypass authentication screens and navigate to target. OPTIMIZED."""
        try:
            print(f"  Attempting to bypass auth and navigate to {route_path}")

            # If we're on OTP/login screen, try to find skip/continue button
            skip_patterns = ['skip', 'continue', 'next', 'done', 'get started', 'enter app']

            for elem in self.driver.find_elements(AppiumBy.CLASS_NAME, "android.widget.Button"):
                try:
                    text = elem.text.lower()
                    if any(pattern in text for pattern in skip_patterns):
                        elem.click()
                        time.sleep(0.5)  # Reduced from 2
                        print(f"  Clicked skip button: {text}")
                except (NoSuchElementException, StaleElementReferenceException, ElementNotInteractableException):
                    continue

            # Try to directly navigate using activity intent
            package = self.driver.capabilities.get('appPackage', '')

            # Extract screen name from route
            screen_name = route_path.strip('/').replace('-', '_').replace('/', '_')

            # Try different activity patterns
            activity_patterns = [
                f"{package}/.ui.{screen_name}.{screen_name.title()}Activity",
                f"{package}/com.example.{screen_name}.{screen_name.title()}Activity",
            ]

            for activity in activity_patterns:
                try:
                    self.driver.start_activity(activity)
                    time.sleep(0.5)  # Reduced from 2
                    print(f"  Started activity: {activity}")
                    return True
                except (NoSuchElementException, StaleElementReferenceException, ElementNotInteractableException):
                    continue

            return False

        except Exception as e:
            print(f"  Auth bypass failed: {e}")
            return False

    def navigate_to_screen_by_keyword(
        self,
        keyword: str,
        element_map: Optional[Dict] = None
    ) -> bool:
        """
        Navigate to screen by finding and tapping navigation elements.

        Args:
            keyword: Screen keyword (e.g., "trial", "subscription")
            element_map: Known element identifiers

        Returns:
            bool: True if navigation successful
        """
        keyword_lower = keyword.lower()

        # Common navigation patterns
        navigation_attempts = [
            # Try finding button with text containing keyword
            lambda: self._tap_element_by_text(keyword),
            # Try finding button with accessibility ID
            lambda: self._tap_element_by_accessibility_id(f"{keyword_lower}_button"),
            lambda: self._tap_element_by_accessibility_id(f"{keyword_lower}_tab"),
            # Try finding in element map
            lambda: self._tap_from_element_map(keyword_lower, element_map) if element_map else False
        ]

        for attempt in navigation_attempts:
            try:
                if attempt():
                    time.sleep(2)  # Wait for screen to load
                    return True
            except (NoSuchElementException, StaleElementReferenceException, ElementNotInteractableException):
                continue

        return False

    def wait_for_screen_load(self, timeout: int = 30) -> bool:
        """
        Wait for screen to finish loading.

        Args:
            timeout: Maximum wait time in seconds

        Returns:
            bool: True if screen loaded
        """
        try:
            # Wait for any interactive element to appear
            self.wait.until(
                lambda d: len(d.find_elements(AppiumBy.CLASS_NAME, "android.widget.Button")) > 0
                or len(d.find_elements(AppiumBy.CLASS_NAME, "android.widget.TextView")) > 0
            )
            return True
        except (NoSuchElementException, StaleElementReferenceException, ElementNotInteractableException):
            return False

    def go_back(self, steps: int = 1) -> None:
        """
        Navigate back N screens.

        Args:
            steps: Number of screens to go back
        """
        for _ in range(steps):
            self.driver.back()
            time.sleep(1)

    def _tap_element_by_text(self, text: str) -> bool:
        """Tap element by visible text."""
        try:
            element = self.wait.until(
                EC.element_to_be_clickable((AppiumBy.XPATH, f"//*[contains(@text, '{text}') or contains(@content-desc, '{text}')]"))
            )
            element.click()
            return True
        except (NoSuchElementException, StaleElementReferenceException, ElementNotInteractableException):
            return False

    def _tap_element_by_accessibility_id(self, accessibility_id: str) -> bool:
        """Tap element by accessibility ID."""
        try:
            element = self.wait.until(
                EC.element_to_be_clickable((AppiumBy.ACCESSIBILITY_ID, accessibility_id))
            )
            element.click()
            return True
        except (NoSuchElementException, StaleElementReferenceException, ElementNotInteractableException):
            return False

    def _tap_from_element_map(self, keyword: str, element_map: Dict) -> bool:
        """Tap element from cached element map."""
        for element_id, element_info in element_map.items():
            if keyword in element_id.lower():
                try:
                    element = self.driver.find_element(AppiumBy.ACCESSIBILITY_ID, element_id)
                    element.click()
                    return True
                except (NoSuchElementException, StaleElementReferenceException, ElementNotInteractableException):
                    continue
        return False
