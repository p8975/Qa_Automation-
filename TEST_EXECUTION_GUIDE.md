# Test Execution Guide

## Quick Test Scenarios

### Scenario 1: APK Upload & Metadata Extraction

**Steps:**
1. Start backend: `cd backend && python3 -m uvicorn app.main:app --reload`
2. Navigate to `http://localhost:3000/builds`
3. Upload a sample APK file
4. Verify metadata is extracted correctly (package name, version, file size)

**Expected Results:**
- APK uploads successfully
- Package name and version displayed correctly
- Build appears in the builds list

---

### Scenario 2: Device Detection

**Steps:**
1. Connect Android device or start emulator
2. Verify with ADB: `adb devices`
3. Navigate to execution page
4. Check if device appears in device selection

**Expected Results:**
- Device is detected and listed
- Device name and Android version displayed
- Emulator vs Physical device correctly identified

---

### Scenario 3: Test Case Generation

**Steps:**
1. Navigate to `http://localhost:3000`
2. Upload a sample PRD document (PDF, DOCX, or MD)
3. Click "Generate Test Cases"
4. Wait for generation to complete

**Expected Results:**
- Test cases generated within 30 seconds
- Test cases have proper structure (title, steps, expected results)
- Categories and priorities assigned correctly

---

### Scenario 4: End-to-End Test Execution

**Prerequisites:**
- Appium server running (`docker ps | grep appium`)
- Backend running on port 8000
- Frontend running on port 3000
- Android device/emulator connected
- APK uploaded
- Test cases generated

**Steps:**
1. Navigate to `http://localhost:3000/execution`
2. Select a build
3. Select test cases (1-3 test cases)
4. Select device
5. Click "Start Execution"
6. Monitor execution dashboard
7. View results when completed

**Expected Results:**
- Execution starts successfully
- Progress bar updates in real-time
- Test results show pass/fail status
- Screenshots captured on failure
- Logs available for download

---

### Scenario 5: Element Inspection

**Steps:**
1. Install and launch Flutter app on device
2. Call `POST /api/inspect-elements` with build_id and device_id
3. Verify response contains element information

**Expected Results:**
- Elements discovered from current screen
- Multiple locator strategies provided (accessibility_id, resource_id, text)
- Bounds information available

---

## Manual Testing Checklist

### Backend API Tests

**Build Management:**
- [ ] Upload APK (valid file)
- [ ] Upload non-APK file (should fail with 400)
- [ ] Upload APK > 50MB (should fail)
- [ ] List all builds
- [ ] Get specific build by ID
- [ ] Delete build

**Test Case Management:**
- [ ] Save test case
- [ ] List all test cases
- [ ] Filter test cases by PRD hash
- [ ] Update test case with locator override
- [ ] Delete test case

**Device Management:**
- [ ] List devices (with device connected)
- [ ] List devices (no devices) - should return empty array
- [ ] Get device info by ID

**Test Execution:**
- [ ] Start test run with valid inputs
- [ ] Start test run with invalid build_id (should fail)
- [ ] Get test run status
- [ ] Cancel running test
- [ ] Get test run logs
- [ ] List test runs for build

**Scheduler:**
- [ ] Schedule test run (valid cron expression)
- [ ] Schedule test run (invalid cron) - should fail
- [ ] List all schedules
- [ ] Delete schedule

---

### Frontend UI Tests

**Builds Page:**
- [ ] Upload APK via drag-and-drop
- [ ] Upload APK via file browser
- [ ] View uploaded builds in table
- [ ] Delete build (with confirmation)
- [ ] Click "Execute" button navigates to execution page

**Execution Page:**
- [ ] Select build from list
- [ ] Select multiple test cases
- [ ] Select all test cases
- [ ] Deselect test cases
- [ ] Select device
- [ ] Start execution
- [ ] View live execution dashboard
- [ ] Progress bar updates
- [ ] Back button navigation works

**Results Page:**
- [ ] Select build from sidebar
- [ ] View test runs for selected build
- [ ] Select specific test run
- [ ] View test results with pass/fail status
- [ ] Expand/collapse test details
- [ ] View step-level results
- [ ] View screenshots
- [ ] Export results to JSON
- [ ] Download logs

**Main Page (Test Generation):**
- [ ] Upload PRD document
- [ ] Generate test cases
- [ ] Review generated test cases
- [ ] Expand/collapse test case details
- [ ] Export to JSON
- [ ] Export to CSV
- [ ] Navigate to other pages via nav menu

---

## Error Scenarios to Test

### Backend Errors

1. **Appium Server Down:**
   - Stop Appium container
   - Try to start test execution
   - Expected: HTTP 503 error with "Appium unavailable"

2. **Device Disconnected Mid-Execution:**
   - Start test execution
   - Disconnect device during execution
   - Expected: Execution fails gracefully with error message

3. **Invalid APK File:**
   - Upload corrupted APK
   - Expected: HTTP 400 error with "Invalid APK file"

4. **Missing API Key:**
   - Unset API_KEY environment variable
   - Restart backend
   - Expected: Server fails to start with clear error

5. **Storage Permission Issues:**
   - Remove write permissions from storage directory
   - Try to upload build
   - Expected: HTTP 500 error

### Frontend Errors

1. **Backend Unavailable:**
   - Stop backend server
   - Try any API operation
   - Expected: Clear error message displayed

2. **Network Timeout:**
   - Simulate slow network
   - Expected: Loading state shown, timeout handled

3. **Invalid File Type:**
   - Try to upload non-APK file in builds page
   - Expected: Validation error before upload

---

## Performance Testing

### Load Test Scenarios

1. **Concurrent Test Runs:**
   - Start multiple test runs simultaneously (3-5)
   - Monitor system resources
   - Verify all complete successfully

2. **Large APK Upload:**
   - Upload 40-50MB APK file
   - Monitor upload progress
   - Verify metadata extraction

3. **Long Test Suite:**
   - Execute 10+ test cases in single run
   - Monitor execution time
   - Verify no timeout issues

4. **Storage Growth:**
   - Run 20+ test executions
   - Check storage directory size
   - Verify old files can be cleaned up

---

## Smoke Test (Quick Validation)

Run this after any deployment:

```bash
# 1. Check backend health
curl http://localhost:8000/health

# 2. Check Appium
curl http://localhost:4723/status

# 3. Check devices
curl http://localhost:8000/api/devices

# 4. Check builds
curl http://localhost:8000/api/builds

# 5. Open frontend
open http://localhost:3000
```

All endpoints should return 200 OK.

---

## Automated Testing (Future)

### Backend Unit Tests (pytest)

```bash
cd backend
pytest tests/test_repositories.py -v
pytest tests/test_services.py -v
pytest tests/test_execution_flow.py -v
```

### Frontend Component Tests (Jest)

```bash
cd frontend
npm test
npm run test:coverage
```

### Integration Tests

```bash
# Run full integration test suite
npm run test:integration
```

---

## Regression Test Suite

Run before each release:

1. ✅ Upload 3 different APK files
2. ✅ Generate test cases from 2 different PRDs
3. ✅ Execute test run with 5 test cases
4. ✅ View results and verify screenshots
5. ✅ Export results (JSON and CSV)
6. ✅ Schedule recurring test run
7. ✅ Inspect elements on 2 different screens
8. ✅ Update test case with locator override
9. ✅ Delete old builds
10. ✅ Cancel running test execution

---

## Known Limitations

- Android-only (iOS not supported)
- Single device execution (no parallel runs)
- Synchronous execution (long runs block API)
- Filesystem storage (not suitable for multi-server deployment)
- No video recording (screenshots only)

---

## Troubleshooting Test Failures

### Test Execution Hangs

1. Check Appium logs: `docker logs appium-server`
2. Verify app is installed: `adb shell pm list packages | grep your.package`
3. Check device is responsive: `adb shell input keyevent 3`
4. Restart Appium: `docker restart appium-server`

### Element Not Found

1. Use element inspector: `POST /api/inspect-elements`
2. Verify locator strategy is correct
3. Add explicit wait in test step
4. Use manual locator override

### Screenshots Missing

1. Check storage directory permissions
2. Verify screenshot_path in test results
3. Check available disk space

---

## Test Metrics to Track

- **Test Case Generation:**
  - Time to generate test cases
  - Number of test cases generated
  - Quality of test cases (manual review)

- **Test Execution:**
  - Test run duration
  - Pass/fail rate
  - Element discovery success rate
  - AI translation accuracy

- **System Performance:**
  - API response times
  - Storage growth rate
  - Memory usage during execution

---

## Next Steps

After validating core functionality:

1. Add pytest unit tests for repositories
2. Add pytest integration tests for API endpoints
3. Add Jest tests for frontend components
4. Set up CI/CD pipeline for automated testing
5. Implement PostgreSQL migration
6. Add multi-device parallel execution
7. Implement video recording
