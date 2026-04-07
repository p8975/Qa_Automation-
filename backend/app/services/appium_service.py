"""
AppiumService: Manages Appium WebDriver connections and sessions.
Supports both UiAutomator2 (native) and Flutter driver modes.
"""

from typing import Optional, List
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
        self.use_flutter_driver: bool = False
        self.current_context: str = "NATIVE_APP"

    def connect(self, device_id: str, app_path: str, use_flutter: bool = False) -> webdriver.Remote:
        """
        Create Appium WebDriver session.

        Args:
            device_id: ADB device ID (e.g., 'emulator-5554' or device serial)
            app_path: Path to APK file
            use_flutter: If True, use Flutter driver (requires debug build). Default False for release builds.

        Returns:
            webdriver.Remote: Appium driver instance

        Note:
            Flutter driver only works with debug/profile builds that have Dart observatory enabled.
            For release/preprod builds, use UiAutomator2 (use_flutter=False).
        """
        options = UiAutomator2Options()
        options.platform_name = "Android"
        options.device_name = device_id
        options.udid = device_id
        options.app = app_path

        # Stage app package and activity
        options.set_capability("appPackage", "in.stage.dev")
        options.set_capability("appActivity", "in.stage.MainActivity")

        # Check if running on emulator
        is_emulator = "emulator" in device_id.lower()

        if is_emulator:
            # Emulator settings
            options.no_reset = True
            options.full_reset = False
        else:
            # Real device settings
            options.no_reset = True
            options.full_reset = False

        options.new_command_timeout = 300  # 5 minutes

        # Use UiAutomator2 for all builds
        self.use_flutter_driver = False
        options.automation_name = "UiAutomator2"
        self.current_context = "NATIVE_APP"
        print(f"  ℹ️ Connecting to {device_id} with UiAutomator2...")

        # Android 13+ compatibility
        options.set_capability("ignoreHiddenApiPolicyError", True)

        # Ensure app launches
        options.set_capability("appWaitForLaunch", True)
        options.set_capability("appWaitDuration", 30000)
        options.set_capability("autoLaunch", True)
        options.set_capability("forceAppLaunch", True)

        self.driver = webdriver.Remote(
            command_executor=self.appium_url,
            options=options
        )

        # Force app to foreground after connection
        import time
        time.sleep(2)
        try:
            self.driver.activate_app("in.stage.dev")
            print("  ✓ App activated and in foreground")
            time.sleep(3)  # Wait for app to fully load
        except Exception as e:
            print(f"  ⚠️ activate_app warning: {e}")

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

    def get_contexts(self) -> List[str]:
        """
        Get available contexts (NATIVE_APP, FLUTTER).

        Returns:
            List[str]: Available context names
        """
        if not self.driver:
            return []

        try:
            return self.driver.contexts
        except Exception:
            return []

    def switch_context(self, context: str) -> bool:
        """
        Switch between NATIVE_APP and FLUTTER contexts.

        Args:
            context: Target context name ('NATIVE_APP' or 'FLUTTER')

        Returns:
            bool: True if switch successful
        """
        if not self.driver:
            return False

        try:
            self.driver.switch_to.context(context)
            self.current_context = context
            print(f"  ℹ️ Switched to context: {context}")
            return True
        except Exception as e:
            print(f"  ⚠️ Failed to switch context to {context}: {e}")
            return False

    def execute_flutter_command(self, script: str, *args) -> Optional[any]:
        """
        Execute a Flutter-specific command.

        Args:
            script: Flutter script name (e.g., 'flutter:waitFor', 'flutter:tap')
            *args: Arguments for the script

        Returns:
            Result of the script execution or None
        """
        if not self.driver:
            return None

        try:
            return self.driver.execute_script(script, *args)
        except Exception as e:
            print(f"  ⚠️ Flutter command failed: {e}")
            return None

    def get_flutter_render_tree(self) -> Optional[str]:
        """
        Get Flutter render tree for debugging.

        Returns:
            Optional[str]: Render tree or None
        """
        return self.execute_flutter_command('flutter:getRenderTree')

    def is_flutter_driver(self) -> bool:
        """
        Check if using Flutter driver.

        Returns:
            bool: True if Flutter driver is active
        """
        return self.use_flutter_driver
