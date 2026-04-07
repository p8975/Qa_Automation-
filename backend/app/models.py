from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Tuple
from enum import Enum
from datetime import datetime


class Priority(str, Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Category(str, Enum):
    FUNCTIONAL = "Functional"
    UI = "UI"
    INTEGRATION = "Integration"
    SECURITY = "Security"
    PERFORMANCE = "Performance"
    EDGE_CASE = "Edge Case"
    ERROR_HANDLING = "Error Handling"


class TestCase(BaseModel):
    id: str
    title: str = Field(..., description="Clear, concise test case title")
    description: str = Field(..., description="Detailed description of what is being tested")
    preconditions: List[str] = Field(default_factory=list, description="Required setup before test")
    steps: List[str] = Field(..., description="Step-by-step test execution instructions")
    expected_result: str = Field(..., description="Expected outcome after executing steps")
    priority: Priority = Field(default=Priority.MEDIUM, description="Test case priority")
    category: Category = Field(default=Category.FUNCTIONAL, description="Test case category")


class TestCaseGenerationResponse(BaseModel):
    test_cases: List[TestCase]
    document_name: str
    total_count: int
    generation_time: float


class ErrorResponse(BaseModel):
    error: str
    detail: str


# ============================================================================
# Test Execution Engine Models
# ============================================================================

# Build Management Models

class BuildEntity(BaseModel):
    build_id: str = Field(..., description="UUID for the build")
    file_name: str = Field(..., description="Original APK filename")
    file_path: str = Field(..., description="Filesystem path to stored APK")
    app_package: str = Field(..., description="Android package name extracted from APK")
    app_version: str = Field(..., description="App version extracted from APK")
    uploaded_at: datetime = Field(..., description="Upload timestamp")
    file_size_bytes: int = Field(..., description="APK file size in bytes")
    md5_hash: str = Field(..., description="MD5 hash for duplicate detection")


# Test Case Persistence Models

class TestStep(BaseModel):
    step_number: int = Field(..., description="Step order in sequence")
    description: str = Field(..., description="Text description of step action")
    locator_override: Optional[str] = Field(None, description="Manual XPath/ID if AI fails")
    expected_element: Optional[str] = Field(None, description="Hint for AI translation")


class TestCaseEntity(BaseModel):
    tc_id: str = Field(..., description="UUID for test case")
    prd_hash: str = Field(..., description="Links to originating PRD document")
    title: str = Field(..., description="Test case title")
    description: str = Field(..., description="Test case description")
    preconditions: List[str] = Field(default_factory=list, description="Required setup")
    steps: List[TestStep] = Field(..., description="Enhanced steps with locator hints")
    expected_result: str = Field(..., description="Expected outcome")
    priority: Priority = Field(default=Priority.MEDIUM, description="Test priority")
    category: Category = Field(default=Category.FUNCTIONAL, description="Test category")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


# Test Execution Models

class TestRunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TestStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    ERROR = "error"
    SKIPPED = "skipped"


class StepStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    ERROR = "error"


class DeviceInfo(BaseModel):
    device_id: str = Field(..., description="ADB device ID")
    device_name: str = Field(..., description="Device model name")
    os_version: str = Field(..., description="Android OS version")
    is_emulator: bool = Field(..., description="True if emulator, False if physical")


class StepResult(BaseModel):
    step_number: int = Field(..., description="Step order in sequence")
    status: StepStatus = Field(..., description="Step execution status")
    duration_ms: int = Field(..., description="Step execution time in milliseconds")
    screenshot_path: Optional[str] = Field(None, description="Screenshot file path")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    appium_command: Optional[str] = Field(None, description="Actual Appium command executed")


class TestResult(BaseModel):
    test_case_id: str = Field(..., description="Reference to test case")
    status: TestStatus = Field(..., description="Overall test status")
    duration_ms: int = Field(..., description="Total test execution time")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    stack_trace: Optional[str] = Field(None, description="Full stack trace if error")
    screenshot_paths: List[str] = Field(default_factory=list, description="All screenshot paths")
    log_output: str = Field(..., description="Full Appium logs for this test")
    step_results: List[StepResult] = Field(default_factory=list, description="Per-step results")


class TestRunEntity(BaseModel):
    run_id: str = Field(..., description="UUID for test run")
    build_id: str = Field(..., description="Reference to BuildEntity")
    test_case_ids: List[str] = Field(..., description="Test cases in this run")
    device_info: DeviceInfo = Field(..., description="Device used for execution")
    status: TestRunStatus = Field(..., description="Run status")
    started_at: datetime = Field(..., description="Execution start time")
    completed_at: Optional[datetime] = Field(None, description="Execution end time")
    duration_seconds: Optional[float] = Field(None, description="Total run duration")
    results: List[TestResult] = Field(default_factory=list, description="All test results")


# Element Discovery Models

class ElementInfo(BaseModel):
    element_name: str = Field(..., description="Logical name like 'username_field'")
    locators: Dict[str, str] = Field(..., description="All locator strategies")
    coordinates: Optional[Tuple[int, int]] = Field(None, description="(x, y) fallback")
    verified: bool = Field(default=False, description="True if used successfully")


class ElementMap(BaseModel):
    build_id: str = Field(..., description="Reference to build")
    screen_name: str = Field(..., description="Screen identifier like 'login_screen'")
    elements: List[ElementInfo] = Field(default_factory=list, description="All elements on screen")
    last_updated: datetime = Field(..., description="Last update timestamp")


# Test Module Models (Test Suite/Group)

class TestModule(BaseModel):
    module_id: str = Field(..., description="UUID for the module")
    name: str = Field(..., description="Module name like 'Login Tests', 'Payment Flow'")
    description: Optional[str] = Field(None, description="Module description")
    test_case_ids: List[str] = Field(default_factory=list, description="Test cases in this module")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class CreateModuleRequest(BaseModel):
    name: str = Field(..., description="Module name")
    description: Optional[str] = Field(None, description="Module description")
    test_case_ids: List[str] = Field(default_factory=list, description="Initial test case IDs")


class UpdateModuleRequest(BaseModel):
    name: Optional[str] = Field(None, description="New module name")
    description: Optional[str] = Field(None, description="New description")
    test_case_ids: Optional[List[str]] = Field(None, description="Updated test case IDs")
