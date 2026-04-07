"""
DeviceManager: Manages Android devices via ADB.
"""

import subprocess
import re
from typing import List, Optional

from app.models import DeviceInfo


class DeviceManager:
    """Service for detecting and managing Android devices via ADB."""

    def __init__(self):
        """Initialize device manager."""
        self.adb_path = "adb"  # Assumes adb is in PATH

    def list_devices(self) -> List[DeviceInfo]:
        """
        List all connected devices.

        Returns:
            List[DeviceInfo]: All available devices
        """
        try:
            result = subprocess.run(
                [self.adb_path, "devices", "-l"],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode != 0:
                return []

            devices = []
            lines = result.stdout.strip().split('\n')[1:]  # Skip header

            for line in lines:
                if not line.strip() or "offline" in line:
                    continue

                parts = line.split()
                if len(parts) >= 2 and parts[1] == "device":
                    device_id = parts[0]
                    device_info = self.get_device_info(device_id)
                    if device_info:
                        devices.append(device_info)

            return devices

        except Exception:
            return []

    def get_device_info(self, device_id: str) -> Optional[DeviceInfo]:
        """
        Get detailed device information.

        Args:
            device_id: ADB device ID

        Returns:
            Optional[DeviceInfo]: Device info if available
        """
        try:
            # Get device model
            model_result = subprocess.run(
                [self.adb_path, "-s", device_id, "shell", "getprop", "ro.product.model"],
                capture_output=True,
                text=True,
                timeout=5
            )
            device_name = model_result.stdout.strip() or "Unknown Device"

            # Get Android version
            version_result = subprocess.run(
                [self.adb_path, "-s", device_id, "shell", "getprop", "ro.build.version.release"],
                capture_output=True,
                text=True,
                timeout=5
            )
            os_version = version_result.stdout.strip() or "Unknown"

            # Check if emulator
            is_emulator = self.is_emulator(device_id)

            return DeviceInfo(
                device_id=device_id,
                device_name=device_name,
                os_version=os_version,
                is_emulator=is_emulator
            )

        except Exception:
            return None

    def is_emulator(self, device_id: str) -> bool:
        """
        Check if device is an emulator.

        Args:
            device_id: ADB device ID

        Returns:
            bool: True if emulator
        """
        try:
            # Emulators typically have "emulator" in device ID
            if "emulator" in device_id.lower():
                return True

            # Check device characteristics
            result = subprocess.run(
                [self.adb_path, "-s", device_id, "shell", "getprop", "ro.product.characteristics"],
                capture_output=True,
                text=True,
                timeout=5
            )

            return "emulator" in result.stdout.lower()

        except Exception:
            return False

    def install_apk(self, device_id: str, apk_path: str) -> bool:
        """
        Install APK on device.

        Args:
            device_id: ADB device ID
            apk_path: Path to APK file

        Returns:
            bool: True if installed successfully
        """
        try:
            result = subprocess.run(
                [self.adb_path, "-s", device_id, "install", "-r", apk_path],
                capture_output=True,
                text=True,
                timeout=60
            )

            return result.returncode == 0 and "Success" in result.stdout

        except Exception:
            return False

    def uninstall_app(self, device_id: str, package_name: str) -> bool:
        """
        Uninstall app from device.

        Args:
            device_id: ADB device ID
            package_name: Android package name

        Returns:
            bool: True if uninstalled successfully
        """
        try:
            result = subprocess.run(
                [self.adb_path, "-s", device_id, "uninstall", package_name],
                capture_output=True,
                text=True,
                timeout=30
            )

            return result.returncode == 0

        except Exception:
            return False

    def clear_app_data(self, device_id: str, package_name: str) -> bool:
        """
        Clear app data.

        Args:
            device_id: ADB device ID
            package_name: Android package name

        Returns:
            bool: True if cleared successfully
        """
        try:
            result = subprocess.run(
                [self.adb_path, "-s", device_id, "shell", "pm", "clear", package_name],
                capture_output=True,
                text=True,
                timeout=10
            )

            return "Success" in result.stdout

        except Exception:
            return False

    def launch_app(self, device_id: str, package_name: str) -> bool:
        """
        Launch app on device.

        Args:
            device_id: ADB device ID
            package_name: Android package name

        Returns:
            bool: True if launched successfully
        """
        try:
            # Get the main activity using pm dump
            result = subprocess.run(
                [self.adb_path, "-s", device_id, "shell", "cmd", "package", "resolve-activity",
                 "--brief", package_name],
                capture_output=True,
                text=True,
                timeout=10
            )

            activity = None
            if result.returncode == 0 and result.stdout.strip():
                # Parse output like "com.example.app/.MainActivity"
                lines = result.stdout.strip().split('\n')
                for line in lines:
                    if '/' in line:
                        activity = line.strip()
                        break

            if not activity:
                # Fallback: try common launcher activity patterns
                activity = f"{package_name}/.MainActivity"

            # Launch the app
            launch_result = subprocess.run(
                [self.adb_path, "-s", device_id, "shell", "am", "start", "-n", activity],
                capture_output=True,
                text=True,
                timeout=10
            )

            return launch_result.returncode == 0

        except Exception as e:
            print(f"Error launching app: {e}")
            return False

    def is_device_available(self, device_id: str) -> bool:
        """
        Check if device is available.

        Args:
            device_id: ADB device ID

        Returns:
            bool: True if device is connected and online
        """
        devices = self.list_devices()
        return any(d.device_id == device_id for d in devices)

    def capture_screenshot(self, device_id: str) -> Optional[bytes]:
        """
        Capture screenshot from device.

        Args:
            device_id: ADB device ID

        Returns:
            Optional[bytes]: PNG image data or None if failed
        """
        try:
            # Use adb exec-out for direct binary output (faster than screencap + pull)
            result = subprocess.run(
                [self.adb_path, "-s", device_id, "exec-out", "screencap", "-p"],
                capture_output=True,
                timeout=10
            )

            if result.returncode == 0 and result.stdout:
                return result.stdout

            return None

        except Exception:
            return None

    def get_screen_size(self, device_id: str) -> Optional[tuple]:
        """
        Get device screen size.

        Args:
            device_id: ADB device ID

        Returns:
            Optional[tuple]: (width, height) or None if failed
        """
        try:
            result = subprocess.run(
                [self.adb_path, "-s", device_id, "shell", "wm", "size"],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                # Output format: "Physical size: 1080x1920"
                match = re.search(r'(\d+)x(\d+)', result.stdout)
                if match:
                    return (int(match.group(1)), int(match.group(2)))

            return None

        except Exception:
            return None
