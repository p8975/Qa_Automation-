"""
AIStepTranslator: Converts text test steps into executable Appium commands.
"""

from typing import Dict, Optional
from openai import OpenAI


class AIStepTranslator:
    """Service for translating test steps to Appium commands using AI."""

    def __init__(self, api_key: str, base_url: str = "https://airouter.stage.in/v1"):
        """
        Initialize AI step translator.

        Args:
            api_key: API key for AI service
            base_url: Base URL for AI service
        """
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = "auto"  # STAGE Smart Router

    def translate_step(self, step_description: str, context: Dict) -> str:
        """
        Translate text step to Appium Python command.

        Args:
            step_description: Text description of step
            context: Context including app_package, element_map, previous_steps

        Returns:
            str: Executable Python code using appium-python-client

        Raises:
            ValueError: If translation fails
        """
        prompt = self._build_translation_prompt(step_description, context)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an Appium automation expert. Convert test steps to executable Python code."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )

            command = response.choices[0].message.content
            if not command:
                raise ValueError("AI returned empty response")
            command = command.strip()

            # Clean up code blocks if present
            if command.startswith("```python"):
                command = command[9:]
            if command.startswith("```"):
                command = command[3:]
            if command.endswith("```"):
                command = command[:-3]

            return command.strip()

        except Exception as e:
            raise ValueError(f"AI translation failed: {str(e)}")

    def build_context(self, element_map: Optional[Dict], previous_steps: list) -> Dict:
        """
        Build context for AI translation.

        Args:
            element_map: Cached element locations
            previous_steps: Previously executed steps

        Returns:
            dict: Context for translation
        """
        context = {
            "element_map": element_map or {},
            "previous_steps": previous_steps or []
        }
        return context

    def _build_translation_prompt(self, step_description: str, context: Dict) -> str:
        """Build prompt for AI translation."""
        app_package = context.get("app_package", "")
        discovered_elements = context.get("discovered_elements", {})
        
        # Format discovered elements for the prompt
        elements_info = ""
        if discovered_elements:
            formatted_elements = []
            for elem_id, elem_info in list(discovered_elements.items())[:20]:  # Limit to 20
                text = elem_info.get("text", "")
                content_desc = elem_info.get("content_desc", "")
                resource_id = elem_info.get("resource_id", "")
                if text or content_desc or resource_id:
                    formatted_elements.append(f"- {elem_id}: text='{text}', content_desc='{content_desc}', resource_id='{resource_id}'")
            elements_info = "\n".join(formatted_elements)

        prompt = f"""Convert this test step into a SINGLE LINE of executable Appium Python code.

**Test Step:** {step_description}

**App Package:** {app_package}

**Available Elements on Screen (use these if they match):**
{elements_info if elements_info else "None - use generic patterns"}

**CRITICAL Requirements:**
1. Return ONLY a SINGLE LINE command like: driver.find_element(AppiumBy.ACCESSIBILITY_ID, "element_id").click()
2. DO NOT return multi-line code or function definitions
3. Use these AppiumBy types: ID, ACCESSIBILITY_ID, XPATH, CLASS_NAME
4. Do NOT wrap in try/except or define functions
5. If no matching element found, use a generic pattern like: driver.find_element(AppiumBy.XPATH, "//android.widget.Button").click()

**Examples of valid single-line commands:**
- driver.find_element(AppiumBy.ACCESSIBILITY_ID, "cancel_button").click()
- driver.find_element(AppiumBy.ID, "com.app:id/username").send_keys("testuser")
- driver.find_element(AppiumBy.XPATH, "//*[contains(@text, 'Submit')]").click()
- driver.find_element(AppiumBy.CLASS_NAME, "android.widget.Button").click()

Generate ONE single line command:"""

        return prompt
