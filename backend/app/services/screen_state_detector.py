"""
ScreenStateDetector: Detects current screen state for A/B test handling.
"""

from typing import Optional, Dict, List
from app.services.flutter_locator_service import FlutterLocatorService


class ScreenStateDetector:
    """Detects current screen for A/B test handling and navigation."""

    # Screen indicators with keys and text patterns
    SCREEN_INDICATORS: Dict[str, Dict[str, List[str]]] = {
        'login': {
            'keys': ['loginButton', 'phoneInput', 'googleSignInButton'],
            'texts': ['Login', 'लॉगिन करें', '+91', 'Enter your phone', 'Sign in', 'Continue with Google'],
        },
        'otp': {
            'keys': ['otpInput', 'verifyButton', 'resendOtpButton'],
            'texts': ['Enter OTP', 'Verify', 'OTP sent', 'Resend', 'Didn\'t receive'],
        },
        'home': {
            'keys': ['homeScreen', 'bottomNavBar', 'forYouTab', 'bannerKey'],
            'texts': ['For You', 'Home', 'Explore', 'Continue Watching'],
        },
        'player': {
            'keys': ['reelVideoPlayer', 'videoPlayerControls', 'chromeCastButton'],
            'texts': ['Play', 'Pause', 'Episode'],
        },
        'subscription': {
            'keys': ['startTrialButton', 'subscribeButton', 'pricingCard'],
            'texts': ['Subscribe', '₹1 Trial', 'Premium', 'Start Trial', 'Choose Plan'],
        },
        'profile': {
            'keys': ['profileScreen', 'editProfileButton', 'logoutButton'],
            'texts': ['Profile', 'Edit Profile', 'Account', 'Logout'],
        },
        'settings': {
            'keys': ['settings', 'languageSettings', 'notificationSettings'],
            'texts': ['Settings', 'Language', 'Notifications', 'About'],
        },
        'search': {
            'keys': ['searchInput', 'searchResults', 'recentSearches'],
            'texts': ['Search', 'Recent Searches', 'Trending'],
        },
        'downloads': {
            'keys': ['downloads', 'downloadList', 'noDownloads'],
            'texts': ['Downloads', 'Downloaded', 'No Downloads'],
        },
        'permission_dialog': {
            'keys': [],
            'texts': ['Allow', 'Deny', 'Permission', 'While using the app', 'Only this time'],
        },
        'error': {
            'keys': ['errorScreen', 'retryButton'],
            'texts': ['Error', 'Something went wrong', 'Retry', 'Try again'],
        },
        'loading': {
            'keys': ['loadingIndicator'],
            'texts': ['Loading', 'Please wait'],
        },
    }

    def __init__(self, flutter_locator: FlutterLocatorService):
        """
        Initialize screen state detector.

        Args:
            flutter_locator: Flutter locator service instance
        """
        self.locator = flutter_locator
        self._last_detected_screen = None
        self._screen_history: List[str] = []

    def detect_current_screen(self) -> str:
        """
        Detect which screen the app is currently on.

        Returns:
            Screen name or 'unknown' if not detected
        """
        scores: Dict[str, int] = {}

        for screen, indicators in self.SCREEN_INDICATORS.items():
            score = 0

            # Check keys (higher weight)
            for key in indicators['keys']:
                if self._element_exists({'keys': [key]}):
                    score += 3

            # Check text patterns (lower weight)
            for text in indicators['texts']:
                if self._element_exists({'text': text}):
                    score += 1

            scores[screen] = score

        # Find screen with highest score (minimum 2 to be confident)
        best_screen = max(scores, key=scores.get)
        if scores[best_screen] >= 2:
            self._update_history(best_screen)
            return best_screen

        return 'unknown'

    def _element_exists(self, hints: dict, timeout: int = 2) -> bool:
        """Check if element exists on screen."""
        try:
            element = self.locator.find_element(hints, timeout=timeout)
            return element is not None
        except Exception:
            return False

    def _update_history(self, screen: str) -> None:
        """Update screen navigation history."""
        if self._last_detected_screen != screen:
            self._screen_history.append(screen)
            # Keep last 10 screens
            if len(self._screen_history) > 10:
                self._screen_history.pop(0)
            self._last_detected_screen = screen

    def get_screen_history(self) -> List[str]:
        """Get navigation history."""
        return self._screen_history.copy()

    def is_on_screen(self, expected_screen: str) -> bool:
        """
        Check if currently on expected screen.

        Args:
            expected_screen: Screen name to check

        Returns:
            True if on expected screen
        """
        current = self.detect_current_screen()
        return current.lower() == expected_screen.lower()

    def wait_for_screen(self, target_screen: str, timeout: int = 10) -> bool:
        """
        Wait for a specific screen to appear.

        Args:
            target_screen: Target screen name
            timeout: Maximum wait time in seconds

        Returns:
            True if screen appeared within timeout
        """
        import time
        start = time.time()

        while time.time() - start < timeout:
            if self.is_on_screen(target_screen):
                return True
            time.sleep(0.5)

        return False

    def is_permission_dialog_visible(self) -> bool:
        """Check if a system permission dialog is blocking."""
        current = self.detect_current_screen()
        return current == 'permission_dialog'

    def is_error_state(self) -> bool:
        """Check if app is in error state."""
        current = self.detect_current_screen()
        return current == 'error'

    def is_loading(self) -> bool:
        """Check if app is in loading state."""
        current = self.detect_current_screen()
        return current == 'loading'

    def get_expected_next_screens(self, current_screen: str) -> List[str]:
        """
        Get expected possible next screens based on current screen.
        Useful for validating navigation.

        Args:
            current_screen: Current screen name

        Returns:
            List of possible next screens
        """
        navigation_map = {
            'login': ['otp', 'home', 'error'],
            'otp': ['home', 'login', 'error'],
            'home': ['player', 'profile', 'settings', 'search', 'subscription', 'downloads'],
            'player': ['home', 'subscription'],
            'profile': ['settings', 'home', 'login'],
            'settings': ['profile', 'home'],
            'subscription': ['home', 'player'],
            'search': ['home', 'player'],
            'downloads': ['home', 'player'],
        }
        return navigation_map.get(current_screen.lower(), [])

    def detect_ab_variation(self, screen: str) -> Optional[str]:
        """
        Detect A/B test variation for a screen.

        Args:
            screen: Screen to check for variations

        Returns:
            Variation identifier or None
        """
        # Define known A/B test variations
        ab_variations = {
            'login': {
                'variation_a': {'keys': ['loginButton'], 'texts': ['Login']},
                'variation_b': {'keys': ['googleSignInButton'], 'texts': ['Continue with Google']},
            },
            'subscription': {
                'trial_first': {'keys': ['startTrialButton'], 'texts': ['Start Trial', '₹1']},
                'subscribe_first': {'keys': ['subscribeButton'], 'texts': ['Subscribe Now']},
            },
        }

        if screen not in ab_variations:
            return None

        for variation_name, indicators in ab_variations[screen].items():
            score = 0
            for key in indicators.get('keys', []):
                if self._element_exists({'keys': [key]}):
                    score += 1
            for text in indicators.get('texts', []):
                if self._element_exists({'text': text}):
                    score += 1

            if score >= 1:
                print(f"  ℹ️ Detected A/B variation: {variation_name} on {screen}")
                return variation_name

        return None

    def get_screen_elements(self, screen: str) -> Dict[str, List[str]]:
        """
        Get expected elements for a screen.

        Args:
            screen: Screen name

        Returns:
            Dict with keys and texts expected on screen
        """
        return self.SCREEN_INDICATORS.get(screen.lower(), {'keys': [], 'texts': []})
