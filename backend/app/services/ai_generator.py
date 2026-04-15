import json
import time
import re
from typing import List, Any
from openai import OpenAI
from app.models import TestCase
from app.utils.prompts import get_test_case_generation_prompt


class AITestCaseGenerator:
    """Generate test cases using STAGE Smart Router (OpenAI-compatible API)."""

    def __init__(self, api_key: str, base_url: str = "https://airouter.stage.in/v1"):
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        self.model = "auto"  # STAGE Smart Router

    def _parse_json_response(self, raw_response: str) -> List[Any]:
        """
        Parse JSON response with multiple fallback strategies.

        Args:
            raw_response: Raw AI response string

        Returns:
            Parsed list of test case data

        Raises:
            ValueError: If all parsing strategies fail
        """
        # Strategy 1: Direct JSON parse
        try:
            data = json.loads(raw_response)

            # Handle wrapped responses
            if isinstance(data, dict):
                if 'test_cases' in data:
                    return data['test_cases']
                elif 'testCases' in data:
                    return data['testCases']
                elif len(data) == 1:
                    # Single key with array value
                    value = list(data.values())[0]
                    if isinstance(value, list):
                        return value

            if isinstance(data, list):
                return data

        except json.JSONDecodeError as e:
            print(f"Strategy 1 failed: {str(e)}")

        # Strategy 2: Extract JSON from markdown code blocks
        try:
            # Look for ```json ... ``` or ```...```
            json_match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', raw_response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
                data = json.loads(json_str)
                if isinstance(data, list):
                    return data
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"Strategy 2 failed: {str(e)}")

        # Strategy 3: Find JSON array pattern [...]
        try:
            # Find first [ and last ]
            start = raw_response.find('[')
            end = raw_response.rfind(']')

            if start != -1 and end != -1 and end > start:
                json_str = raw_response[start:end+1]
                data = json.loads(json_str)
                if isinstance(data, list):
                    return data
        except json.JSONDecodeError as e:
            print(f"Strategy 3 failed: {str(e)}")

        # Strategy 4: Fix invalid escape sequences
        try:
            # Remove any text before first [ and after last ]
            cleaned = raw_response.strip()
            start = cleaned.find('[')
            end = cleaned.rfind(']')

            if start != -1 and end != -1:
                cleaned = cleaned[start:end+1]

                # Fix invalid escape sequences
                # Replace invalid backslash escapes with just the character
                # Valid JSON escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
                def fix_escapes(match):
                    escaped_char = match.group(1)
                    # If it's not a valid JSON escape, remove the backslash
                    if escaped_char not in ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']:
                        return escaped_char
                    return match.group(0)

                cleaned = re.sub(r'\\(.)', fix_escapes, cleaned)

                data = json.loads(cleaned)
                if isinstance(data, list):
                    return data
        except json.JSONDecodeError as e:
            print(f"Strategy 4 failed: {str(e)}")

        # Strategy 5: Aggressive cleaning - remove ALL backslashes except valid ones
        try:
            cleaned = raw_response.strip()
            start = cleaned.find('[')
            end = cleaned.rfind(']')

            if start != -1 and end != -1:
                cleaned = cleaned[start:end+1]

                # Replace problematic backslashes but preserve valid escapes
                # First protect valid escapes
                cleaned = cleaned.replace('\\n', '<!NEWLINE!>')
                cleaned = cleaned.replace('\\t', '<!TAB!>')
                cleaned = cleaned.replace('\\"', '<!QUOTE!>')
                cleaned = cleaned.replace('\\\\', '<!BACKSLASH!>')

                # Remove remaining backslashes
                cleaned = cleaned.replace('\\', '')

                # Restore valid escapes
                cleaned = cleaned.replace('<!NEWLINE!>', '\\n')
                cleaned = cleaned.replace('<!TAB!>', '\\t')
                cleaned = cleaned.replace('<!QUOTE!>', '\\"')
                cleaned = cleaned.replace('<!BACKSLASH!>', '\\\\')

                data = json.loads(cleaned)
                if isinstance(data, list):
                    return data
        except json.JSONDecodeError as e:
            print(f"Strategy 5 failed: {str(e)}")

        # Strategy 6: Truncation recovery - extract complete test cases from truncated JSON
        try:
            cleaned = raw_response.strip()
            start = cleaned.find('[')

            if start != -1:
                cleaned = cleaned[start:]

                # Find all complete JSON objects using regex
                # Match objects that have all required closing braces
                complete_objects = []
                depth = 0
                obj_start = None

                for i, char in enumerate(cleaned):
                    if char == '{':
                        if depth == 0:
                            obj_start = i
                        depth += 1
                    elif char == '}':
                        depth -= 1
                        if depth == 0 and obj_start is not None:
                            obj_str = cleaned[obj_start:i+1]
                            try:
                                obj = json.loads(obj_str)
                                # Verify it has required fields
                                if all(k in obj for k in ['title', 'steps', 'expected_result']):
                                    complete_objects.append(obj)
                            except json.JSONDecodeError:
                                pass
                            obj_start = None

                if complete_objects:
                    print(f"Strategy 6 (truncation recovery): Recovered {len(complete_objects)} complete test cases")
                    return complete_objects
        except Exception as e:
            print(f"Strategy 6 failed: {str(e)}")

        # All strategies failed
        raise ValueError(f"Could not parse JSON response. Response starts with: {raw_response[:200]}")

    def generate_test_cases(self, document_text: str, max_retries: int = 2) -> List[TestCase]:
        """
        Generate test cases from document text using STAGE Smart Router.

        Args:
            document_text: Extracted text from the document
            max_retries: Maximum number of retry attempts on JSON parse failure

        Returns:
            List of TestCase objects

        Raises:
            Exception: If AI generation fails
        """
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                if attempt > 0:
                    print(f"Retry attempt {attempt}/{max_retries}")

                return self._generate_with_single_attempt(document_text, attempt)

            except ValueError as e:
                last_error = e
                if "parse JSON" in str(e) and attempt < max_retries:
                    print(f"JSON parse failed on attempt {attempt + 1}, retrying...")
                    time.sleep(1)  # Brief pause before retry
                    continue
                else:
                    raise

            except Exception as e:
                # Non-retry-able error
                raise Exception(f"AI generation failed: {str(e)}")

        # All retries exhausted
        raise Exception(f"AI generation failed after {max_retries + 1} attempts: {str(last_error)}")

    def _generate_with_single_attempt(self, document_text: str, attempt: int) -> List[TestCase]:
        """
        Single attempt at generating test cases.

        Args:
            document_text: Document text to analyze
            attempt: Attempt number (0-indexed)

        Returns:
            List of TestCase objects
        """
        try:
            # Get the prompt
            prompt = get_test_case_generation_prompt(document_text)

            # Call STAGE Smart Router API (OpenAI-compatible) with streaming
            # Neorouter always returns streaming format, so we accumulate chunks
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert QA engineer focused on MAXIMUM FUNCTIONAL TEST COVERAGE. Generate ALL functional test cases needed to prevent bug leakage - cover every feature, screen, and user flow. CRITICAL JSON RULES: 1) Return ONLY a valid JSON array - no markdown, no code blocks, no explanation text. 2) Start with [ and end with ]. 3) Use double quotes for all strings. 4) Escape quotes in text as \\\". 5) Category must always be \"Functional\"."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=16000,
                stream=True
            )

            # Accumulate streaming response
            raw_response = ""
            for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, 'content') and delta.content:
                        raw_response += delta.content

            raw_response = raw_response.strip()

            # Log raw response for debugging (first 500 chars)
            print(f"AI Response (first 500 chars): {raw_response[:500]}")

            # Parse JSON with multiple strategies
            test_cases_data = self._parse_json_response(raw_response)

            if not isinstance(test_cases_data, list):
                raise ValueError("Response is not a list of test cases")

            # Validate and create TestCase objects (filter to Functional only)
            test_cases = []
            skipped_non_functional = 0
            for idx, tc_data in enumerate(test_cases_data):
                try:
                    # Ensure ID exists
                    if 'id' not in tc_data:
                        tc_data['id'] = f"TC{str(idx + 1).zfill(3)}"

                    # Filter: Only keep Functional test cases
                    category = tc_data.get('category', '').strip()
                    if category.lower() != 'functional':
                        # Force category to Functional if it's close, otherwise skip
                        if category.lower() in ['ui', 'integration', 'user flow', 'workflow']:
                            tc_data['category'] = 'Functional'
                        else:
                            skipped_non_functional += 1
                            print(f"Skipping non-functional test case: {tc_data.get('title', 'Unknown')} (category: {category})")
                            continue

                    # Validate and create TestCase
                    test_case = TestCase(**tc_data)
                    test_cases.append(test_case)
                except Exception as e:
                    print(f"Warning: Skipping invalid test case at index {idx}: {str(e)}")
                    continue

            if not test_cases:
                raise ValueError("No valid functional test cases were generated")

            print(f"Generated {len(test_cases)} functional test cases on attempt {attempt + 1}")
            if skipped_non_functional > 0:
                print(f"Skipped {skipped_non_functional} non-functional test cases")

            return test_cases

        except Exception:
            # Re-raise with context
            raise
