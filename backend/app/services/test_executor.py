"""
TestExecutor: Main execution engine for running tests against APK builds.
"""

import time
import uuid
from datetime import datetime
from typing import List, Optional, Dict
from pathlib import Path

from app.models import (
    TestRunEntity, TestResult, TestStatus, StepResult, StepStatus,
    TestRunStatus, TestCaseEntity, DeviceInfo
)
from app.services.appium_service import AppiumService
from app.services.device_manager import DeviceManager
from app.services.ai_step_translator import AIStepTranslator
from app.services.codebase_analyzer import CodebaseAnalyzer
from app.services.navigation_service import NavigationService
from app.services.dynamic_element_discovery import DynamicElementDiscovery
from app.repositories.test_run_repository import TestRunRepository
from app.repositories.element_map_repository import ElementMapRepository
from app.repositories.build_repository import BuildRepository
from app.repositories.test_case_repository import TestCaseRepository


class TestExecutor:
    """Service for executing tests against APK builds."""

    # System packages to filter out during element discovery
    SYSTEM_PACKAGES = [
        "com.android.permissioncontroller",
        "com.android.systemui",
        "com.android.packageinstaller",
        "com.google.android.permissioncontroller",
    ]

    # Permission dialog button patterns to click (in order of preference)
    PERMISSION_BUTTON_PATTERNS = [
        "com.android.permissioncontroller:id/permission_allow_button",
        "com.android.permissioncontroller:id/permission_allow_foreground_only_button",
        "com.android.packageinstaller:id/permission_allow_button",
        "android:id/button1",  # Generic "OK" button
    ]

    # Text patterns for permission buttons
    PERMISSION_TEXT_PATTERNS = [
        "allow",
        "while using the app",
        "only this time",
        "permit",
        "ok",
        "continue",
    ]

    def __init__(
        self,
        appium_service: AppiumService,
        device_manager: DeviceManager,
        ai_translator: AIStepTranslator,
        test_run_repository: TestRunRepository,
        element_map_repository: ElementMapRepository,
        build_repository: BuildRepository,
        test_case_repository: TestCaseRepository,
        flutter_project_path: str = "/Users/prakashkumar/StudioProjects/flutter_app"
    ):
        """Initialize test executor with all required services."""
        self.appium_service = appium_service
        self.device_manager = device_manager
        self.ai_translator = ai_translator
        self.test_run_repository = test_run_repository
        self.element_map_repository = element_map_repository
        self.build_repository = build_repository
        self.test_case_repository = test_case_repository

        # Intelligent services
        self.codebase_analyzer = CodebaseAnalyzer(flutter_project_path)

        # Timeout settings (in seconds) - OPTIMIZED for speed
        self.step_timeout = 10  # Reduced from 30
        self.test_timeout = 120  # Reduced from 300 (2 minutes per test)
        self.run_timeout = 900  # Reduced from 1800 (15 minutes total)

        # Configurable delays (in seconds) - OPTIMIZED
        self.post_action_delay = 0.2  # Reduced from 0.3
        self.screen_settle_delay = 0.5  # Reduced from 1.0
        self.app_launch_delay = 8  # Increased for Flutter apps (fallback only)
        self.app_ready_timeout = 15  # Max wait for app to become ready
        self.app_ready_poll_interval = 0.5  # Polling interval for app readiness

        # STAGE app specific identifiers for app readiness detection
        self.stage_app_ready_indicators = [
            "लॉगिन करें",  # Hindi login button
            "Login",
            "+91",  # Country code
            "phone",
            "mobile",
            "Enter your",
            "Google",  # Google sign-in
            "Continue",
        ]

    def _dismiss_permission_dialogs(self, driver, max_attempts: int = 5) -> int:
        """
        Dismiss any Android permission dialogs that may be blocking the app.

        Args:
            driver: Appium WebDriver instance
            max_attempts: Maximum number of permission dialogs to dismiss

        Returns:
            int: Number of dialogs dismissed
        """
        from appium.webdriver.common.appiumby import AppiumBy
        from selenium.common.exceptions import NoSuchElementException, TimeoutException

        dismissed_count = 0

        for attempt in range(max_attempts):
            dialog_found = False

            # Strategy 1: Try to find permission dialog by resource ID
            for resource_id in self.PERMISSION_BUTTON_PATTERNS:
                try:
                    element = driver.find_element(AppiumBy.ID, resource_id)
                    if element.is_displayed():
                        print(f"  → Dismissing permission dialog (resource: {resource_id})")
                        element.click()
                        time.sleep(0.5)
                        dismissed_count += 1
                        dialog_found = True
                        break
                except NoSuchElementException:
                    continue
                except Exception as e:
                    print(f"  → Error clicking permission button: {e}")
                    continue

            if dialog_found:
                continue

            # Strategy 2: Try to find by text content
            for text_pattern in self.PERMISSION_TEXT_PATTERNS:
                try:
                    xpath = f"//*[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{text_pattern}')]"
                    elements = driver.find_elements(AppiumBy.XPATH, xpath)
                    for element in elements:
                        # Check if this is from a system package (permission dialog)
                        try:
                            # Get the element's package - if it's a system package, click it
                            if element.is_displayed() and element.is_enabled():
                                # Check if element looks like a button
                                class_name = element.get_attribute("className") or ""
                                if "Button" in class_name or element.get_attribute("clickable") == "true":
                                    print(f"  → Dismissing permission dialog (text: {text_pattern})")
                                    element.click()
                                    time.sleep(0.5)
                                    dismissed_count += 1
                                    dialog_found = True
                                    break
                        except Exception:
                            continue
                    if dialog_found:
                        break
                except Exception:
                    continue

            if not dialog_found:
                # No more dialogs found
                break

            time.sleep(0.3)

        if dismissed_count > 0:
            print(f"  ✓ Dismissed {dismissed_count} permission dialog(s)")
            time.sleep(1)  # Wait for app to stabilize after dismissing dialogs

        return dismissed_count

    def _wait_for_app_ready(self, driver, timeout: float = None) -> bool:
        """
        Wait for the app to become ready by polling for interactive elements.
        This replaces fixed sleep() delays with smart element detection.

        Args:
            driver: Appium WebDriver instance
            timeout: Max seconds to wait (default: self.app_ready_timeout)

        Returns:
            bool: True if app is ready, False if timeout reached
        """
        from appium.webdriver.common.appiumby import AppiumBy
        from selenium.common.exceptions import NoSuchElementException

        timeout = timeout or self.app_ready_timeout
        start_time = time.time()
        last_element_count = 0
        stable_count = 0

        print(f"  ⏳ Waiting for app to become ready (max {timeout}s)...")

        while time.time() - start_time < timeout:
            try:
                # Dismiss any permission dialogs first
                self._dismiss_permission_dialogs(driver, max_attempts=2)

                # Strategy 1: Check for known STAGE app elements
                for indicator in self.stage_app_ready_indicators:
                    try:
                        elements = driver.find_elements(
                            AppiumBy.XPATH,
                            f"//*[contains(@text, '{indicator}') or contains(@content-desc, '{indicator}')]"
                        )
                        if elements:
                            print(f"  ✓ App ready - found indicator: '{indicator}'")
                            return True
                    except:
                        continue

                # Strategy 2: Check for any clickable/interactive elements (not system UI)
                try:
                    clickable_elements = driver.find_elements(
                        AppiumBy.XPATH,
                        "//*[@clickable='true' and not(contains(@resource-id, 'com.android'))]"
                    )
                    # Filter out system elements
                    app_elements = [
                        e for e in clickable_elements
                        if not self._is_system_element(e.get_attribute("resource-id") or "")
                    ]

                    current_count = len(app_elements)

                    if current_count > 0:
                        # Check if element count is stable (UI has settled)
                        if current_count == last_element_count:
                            stable_count += 1
                            if stable_count >= 3:  # Stable for 3 polls
                                print(f"  ✓ App ready - {current_count} interactive elements found")
                                return True
                        else:
                            stable_count = 0
                        last_element_count = current_count

                except Exception as e:
                    print(f"  → Polling error: {e}")

                # Strategy 3: Check for EditText (input fields) - common on login screens
                try:
                    edit_texts = driver.find_elements(AppiumBy.CLASS_NAME, "android.widget.EditText")
                    if edit_texts:
                        print(f"  ✓ App ready - found {len(edit_texts)} input field(s)")
                        return True
                except:
                    pass

            except Exception as e:
                print(f"  → Wait cycle error: {e}")

            time.sleep(self.app_ready_poll_interval)

        # Timeout reached - log current state for debugging
        elapsed = time.time() - start_time
        print(f"  ⚠️ App ready timeout after {elapsed:.1f}s")
        self._log_screen_state(driver)

        return False

    def _log_screen_state(self, driver, prefix: str = "DEBUG") -> dict:
        """
        Log the current screen state for debugging purposes.
        Returns a summary of what's on screen.

        Args:
            driver: Appium WebDriver instance
            prefix: Log prefix for identification

        Returns:
            dict: Summary of screen state
        """
        from appium.webdriver.common.appiumby import AppiumBy

        summary = {
            "total_elements": 0,
            "clickable_elements": 0,
            "text_views": 0,
            "edit_texts": 0,
            "visible_text": [],
            "has_content": False
        }

        try:
            # Get page source length as indicator
            page_source = driver.page_source
            summary["page_source_length"] = len(page_source)

            # Count different element types
            try:
                all_views = driver.find_elements(AppiumBy.XPATH, "//*")
                summary["total_elements"] = len(all_views)
            except:
                pass

            try:
                clickables = driver.find_elements(AppiumBy.XPATH, "//*[@clickable='true']")
                summary["clickable_elements"] = len(clickables)
            except:
                pass

            try:
                text_views = driver.find_elements(AppiumBy.CLASS_NAME, "android.widget.TextView")
                summary["text_views"] = len(text_views)
                # Collect visible text (first 5)
                for tv in text_views[:5]:
                    text = tv.text
                    if text and len(text.strip()) > 0:
                        summary["visible_text"].append(text[:50])
            except:
                pass

            try:
                edit_texts = driver.find_elements(AppiumBy.CLASS_NAME, "android.widget.EditText")
                summary["edit_texts"] = len(edit_texts)
            except:
                pass

            summary["has_content"] = (
                summary["total_elements"] > 10 or
                summary["clickable_elements"] > 2 or
                len(summary["visible_text"]) > 0
            )

            print(f"  [{prefix}] Screen state:")
            print(f"    - Total elements: {summary['total_elements']}")
            print(f"    - Clickable: {summary['clickable_elements']}")
            print(f"    - TextViews: {summary['text_views']}")
            print(f"    - EditTexts: {summary['edit_texts']}")
            if summary["visible_text"]:
                print(f"    - Visible text: {summary['visible_text'][:3]}")
            print(f"    - Has content: {summary['has_content']}")

        except Exception as e:
            print(f"  [{prefix}] Error logging screen state: {e}")

        return summary

    def _ensure_app_on_screen(self, driver, target_screen: str, build_package: str, device_id: str) -> bool:
        """
        Ensure the app is on the expected screen. If not, try to navigate there.

        Args:
            driver: Appium WebDriver instance
            target_screen: Expected screen (e.g., "Login", "Home", "OTP")
            build_package: App package name
            device_id: Device ID for adb commands

        Returns:
            bool: True if on target screen or successfully navigated there
        """
        from appium.webdriver.common.appiumby import AppiumBy

        target_lower = target_screen.lower()

        # Define screen indicators
        screen_indicators = {
            "login": ["लॉगिन करें", "+91", "Enter your phone", "mobile number", "Login"],
            "otp": ["OTP", "Enter OTP", "Verify", "code sent", "resend"],
            "home": ["Home", "For You", "Explore", "Search", "Profile"],
            "profile": ["Profile", "Account", "Settings", "Edit Profile"],
        }

        # Check if already on target screen
        indicators = screen_indicators.get(target_lower, [target_screen])
        for indicator in indicators:
            try:
                elements = driver.find_elements(
                    AppiumBy.XPATH,
                    f"//*[contains(@text, '{indicator}') or contains(@content-desc, '{indicator}')]"
                )
                if elements:
                    print(f"  ✓ Already on {target_screen} screen (found: '{indicator}')")
                    return True
            except:
                continue

        # Not on target screen - try to navigate
        print(f"  ⚠️ Not on {target_screen} screen, attempting navigation...")

        # Strategy 1: If target is Login and we're elsewhere, relaunch app
        if target_lower == "login":
            try:
                self.device_manager.clear_app_data(device_id, build_package)
                self.device_manager.launch_app(device_id, build_package)
                time.sleep(2)
                self._dismiss_permission_dialogs(driver)
                if self._wait_for_app_ready(driver, timeout=10):
                    print(f"  ✓ Navigated to Login via app relaunch")
                    return True
            except Exception as e:
                print(f"  → Navigation failed: {e}")

        # Strategy 2: Press back button to potentially go to login/home
        try:
            for _ in range(3):
                driver.press_keycode(4)  # Android BACK key
                time.sleep(0.5)
            self._dismiss_permission_dialogs(driver)

            # Check again
            for indicator in indicators:
                try:
                    elements = driver.find_elements(
                        AppiumBy.XPATH,
                        f"//*[contains(@text, '{indicator}')]"
                    )
                    if elements:
                        print(f"  ✓ Navigated to {target_screen} via back button")
                        return True
                except:
                    continue
        except:
            pass

        print(f"  ✗ Could not navigate to {target_screen} screen")
        return False

    def _is_system_element(self, resource_id: str) -> bool:
        """Check if an element belongs to a system package (should be filtered out)."""
        if not resource_id:
            return False
        for pkg in self.SYSTEM_PACKAGES:
            if resource_id.startswith(pkg):
                return True
        return False

    def create_test_run(
        self,
        build_id: str,
        test_case_ids: List[str],
        device_id: str
    ) -> str:
        """
        Create a test run record without executing (for async execution).

        Args:
            build_id: Build to test
            test_case_ids: Test cases to run
            device_id: Device to use

        Returns:
            str: run_id

        Raises:
            ValueError: If build, device, or test cases not found
        """
        # Validate inputs
        build = self.build_repository.get(build_id)
        if not build:
            raise ValueError(f"Build not found: {build_id}")

        device_info = self.device_manager.get_device_info(device_id)
        if not device_info:
            raise ValueError(f"Device not found: {device_id}")

        # Validate test cases exist
        for tc_id in test_case_ids:
            tc = self.test_case_repository.get(tc_id)
            if not tc:
                raise ValueError(f"Test case not found: {tc_id}")

        # Create test run with RUNNING status
        run_id = str(uuid.uuid4())
        test_run = TestRunEntity(
            run_id=run_id,
            build_id=build_id,
            test_case_ids=test_case_ids,
            device_info=device_info,
            status=TestRunStatus.RUNNING,
            started_at=datetime.now(),
            results=[]
        )
        self.test_run_repository.save(test_run)

        return run_id

    def execute_test_run_async(
        self,
        run_id: str
    ) -> None:
        """
        Execute a pre-created test run (called from background task).

        Args:
            run_id: Existing test run ID to execute
        """
        test_run = self.test_run_repository.get(run_id)
        if not test_run:
            print(f"Error: Test run not found: {run_id}")
            return

        build = self.build_repository.get(test_run.build_id)
        if not build:
            test_run.status = TestRunStatus.FAILED
            test_run.completed_at = datetime.now()
            self.test_run_repository.save(test_run)
            return

        test_cases = []
        for tc_id in test_run.test_case_ids:
            tc = self.test_case_repository.get(tc_id)
            if tc:
                test_cases.append(tc)

        # Execute tests
        driver = None
        results = []
        consecutive_errors = 0
        max_consecutive_errors = 3  # Stop if 3 tests fail in a row due to driver issues

        try:
            # Connect Appium
            apk_path = build.file_path
            driver = self.appium_service.connect(test_run.device_info.device_id, apk_path)

            # Wait for app to become ready with smart polling (Phase 1 fix)
            print("  Waiting for app to launch...")
            app_ready = self._wait_for_app_ready(driver)
            if not app_ready:
                print("  ⚠️ App may not be fully ready, continuing with fallback delay...")
                time.sleep(self.app_launch_delay)
                self._dismiss_permission_dialogs(driver)

            # Log initial screen state for debugging (Phase 2)
            self._log_screen_state(driver, "INITIAL")

            # Run each test case with robust error handling
            for idx, test_case in enumerate(test_cases):
                print(f"\n📋 Executing test {idx + 1} of {len(test_cases)}: {test_case.title}")

                try:
                    result = self.execute_single_test(test_case, driver, test_run.build_id, run_id)
                    results.append(result)

                    # Reset consecutive error counter on successful execution
                    if result.status == TestStatus.PASS:
                        consecutive_errors = 0
                    else:
                        # Check if it's a driver/connection error
                        if result.step_results and any("driver" in str(sr.error_message).lower() or "session" in str(sr.error_message).lower() for sr in result.step_results if sr.error_message):
                            consecutive_errors += 1
                        else:
                            consecutive_errors = 0  # Test logic failure, not driver issue

                except Exception as e:
                    error_msg = str(e)
                    print(f"  ✗ Test execution error: {error_msg}")

                    # Create a failed result for this test
                    result = TestResult(
                        test_case_id=test_case.tc_id,
                        status=TestStatus.FAIL,
                        duration_ms=0,
                        error_message=error_msg,
                        stack_trace=None,
                        screenshot_paths=[],
                        log_output="",
                        step_results=[]
                    )
                    results.append(result)
                    consecutive_errors += 1

                    # Check for driver/session issues
                    if "session" in error_msg.lower() or "driver" in error_msg.lower():
                        print("  ⚠️ Driver session issue detected, attempting recovery...")
                        try:
                            self.appium_service.disconnect()
                            time.sleep(1)
                            driver = self.appium_service.connect(test_run.device_info.device_id, apk_path)
                            # Use smart wait for recovery
                            if not self._wait_for_app_ready(driver, timeout=10):
                                time.sleep(self.app_launch_delay)
                            self._dismiss_permission_dialogs(driver)
                            consecutive_errors = 0  # Reset on successful recovery
                            print("  ✓ Driver session recovered")
                        except Exception as recovery_error:
                            print(f"  ✗ Recovery failed: {recovery_error}")

                # Update test run after each test (for real-time progress)
                test_run.results = results.copy()
                self.test_run_repository.save(test_run)
                print(f"  ✅ Test {idx + 1} completed with status: {result.status}")

                # Check if we should stop due to repeated driver failures
                if consecutive_errors >= max_consecutive_errors:
                    print(f"\n⚠️ Stopping: {consecutive_errors} consecutive driver errors")
                    break

                # OPTIMIZED: Only reset app if test failed AND it's not the last test
                # Skip reset if previous test passed (assume app is in good state)
                if idx < len(test_cases) - 1 and result.status == TestStatus.FAIL:
                    try:
                        print("  Resetting app state...")
                        # Use clear_app_data instead of uninstall/reinstall (much faster)
                        self.device_manager.clear_app_data(test_run.device_info.device_id, build.app_package)
                        # Relaunch app
                        self.device_manager.launch_app(test_run.device_info.device_id, build.app_package)
                        # Use smart wait for app ready after reset
                        if not self._wait_for_app_ready(driver, timeout=10):
                            time.sleep(self.app_launch_delay)
                        self._dismiss_permission_dialogs(driver)
                    except Exception as e:
                        print(f"  Warning: App reset issue: {e}")
                        pass  # Continue even if reset fails

            # Final update - mark as completed
            test_run.results = results
            test_run.status = TestRunStatus.COMPLETED
            test_run.completed_at = datetime.now()
            test_run.duration_seconds = (test_run.completed_at - test_run.started_at).total_seconds()
            self.test_run_repository.save(test_run)
            print(f"\n🎉 Test run completed: {len(results)} tests executed")

        except Exception as e:
            # Mark as failed but preserve any results we have
            test_run.results = results
            test_run.status = TestRunStatus.FAILED
            test_run.completed_at = datetime.now()
            test_run.duration_seconds = (test_run.completed_at - test_run.started_at).total_seconds()
            self.test_run_repository.save(test_run)
            print(f"Test run failed: {str(e)}")
        finally:
            try:
                if driver:
                    self.appium_service.disconnect()
            except:
                pass

    def execute_test_run(
        self,
        build_id: str,
        test_case_ids: List[str],
        device_id: str
    ) -> str:
        """
        Execute test run (synchronous - kept for backward compatibility).

        Args:
            build_id: Build to test
            test_case_ids: Test cases to run
            device_id: Device to use

        Returns:
            str: run_id

        Raises:
            ValueError: If build, device, or test cases not found
        """
        # Validate inputs
        build = self.build_repository.get(build_id)
        if not build:
            raise ValueError(f"Build not found: {build_id}")

        device_info = self.device_manager.get_device_info(device_id)
        if not device_info:
            raise ValueError(f"Device not found: {device_id}")

        test_cases = []
        for tc_id in test_case_ids:
            tc = self.test_case_repository.get(tc_id)
            if not tc:
                raise ValueError(f"Test case not found: {tc_id}")
            test_cases.append(tc)

        # Create test run
        run_id = str(uuid.uuid4())
        test_run = TestRunEntity(
            run_id=run_id,
            build_id=build_id,
            test_case_ids=test_case_ids,
            device_info=device_info,
            status=TestRunStatus.RUNNING,
            started_at=datetime.now(),
            results=[]
        )
        self.test_run_repository.save(test_run)

        # Execute tests
        driver = None
        results = []
        try:
            # Connect Appium
            apk_path = build.file_path
            driver = self.appium_service.connect(device_id, apk_path)

            # Wait for app to become ready with smart polling (Phase 1 fix)
            print("  Waiting for app to launch...")
            app_ready = self._wait_for_app_ready(driver)
            if not app_ready:
                print("  ⚠️ App may not be fully ready, continuing with fallback delay...")
                time.sleep(self.app_launch_delay)
                self._dismiss_permission_dialogs(driver)

            # Log initial screen state for debugging (Phase 2)
            self._log_screen_state(driver, "INITIAL")

            # Run each test case
            for idx, test_case in enumerate(test_cases):
                print(f"\n📋 Executing test {idx + 1} of {len(test_cases)}: {test_case.title}")

                try:
                    result = self.execute_single_test(test_case, driver, build_id, run_id)
                except Exception as e:
                    result = TestResult(
                        test_case_id=test_case.tc_id,
                        status=TestStatus.FAIL,
                        duration_ms=0,
                        error_message=str(e),
                        stack_trace=None,
                        screenshot_paths=[],
                        log_output="",
                        step_results=[]
                    )
                results.append(result)

                # Update test run after each test (for real-time progress)
                test_run.results = results.copy()
                self.test_run_repository.save(test_run)
                print(f"  ✅ Test {idx + 1} completed with status: {result.status}")

                # OPTIMIZED: Only reset app if test failed AND not the last test
                if idx < len(test_cases) - 1 and result.status == TestStatus.FAIL:
                    try:
                        self.device_manager.clear_app_data(device_id, build.app_package)
                        self.device_manager.launch_app(device_id, build.app_package)
                        # Use smart wait for app ready after reset
                        if not self._wait_for_app_ready(driver, timeout=10):
                            time.sleep(self.app_launch_delay)
                        self._dismiss_permission_dialogs(driver)
                    except Exception as e:
                        print(f"  Warning: App reset issue: {e}")

            # Final update - mark as completed
            test_run.results = results
            test_run.status = TestRunStatus.COMPLETED
            test_run.completed_at = datetime.now()
            test_run.duration_seconds = (test_run.completed_at - test_run.started_at).total_seconds()
            self.test_run_repository.save(test_run)
            print(f"\n🎉 Test run completed: {len(results)} tests executed")

        except Exception as e:
            # Mark as failed but preserve results
            test_run.results = results
            test_run.status = TestRunStatus.FAILED
            test_run.completed_at = datetime.now()
            test_run.duration_seconds = (test_run.completed_at - test_run.started_at).total_seconds()
            self.test_run_repository.save(test_run)
            raise ValueError(f"Test run failed: {str(e)}")
        finally:
            try:
                if driver:
                    self.appium_service.disconnect()
            except:
                pass

        return run_id

    def execute_single_test(
        self,
        test_case: TestCaseEntity,
        driver,
        build_id: str,
        run_id: str
    ) -> TestResult:
        """Execute a single test case with intelligent navigation and element discovery."""
        test_start = time.time()
        step_results = []
        overall_status = TestStatus.PASS
        error_message = None
        screenshot_paths = []

        screenshot_dir = self.test_run_repository.get_screenshot_dir(run_id)
        screenshot_dir.mkdir(parents=True, exist_ok=True)

        from appium.webdriver.common.appiumby import AppiumBy

        # PHASE 1: Analyze test case context
        print(f"\n🔍 Test case: {test_case.title}")

        # PHASE 2: Initialize element discovery for current screen
        element_discovery = DynamicElementDiscovery(driver)

        # Phase 3: Handle preconditions - try to get to required screen
        if test_case.preconditions:
            for precondition in test_case.preconditions:
                precond_lower = precondition.lower()
                # Extract target screen from precondition
                if "login screen" in precond_lower:
                    self._ensure_app_on_screen(driver, "Login", "", "")
                elif "otp screen" in precond_lower:
                    self._ensure_app_on_screen(driver, "OTP", "", "")
                elif "home" in precond_lower:
                    self._ensure_app_on_screen(driver, "Home", "", "")
                print(f"  📋 Precondition: {precondition}")

        # Wait for screen to settle after any navigation
        time.sleep(self.screen_settle_delay)
        self._dismiss_permission_dialogs(driver)

        # Execute each step with validation after each
        for idx, step in enumerate(test_case.steps, 1):
            step_start = time.time()
            step_status = StepStatus.PASS
            step_error = None
            step_screenshot = None
            command = ""

            try:
                # Re-inspect elements on current screen
                discovered_elements = element_discovery.inspect_current_screen()
                print(f"  Step {idx}: {step.description}")
                print(f"    Found {len(discovered_elements)} elements on screen")

                # Determine action from step description
                action, text_to_input = self._determine_action(step.description)

                # SPECIAL HANDLING: Verification steps should just check text presence
                if action == "is_displayed":
                    # For verification, search page source for the text
                    verification_passed = self._verify_text_on_screen(step.description, driver, discovered_elements)
                    if verification_passed:
                        print(f"    ✓ Verification passed")
                        command = f"# Verified: {step.description[:50]}..."
                    else:
                        raise ValueError(f"Verification failed: expected content not found on screen")
                else:
                    # Find element using multiple strategies
                    command = None
                    element_info = None
                    step_keywords = element_discovery.extract_step_keywords(step.description)

                    if step.locator_override:
                        command = step.locator_override
                        print(f"    Using manual locator override")
                    else:
                        # Strategy 1: Direct keyword match on discovered elements
                        for keyword in step_keywords:
                            element_info = element_discovery.find_element_by_keyword(keyword, discovered_elements)
                            if element_info:
                                print(f"    ✓ Found element for keyword '{keyword}': {element_info.get('element_id')}")
                                command = element_discovery.generate_appium_command_from_element(element_info, action, text_to_input)
                                break

                        # Strategy 2: Fuzzy match if direct match failed
                        if not element_info and discovered_elements:
                            element_info = element_discovery.find_element_by_fuzzy_match(step_keywords, discovered_elements)
                            if element_info:
                                print(f"    ✓ Fuzzy match found: {element_info.get('element_id')}")
                                command = element_discovery.generate_appium_command_from_element(element_info, action, text_to_input)

                        # Strategy 3: Search by text content (including Hindi text)
                        if not element_info and discovered_elements:
                            element_info = element_discovery.find_element_by_text_fallback(step_keywords, discovered_elements)
                            if element_info:
                                print(f"    ✓ Text fallback found: {element_info.get('element_id')}")
                                command = element_discovery.generate_appium_command_from_element(element_info, action, text_to_input)

                        # Strategy 4: Search by exact text from step description (for Hindi buttons)
                        if not element_info:
                            element_info = self._find_element_by_exact_text(step.description, driver)
                            if element_info:
                                print(f"    ✓ Exact text found: {element_info}")
                                command = f"driver.find_element(AppiumBy.XPATH, \"{element_info}\").click()"

                        # Strategy 5: Search all screen elements for step content
                        if not element_info:
                            element_info = self._find_element_for_step(step.description, discovered_elements, driver)
                            if element_info:
                                print(f"    ✓ Screen search found: {element_info.get('element_id')}")
                                command = element_discovery.generate_appium_command_from_element(element_info, action, text_to_input)

                        # Strategy 6: Direct tap by visible text
                        if not element_info:
                            element_info = self._try_direct_tap(step.description, driver)
                            if element_info:
                                print(f"    ✓ Direct tap found: {element_info}")
                                command = f"driver.find_element(AppiumBy.XPATH, \"{element_info}\").click()"

                    if not command:
                        # Phase 2: Enhanced error message with screen state
                        screen_info = self._log_screen_state(driver, "STEP_FAIL")
                        visible_text = screen_info.get("visible_text", [])
                        element_count = screen_info.get("clickable_elements", 0)
                        error_detail = f"Could not find element for step: {step.description}"
                        error_detail += f"\n    Screen has {element_count} clickable elements."
                        if visible_text:
                            error_detail += f"\n    Visible text on screen: {visible_text[:3]}"
                        else:
                            error_detail += "\n    No visible text found - screen may be blank or loading."
                        raise ValueError(error_detail)

                    print(f"    Command: {command[:100]}...")

                    # Execute command directly using driver
                    self._execute_command(driver, command)

                # Brief pause after action to let UI settle
                time.sleep(self.post_action_delay)
                print(f"    ✓ Step executed successfully")

            except Exception as e:
                step_status = StepStatus.ERROR
                step_error = str(e)
                overall_status = TestStatus.FAIL

                # Capture screenshot on failure
                try:
                    step_screenshot = str(screenshot_dir / f"step_{idx}_error.png")
                    self.appium_service.take_screenshot(step_screenshot)
                    screenshot_paths.append(step_screenshot)
                except:
                    pass
                print(f"    ✗ Error: {step_error}")

            step_duration = int((time.time() - step_start) * 1000)

            step_result = StepResult(
                step_number=idx,
                status=step_status,
                duration_ms=step_duration,
                screenshot_path=step_screenshot,
                error_message=step_error,
                appium_command=command if command else "No command generated"
            )
            step_results.append(step_result)

            # Break if step failed
            if step_status == StepStatus.ERROR:
                break

        test_duration = int((time.time() - test_start) * 1000)

        return TestResult(
            test_case_id=test_case.tc_id,
            status=overall_status,
            duration_ms=test_duration,
            error_message=error_message,
            stack_trace=None,
            screenshot_paths=screenshot_paths,
            log_output="",
            step_results=step_results
        )

    def _verify_text_on_screen(self, step_description: str, driver, discovered_elements: dict) -> bool:
        """
        Verify that expected text/content is present on screen.
        Used for verification steps like "Verify the country code is +91".
        """
        import re

        # Extract text patterns to verify from step description
        # Look for text in quotes, numbers, or specific patterns
        patterns_to_find = []

        # Extract quoted text
        quoted = re.findall(r'["\']([^"\']+)["\']', step_description)
        patterns_to_find.extend(quoted)

        # Extract numbers with symbols (like +91, ₹99)
        numbers = re.findall(r'[+₹$]?\d+', step_description)
        patterns_to_find.extend(numbers)

        # Extract key verification terms
        verify_keywords = ['country code', 'price', 'title', 'button', 'text']
        step_lower = step_description.lower()
        for kw in verify_keywords:
            if kw in step_lower:
                # Extract the value after keyword
                idx = step_lower.find(kw)
                remaining = step_description[idx + len(kw):].strip()
                # Get next word or quoted value
                words = remaining.split()[:3]
                patterns_to_find.extend([w.strip("'\".,") for w in words if w and len(w) > 1])

        if not patterns_to_find:
            # If no specific patterns, try to find key nouns from the step
            words = re.findall(r'\b[A-Za-z0-9+₹]+\b', step_description)
            stop_words = {'verify', 'check', 'see', 'should', 'the', 'is', 'are', 'a', 'an', 'that', 'default', 'ensure'}
            patterns_to_find = [w for w in words if w.lower() not in stop_words and len(w) > 1][:3]

        # Get page source for text search
        try:
            page_source = driver.page_source
        except:
            page_source = ""

        # Also search in discovered elements
        all_text = page_source.lower()
        for elem_info in discovered_elements.values():
            all_text += " " + (elem_info.get("text", "") or "").lower()
            all_text += " " + (elem_info.get("content_desc", "") or "").lower()

        # Check if any pattern is found
        for pattern in patterns_to_find:
            if pattern.lower() in all_text:
                print(f"    ✓ Found '{pattern}' on screen")
                return True

        print(f"    ✗ Could not find any of: {patterns_to_find}")
        return False

    def _find_element_by_exact_text(self, step_description: str, driver) -> Optional[str]:
        """
        Find element by exact text match, including Hindi/Unicode text.
        Extracts quoted text from step description and searches for it.
        """
        import re
        from appium.webdriver.common.appiumby import AppiumBy

        # Extract text in quotes (for Hindi buttons like 'लॉगिन करें')
        quoted_texts = re.findall(r'["\']([^"\']+)["\']', step_description)

        for text in quoted_texts:
            try:
                # Try exact text match
                xpath = f"//*[@text='{text}']"
                elements = driver.find_elements(AppiumBy.XPATH, xpath)
                if elements:
                    return xpath

                # Try contains for partial match
                xpath = f"//*[contains(@text, '{text}')]"
                elements = driver.find_elements(AppiumBy.XPATH, xpath)
                if elements:
                    return xpath
            except:
                continue

        return None

    def _determine_action(self, step_description: str) -> tuple:
        """Determine action and text input from step description."""
        step_lower = step_description.lower()
        
        if any(word in step_lower for word in ["type", "enter", "input", "fill", "write"]):
            # Extract text in quotes or after "with/in"
            import re
            text_match = re.search(r'["\']([^"\']+)["\']', step_description)
            if text_match:
                return "send_keys", text_match.group(1)
            words = step_lower.split()
            for i, w in enumerate(words):
                if w in ["with", "in", "text", "value"]:
                    if i + 1 < len(words):
                        return "send_keys", "test_input"
            return "send_keys", "test_input"
        elif any(word in step_lower for word in ["verify", "check", "see", "should", "ensure", "confirm"]):
            return "is_displayed", None
        elif any(word in step_lower for word in ["scroll", "swipe"]):
            return "scroll", None
        else:
            return "click", None

    def _find_element_for_step(self, step_description: str, discovered_elements: dict, driver) -> Optional[Dict]:
        """Search screen elements for content mentioned in step."""
        step_lower = step_description.lower()
        
        # Extract meaningful nouns/verbs from step
        import re
        words = re.findall(r'\b[a-zA-Z]{3,}\b', step_lower)
        
        # Filter common words
        stop_words = {"the", "and", "for", "from", "this", "that", "with", "have", "has", "will", "can", "should", "click", "tap", "enter", "input", "type", "select", "verify", "check", "user", "app", "button", "screen", "page", "field", "menu", "list"}
        keywords = [w for w in words if w not in stop_words and len(w) > 2]
        
        # Search in all elements
        for elem_id, elem_info in discovered_elements.items():
            elem_text = elem_info.get("text", "").lower()
            elem_desc = elem_info.get("content_desc", "").lower()
            elem_resource = elem_info.get("resource_id", "").lower()
            
            for keyword in keywords:
                if (keyword in elem_text or keyword in elem_desc or 
                    keyword in elem_resource or elem_text and keyword in elem_text):
                    return {"element_id": elem_id, **elem_info}
        
        return None

    def _try_direct_tap(self, step_description: str, driver) -> Optional[str]:
        """Try to directly tap element by text/content description."""
        from appium.webdriver.common.appiumby import AppiumBy
        
        step_lower = step_description.lower()
        
        # Extract key action words
        import re
        words = re.findall(r'\b[a-zA-Z]{3,}\b', step_lower)
        stop_words = {"the", "and", "for", "from", "this", "that", "click", "tap", "on", "button"}
        keywords = [w for w in words if w not in stop_words]
        
        for keyword in keywords:
            try:
                # Try XPath by text
                elements = driver.find_elements(AppiumBy.XPATH, f"//*[contains(@text, '{keyword.title()}')]")
                if elements:
                    return f"//*[contains(@text, '{keyword.title()}')]"
            except:
                continue
        
        return None

    def _validate_step_result(self, step, driver, discovered_elements: dict, action: str) -> bool:
        """Validate that step produced expected result."""
        step_lower = step.description.lower()
        
        # For click actions, check if something changed on screen
        if action == "click":
            # Wait briefly for UI to update
            time.sleep(0.5)
            # Re-inspect to see if new elements appeared or old ones disappeared
            new_elements = DynamicElementDiscovery(driver).inspect_current_screen()
            
            # Check if we navigated to a new screen (elements changed significantly)
            if len(new_elements) != len(discovered_elements):
                print(f"    ✓ Screen changed after click (validation passed)")
                return True
            
            # Check for confirmation messages
            confirm_words = ["success", "done", "saved", "confirmed", "ok", "thanks", "welcome"]
            for elem_id, elem_info in new_elements.items():
                elem_text = (elem_info.get("text", "") + elem_info.get("content_desc", "")).lower()
                if any(word in elem_text for word in confirm_words):
                    print(f"    ✓ Confirmation element found")
                    return True
            
            return True  # Assume click worked if no exception
        
        # For text input, verify field has content
        elif action == "send_keys":
            # Check that we're still on same screen
            return True
        
        # For verify actions, check element is present
        elif action == "is_displayed":
            # Already validated by exception not being raised
            return True
        
        return True

    def _execute_command(self, driver, command: str) -> None:
        """Execute Appium command directly without using exec()."""
        from appium.webdriver.common.appiumby import AppiumBy
        
        # Parse the command string to extract locator type and value
        import re

        # Pattern: driver.find_element(AppiumBy.XPATH, "...").click()
        # Updated to handle both "ACCESSIBILITY_ID" and "ACCESSIBILITY ID" (with space)
        pattern = r'driver\.find_element\(AppiumBy\.([A-Z_]+(?:\s+[A-Z]+)?),\s*["\']([^"\']+)["\']\)'
        match = re.search(pattern, command)

        if match:
            locator_type = match.group(1).upper().replace(' ', '_')  # Normalize spaces to underscores
            locator_value = match.group(2)

            # Map locator type to AppiumBy
            locator_map = {
                'ID': AppiumBy.ID,
                'ACCESSIBILITY_ID': AppiumBy.ACCESSIBILITY_ID,
                'XPATH': AppiumBy.XPATH,
                'CLASS_NAME': AppiumBy.CLASS_NAME,
                'TEXT': AppiumBy.NAME
            }

            locator = locator_map.get(locator_type, AppiumBy.ID)
            
            # Find element
            element = driver.find_element(locator, locator_value)
            
            # Determine action
            if '.click()' in command:
                element.click()
            elif '.send_keys(' in command:
                # Extract text to send
                text_match = re.search(r'\.send_keys\(["\']([^"\']*)["\']\)', command)
                text = text_match.group(1) if text_match else "test"
                element.send_keys(text)
            elif '.is_displayed()' in command:
                if not element.is_displayed():
                    raise AssertionError("Element not visible")
            elif '.get_text()' in command:
                return element.get_text()
            else:
                # Try generic action
                element.click()
        else:
            raise ValueError(f"Could not parse command: {command}")

    def capture_screenshot(self, driver, step_num: int, run_id: str) -> str:
        """Capture and save screenshot."""
        screenshot_dir = self.test_run_repository.get_screenshot_dir(run_id)
        screenshot_dir.mkdir(parents=True, exist_ok=True)
        screenshot_path = str(screenshot_dir / f"step_{step_num}.png")
        self.appium_service.take_screenshot(screenshot_path)
        return screenshot_path

    def _start_app_directly(self, driver, target_screen: str) -> bool:
        """Start the app directly using adb activity launch."""
        try:
            import subprocess
            
            package = driver.capabilities.get('appPackage', '')
            if not package:
                return False
            
            # Try to find the main activity
            result = subprocess.run(
                ['adb', 'shell', 'cmd', 'package', 'resolve-activity', '--brief', package],
                capture_output=True,
                text=True
            )
            
            main_activity = result.stdout.strip()
            print(f"  Main activity: {main_activity}")
            
            if main_activity:
                # Try to start the activity directly
                subprocess.run(
                    ['adb', 'shell', 'am', 'start', '-n', f"{package}/{main_activity}"],
                    capture_output=True
                )
                time.sleep(2)
                return True
                
        except Exception as e:
            print(f"  Failed to start app directly: {e}")
        
        return False
