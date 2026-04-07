---
title: 'APK Test Execution Engine with AI-Powered Automation'
slug: 'apk-test-execution-engine'
created: '2026-03-10'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'Python 3.10+'
  - 'FastAPI 0.109.2'
  - 'Pydantic 2.6.1'
  - 'Next.js 14 (App Router)'
  - 'TypeScript 5'
  - 'React 19'
  - 'Tailwind CSS 4'
  - 'Appium (to be added)'
  - 'Appium Python Client (to be added)'
  - 'ADB (Android Debug Bridge)'
files_to_modify:
  - 'backend/app/main.py'
  - 'backend/app/models.py'
  - 'backend/requirements.txt'
  - 'frontend/lib/api.ts'
  - 'frontend/lib/types.ts'
  - 'frontend/package.json'
files_to_create:
  - 'backend/app/repositories/build_repository.py'
  - 'backend/app/repositories/test_case_repository.py'
  - 'backend/app/repositories/test_run_repository.py'
  - 'backend/app/repositories/element_map_repository.py'
  - 'backend/app/services/appium_service.py'
  - 'backend/app/services/device_manager.py'
  - 'backend/app/services/test_executor.py'
  - 'backend/app/services/ai_step_translator.py'
  - 'backend/app/services/build_service.py'
  - 'backend/app/utils/apk_parser.py'
  - 'backend/app/utils/scheduler.py'
  - 'backend/Dockerfile'
  - 'frontend/components/BuildUpload.tsx'
  - 'frontend/components/BuildList.tsx'
  - 'frontend/components/TestCaseLibrary.tsx'
  - 'frontend/components/ExecutionDashboard.tsx'
  - 'frontend/components/TestResults.tsx'
  - 'frontend/components/ElementInspector.tsx'
  - 'frontend/app/builds/page.tsx'
  - 'frontend/app/execution/page.tsx'
  - 'frontend/app/results/page.tsx'
code_patterns:
  - 'Service layer pattern for business logic'
  - 'Repository pattern for data access (NEW - to be implemented)'
  - 'Pydantic models for request/response validation'
  - 'FastAPI dependency injection for services'
  - 'React client components with "use client" directive'
  - 'useState/useCallback for state management'
  - 'API client singleton pattern with class-based structure'
  - 'Tailwind CSS utility classes for styling'
  - 'lucide-react for icons'
  - 'FormData for file uploads'
  - 'Error handling with HTTPException and status codes'
test_patterns:
  - 'No test infrastructure currently exists'
  - 'Will need pytest for backend unit tests'
  - 'Will need Jest/React Testing Library for frontend tests'
---

# Tech-Spec: APK Test Execution Engine with AI-Powered Automation

**Created:** 2026-03-10

## Overview

### Problem Statement

The QA Automation Platform currently generates test cases from PRD documents but lacks execution capability. QA teams need to upload Flutter APK builds and automatically run the generated test cases against them to validate functionality. Without execution, teams must manually perform each test step, which is time-consuming and reduces the value proposition of AI-generated test cases.

### Solution

Add a comprehensive test execution module that:
- Accepts Flutter APK uploads and stores them using filesystem-based storage
- Uses Appium for device automation supporting both Android emulator and physical devices via ADB
- Employs an AI agent to dynamically convert text-based test steps into executable Appium commands
- Provides element identification helpers for locating Flutter widgets using multiple locator strategies (accessibility ID, XPath, resource-id, text, content-desc, semantics, key-based)
- Executes tests on-demand with real automation against actual devices/emulators
- Captures results, logs, and screenshots for comprehensive reporting
- Provides basic scheduling capability for periodic/regression testing
- Uses service/repository abstraction layer for easy PostgreSQL migration in future

### Scope

**In Scope:**
- **Build Management:**
  - APK file upload endpoint with validation
  - Filesystem storage with `BuildRepository` abstraction
  - APK metadata extraction (package name, version)
  - Build listing and retrieval APIs
- **Test Case Persistence:**
  - Filesystem storage for generated test cases
  - Test case CRUD operations via `TestCaseRepository`
  - Link test cases to PRD document hash
  - Support for locator overrides on test steps
- **Appium Infrastructure:**
  - Docker container with Appium + Android SDK + ADB
  - Appium server lifecycle management (start/stop)
  - Connection abstraction for future Appium Grid support
- **AI-Powered Test Translation:**
  - AI agent to convert text steps → Appium commands
  - Hybrid element discovery (dynamic + cached)
  - Element map caching via `ElementMapRepository`
  - Manual locator override fallback mechanism
- **Element Identification:**
  - `/api/inspect-elements` endpoint for real-time discovery
  - Multiple locator strategies (accessibility ID, XPath, resource-id, text, semantics)
  - Flutter widget-specific locator utilities
- **Device Management:**
  - ADB integration for device detection
  - Support for Android emulator and physical devices
  - Single device execution for MVP
  - Device info capture (name, OS version, type)
- **Test Execution Engine:**
  - On-demand test execution (synchronous)
  - Per-step, per-test, per-run timeout handling
  - App reinstall between test cases (state isolation)
  - Real-time execution status tracking
  - Screenshot capture on failure and key steps
  - Full Appium log capture
- **Test Results:**
  - Comprehensive result schema with step-level granularity
  - Filesystem storage via `TestRunRepository`
  - Screenshot and log file management
  - Test run history per build
- **Scheduler:**
  - API-triggered scheduling via cron expressions
  - `POST /api/schedule-test-run` endpoint
  - Basic periodic/regression test support
- **Frontend UI Components:**
  - Build upload interface
  - Test case library viewer (persisted test cases)
  - Test selection for execution (individual or suite)
  - Execution dashboard with live status
  - Results viewer with logs, screenshots, and step details
  - Element inspector UI (for `/api/inspect-elements`)
- **Architecture:**
  - Repository pattern for all data access (Build, TestCase, TestRun, ElementMap)
  - Service layer abstraction (BuildService, ExecutionService, DeviceService)
  - Easy PostgreSQL migration path

**Out of Scope (Post-MVP):**
- iOS support and XCUITest integration
- Parallel multi-device execution
- PostgreSQL database implementation (filesystem for MVP)
- User authentication and multi-user workspace support
- Advanced CI/CD pipeline integrations (webhooks, Jenkins, GitHub Actions)
- Advanced test analytics and trend reporting dashboard
- Video recording of test execution
- Cloud device farm integration

## Context for Development

### Codebase Patterns

**Existing Platform Architecture:**
- Backend: FastAPI with Pydantic models for validation
- Frontend: Next.js 14 with TypeScript and Tailwind CSS
- API Pattern: RESTful with single responsibility endpoints
- Current endpoint: `POST /api/generate-test-cases` (document upload → test case generation)
- No database: In-memory state, client-side storage for results
- AI Integration: Uses STAGE Smart Router (not direct OpenAI) via custom API endpoint at env var `BASE_URL`
- File handling: Multipart form data with size validation (10MB limit)
- Error handling: HTTPException with status codes and detailed messages

**Backend Code Patterns (from investigation):**
- **Service Layer:** Business logic in `backend/app/services/` (e.g., `ai_generator.py`, `document_parser.py`)
- **Models:** Pydantic BaseModel classes in `backend/app/models.py` with Enum types
- **Utilities:** Helper functions in `backend/app/utils/` (e.g., `prompts.py`)
- **Dependency Injection:** Services initialized in `main.py`, injected into endpoints
- **Environment Config:** Uses `python-dotenv` with `.env` file for API keys
- **CORS:** Configured via `CORS_ORIGINS` env var (comma-separated)
- **Main Entry:** `if __name__ == "__main__":` runs uvicorn server on configurable port
- **No Repository Layer:** Direct file operations, no abstraction for data access yet

**Frontend Code Patterns (from investigation):**
- **Component Structure:** Reusable components in `components/` directory
- **Client Components:** All interactive components use `"use client"` directive
- **State Management:** React hooks (`useState`, `useCallback`) - no Redux
- **API Client:** Singleton class pattern in `lib/api.ts` with methods per endpoint
- **Type Safety:** TypeScript interfaces in `lib/types.ts` matching backend Pydantic models
- **Utilities:** Export/import helpers in `lib/utils.ts` (JSON, CSV export)
- **Styling:** Tailwind CSS utility classes, `cn()` helper for conditional classes
- **Icons:** `lucide-react` library for consistent icon set
- **Error Handling:** Try-catch with state-based error display
- **File Upload:** FormData API for multipart uploads

**Dependencies (Current):**

Backend (`requirements.txt`):
- fastapi==0.109.2
- uvicorn==0.27.1
- pydantic==2.6.1
- openai>=1.0.0
- PyPDF2==3.0.1
- python-docx==1.1.0
- markdown==3.5.2
- python-dotenv==1.0.1
- python-multipart==0.0.9

Frontend (`package.json`):
- next: 16.1.6
- react: 19.2.3
- typescript: ^5
- tailwindcss: ^4
- lucide-react: ^0.577.0
- class-variance-authority, clsx, tailwind-merge (utility libs)

**Technical Constraints:**
- Appium requires Flutter app to have accessibility identifiers exposed
- Flutter widgets may not be directly visible to Appium without proper semantics
- AI step-to-command translation needs context about app structure
- Device/emulator management requires ADB installed on backend server
- Test execution is synchronous initially (can block API during runs)
- No test infrastructure exists yet - will need pytest for backend, Jest for frontend
- No Docker setup exists yet - will need to create Dockerfile for Appium

### Files to Reference

| File | Purpose | Key Patterns to Follow |
| ---- | ------- | ---------------------- |
| `backend/app/main.py` | FastAPI app setup, CORS, existing endpoints pattern | Use same CORS config, HTTPException error handling, endpoint naming `/api/{resource}` |
| `backend/app/models.py` | Pydantic models for TestCase, Priority, Category schemas | Extend with new models (BuildEntity, TestRunEntity, etc.) using BaseModel, Enum types |
| `backend/app/services/document_parser.py` | Service pattern for document processing | Follow same class structure for new services (constructor injection, public methods) |
| `backend/app/services/ai_generator.py` | AI integration with STAGE Smart Router | Reuse for AI step translation, similar prompt engineering approach |
| `backend/app/utils/prompts.py` | AI prompt templates as string constants | Add new prompts for step-to-command translation |
| `backend/requirements.txt` | Python dependencies list | Add Appium, apk-parser, schedule libs |
| `frontend/lib/types.ts` | TypeScript interfaces matching backend models | Add BuildEntity, TestRunEntity, TestResult interfaces |
| `frontend/lib/api.ts` | API client singleton pattern | Extend APIClient class with new methods (uploadBuild, startExecution, etc.) |
| `frontend/lib/utils.ts` | Export utilities (JSON, CSV) | Follow same pattern for new utilities |
| `frontend/app/page.tsx` | Main UI with state management, file upload flow | Reference for state patterns, error handling, loading states |
| `frontend/components/DocumentUpload.tsx` | Drag-drop file upload component | Reuse pattern for BuildUpload component |
| `frontend/components/TestCaseTable.tsx` | Interactive table with expand/collapse | Reference for TestResults table component |

### Technical Decisions

**1. Appium vs Flutter Driver:**
- Decision: Use Appium
- Rationale: Supports both Android and iOS (future roadmap), industry standard, better device management

**2. Appium Deployment Strategy:**
- Decision: Docker container with Appium + Android SDK + ADB pre-installed
- Rationale: Eliminates complex manual setup, ensures consistent environment, simplifies deployment
- Implementation: Create Dockerfile with all dependencies, backend connects to containerized Appium server

**3. Test Step Translation:**
- Decision: AI-powered dynamic translation with manual override fallback
- Rationale: Enables automation without manual scripting, but provides escape hatch when AI fails
- Fallback: Allow users to provide explicit locators (XPath, accessibility ID) for critical steps

**4. AI Translation Context Strategy:**
- Decision: Hybrid approach - cache element locations from successful runs
- Rationale: Balances accuracy and performance, improves over time
- Implementation: First run does dynamic discovery, subsequent runs use cached element map

**5. Storage Strategy with Explicit Repository Interfaces:**
- Decision: Filesystem for MVP with repository pattern abstraction
- Rationale: Fast MVP, easy PostgreSQL migration later
- **Repository Contracts:**
  - `BuildRepository`: `save(apk_file) → build_id`, `get(build_id) → BuildEntity`, `list() → List[BuildEntity]`
  - `TestCaseRepository`: `save(test_case) → tc_id`, `get(tc_id) → TestCaseEntity`, `list() → List[TestCaseEntity]`
  - `TestRunRepository`: `save(test_run) → run_id`, `get(run_id) → TestRunEntity`, `list_by_build(build_id) → List[TestRunEntity]`
  - `ElementMapRepository`: `save(build_id, element_map) → void`, `get(build_id) → ElementMap`

**6. Test Case Persistence:**
- Decision: Store test cases in filesystem as JSON files, linked to PRD document hash
- Rationale: Enables test case reuse across sessions, supports edit workflow
- Storage: `{storage_root}/test-cases/{prd_hash}/test_case_{id}.json`
- Linkage: Test cases reference builds by `build_id` during execution

**7. Execution Model:**
- Decision: On-demand synchronous with API-triggered scheduler
- Rationale: Simple for MVP, supports manual and scheduled runs
- Scheduler: Cron-style scheduling via `POST /api/schedule-test-run` with cron expression

**8. Execution Timeout Strategy:**
- Decision: Multi-level timeouts to prevent hangs
- Per-step timeout: 30 seconds
- Per-test-case timeout: 5 minutes
- Per-test-run timeout: 30 minutes
- Rationale: Ensures system remains responsive even if tests hang

**9. Device State Management:**
- Decision: Reinstall app between test cases (fresh install per test)
- Rationale: Maximum test isolation, prevents state pollution between tests
- Trade-off: Slower execution, but more reliable results for MVP

**10. Scope Limitations:**
- Decision: Android-only, single device
- Rationale: Reduces complexity, validates concept faster, can expand after MVP validation

**11. Element Identification:**
- Decision: Build `/api/inspect-elements` endpoint for real-time element discovery
- Rationale: Helps with test creation and debugging, supports multiple locator strategies
- Returns: All possible locators (accessibility ID, XPath, resource-id, text, etc.) for given screen/coordinates

### Data Models & Schemas

**BuildEntity (APK Build):**
```python
class BuildEntity(BaseModel):
    build_id: str  # UUID
    file_name: str
    file_path: str  # Filesystem path
    app_package: str  # Extracted from APK
    app_version: str  # Extracted from APK
    uploaded_at: datetime
    file_size_bytes: int
    md5_hash: str  # For duplicate detection
```

**TestCaseEntity (Persisted Test Case):**
```python
class TestCaseEntity(BaseModel):
    tc_id: str  # UUID
    prd_hash: str  # Links to originating PRD
    title: str
    description: str
    preconditions: List[str]
    steps: List[TestStep]  # Enhanced with locator hints
    expected_result: str
    priority: Priority
    category: Category
    created_at: datetime
    updated_at: datetime

class TestStep(BaseModel):
    step_number: int
    description: str  # "Enter username in login field"
    locator_override: Optional[str]  # Manual XPath/ID if AI fails
    expected_element: Optional[str]  # Hint for AI translation
```

**TestRunEntity (Execution Record):**
```python
class TestRunEntity(BaseModel):
    run_id: str  # UUID
    build_id: str  # Links to BuildEntity
    test_case_ids: List[str]  # Test cases in this run
    device_info: DeviceInfo
    status: TestRunStatus  # queued, running, completed, failed
    started_at: datetime
    completed_at: Optional[datetime]
    duration_seconds: Optional[float]
    results: List[TestResult]

class DeviceInfo(BaseModel):
    device_id: str  # ADB device ID
    device_name: str
    os_version: str
    is_emulator: bool
```

**TestResult (Individual Test Outcome):**
```python
class TestResult(BaseModel):
    test_case_id: str
    status: TestStatus  # pass, fail, error, skipped
    duration_ms: int
    error_message: Optional[str]
    stack_trace: Optional[str]
    screenshot_paths: List[str]  # Filesystem paths
    log_output: str  # Full Appium logs for this test
    step_results: List[StepResult]

class StepResult(BaseModel):
    step_number: int
    status: StepStatus  # pass, fail, error
    duration_ms: int
    screenshot_path: Optional[str]
    error_message: Optional[str]
    appium_command: str  # The actual command executed
```

**ElementMap (Cached Element Locations):**
```python
class ElementMap(BaseModel):
    build_id: str
    screen_name: str  # e.g., "login_screen", "dashboard"
    elements: List[ElementInfo]
    last_updated: datetime

class ElementInfo(BaseModel):
    element_name: str  # Logical name: "username_field"
    locators: Dict[str, str]  # {"accessibility_id": "username", "xpath": "//input[@type='text'][1]"}
    coordinates: Optional[Tuple[int, int]]  # (x, y) fallback
    verified: bool  # True if used successfully in test run
```

**Enums:**
```python
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
```

### API Endpoints

**Build Management:**
- `POST /api/builds/upload` - Upload APK file, returns `build_id`
- `GET /api/builds` - List all uploaded builds
- `GET /api/builds/{build_id}` - Get build details
- `DELETE /api/builds/{build_id}` - Delete build and associated data

**Test Case Management:**
- `POST /api/test-cases` - Save test case (from generation or manual creation)
- `GET /api/test-cases` - List all test cases (optionally filter by PRD hash)
- `GET /api/test-cases/{tc_id}` - Get test case details
- `PUT /api/test-cases/{tc_id}` - Update test case (edit steps, add locator overrides)
- `DELETE /api/test-cases/{tc_id}` - Delete test case

**Device Management:**
- `GET /api/devices` - List available devices (emulators + physical via ADB)
- `GET /api/devices/{device_id}` - Get device details and status

**Test Execution:**
- `POST /api/test-runs` - Start test execution
  - Request: `{ build_id, test_case_ids[], device_id }`
  - Response: `{ run_id, status: "running" }`
- `GET /api/test-runs/{run_id}` - Get test run status and results
- `GET /api/test-runs/{run_id}/logs` - Stream/download full logs
- `POST /api/test-runs/{run_id}/cancel` - Cancel running test
- `GET /api/builds/{build_id}/test-runs` - List all test runs for a build

**Scheduler:**
- `POST /api/schedules` - Create scheduled test run
  - Request: `{ build_id, test_case_ids[], device_id, cron_expression }`
  - Response: `{ schedule_id }`
- `GET /api/schedules` - List all schedules
- `DELETE /api/schedules/{schedule_id}` - Remove schedule

**Element Inspection:**
- `POST /api/inspect-elements` - Inspect elements on current screen
  - Request: `{ build_id, device_id, screen_coordinates?: {x, y} }`
  - Response: `{ elements: [{ name, locators: {...}, coordinates }] }`

**Existing (for reference):**
- `POST /api/generate-test-cases` - Generate test cases from PRD (already exists)

### Appium Integration Architecture

**Docker Setup:**
```dockerfile
# Base image with Appium + Android SDK
FROM appium/appium:latest

# Install Android SDK components
RUN sdkmanager "platform-tools" "platforms;android-30" "build-tools;30.0.3"

# Expose Appium port
EXPOSE 4723

# Start Appium server
CMD ["appium", "--address", "0.0.0.0", "--port", "4723"]
```

**Backend Connection:**
- Backend connects to Appium server via HTTP (default: `http://localhost:4723`)
- Uses `appium-python-client` library
- Connection pool for multiple test runs (future: parallel execution)

**Appium Desired Capabilities:**
```python
capabilities = {
    "platformName": "Android",
    "automationName": "UiAutomator2",  # Flutter support
    "deviceName": device_id,
    "app": apk_file_path,
    "noReset": False,  # Fresh install per test
    "fullReset": True,  # Clear app data
    "newCommandTimeout": 300,  # 5 min timeout
    "uiautomator2ServerInstallTimeout": 60000,
}
```

**Element Location Strategies (Priority Order):**
1. Accessibility ID (Flutter `semantics` or `key` property)
2. Resource ID (Android native)
3. XPath (last resort, fragile)
4. Text match (if unique)
5. Content description (Android accessibility)

**AI Translation Examples:**
| Text Step | Appium Command |
| --------- | -------------- |
| "Tap login button" | `driver.find_element(AppiumBy.ACCESSIBILITY_ID, "login_button").click()` |
| "Enter 'john@example.com' in email field" | `driver.find_element(AppiumBy.ACCESSIBILITY_ID, "email_field").send_keys("john@example.com")` |
| "Verify dashboard is displayed" | `assert driver.find_element(AppiumBy.ACCESSIBILITY_ID, "dashboard_screen").is_displayed()` |
| "Swipe left on carousel" | `driver.swipe(start_x=300, start_y=500, end_x=100, end_y=500, duration=800)` |

**AI Translation Prompt Template:**
```
You are an Appium automation expert. Convert this test step into executable Appium Python code.

Context:
- App package: {app_package}
- Known elements: {element_map}
- Previous step results: {previous_context}

Test Step: "{step_description}"

Generate Appium code using appium-python-client syntax. Prefer accessibility IDs over XPath. Include waits and error handling.

Output format: Single line of Python code that can be executed directly.
```

## Implementation Plan

### Tasks

**Phase 1: Foundation - Data Models & Storage (Days 1-2)**

- [ ] Task 1.1: Extend backend Pydantic models
  - File: `backend/app/models.py`
  - Action: Add `BuildEntity`, `TestCaseEntity`, `TestRunEntity`, `TestResult`, `DeviceInfo`, `ElementMap`, `TestStep`, `StepResult` models
  - Action: Add enums: `TestRunStatus`, `TestStatus`, `StepStatus`
  - Notes: Follow existing pattern with BaseModel, Field descriptors, Enum inheritance

- [ ] Task 1.2: Create repository base interface
  - File: `backend/app/repositories/__init__.py` (NEW)
  - Action: Create abstract base class `BaseRepository` with CRUD methods
  - Notes: Define interface for future PostgreSQL migration

- [ ] Task 1.3: Implement BuildRepository
  - File: `backend/app/repositories/build_repository.py` (NEW)
  - Action: Implement filesystem storage for APK files and metadata
  - Action: Methods: `save(apk_file) → build_id`, `get(build_id)`, `list()`, `delete(build_id)`
  - Notes: Store APKs in `{storage_root}/builds/{build_id}/`, metadata as JSON

- [ ] Task 1.4: Implement TestCaseRepository
  - File: `backend/app/repositories/test_case_repository.py` (NEW)
  - Action: Implement filesystem storage for test cases
  - Action: Methods: `save(test_case)`, `get(tc_id)`, `list(prd_hash?)`, `update(tc_id, updates)`, `delete(tc_id)`
  - Notes: Store in `{storage_root}/test-cases/{prd_hash}/{tc_id}.json`

- [ ] Task 1.5: Implement TestRunRepository
  - File: `backend/app/repositories/test_run_repository.py` (NEW)
  - Action: Implement filesystem storage for test runs and results
  - Action: Methods: `save(test_run)`, `get(run_id)`, `list_by_build(build_id)`, `update_status(run_id, status)`
  - Notes: Store in `{storage_root}/test-runs/{run_id}/`, include screenshots and logs

- [ ] Task 1.6: Implement ElementMapRepository
  - File: `backend/app/repositories/element_map_repository.py` (NEW)
  - Action: Implement caching for discovered element locations
  - Action: Methods: `save(build_id, element_map)`, `get(build_id)`, `update(build_id, screen_name, elements)`
  - Notes: Store in `{storage_root}/element-maps/{build_id}.json`

**Phase 2: Appium Infrastructure (Days 3-4)**

- [ ] Task 2.1: Create Dockerfile for Appium
  - File: `backend/Dockerfile` (NEW)
  - Action: Base on `appium/appium:latest`, install Android SDK, platform-tools, build-tools
  - Action: Expose port 4723, set CMD to start Appium server
  - Notes: Include ADB and necessary emulator components

- [ ] Task 2.2: Implement AppiumService
  - File: `backend/app/services/appium_service.py` (NEW)
  - Action: Create service to manage Appium connection and WebDriver lifecycle
  - Action: Methods: `connect(device_id)`, `disconnect()`, `create_session(capabilities)`, `end_session()`
  - Notes: Use `appium-python-client`, handle connection pooling

- [ ] Task 2.3: Implement DeviceManager
  - File: `backend/app/services/device_manager.py` (NEW)
  - Action: Create service to detect and manage devices via ADB
  - Action: Methods: `list_devices()`, `get_device_info(device_id)`, `is_emulator(device_id)`, `install_apk(device_id, apk_path)`
  - Action: Use subprocess to call ADB commands
  - Notes: Parse ADB output for device list, handle emulator vs physical device detection

- [ ] Task 2.4: Update requirements.txt with Appium dependencies
  - File: `backend/requirements.txt`
  - Action: Add `Appium-Python-Client>=3.0.0`, `py-apk-parser>=0.3.0`, `schedule>=1.2.0`
  - Notes: Pin versions for stability

**Phase 3: Build Management (Day 5)**

- [ ] Task 3.1: Create APK parser utility
  - File: `backend/app/utils/apk_parser.py` (NEW)
  - Action: Extract package name, version, app name from APK
  - Action: Function: `parse_apk(apk_path) → dict[package, version, app_name]`
  - Notes: Use `py-apk-parser` library

- [ ] Task 3.2: Implement BuildService
  - File: `backend/app/services/build_service.py` (NEW)
  - Action: Business logic for build upload, validation, storage
  - Action: Methods: `upload_build(file, filename)`, `get_build(build_id)`, `list_builds()`, `delete_build(build_id)`
  - Notes: Inject BuildRepository, call apk_parser for metadata extraction

- [ ] Task 3.3: Add build management API endpoints
  - File: `backend/app/main.py`
  - Action: Add `POST /api/builds/upload`, `GET /api/builds`, `GET /api/builds/{build_id}`, `DELETE /api/builds/{build_id}`
  - Action: Inject BuildService, handle multipart file upload, return build_id
  - Notes: Follow existing endpoint pattern with HTTPException error handling

**Phase 4: Test Case Persistence (Day 5)**

- [ ] Task 4.1: Update test case generation endpoint
  - File: `backend/app/main.py`
  - Action: Modify `POST /api/generate-test-cases` to optionally save test cases via TestCaseRepository
  - Action: Calculate PRD hash, store test cases with prd_hash link
  - Notes: Maintain backward compatibility, make persistence optional via query param

- [ ] Task 4.2: Add test case CRUD API endpoints
  - File: `backend/app/main.py`
  - Action: Add `POST /api/test-cases`, `GET /api/test-cases`, `GET /api/test-cases/{tc_id}`, `PUT /api/test-cases/{tc_id}`, `DELETE /api/test-cases/{tc_id}`
  - Action: Support query param `prd_hash` for filtering
  - Notes: Inject TestCaseRepository

**Phase 5: AI Step Translation (Days 6-7)**

- [ ] Task 5.1: Create AI step translator service
  - File: `backend/app/services/ai_step_translator.py` (NEW)
  - Action: Convert text test steps into executable Appium Python commands
  - Action: Methods: `translate_step(step_description, context) → appium_command`, `build_context(element_map, previous_steps)`
  - Notes: Reuse AITestCaseGenerator pattern, use STAGE Smart Router, similar to ai_generator.py

- [ ] Task 5.2: Add step translation prompts
  - File: `backend/app/utils/prompts.py`
  - Action: Add `STEP_TO_COMMAND_PROMPT` template with examples
  - Notes: Include Appium syntax, locator strategies, wait handling

- [ ] Task 5.3: Implement element inspection endpoint
  - File: `backend/app/main.py`
  - Action: Add `POST /api/inspect-elements` endpoint
  - Action: Take build_id, device_id, optional coordinates, return all possible locators for elements on screen
  - Notes: Use Appium page_source, parse for accessibility IDs, resource IDs, XPath, text

**Phase 6: Test Execution Engine (Days 8-10)**

- [ ] Task 6.1: Implement TestExecutor service
  - File: `backend/app/services/test_executor.py` (NEW)
  - Action: Main execution engine coordinating device, Appium, AI translation, result capture
  - Action: Methods: `execute_test_run(build_id, test_case_ids, device_id)`, `execute_single_test(test_case, driver)`, `capture_screenshot(driver, step_num)`
  - Action: Implement timeout handling (per-step: 30s, per-test: 5min, per-run: 30min)
  - Action: Implement app reinstall between test cases
  - Notes: Inject DeviceManager, AppiumService, AIStepTranslator, ElementMapRepository, TestRunRepository

- [ ] Task 6.2: Implement scheduler utility
  - File: `backend/app/utils/scheduler.py` (NEW)
  - Action: Basic cron-style scheduler for periodic test runs
  - Action: Functions: `schedule_test_run(build_id, test_case_ids, device_id, cron_expression)`, `list_schedules()`, `cancel_schedule(schedule_id)`
  - Notes: Use `schedule` library, run in background thread

- [ ] Task 6.3: Add test execution API endpoints
  - File: `backend/app/main.py`
  - Action: Add `POST /api/test-runs` (start execution), `GET /api/test-runs/{run_id}`, `GET /api/test-runs/{run_id}/logs`, `POST /api/test-runs/{run_id}/cancel`
  - Action: Add `GET /api/builds/{build_id}/test-runs`
  - Notes: Inject TestExecutor, handle async execution status

- [ ] Task 6.4: Add device management API endpoints
  - File: `backend/app/main.py`
  - Action: Add `GET /api/devices`, `GET /api/devices/{device_id}`
  - Notes: Inject DeviceManager

- [ ] Task 6.5: Add scheduler API endpoints
  - File: `backend/app/main.py`
  - Action: Add `POST /api/schedules`, `GET /api/schedules`, `DELETE /api/schedules/{schedule_id}`
  - Notes: Inject scheduler utility

**Phase 7: Frontend TypeScript Types (Day 11)**

- [ ] Task 7.1: Add execution-related TypeScript interfaces
  - File: `frontend/lib/types.ts`
  - Action: Add `BuildEntity`, `TestRunEntity`, `TestResult`, `DeviceInfo`, `ElementMap`, `TestStep`, `StepResult` interfaces
  - Action: Add `TestRunStatus`, `TestStatus`, `StepStatus` types
  - Notes: Match backend Pydantic models exactly

**Phase 8: Frontend API Client (Day 11)**

- [ ] Task 8.1: Extend API client with build management methods
  - File: `frontend/lib/api.ts`
  - Action: Add methods: `uploadBuild(file)`, `getBuilds()`, `getBuild(buildId)`, `deleteBuild(buildId)`
  - Notes: Follow existing pattern with FormData for file upload

- [ ] Task 8.2: Extend API client with test case methods
  - File: `frontend/lib/api.ts`
  - Action: Add methods: `saveTestCase(testCase)`, `getTestCases(prdHash?)`, `getTestCase(tcId)`, `updateTestCase(tcId, updates)`, `deleteTestCase(tcId)`

- [ ] Task 8.3: Extend API client with execution methods
  - File: `frontend/lib/api.ts`
  - Action: Add methods: `startTestRun(buildId, testCaseIds, deviceId)`, `getTestRun(runId)`, `getTestRunLogs(runId)`, `cancelTestRun(runId)`, `getDevices()`, `inspectElements(buildId, deviceId, coords?)`

- [ ] Task 8.4: Extend API client with scheduler methods
  - File: `frontend/lib/api.ts`
  - Action: Add methods: `scheduleTestRun(schedule)`, `getSchedules()`, `deleteSchedule(scheduleId)`

**Phase 9: Frontend Components (Days 12-13)**

- [ ] Task 9.1: Create BuildUpload component
  - File: `frontend/components/BuildUpload.tsx` (NEW)
  - Action: Reuse DocumentUpload pattern, accept APK files only
  - Action: Props: `onFileSelect(file)`, `disabled?`
  - Notes: Add file type validation for .apk

- [ ] Task 9.2: Create BuildList component
  - File: `frontend/components/BuildList.tsx` (NEW)
  - Action: Display table of uploaded builds with metadata (package, version, upload date)
  - Action: Actions: Select for execution, Delete, View test runs
  - Notes: Use lucide-react icons, Tailwind styling

- [ ] Task 9.3: Create TestCaseLibrary component
  - File: `frontend/components/TestCaseLibrary.tsx` (NEW)
  - Action: Display saved test cases with checkbox selection
  - Action: Support filtering by PRD, inline editing, locator override UI
  - Notes: Similar to TestCaseTable but with selection checkboxes

- [ ] Task 9.4: Create ExecutionDashboard component
  - File: `frontend/components/ExecutionDashboard.tsx` (NEW)
  - Action: Real-time execution status display with progress bar
  - Action: Show running test case, current step, device info
  - Action: Display live logs stream
  - Notes: Poll `/api/test-runs/{run_id}` for status updates

- [ ] Task 9.5: Create TestResults component
  - File: `frontend/components/TestResults.tsx` (NEW)
  - Action: Display test run results with pass/fail status, screenshots, logs
  - Action: Expandable step-level details with screenshots
  - Action: Export results to JSON/CSV
  - Notes: Reuse TestCaseTable expand/collapse pattern

- [ ] Task 9.6: Create ElementInspector component
  - File: `frontend/components/ElementInspector.tsx` (NEW)
  - Action: Display discovered elements with all locator options
  - Action: Allow copy-paste locators for manual override
  - Notes: Use code syntax highlighting for locators

**Phase 10: Frontend Pages (Days 14-15)**

- [ ] Task 10.1: Create Builds page
  - File: `frontend/app/builds/page.tsx` (NEW)
  - Action: Upload interface + BuildList display
  - Action: State management for builds, upload progress, errors
  - Notes: Follow existing page.tsx pattern with useState/useCallback

- [ ] Task 10.2: Create Execution page
  - File: `frontend/app/execution/page.tsx` (NEW)
  - Action: Build selection + Test case selection + Device selection + Run button
  - Action: ExecutionDashboard for live status
  - Notes: Multi-step flow with state transitions

- [ ] Task 10.3: Create Results page
  - File: `frontend/app/results/page.tsx` (NEW)
  - Action: List of test runs per build + TestResults component
  - Action: Filtering and search
  - Notes: Support deep linking to specific run_id

- [ ] Task 10.4: Update main page navigation
  - File: `frontend/app/page.tsx`
  - Action: Add navigation links to /builds, /execution, /results
  - Action: Update header with tabs or nav menu
  - Notes: Maintain existing test case generation flow

**Phase 11: Integration & Testing (Days 16-17)**

- [ ] Task 11.1: Add backend unit tests
  - File: `backend/tests/test_repositories.py` (NEW)
  - Action: Test all repository CRUD operations
  - Notes: Use pytest, mock filesystem

- [ ] Task 11.2: Add backend integration tests
  - File: `backend/tests/test_execution_flow.py` (NEW)
  - Action: End-to-end test of upload → execution → results flow
  - Notes: Use pytest, mock Appium responses

- [ ] Task 11.3: Add frontend component tests
  - File: `frontend/components/__tests__/` (NEW)
  - Action: Test each component with React Testing Library
  - Notes: Mock API client

- [ ] Task 11.4: Manual end-to-end testing
  - Action: Test complete flow with real APK and emulator
  - Action: Verify AI translation quality, screenshot capture, result accuracy
  - Notes: Document issues in GitHub/Jira

- [ ] Task 11.5: Create deployment documentation
  - File: `EXECUTION_ENGINE_SETUP.md` (NEW)
  - Action: Document Docker setup, ADB installation, environment variables
  - Action: Provide troubleshooting guide
  - Notes: Include Appium server configuration

### Acceptance Criteria

**Build Management:**

- [ ] AC1: Given a valid APK file, when user uploads via `/api/builds/upload`, then build_id is returned and file is stored in filesystem
- [ ] AC2: Given an APK file exceeds 50MB, when user attempts upload, then HTTP 400 error is returned with size limit message
- [ ] AC3: Given a non-APK file, when user attempts upload, then HTTP 400 error is returned with invalid file type message
- [ ] AC4: Given builds exist, when user calls `/api/builds`, then all builds with metadata (package, version, upload date) are returned
- [ ] AC5: Given a build_id, when user calls `/api/builds/{build_id}`, then build details are returned
- [ ] AC6: Given a build_id, when user calls `DELETE /api/builds/{build_id}`, then build files and metadata are deleted from filesystem

**Test Case Persistence:**

- [ ] AC7: Given a generated test case, when user saves via `/api/test-cases`, then test case is stored with unique tc_id and linked to prd_hash
- [ ] AC8: Given test cases exist, when user calls `/api/test-cases`, then all test cases are returned
- [ ] AC9: Given a prd_hash filter, when user calls `/api/test-cases?prd_hash={hash}`, then only test cases for that PRD are returned
- [ ] AC10: Given a test case, when user updates with locator override, then updated test case is saved with manual locator preserved
- [ ] AC11: Given a tc_id, when user deletes test case, then test case file is removed from filesystem

**Device Management:**

- [ ] AC12: Given ADB is running and devices connected, when user calls `/api/devices`, then all emulators and physical devices are listed with device_id, name, OS version
- [ ] AC13: Given no devices connected, when user calls `/api/devices`, then empty array is returned
- [ ] AC14: Given a device_id, when user calls `/api/devices/{device_id}`, then device details including is_emulator flag are returned

**Test Execution:**

- [ ] AC15: Given a build_id, test_case_ids, and device_id, when user calls `POST /api/test-runs`, then test execution starts and run_id is returned with status "running"
- [ ] AC16: Given a test run in progress, when user calls `/api/test-runs/{run_id}`, then current status, completed test count, and results so far are returned
- [ ] AC17: Given a test step timeout (>30s), when step execution hangs, then step is marked as "error" and next step continues
- [ ] AC18: Given a test case completes, when app is not reinstalled before next test, then test isolation is verified
- [ ] AC19: Given a test fails, when failure occurs, then screenshot is captured and saved to filesystem with error message in result
- [ ] AC20: Given all tests complete, when user retrieves results, then pass/fail status, duration, screenshots, and full logs are available
- [ ] AC21: Given a running test, when user calls `POST /api/test-runs/{run_id}/cancel`, then execution stops and status changes to "cancelled"

**AI Step Translation:**

- [ ] AC22: Given a test step "Tap login button", when AI translates, then Appium command uses accessibility ID locator strategy
- [ ] AC23: Given element not found via AI locator, when user provides manual XPath override, then manual locator is used in execution
- [ ] AC24: Given element found and cached, when same test runs again, then cached locator is used without re-discovery
- [ ] AC25: Given screen coordinates, when user calls `/api/inspect-elements`, then all elements at that location with all locator strategies are returned

**Scheduler:**

- [ ] AC26: Given a cron expression, when user schedules test run via `/api/schedules`, then schedule_id is returned and test executes at specified times
- [ ] AC27: Given a schedule_id, when user deletes schedule, then future executions are cancelled

**Frontend:**

- [ ] AC28: Given Builds page, when user uploads APK, then upload progress is shown and build appears in list after completion
- [ ] AC29: Given Execution page, when user selects build + test cases + device and clicks Run, then execution starts and dashboard shows live status
- [ ] AC30: Given test run completes, when user views Results page, then pass/fail summary, screenshots, and logs are displayed
- [ ] AC31: Given element inspector, when user inspects screen, then all locators are shown and copyable for manual override

**Error Handling:**

- [ ] AC32: Given Appium server is down, when execution starts, then HTTP 503 error is returned with "Appium unavailable" message
- [ ] AC33: Given device disconnects mid-execution, when test runs, then execution fails gracefully with "device disconnected" error
- [ ] AC34: Given AI translation fails, when step cannot be translated, then step is marked as "error" with message "AI translation failed - manual locator required"

## Additional Context

### Dependencies

**External Libraries (Backend):**
- `Appium-Python-Client>=3.0.0` - WebDriver client for Appium server
- `py-apk-parser>=0.3.0` - Extract metadata from APK files
- `schedule>=1.2.0` - Cron-style job scheduling
- `pytest>=7.0.0` - Testing framework (dev dependency)
- `pytest-mock>=3.10.0` - Mocking for tests (dev dependency)

**External Libraries (Frontend):**
- `react-syntax-highlighter` - Code display for locators in element inspector
- `date-fns` - Date formatting for timestamps
- `@testing-library/react` - Component testing (dev dependency)
- `@testing-library/jest-dom` - Jest matchers (dev dependency)

**System Dependencies:**
- **ADB (Android Debug Bridge)** - Required on backend server for device communication
- **Android SDK Platform Tools** - Required for emulator support
- **Docker** - For containerized Appium server
- **Emulator or Physical Device** - At least one Android device for testing

**Service Dependencies:**
- **STAGE Smart Router** - Existing AI service for step translation (already configured)
- **Appium Server** - Running on port 4723 (managed via Docker)

**Task Dependencies:**
- Phase 1 (Foundation) must complete before all other phases
- Phase 2 (Appium Infrastructure) must complete before Phase 6 (Execution Engine)
- Phase 3 (Build Management) must complete before Phase 6 (Execution Engine)
- Phase 4 (Test Case Persistence) must complete before Phase 6 (Execution Engine)
- Phase 5 (AI Translation) must complete before Phase 6 (Execution Engine)
- Phase 7-8 (Frontend Types/API) must complete before Phase 9-10 (Components/Pages)

### Testing Strategy

**Unit Tests (Backend):**
- **Repositories:** Test CRUD operations with mocked filesystem
  - Mock `open()`, `json.dump()`, `json.load()` for file operations
  - Verify correct file paths, data serialization, error handling
- **Services:** Test business logic with mocked dependencies
  - Mock AppiumService, DeviceManager, repositories
  - Verify method calls, error propagation, timeout handling
- **Utilities:** Test pure functions (apk_parser, scheduler)
  - Use sample APK files, verify extracted metadata
  - Test cron parsing and scheduling logic
- **Framework:** pytest with pytest-mock
- **Coverage Target:** 80%+ for services and repositories

**Integration Tests (Backend):**
- **API Endpoints:** Test HTTP request/response cycle
  - Use FastAPI TestClient
  - Mock external services (Appium, AI)
  - Verify status codes, response schemas, error messages
- **Execution Flow:** End-to-end test from upload to results
  - Mock Appium driver responses
  - Verify test run state transitions
  - Check result capture and storage

**Unit Tests (Frontend):**
- **Components:** Test rendering and user interactions
  - Use React Testing Library
  - Mock API client methods
  - Verify state updates, error display, loading states
- **API Client:** Test request formatting and error handling
  - Mock fetch() responses
  - Verify FormData construction, error parsing
- **Framework:** Jest with React Testing Library
- **Coverage Target:** 70%+ for components and utilities

**Manual Testing:**
- **Prerequisites:** Real Android emulator or device, sample Flutter APK
- **Test Scenarios:**
  1. Upload APK and verify metadata extraction
  2. Generate test cases from sample PRD
  3. Save test cases and verify persistence
  4. Start test execution and monitor live dashboard
  5. Verify screenshots captured on failure
  6. Check test results with logs and screenshots
  7. Test AI translation with various step descriptions
  8. Test element inspector with sample screens
  9. Schedule periodic test run and verify execution
  10. Test error scenarios (device disconnect, Appium failure, timeout)
- **Documentation:** Record results in test report, capture screenshots

**Performance Testing:**
- Verify test execution completes within timeout limits (30s/step, 5min/test, 30min/run)
- Monitor filesystem storage growth with multiple builds
- Check memory usage during long test runs

### Notes

**Project Context:**
- Current platform location: `/Users/prakashkumar/qa-automation-platform/`
- Working directory: `/Users/prakashkumar/StudioProjects/flutter_app/` (BMAD running from Flutter project)
- Platform is not a git repository (baseline_commit: NO_GIT)
- Existing docs provide good reference: PROJECT_STATUS.md, HANDOFF.md, SHIP_IT.md

**High-Risk Items (Pre-Mortem):**

1. **Appium Element Discovery for Flutter Apps**
   - **Risk:** Flutter widgets may not expose accessibility IDs consistently
   - **Mitigation:** Implement multiple locator fallback strategies, provide manual override mechanism
   - **Contingency:** Document Flutter app requirements for test-friendly semantics

2. **AI Translation Accuracy**
   - **Risk:** AI may generate incorrect Appium commands for ambiguous steps
   - **Mitigation:** Cache successful translations, allow manual overrides, provide element inspector
   - **Contingency:** If accuracy <70%, pivot to template-based translation with AI assist

3. **Test Execution Stability**
   - **Risk:** Mobile tests are inherently flaky (timing issues, animations, network)
   - **Mitigation:** Implement generous timeouts, retry logic, explicit waits in Appium commands
   - **Contingency:** Add configurable retry count and smart waiting strategies

4. **Device Management Complexity**
   - **Risk:** ADB device detection can be unreliable, emulators may crash
   - **Mitigation:** Implement health checks, automatic reconnection, clear error messages
   - **Contingency:** Start with single emulator support, add multi-device later

5. **Filesystem Storage Scalability**
   - **Risk:** Large APKs, screenshots, logs will consume disk space quickly
   - **Mitigation:** Implement cleanup policies (delete old runs after 30 days), file size limits
   - **Contingency:** Migrate to cloud storage (S3) if local storage insufficient

6. **Docker Appium Server Setup**
   - **Risk:** Complex setup with Android SDK, ADB, emulator in container
   - **Mitigation:** Use pre-built Appium Docker image, document setup steps clearly
   - **Contingency:** Fall back to local Appium installation with manual setup guide

**Known Limitations:**

- **Android-only:** iOS support not included in MVP
- **Single device execution:** Parallel execution requires architecture changes
- **Synchronous execution:** Long test runs block API, need async queue for production
- **No authentication:** Anyone can upload APKs and run tests (security risk for production)
- **No video recording:** Only screenshots captured, no video playback
- **Basic scheduler:** Simple cron-based, not a full job queue system
- **Filesystem storage:** Not suitable for multi-server deployment, needs DB for scaling

**Future Considerations (Out of Scope):**

- iOS support with XCUITest
- Parallel execution on device farm (AWS Device Farm, BrowserStack)
- Advanced analytics and test trend reporting
- CI/CD integration with webhooks (GitHub Actions, Jenkins)
- Video recording of test executions
- Cloud storage for artifacts (S3, GCS)
- Multi-tenancy with user authentication
- PostgreSQL migration for better query performance
- WebSocket for real-time execution updates (replace polling)
- ML-based flakiness detection and auto-retry
- Visual regression testing with screenshot comparison
