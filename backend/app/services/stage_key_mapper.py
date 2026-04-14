"""
StageKeyMapper: Maps natural language step descriptions to Stage app Key constants.
Based on /lib/utils/stage_keys.dart and feature-specific key files.
"""

import re
from typing import List, Dict, Optional


class StageKeyMapper:
    """Maps step descriptions to Stage app Key constants from stage_keys.dart."""

    # Core keys extracted from /lib/utils/stage_keys.dart
    KEYS: Dict[str, str] = {
        # Navigation
        'home': 'homeScreen',
        'settings': 'settings',
        'downloads': 'downloads',
        'watchlist': 'watchlist',
        'profile': 'profileScreen',
        'coming soon': 'comingSoon',
        'explore': 'explore',
        'search': 'search',

        # Auth / Login
        'login': 'loginButton',
        'logout': 'logoutButton',
        'otp': 'tvRegistrationScreenOtpTextField',
        'phone': 'phoneInput',
        'mobile': 'phoneInput',
        'google': 'googleSignInButton',
        'sign in': 'loginButton',
        'sign out': 'logoutButton',

        # Subscription / Trial
        'start trial': 'startTrialButton',
        'subscribe': 'subscribeButton',
        'payment': 'paymentSuccessActionButtonKey',
        'cancel trial': 'trialCancelButtonKey',
        'pause trial': 'pauseTrialContinueButtonKey',
        'resume trial': 'resumeTrialButton',
        'trial': 'startTrialButton',
        'premium': 'subscribeButton',

        # Player / Video
        'play': 'reelVideoPlayer',
        'chromecast': 'chromeCastButton',
        'cast': 'chromeCastButton',
        'video': 'reelVideoPlayer',
        'player': 'reelVideoPlayer',
        'micro drama': 'microDramaVideoPlayer',
        'fullscreen': 'fullscreenButton',

        # Content / Cards
        'platter': 'platterCardKeyInitial',
        'card': 'watchlistCardInitial',
        'banner': 'bannerKey',
        'thumbnail': 'thumbnailKey',

        # Bottom Navigation
        'for you': 'forYouTab',
        'bottom nav': 'bottomNavBar',
        'navigation': 'bottomNavBar',

        # Family Sharing (from family_sharing_keys.dart)
        'family': 'familySharingKey',
        'add member': 'addFamilyMemberButton',
        'invite': 'inviteFamilyButton',

        # Consumption (from consumption_keys.dart)
        'portrait settings': 'portraitSettingsButton',
        'landscape settings': 'landscapeSettingsButton',
        'quality': 'qualitySettingsButton',
        'subtitles': 'subtitlesButton',
        'audio': 'audioTrackButton',

        # Generic UI
        'close': 'closeButton',
        'back': 'backButton',
        'next': 'nextButton',
        'continue': 'continueButton',
        'skip': 'skipButton',
        'done': 'doneButton',
        'confirm': 'confirmButton',
        'cancel': 'cancelButton',
        'ok': 'okButton',
        'submit': 'submitButton',
        'retry': 'retryButton',
    }

    # Reverse mapping for generating readable names
    KEY_TO_NAME: Dict[str, str] = {v: k for k, v in KEYS.items()}

    # Pattern-based mappings for dynamic key generation
    PATTERNS: List[tuple] = [
        (r'tap (?:on )?(?:the )?(.+?) button', '{}_button'),
        (r'click (?:on )?(?:the )?(.+?) button', '{}_button'),
        (r'press (?:on )?(?:the )?(.+?) button', '{}_button'),
        (r'enter (?:text )?(?:in )?(?:the )?(.+?) field', '{}_field'),
        (r'type (?:in )?(?:the )?(.+?) input', '{}_input'),
        (r'select (?:the )?(.+?) option', '{}_option'),
        (r'toggle (?:the )?(.+?) switch', '{}_switch'),
    ]

    @classmethod
    def get_keys_for_step(cls, step_description: str) -> List[str]:
        """
        Extract possible keys from step description.

        Args:
            step_description: Natural language test step

        Returns:
            List of possible Flutter Key strings to try
        """
        step_lower = step_description.lower()
        matching_keys = []

        # Strategy 1: Direct keyword match
        for keyword, key in cls.KEYS.items():
            if keyword in step_lower:
                matching_keys.append(key)

        # Strategy 2: Extract quoted text and generate key variants
        quoted = re.findall(r'["\']([^"\']+)["\']', step_description)
        for text in quoted:
            text_key = cls._text_to_key(text)
            matching_keys.append(text_key)
            matching_keys.append(f"{text_key}Button")
            matching_keys.append(f"{text_key}Key")

        # Strategy 3: Pattern-based extraction
        for pattern, key_template in cls.PATTERNS:
            match = re.search(pattern, step_lower)
            if match:
                extracted = match.group(1).strip()
                key_name = cls._text_to_key(extracted)
                matching_keys.append(key_template.format(key_name))

        # Strategy 4: Extract action target words
        target_words = cls._extract_target_words(step_lower)
        for word in target_words:
            if word in cls.KEYS:
                matching_keys.append(cls.KEYS[word])
            else:
                # Generate variants
                matching_keys.append(f"{word}Button")
                matching_keys.append(f"{word}Key")
                matching_keys.append(word)

        # Remove duplicates while preserving order
        seen = set()
        unique_keys = []
        for key in matching_keys:
            if key not in seen:
                seen.add(key)
                unique_keys.append(key)

        return unique_keys

    @classmethod
    def _text_to_key(cls, text: str) -> str:
        """Convert text to a Flutter key format."""
        # Clean and convert to camelCase
        words = re.sub(r'[^\w\s]', '', text.lower()).split()
        if not words:
            return text.lower().replace(' ', '_')

        # camelCase: first word lowercase, rest capitalized
        return words[0] + ''.join(word.capitalize() for word in words[1:])

    @classmethod
    def _extract_target_words(cls, step_lower: str) -> List[str]:
        """Extract potential target element words from step."""
        # Remove common action words
        action_words = {
            'tap', 'click', 'press', 'enter', 'type', 'input', 'select',
            'toggle', 'verify', 'check', 'see', 'should', 'ensure', 'the',
            'on', 'a', 'an', 'to', 'from', 'with', 'in', 'of', 'is', 'are',
            'button', 'field', 'text', 'screen', 'page', 'user'
        }

        words = re.findall(r'\b[a-zA-Z]{3,}\b', step_lower)
        return [w for w in words if w not in action_words]

    @classmethod
    def get_screen_keys(cls, screen_name: str) -> List[str]:
        """Get all keys associated with a screen."""
        screen_lower = screen_name.lower()
        screen_keys = {
            'login': ['loginButton', 'phoneInput', 'googleSignInButton', 'otpInput'],
            'home': ['homeScreen', 'bottomNavBar', 'forYouTab', 'bannerKey'],
            'player': ['reelVideoPlayer', 'chromeCastButton', 'fullscreenButton'],
            'settings': ['settings', 'logoutButton', 'profileScreen'],
            'subscription': ['startTrialButton', 'subscribeButton', 'paymentSuccessActionButtonKey'],
            'profile': ['profileScreen', 'settings', 'logoutButton'],
            'search': ['searchInput', 'searchButton', 'searchResults'],
            'downloads': ['downloads', 'downloadList', 'downloadCard'],
        }
        return screen_keys.get(screen_lower, [])

    @classmethod
    def suggest_key_for_element(cls, element_description: str) -> Optional[str]:
        """Suggest a Flutter Key name for an element description."""
        # Useful for generating keys when adding new elements
        return cls._text_to_key(element_description)

    @classmethod
    def get_hindi_text_mappings(cls) -> Dict[str, str]:
        """Get Hindi text to key mappings for localized UI."""
        return {
            'लॉगिन करें': 'loginButton',
            'जारी रखें': 'continueButton',
            'रद्द करें': 'cancelButton',
            'सबमिट करें': 'submitButton',
            'खोजें': 'searchButton',
            'सेटिंग्स': 'settings',
            'डाउनलोड': 'downloads',
            'प्रोफ़ाइल': 'profileScreen',
            'होम': 'homeScreen',
        }
