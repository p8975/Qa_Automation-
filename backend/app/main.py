import os
import time
import tempfile
import hashlib
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Response, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from app.models import (
    TestCaseGenerationResponse, BuildEntity,
    DeviceInfo, TestRunEntity, TestCaseEntity, TestStep, Priority, Category,
    TestModule, CreateModuleRequest, UpdateModuleRequest
)
from app.services.document_parser import DocumentParser
from app.services.ai_generator import AITestCaseGenerator
from app.services.build_service import BuildService
from app.services.device_manager import DeviceManager
from app.services.appium_service import AppiumService
from app.services.ai_step_translator import AIStepTranslator
from app.services.test_executor import TestExecutor
from app.repositories.build_repository import BuildRepository
from app.repositories.test_case_repository import TestCaseRepository
from app.repositories.test_run_repository import TestRunRepository
from app.repositories.element_map_repository import ElementMapRepository
from app.repositories.test_module_repository import TestModuleRepository
from app.repositories.input_history_repository import InputHistoryRepository, InputHistoryEntry
from app.utils.scheduler import TestScheduler
from app.services.execution_logger import get_logs as get_execution_logs

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="QA Automation Platform API",
    description="AI-powered test case generation from PRDs",
    version="0.1.0"
)

# Configure CORS
cors_origins = ["http://localhost:3002", "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3002", "*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
api_key = os.getenv("API_KEY")
if not api_key:
    raise ValueError("API_KEY environment variable is required")

base_url = os.getenv("BASE_URL", "https://airouter.stage.in/v1")
ai_generator = AITestCaseGenerator(api_key=api_key, base_url=base_url)
document_parser = DocumentParser()

# Initialize execution engine services
storage_root = os.getenv("STORAGE_ROOT", "./storage")
appium_url = os.getenv("APPIUM_URL", "http://localhost:4723")

build_repository = BuildRepository(storage_root=storage_root)
test_case_repository = TestCaseRepository(storage_root=storage_root)
test_run_repository = TestRunRepository(storage_root=storage_root)
element_map_repository = ElementMapRepository(storage_root=storage_root)
test_module_repository = TestModuleRepository(storage_root=storage_root)
input_history_repository = InputHistoryRepository(storage_root=storage_root)

build_service = BuildService(build_repository=build_repository)
device_manager = DeviceManager()
appium_service = AppiumService(appium_url=appium_url)
ai_translator = AIStepTranslator(api_key=api_key, base_url=base_url)
test_executor = TestExecutor(
    appium_service=appium_service,
    device_manager=device_manager,
    ai_translator=ai_translator,
    test_run_repository=test_run_repository,
    element_map_repository=element_map_repository,
    build_repository=build_repository,
    test_case_repository=test_case_repository
)

# Initialize scheduler
test_scheduler = TestScheduler()


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "QA Automation Platform API",
        "version": "0.1.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "ai_configured": bool(api_key),
        "model": "STAGE Smart Router (auto)",
        "base_url": base_url,
        "timestamp": time.time()
    }


@app.post("/api/generate-test-cases", response_model=TestCaseGenerationResponse)
async def generate_test_cases(
    file: UploadFile = File(..., description="PRD document (PDF, DOCX, Markdown, or TXT)"),
    save: bool = Query(default=True, description="Auto-save test cases to library")
):
    """
    Generate test cases from an uploaded PRD document.

    Args:
        file: Uploaded document file
        save: Whether to automatically save test cases (default: True)

    Returns:
        TestCaseGenerationResponse with generated test cases

    Raises:
        HTTPException: If file processing or AI generation fails
    """
    start_time = time.time()

    # Validate file size (10MB limit)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds 10MB limit. File size: {len(file_bytes) / (1024 * 1024):.2f}MB"
        )

    try:
        # Step 1: Parse document
        print(f"Parsing document: {file.filename}")
        document_text = document_parser.parse_document(file_bytes, file.filename)
        print(f"Extracted {len(document_text)} characters from document")

        # Step 2: Generate test cases using AI
        print("Generating test cases with AI...")
        test_cases = ai_generator.generate_test_cases(document_text)

        # Step 3: Auto-save test cases if requested
        if save:
            # Calculate PRD hash for linking
            prd_hash = hashlib.md5(file_bytes).hexdigest()
            print(f"PRD hash: {prd_hash}")

            saved_count = 0
            for test_case in test_cases:
                try:
                    # Convert TestCase to TestCaseEntity
                    tc_entity = TestCaseEntity(
                        tc_id=str(uuid.uuid4()),
                        prd_hash=prd_hash,
                        title=test_case.title,
                        description=test_case.description,
                        preconditions=test_case.preconditions,
                        steps=[
                            TestStep(
                                step_number=idx + 1,
                                description=step,
                                locator_override=None,
                                expected_element=None
                            )
                            for idx, step in enumerate(test_case.steps)
                        ],
                        expected_result=test_case.expected_result,
                        priority=test_case.priority,
                        category=test_case.category,
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )

                    # Save to repository
                    test_case_repository.save(tc_entity)
                    saved_count += 1

                except Exception as e:
                    print(f"Warning: Failed to save test case '{test_case.title}': {str(e)}")
                    continue

            print(f"Auto-saved {saved_count}/{len(test_cases)} test cases to library")

        # Step 4: Save to input history
        prd_hash = hashlib.md5(file_bytes).hexdigest()
        input_history_repository.save_prd_upload(
            filename=file.filename,
            file_bytes=file_bytes,
            content_text=document_text,
            content_hash=prd_hash,
            test_cases_count=len(test_cases)
        )
        print(f"Saved PRD upload to history: {file.filename}")

        # Step 5: Prepare response
        generation_time = time.time() - start_time

        return TestCaseGenerationResponse(
            test_cases=test_cases,
            document_name=file.filename,
            total_count=len(test_cases),
            generation_time=round(generation_time, 2)
        )

    except ValueError as e:
        # Document parsing errors or validation errors
        error_msg = str(e)
        if "parse JSON" in error_msg:
            error_msg = "AI returned invalid format. Please try again or use a different document."
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        # AI generation or other unexpected errors
        error_str = str(e)
        print(f"Error generating test cases: {error_str}")

        # User-friendly error message
        if "parse JSON" in error_str or "JSONDecodeError" in error_str:
            detail = "AI returned invalid format. This sometimes happens with complex documents. Please try again with a simpler or shorter PRD."
        elif "timeout" in error_str.lower():
            detail = "Request timed out. Please try with a shorter document."
        elif "API" in error_str or "401" in error_str or "403" in error_str:
            detail = "AI service authentication error. Please contact support."
        else:
            detail = f"Failed to generate test cases: {error_str}"

        raise HTTPException(status_code=500, detail=detail)


# ============================================================================
# Input History Endpoints
# ============================================================================

@app.get("/api/input-history", response_model=List[InputHistoryEntry])
async def list_input_history(
    input_type: Optional[str] = Query(None, description="Filter by type: 'prd_upload' or 'natural_language'"),
    limit: int = Query(50, description="Maximum entries to return"),
    offset: int = Query(0, description="Offset for pagination")
):
    """
    List all user input history (PRD uploads and natural language inputs).

    Args:
        input_type: Optional filter by input type
        limit: Maximum entries to return
        offset: Pagination offset

    Returns:
        List[InputHistoryEntry]: Input history entries sorted by date (newest first)
    """
    try:
        return input_history_repository.list(
            input_type=input_type,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list input history: {str(e)}"
        )


@app.get("/api/input-history/stats")
async def get_input_history_stats():
    """
    Get statistics about input history.

    Returns:
        dict: Statistics including counts and totals
    """
    try:
        return input_history_repository.get_stats()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get stats: {str(e)}"
        )


@app.get("/api/input-history/{entry_id}", response_model=InputHistoryEntry)
async def get_input_history_entry(entry_id: str):
    """
    Get specific input history entry.

    Args:
        entry_id: Entry identifier

    Returns:
        InputHistoryEntry: Entry details

    Raises:
        HTTPException: If entry not found
    """
    entry = input_history_repository.get(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@app.delete("/api/input-history/{entry_id}")
async def delete_input_history_entry(entry_id: str):
    """
    Delete input history entry.

    Args:
        entry_id: Entry identifier

    Returns:
        dict: Success message

    Raises:
        HTTPException: If entry not found
    """
    success = input_history_repository.delete(entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted successfully", "entry_id": entry_id}


# ============================================================================
# Build Management Endpoints
# ============================================================================

@app.post("/api/builds/upload", response_model=BuildEntity)
async def upload_build(
    file: UploadFile = File(..., description="APK file to upload")
):
    """
    Upload APK build.

    Args:
        file: APK file

    Returns:
        BuildEntity: Build metadata

    Raises:
        HTTPException: If upload or parsing fails
    """
    # Validate file extension
    if not file.filename.endswith('.apk'):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only .apk files are accepted."
        )

    # Save to temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.apk') as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name

    try:
        build = build_service.upload_build(temp_path, file.filename)
        return build
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload build: {str(e)}"
        )
    finally:
        # Cleanup temp file
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@app.get("/api/builds", response_model=List[BuildEntity])
async def list_builds():
    """
    List all uploaded builds.

    Returns:
        List[BuildEntity]: All builds
    """
    try:
        return build_service.list_builds()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list builds: {str(e)}"
        )


@app.get("/api/builds/{build_id}", response_model=BuildEntity)
async def get_build(build_id: str):
    """
    Get build by ID.

    Args:
        build_id: Build identifier

    Returns:
        BuildEntity: Build metadata

    Raises:
        HTTPException: If build not found
    """
    build = build_service.get_build(build_id)
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    return build


@app.delete("/api/builds/{build_id}")
async def delete_build(build_id: str):
    """
    Delete build.

    Args:
        build_id: Build identifier

    Returns:
        dict: Success message

    Raises:
        HTTPException: If build not found
    """
    success = build_service.delete_build(build_id)
    if not success:
        raise HTTPException(status_code=404, detail="Build not found")
    return {"message": "Build deleted successfully", "build_id": build_id}


# ============================================================================
# Test Case Management Endpoints
# ============================================================================

@app.post("/api/test-cases", response_model=TestCaseEntity)
async def save_test_case(test_case: TestCaseEntity):
    """
    Save test case.

    Args:
        test_case: Test case to save

    Returns:
        TestCaseEntity: Saved test case

    Raises:
        HTTPException: If save fails
    """
    try:
        tc_id = test_case_repository.save(test_case)
        saved_test_case = test_case_repository.get(tc_id)
        return saved_test_case
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save test case: {str(e)}"
        )


@app.get("/api/test-cases", response_model=List[TestCaseEntity])
async def list_test_cases(prd_hash: str = None):
    """
    List all test cases, optionally filtered by PRD hash.

    Args:
        prd_hash: Optional PRD hash filter

    Returns:
        List[TestCaseEntity]: Filtered test cases
    """
    try:
        if prd_hash:
            return test_case_repository.list(prd_hash=prd_hash)
        return test_case_repository.list()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list test cases: {str(e)}"
        )


@app.get("/api/test-cases/{tc_id}", response_model=TestCaseEntity)
async def get_test_case(tc_id: str):
    """
    Get test case by ID.

    Args:
        tc_id: Test case identifier

    Returns:
        TestCaseEntity: Test case details

    Raises:
        HTTPException: If test case not found
    """
    test_case = test_case_repository.get(tc_id)
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    return test_case


@app.put("/api/test-cases/{tc_id}", response_model=TestCaseEntity)
async def update_test_case(tc_id: str, updates: dict):
    """
    Update test case.

    Args:
        tc_id: Test case identifier
        updates: Fields to update

    Returns:
        TestCaseEntity: Updated test case

    Raises:
        HTTPException: If test case not found or update fails
    """
    try:
        success = test_case_repository.update(tc_id, updates)
        if not success:
            raise HTTPException(status_code=404, detail="Test case not found")
        return test_case_repository.get(tc_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update test case: {str(e)}"
        )


@app.delete("/api/test-cases/{tc_id}")
async def delete_test_case(tc_id: str):
    """
    Delete test case.

    Args:
        tc_id: Test case identifier

    Returns:
        dict: Success message

    Raises:
        HTTPException: If test case not found
    """
    success = test_case_repository.delete(tc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Test case not found")
    return {"message": "Test case deleted successfully", "tc_id": tc_id}


# ============================================================================
# Manual Test Case Conversion Endpoints
# ============================================================================


class ManualTestCaseRequest(BaseModel):
    title: str
    steps: List[str]
    expected_result: str


class NaturalLanguageTestCaseRequest(BaseModel):
    description: str  # Natural language description of the test case


@app.post("/api/test-cases/from-natural-language")
async def create_test_case_from_natural_language(request: NaturalLanguageTestCaseRequest):
    """
    Convert natural language description to a structured test case using AI.

    Takes a free-form description and generates a properly formatted test case
    with title, steps, preconditions, and expected results.

    Args:
        request: Natural language description of what to test

    Returns:
        TestCase: Generated structured test case
    """
    import json as json_module
    from app.models import TestCase

    try:
        # Use AI to convert natural language to structured test case
        prompt = f"""Convert this natural language test description into a structured test case.

**User Input:**
{request.description}

**Output Format:**
Return a single JSON object (not an array) with this structure:
{{
    "id": "TC001",
    "title": "Clear action-oriented title starting with Verify/Test/Validate",
    "description": "Detailed description of what is being tested",
    "preconditions": ["List of setup requirements"],
    "steps": ["1. First step", "2. Second step", "3. Third step"],
    "expected_result": "What should happen after executing the steps",
    "priority": "High|Medium|Low",
    "category": "Functional"
}}

**Rules:**
- Extract the test intent from the natural language
- Create clear, automatable steps (click, tap, enter, verify, etc.)
- Infer reasonable preconditions
- Set appropriate priority based on the feature importance
- Category must be "Functional"
- Return ONLY the JSON object, no markdown or explanation"""

        stream = ai_generator.client.chat.completions.create(
            model=ai_generator.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a QA engineer. Convert natural language test descriptions into structured test cases. Return ONLY valid JSON, no markdown."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.5,
            max_tokens=2000,
            stream=True
        )

        # Accumulate streaming response
        raw_response = ""
        for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    raw_response += delta.content

        # Clean up response - remove markdown if present
        raw_response = raw_response.strip()
        if raw_response.startswith('```'):
            raw_response = raw_response.split('```')[1]
            if raw_response.startswith('json'):
                raw_response = raw_response[4:]
        raw_response = raw_response.strip()

        # Parse JSON
        tc_data = json_module.loads(raw_response)

        # Ensure ID
        if 'id' not in tc_data:
            tc_data['id'] = f"TC{str(uuid.uuid4())[:8].upper()}"

        # Create TestCase object
        test_case = TestCase(**tc_data)

        # Save to input history
        content_hash = hashlib.md5(request.description.encode()).hexdigest()
        input_history_repository.save_natural_language_input(
            description=request.description,
            content_hash=content_hash,
            test_case_generated=True
        )

        return {
            "success": True,
            "test_case": test_case.model_dump(),
            "message": "Test case generated successfully from natural language"
        }

    except json_module.JSONDecodeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse AI response as JSON: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate test case: {str(e)}"
        )


@app.post("/api/manual-test-cases/convert")
async def convert_manual_test_case(request: ManualTestCaseRequest):
    """
    Convert a manually written test case to automation script format.

    Takes natural language test steps and converts them to a format
    that can be executed by the automation framework.

    Args:
        request: Manual test case with title, steps, and expected result

    Returns:
        dict: Converted test case ID and success message
    """
    try:
        # Create test steps in the required format
        test_steps = []
        for idx, step_text in enumerate(request.steps, 1):
            test_steps.append(TestStep(
                step_number=idx,
                description=step_text.strip(),
                locator_override=None,
                expected_element=None
            ))

        # Generate a unique PRD hash for manual test cases
        manual_hash = hashlib.md5(f"manual_{datetime.now().isoformat()}".encode()).hexdigest()

        # Create the test case entity
        test_case = TestCaseEntity(
            tc_id=str(uuid.uuid4()),
            prd_hash=manual_hash,
            title=request.title.strip(),
            description=f"Manual test case: {request.title.strip()}",
            preconditions=["Manual test case created by user"],
            steps=test_steps,
            expected_result=request.expected_result.strip(),
            priority=Priority.MEDIUM,
            category=Category.FUNCTIONAL,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        # Save the test case
        tc_id = test_case_repository.save(test_case)

        return {
            "tc_id": tc_id,
            "message": f"Test case '{request.title}' converted and saved successfully",
            "steps_count": len(test_steps)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to convert test case: {str(e)}"
        )


# ============================================================================
# Device Management Endpoints
# ============================================================================

@app.get("/api/devices", response_model=List[DeviceInfo])
async def list_devices():
    """
    List all available devices.

    Returns:
        List[DeviceInfo]: All connected devices
    """
    try:
        return device_manager.list_devices()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list devices: {str(e)}"
        )


@app.get("/api/devices/{device_id}", response_model=DeviceInfo)
async def get_device(device_id: str):
    """
    Get device info.

    Args:
        device_id: Device identifier

    Returns:
        DeviceInfo: Device information

    Raises:
        HTTPException: If device not found
    """
    device_info = device_manager.get_device_info(device_id)
    if not device_info:
        raise HTTPException(status_code=404, detail="Device not found")
    return device_info


@app.get("/api/devices/{device_id}/screenshot")
async def get_device_screenshot(device_id: str):
    """
    Get live screenshot from device.

    Args:
        device_id: Device identifier

    Returns:
        Response: PNG image data

    Raises:
        HTTPException: If device not found or screenshot failed
    """
    # Check if device exists
    if not device_manager.is_device_available(device_id):
        raise HTTPException(status_code=404, detail="Device not found or offline")

    # Capture screenshot
    screenshot_data = device_manager.capture_screenshot(device_id)
    if not screenshot_data:
        raise HTTPException(status_code=500, detail="Failed to capture screenshot")

    return Response(
        content=screenshot_data,
        media_type="image/png",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@app.get("/api/devices/{device_id}/screen-info")
async def get_device_screen_info(device_id: str):
    """
    Get device screen information.

    Args:
        device_id: Device identifier

    Returns:
        dict: Screen size and device info

    Raises:
        HTTPException: If device not found
    """
    device_info = device_manager.get_device_info(device_id)
    if not device_info:
        raise HTTPException(status_code=404, detail="Device not found")

    screen_size = device_manager.get_screen_size(device_id)

    return {
        "device": device_info,
        "screen_width": screen_size[0] if screen_size else None,
        "screen_height": screen_size[1] if screen_size else None
    }


# ============================================================================
# Element Inspection Endpoint
# ============================================================================

@app.post("/api/inspect-elements", response_model=dict)
async def inspect_elements(
    build_id: str,
    device_id: str,
    screen_coordinates: dict = None
):
    """
    Inspect elements on current screen.

    Args:
        build_id: Build identifier
        device_id: Device identifier
        screen_coordinates: Optional {x, y} coordinates

    Returns:
        dict: Discovered elements with locators

    Raises:
        HTTPException: If inspection fails
    """
    try:
        # Get build info
        build = build_service.get_build(build_id)
        if not build:
            raise HTTPException(status_code=404, detail="Build not found")

        # Get device info
        device_info = device_manager.get_device_info(device_id)
        if not device_info:
            raise HTTPException(status_code=404, detail="Device not found")

        # Create Appium session
        driver = appium_service.create_session(
            device_id=device_id,
            app_path=build.file_path,
            app_package=build.app_package
        )

        try:
            # Get page source
            page_source = driver.page_source

            # Parse elements from page source
            from xml.etree import ElementTree as ET
            root = ET.fromstring(page_source)

            elements = []
            for elem in root.iter():
                element_info = {
                    "tag": elem.tag,
                    "locators": {}
                }

                # Extract all possible locators
                if elem.get('resource-id'):
                    element_info["locators"]["resource_id"] = elem.get('resource-id')
                if elem.get('content-desc'):
                    element_info["locators"]["accessibility_id"] = elem.get('content-desc')
                if elem.get('text'):
                    element_info["locators"]["text"] = elem.get('text')
                if elem.get('class'):
                    element_info["locators"]["class_name"] = elem.get('class')

                # Get coordinates
                bounds = elem.get('bounds')
                if bounds:
                    element_info["bounds"] = bounds

                # Only include elements with at least one locator
                if element_info["locators"]:
                    elements.append(element_info)

            return {
                "elements": elements,
                "total_count": len(elements),
                "device_id": device_id,
                "build_id": build_id
            }

        finally:
            appium_service.end_session(driver)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to inspect elements: {str(e)}"
        )


# ============================================================================
# Test Execution Endpoints
# ============================================================================

def run_tests_in_background(run_id: str):
    """Background task to execute tests asynchronously."""
    try:
        test_executor.execute_test_run_async(run_id)
    except Exception as e:
        print(f"Background test execution error: {str(e)}")


@app.post("/api/test-runs", response_model=dict)
async def start_test_run(
    background_tasks: BackgroundTasks,
    build_id: Optional[str] = Query(None, description="Build ID to test (required if no APK uploaded)"),
    test_case_ids: List[str] = Query(..., description="Test case IDs to run"),
    device_id: str = Query(..., description="Device ID to use"),
    apk_file: UploadFile = File(None, description="Fresh APK file (optional - will use build_id if not provided)")
):
    """
    Start test execution.

    Args:
        build_id: Build to test (required if no APK uploaded)
        test_case_ids: Test cases to run
        device_id: Device to use
        apk_file: Fresh APK file (optional)

    Returns:
        dict: run_id and status

    Raises:
        HTTPException: If execution fails to start
    """
    try:
        # If APK file uploaded, create a build from it
        if apk_file:
            # Validate file type
            if not apk_file.filename.endswith('.apk'):
                raise HTTPException(status_code=400, detail="Only APK files are accepted")

            # Save the uploaded APK temporarily
            import tempfile
            import os

            with tempfile.NamedTemporaryFile(delete=False, suffix='.apk') as tmp:
                content = await apk_file.read()
                tmp.write(content)
                tmp_path = tmp.name

            try:
                # Create build from uploaded APK
                build_id = build_repository.create_build(tmp_path, apk_file.filename)
            finally:
                # Cleanup temp file
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

        # Validate we have a build
        if not build_id:
            raise HTTPException(status_code=400, detail="Either build_id or apk_file is required")

        # Create the test run record immediately (returns run_id right away)
        run_id = test_executor.create_test_run(build_id, test_case_ids, device_id)

        # Execute tests in background (non-blocking)
        background_tasks.add_task(run_tests_in_background, run_id)

        return {"run_id": run_id, "status": "running"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start test run: {str(e)}"
        )


@app.get("/api/test-runs/{run_id}", response_model=TestRunEntity)
async def get_test_run(run_id: str):
    """
    Get test run status and results.

    Args:
        run_id: Test run identifier

    Returns:
        TestRunEntity: Test run details

    Raises:
        HTTPException: If run not found
    """
    test_run = test_run_repository.get(run_id)
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return test_run


@app.get("/api/builds/{build_id}/test-runs", response_model=List[TestRunEntity])
async def get_build_test_runs(build_id: str):
    """
    List all test runs for a build.

    Args:
        build_id: Build identifier

    Returns:
        List[TestRunEntity]: Test runs for this build
    """
    try:
        return test_run_repository.list_by_build(build_id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list test runs: {str(e)}"
        )


@app.get("/api/test-runs/{run_id}/logs")
async def get_test_run_logs(run_id: str):
    """
    Get full logs for a test run.

    Args:
        run_id: Test run identifier

    Returns:
        dict: Log output

    Raises:
        HTTPException: If run not found
    """
    test_run = test_run_repository.get(run_id)
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Aggregate logs from all test results
    full_logs = []
    for result in test_run.results:
        full_logs.append(f"=== Test Case: {result.test_case_id} ===")
        full_logs.append(result.log_output)
        full_logs.append("")

    return {
        "run_id": run_id,
        "logs": "\n".join(full_logs)
    }


@app.post("/api/test-runs/{run_id}/cancel")
async def cancel_test_run(run_id: str):
    """
    Cancel running test.

    Args:
        run_id: Test run identifier

    Returns:
        dict: Success message

    Raises:
        HTTPException: If run not found or cannot be cancelled
    """
    test_run = test_run_repository.get(run_id)
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    if test_run.status not in ["queued", "running"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel test run with status: {test_run.status}"
        )

    try:
        # Update status to cancelled
        test_run_repository.update_status(run_id, "cancelled")
        return {
            "message": "Test run cancelled successfully",
            "run_id": run_id
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cancel test run: {str(e)}"
        )


# ============================================================================
# Scheduler Endpoints
# ============================================================================

@app.post("/api/schedules")
async def schedule_test_run(
    build_id: str = Query(..., description="Build ID to test"),
    test_case_ids: List[str] = Query(..., description="Test case IDs to run"),
    device_id: str = Query(..., description="Device ID to use"),
    cron_expression: str = Query(..., description="Cron-style expression")
):
    """
    Schedule periodic test run.

    Args:
        build_id: Build to test
        test_case_ids: Test cases to run
        device_id: Device to use
        cron_expression: Cron-style expression (e.g., "every 1 hour", "every day at 10:00")

    Returns:
        dict: schedule_id

    Raises:
        HTTPException: If scheduling fails
    """
    try:
        # Validate inputs
        build = build_service.get_build(build_id)
        if not build:
            raise HTTPException(status_code=404, detail="Build not found")

        device_info = device_manager.get_device_info(device_id)
        if not device_info:
            raise HTTPException(status_code=404, detail="Device not found")

        # Create executor callback
        def executor_callback(bid, tcids, did):
            try:
                test_executor.execute_test_run(bid, tcids, did)
            except Exception as e:
                print(f"Scheduled test run failed: {str(e)}")

        # Schedule the test run
        schedule_id = test_scheduler.schedule_test_run(
            build_id=build_id,
            test_case_ids=test_case_ids,
            device_id=device_id,
            cron_expression=cron_expression,
            executor_callback=executor_callback
        )

        return {
            "schedule_id": schedule_id,
            "message": "Test run scheduled successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to schedule test run: {str(e)}"
        )


@app.get("/api/schedules")
async def list_schedules():
    """
    List all scheduled test runs.

    Returns:
        List[dict]: All schedules
    """
    try:
        return test_scheduler.list_schedules()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list schedules: {str(e)}"
        )


@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """
    Cancel scheduled test run.

    Args:
        schedule_id: Schedule identifier

    Returns:
        dict: Success message

    Raises:
        HTTPException: If schedule not found
    """
    success = test_scheduler.cancel_schedule(schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {
        "message": "Schedule cancelled successfully",
        "schedule_id": schedule_id
    }


# ============================================================================
# Test Module (Suite) Endpoints
# ============================================================================

@app.post("/api/modules", response_model=TestModule)
async def create_module(request: CreateModuleRequest):
    """
    Create a new test module.

    Args:
        request: Module creation request

    Returns:
        TestModule: Created module

    Raises:
        HTTPException: If creation fails
    """
    try:
        # Check if module with same name exists
        existing = test_module_repository.get_by_name(request.name)
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Module with name '{request.name}' already exists"
            )

        module = test_module_repository.create(
            name=request.name,
            description=request.description,
            test_case_ids=request.test_case_ids
        )
        return module
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create module: {str(e)}"
        )


@app.get("/api/modules", response_model=List[TestModule])
async def list_modules():
    """
    List all test modules.

    Returns:
        List[TestModule]: All modules
    """
    try:
        return test_module_repository.list()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list modules: {str(e)}"
        )


@app.get("/api/modules/{module_id}", response_model=TestModule)
async def get_module(module_id: str):
    """
    Get module by ID.

    Args:
        module_id: Module identifier

    Returns:
        TestModule: Module details

    Raises:
        HTTPException: If not found
    """
    module = test_module_repository.get(module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module


@app.get("/api/modules/by-name/{name}", response_model=TestModule)
async def get_module_by_name(name: str):
    """
    Get module by name.

    Args:
        name: Module name

    Returns:
        TestModule: Module details

    Raises:
        HTTPException: If not found
    """
    module = test_module_repository.get_by_name(name)
    if not module:
        raise HTTPException(status_code=404, detail=f"Module '{name}' not found")
    return module


@app.put("/api/modules/{module_id}", response_model=TestModule)
async def update_module(module_id: str, request: UpdateModuleRequest):
    """
    Update module.

    Args:
        module_id: Module identifier
        request: Update request

    Returns:
        TestModule: Updated module

    Raises:
        HTTPException: If not found
    """
    try:
        # Check name uniqueness if changing name
        if request.name:
            existing = test_module_repository.get_by_name(request.name)
            if existing and existing.module_id != module_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Module with name '{request.name}' already exists"
                )

        module = test_module_repository.update(
            module_id=module_id,
            name=request.name,
            description=request.description,
            test_case_ids=request.test_case_ids
        )

        if not module:
            raise HTTPException(status_code=404, detail="Module not found")

        return module
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update module: {str(e)}"
        )


@app.post("/api/modules/{module_id}/test-cases")
async def add_test_cases_to_module(
    module_id: str,
    test_case_ids: List[str] = Query(..., description="Test case IDs to add")
):
    """
    Add test cases to a module.

    Args:
        module_id: Module identifier
        test_case_ids: Test case IDs to add

    Returns:
        TestModule: Updated module

    Raises:
        HTTPException: If not found
    """
    module = test_module_repository.add_test_cases(module_id, test_case_ids)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module


@app.delete("/api/modules/{module_id}/test-cases")
async def remove_test_cases_from_module(
    module_id: str,
    test_case_ids: List[str] = Query(..., description="Test case IDs to remove")
):
    """
    Remove test cases from a module.

    Args:
        module_id: Module identifier
        test_case_ids: Test case IDs to remove

    Returns:
        TestModule: Updated module

    Raises:
        HTTPException: If not found
    """
    module = test_module_repository.remove_test_cases(module_id, test_case_ids)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module


@app.delete("/api/modules/{module_id}")
async def delete_module(module_id: str):
    """
    Delete module.

    Args:
        module_id: Module identifier

    Returns:
        dict: Success message

    Raises:
        HTTPException: If not found
    """
    success = test_module_repository.delete(module_id)
    if not success:
        raise HTTPException(status_code=404, detail="Module not found")
    return {
        "message": "Module deleted successfully",
        "module_id": module_id
    }


# ============================================================================
# Mobile App Test Execution Endpoints (Natural Language → Appium)
# ============================================================================

class MobileTestRequest(BaseModel):
    description: str  # Natural language test description
    build_id: Optional[str] = None  # APK build ID to test against
    device_id: Optional[str] = None  # Device ID to run test on


class MobileTestExecuteRequest(BaseModel):
    test_case: dict  # Structured test case from generation
    build_id: str  # APK build ID
    device_id: str  # Device ID


@app.post("/api/mobile-test/generate")
async def generate_mobile_test(request: MobileTestRequest):
    """
    Convert natural language test description to structured mobile test case.

    Args:
        request: Natural language description of the test

    Returns:
        dict: Structured test case with steps for Appium execution
    """
    import json as json_module
    from app.utils.prompts import get_appium_test_prompt

    try:
        # Get app context if build_id provided
        app_context = ""
        if request.build_id:
            build = build_repository.get(request.build_id)
            if build:
                app_context = f"App: {build.file_name}, Package: {build.app_package}"

        prompt = get_appium_test_prompt(request.description, app_context)

        stream = ai_generator.client.chat.completions.create(
            model=ai_generator.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a mobile app test automation expert. Generate structured test cases for Appium execution. Return ONLY valid JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,
            max_tokens=4000,
            stream=True
        )

        # Accumulate streaming response
        raw_response = ""
        for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    raw_response += delta.content

        # Clean up response
        raw_response = raw_response.strip()
        if raw_response.startswith('```'):
            raw_response = raw_response.split('```')[1]
            if raw_response.startswith('json'):
                raw_response = raw_response[4:]
        raw_response = raw_response.strip()

        # Parse JSON
        test_case = json_module.loads(raw_response)

        # Ensure ID
        if 'id' not in test_case:
            test_case['id'] = f"TC{str(uuid.uuid4())[:8].upper()}"

        return {
            "success": True,
            "test_case": test_case,
            "message": "Test case generated successfully"
        }

    except json_module.JSONDecodeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse AI response: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate test case: {str(e)}"
        )


@app.post("/api/mobile-test/execute")
async def execute_mobile_test(
    request: MobileTestExecuteRequest,
    background_tasks: BackgroundTasks
):
    """
    Execute a structured test case on a mobile device via Appium.

    Args:
        request: Test case, build ID, and device ID

    Returns:
        dict: run_id for tracking execution status
    """
    try:
        # Validate build exists
        build = build_repository.get(request.build_id)
        if not build:
            raise HTTPException(status_code=404, detail="Build not found")

        # Validate device exists
        device_info = device_manager.get_device_info(request.device_id)
        if not device_info:
            raise HTTPException(status_code=404, detail="Device not found or offline")

        # Convert test case dict to TestCaseEntity
        tc_data = request.test_case
        tc_id = str(uuid.uuid4())

        test_case_entity = TestCaseEntity(
            tc_id=tc_id,
            prd_hash=hashlib.md5(f"manual_{datetime.now().isoformat()}".encode()).hexdigest(),
            title=tc_data.get('title', 'Manual Test'),
            description=tc_data.get('description', ''),
            preconditions=tc_data.get('preconditions', []),
            steps=[
                TestStep(
                    step_number=idx + 1,
                    description=step,
                    locator_override=None,
                    expected_element=None
                )
                for idx, step in enumerate(tc_data.get('steps', []))
            ],
            expected_result=tc_data.get('expected_result', ''),
            priority=Priority(tc_data.get('priority', 'Medium')),
            category=Category.FUNCTIONAL,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        # Save the test case
        test_case_repository.save(test_case_entity)

        # Create test run
        run_id = test_executor.create_test_run(
            build_id=request.build_id,
            test_case_ids=[tc_id],
            device_id=request.device_id
        )

        # Execute in background
        background_tasks.add_task(run_tests_in_background, run_id)

        return {
            "success": True,
            "run_id": run_id,
            "test_case_id": tc_id,
            "status": "running",
            "message": "Test execution started"
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute test: {str(e)}"
        )


@app.post("/api/mobile-test/generate-and-execute")
async def generate_and_execute_mobile_test(
    request: MobileTestRequest,
    background_tasks: BackgroundTasks
):
    """
    Generate test case from natural language and execute it immediately.

    Args:
        request: Natural language description, build ID, and device ID

    Returns:
        dict: Generated test case and run_id for tracking
    """
    # Validate required fields for execution
    if not request.build_id:
        raise HTTPException(status_code=400, detail="build_id is required for execution")
    if not request.device_id:
        raise HTTPException(status_code=400, detail="device_id is required for execution")

    # Generate the test case
    generation_result = await generate_mobile_test(request)

    if not generation_result.get("success"):
        return generation_result

    # Execute it
    execute_request = MobileTestExecuteRequest(
        test_case=generation_result["test_case"],
        build_id=request.build_id,
        device_id=request.device_id
    )
    execution_result = await execute_mobile_test(execute_request, background_tasks)

    return {
        "success": True,
        "test_case": generation_result["test_case"],
        "run_id": execution_result.get("run_id"),
        "test_case_id": execution_result.get("test_case_id"),
        "status": "running"
    }


@app.get("/api/mobile-test/status/{run_id}")
async def get_mobile_test_status(run_id: str):
    """
    Get the status of a running or completed mobile test.

    Args:
        run_id: Test run ID

    Returns:
        dict: Test run status and results
    """
    test_run = test_run_repository.get(run_id)
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Calculate summary
    total_steps = 0
    passed_steps = 0
    failed_steps = 0

    for result in test_run.results:
        for step_result in result.step_results:
            total_steps += 1
            if step_result.status.value == "pass":
                passed_steps += 1
            else:
                failed_steps += 1

    return {
        "run_id": run_id,
        "status": test_run.status.value,
        "started_at": test_run.started_at.isoformat() if test_run.started_at else None,
        "completed_at": test_run.completed_at.isoformat() if test_run.completed_at else None,
        "duration_seconds": test_run.duration_seconds,
        "summary": {
            "total_tests": len(test_run.results),
            "passed": sum(1 for r in test_run.results if r.status.value == "pass"),
            "failed": sum(1 for r in test_run.results if r.status.value == "fail"),
            "total_steps": total_steps,
            "passed_steps": passed_steps,
            "failed_steps": failed_steps
        },
        "results": [
            {
                "test_case_id": r.test_case_id,
                "status": r.status.value,
                "duration_ms": r.duration_ms,
                "error_message": r.error_message,
                "step_results": [
                    {
                        "step_number": sr.step_number,
                        "status": sr.status.value,
                        "duration_ms": sr.duration_ms,
                        "error_message": sr.error_message,
                        "appium_command": sr.appium_command
                    }
                    for sr in r.step_results
                ]
            }
            for r in test_run.results
        ]
    }


# ============================================================================
# Live Device Screen Endpoints
# ============================================================================

@app.get("/api/device/{device_id}/screenshot")
async def get_device_screenshot_adb(device_id: str):
    """
    Get live screenshot from device using ADB.

    Args:
        device_id: Device ID (e.g., emulator-5554)

    Returns:
        Base64 encoded PNG screenshot
    """
    import subprocess
    import base64
    import re

    # Validate device_id to prevent command injection
    if not re.match(r'^[a-zA-Z0-9_\-.:]+$', device_id):
        raise HTTPException(status_code=400, detail="Invalid device ID format")

    try:
        # Use adb to capture screenshot (using list to prevent shell injection)
        result = subprocess.run(
            ['adb', '-s', device_id, 'exec-out', 'screencap', '-p'],
            capture_output=True,
            timeout=10
        )

        if result.returncode == 0 and result.stdout:
            screenshot_base64 = base64.b64encode(result.stdout).decode('utf-8')
            return {
                "success": True,
                "device_id": device_id,
                "screenshot": screenshot_base64,
                "format": "png"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to capture screenshot")

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Screenshot capture timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screenshot error: {str(e)}")


@app.get("/api/test-runs/{run_id}/live-progress")
async def get_live_execution_progress(run_id: str):
    """
    Get real-time execution progress for a test run.

    Args:
        run_id: Test run ID

    Returns:
        Current step, logs, and status
    """
    test_run = test_run_repository.get(run_id)
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Get execution logs from shared module
    logs = get_execution_logs(run_id, limit=20)

    return {
        "run_id": run_id,
        "status": test_run.status.value,
        "current_test": getattr(test_run, 'current_test', None),
        "current_step": getattr(test_run, 'current_step', None),
        "logs": logs,
        "results_count": len(test_run.results)
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
