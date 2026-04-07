TEST_CASE_GENERATION_PROMPT = """You are an expert QA engineer analyzing a product requirements document (PRD).
Your task is to generate COMPREHENSIVE FUNCTIONAL test cases for MAXIMUM COVERAGE to prevent any bug leakage.

**Document Content:**
{document_text}

**Instructions:**
Generate ALL necessary FUNCTIONAL test cases to achieve MAXIMUM COVERAGE. Include:
1. ALL core user workflows and primary features (happy paths)
2. ALL user interactions with UI elements (buttons, inputs, navigation)
3. ALL state changes and transitions in the app
4. ALL data input and form submissions
5. ALL navigation flows between screens
6. ALL feature combinations and user journeys
7. Positive AND negative functional scenarios
8. Edge cases and boundary conditions
9. Different user states and conditions
10. Error handling and validation scenarios

**IMPORTANT - MAXIMUM FUNCTIONAL COVERAGE:**
- Generate ALL functional test cases needed for complete coverage
- Cover every feature, screen, button, input, and user flow in the PRD
- Each test must be automatable with UI interactions (click, tap, input, verify)
- Include tests for different user roles/states if applicable
- Category must ALWAYS be "Functional" - skip performance/security/load tests

**Output Format:**
Return a valid JSON array with this EXACT structure:
[
  {{
    "id": "TC001",
    "title": "Verify user can successfully login with valid credentials",
    "description": "Test that a registered user can log into the application using correct username and password",
    "preconditions": ["User account exists", "User is on login page"],
    "steps": [
      "1. Navigate to login page",
      "2. Enter valid username",
      "3. Enter valid password",
      "4. Click 'Login' button"
    ],
    "expected_result": "User is successfully authenticated and redirected to dashboard",
    "priority": "High",
    "category": "Functional"
  }}
]

**CRITICAL JSON RULES:**
- Return ONLY the JSON array - no markdown, no code blocks, no explanation text
- Use double quotes (") for all strings, NOT single quotes (')
- If text contains quotes, escape them with backslash: \"like this\"
- Keep strings short and avoid special characters when possible
- Each test case must have all required fields
- Priority must be: "High", "Medium", or "Low"
- Category must ALWAYS be "Functional"

**Guidelines:**
- Use sequential IDs: TC001, TC002, TC003, etc.
- Title should be clear and action-oriented (start with verbs like "Verify", "Test", "Validate")
- Steps should be specific UI actions (click, tap, enter text, scroll, verify element)
- Include realistic preconditions
- Each step should map to an automatable Appium action
- Focus on what user DOES and what they SEE as result

Return ONLY the JSON array starting with [ and ending with ], nothing else.
"""


def get_test_case_generation_prompt(document_text: str) -> str:
    """Generate the prompt for test case generation."""
    return TEST_CASE_GENERATION_PROMPT.format(document_text=document_text)


APPIUM_TEST_GENERATION_PROMPT = """You are an expert mobile app test automation engineer. Convert this natural language test description into a structured test case for Appium mobile testing.

**Test Description:**
{test_description}

**App Context:**
{app_context}

**Instructions:**
Generate a structured test case that can be executed on a mobile device via Appium. The test case should have clear, atomic steps that map to UI interactions.

**Output Format:**
Return a valid JSON object with this structure:
{{
    "id": "TC001",
    "title": "Clear action-oriented title",
    "description": "What this test verifies",
    "preconditions": ["App is installed", "User is on login screen"],
    "steps": [
        "1. Tap on the login button",
        "2. Enter phone number '9876543210' in the phone field",
        "3. Tap 'Continue' button",
        "4. Verify OTP screen is displayed"
    ],
    "expected_result": "What should happen after all steps",
    "priority": "High",
    "category": "Functional"
}}

**Step Writing Rules:**
- Each step should be a single UI action (tap, enter text, swipe, verify)
- Use action verbs: Tap, Click, Enter, Type, Swipe, Scroll, Verify, Check
- For text input, include the exact text in quotes
- For button taps, include the button text or description
- Include verification steps to check expected outcomes
- Steps should be automatable via Appium locators (resource-id, content-desc, text, xpath)

**Common Mobile Actions:**
- Tap on 'Button Text' button
- Enter 'value' in the phone/email/password field
- Swipe up/down to scroll
- Verify 'expected text' is displayed
- Check that element with 'description' is visible
- Wait for screen to load

Return ONLY the JSON object, no markdown or explanation."""


def get_appium_test_prompt(test_description: str, app_context: str = "") -> str:
    """Generate the prompt for Appium test case generation."""
    return APPIUM_TEST_GENERATION_PROMPT.format(
        test_description=test_description,
        app_context=app_context or "Mobile app testing"
    )
