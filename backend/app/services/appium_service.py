"""
AppiumService: Manages Appium WebDriver connections and sessions.
"""

from typing import Optional
from appium import webdriver
from appium.options.android import UiAutomator2Options


class AppiumService:
    """Service for managing Appium WebDriver lifecycle."""

    def __init__(self, appium_url: str = "http://localhost:4723"):
        """
        Initialize Appium service.

        Args:
            appium_url: Appium server URL
        """
        self.appium_url = appium_url
        self.driver: Optional[webdriver.Remote] = None

    def connect(self, device_id: str, app_path: str) -> webdriver.Remote:
        """
        Create Appium WebDriver session.

        Args:
            device_id: ADB device ID (e.g., 'emulator-5554' or device serial)
            app_path: Path to APK file

        Returns:
            webdriver.Remote: Appium driver instance
        """
        options = UiAutomator2Options()
        options.platform_name = "Android"
        options.device_name = device_id
        options.udid = device_id
        options.app = app_path
        
        # Check if running on emulator
        is_emulator = "emulator" in device_id.lower()
        
        if is_emulator:
            # Emulator settings - don't reset to avoid reinstalling
            options.no_reset = True
            options.full_reset = False
            # Skip some initialization for faster emulator
            options.set_capability("skipServerInstallation", True)
            options.set_capability("skipDeviceInitialization", True)
        else:
            # Real device settings - changed from full_reset to avoid slow reinstall
            # App reset is handled by test_executor between failed tests
            options.no_reset = True
            options.full_reset = False
            options.set_capability("skipServerInstallation", True)
            options.set_capability("skipDeviceInitialization", True)

        options.new_command_timeout = 300  # 5 minutes
        options.automation_name = "UiAutomator2"

        # Android 13+ compatibility: ignore hidden API policy errors
        options.set_capability("ignoreHiddenApiPolicyError", True)

        # Flutter app specific settings - longer wait for app to launch
        options.set_capability("appWaitForLaunch", True)
        options.set_capability("appWaitDuration", 30000)  # 30 seconds max wait
        options.set_capability("autoLaunch", True)

        # Ensure app is in foreground
        options.set_capability("dontStopAppOnReset", False)
        options.set_capability("forceAppLaunch", True)

        self.driver = webdriver.Remote(
            command_executor=self.appium_url,
            options=options
        )
        return self.driver

    def disconnect(self) -> None:
        """End Appium session and cleanup."""
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            finally:
                self.driver = None

    def create_session(self, capabilities: dict) -> webdriver.Remote:
        """
        Create session with custom capabilities.

        Args:
            capabilities: Appium desired capabilities

        Returns:
            webdriver.Remote: Driver instance
        """
        self.driver = webdriver.Remote(
            command_executor=self.appium_url,
            desired_capabilities=capabilities
        )
        return self.driver

    def end_session(self) -> None:
        """Alias for disconnect()."""
        self.disconnect()

    def get_driver(self) -> Optional[webdriver.Remote]:
        """
        Get current driver instance.

        Returns:
            Optional[webdriver.Remote]: Active driver or None
        """
        return self.driver

    def is_connected(self) -> bool:
        """
        Check if driver is connected.

        Returns:
            bool: True if connected
        """
        return self.driver is not None

    def take_screenshot(self, file_path: str) -> bool:
        """
        Capture screenshot.

        Args:
            file_path: Path to save screenshot

        Returns:
            bool: True if successful
        """
        if not self.driver:
            return False

        try:
            self.driver.save_screenshot(file_path)
            return True
        except Exception:
            return False

    def get_page_source(self) -> Optional[str]:
        """
        Get current page XML source.

        Returns:
            Optional[str]: Page source XML or None
        """
        if not self.driver:
            return None

        try:
            return self.driver.page_source
        except Exception:
            return None
