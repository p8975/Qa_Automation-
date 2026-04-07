"""
APK Parser: Extract metadata from Android APK files.
"""

from typing import Dict, Optional
from apkutils2 import APK


def parse_apk(apk_path: str) -> Dict[str, str]:
    """
    Extract package name, version, and app name from APK.

    Args:
        apk_path: Path to APK file

    Returns:
        dict: Metadata with keys: package, version, app_name

    Raises:
        ValueError: If APK parsing fails
    """
    try:
        apk = APK(apk_path)
        manifest = apk.get_manifest()

        # Extract package name
        package = manifest.get('@package', 'unknown.package')

        # Extract version
        version_code = manifest.get('@android:versionCode', '0')
        version_name = manifest.get('@android:versionName', '1.0')
        version = f"{version_name} ({version_code})"

        # Extract app name (from application label)
        app_name = 'Unknown App'
        application = manifest.get('application', {})
        if isinstance(application, dict):
            label = application.get('@android:label', '')
            if label and not label.startswith('@'):
                app_name = label
            elif label:
                # Try to get from resources
                try:
                    app_name = apk.get_app_name() or 'Unknown App'
                except Exception:
                    app_name = 'Unknown App'

        return {
            'package': package,
            'version': version,
            'app_name': app_name
        }

    except Exception as e:
        raise ValueError(f"Failed to parse APK: {str(e)}")


def get_app_icon(apk_path: str) -> Optional[bytes]:
    """
    Extract app icon from APK.

    Args:
        apk_path: Path to APK file

    Returns:
        Optional[bytes]: Icon image data or None
    """
    try:
        apk = APK(apk_path)
        return apk.get_app_icon()
    except Exception:
        return None
