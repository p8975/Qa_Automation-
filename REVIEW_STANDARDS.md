# Code Review Standards for QA Automation Platform

This document defines the review standards for the QA Automation platform, which consists of:
- **Frontend**: Next.js 14 + React 18 + TypeScript + TailwindCSS + Zustand
- **Backend**: FastAPI (Python) + Appium + OpenAI

## Severity Levels

### HIGH Severity (Blocks Merge)

These issues MUST be fixed before merging:

**Security Issues:**
- Hardcoded API keys, tokens, or credentials
- SQL injection vulnerabilities
- Command injection in subprocess calls
- XSS vulnerabilities in React components
- Exposed sensitive data in logs or responses
- Missing authentication/authorization checks

**Runtime Errors:**
- Syntax errors that will crash the application
- Undefined variable usage
- Missing required imports
- Type errors that will fail at runtime
- Unhandled promise rejections
- Missing error handling on critical paths

**Appium/Device Issues:**
- ADB commands without proper error handling
- Device connection without timeout
- Missing retry logic for flaky device operations
- Hardcoded device identifiers

**API Issues:**
- Missing request validation
- Missing error responses
- Incorrect HTTP status codes for error states
- Unhandled exceptions in route handlers

### MEDIUM Severity (Comments Only)

These issues should be addressed but don't block merge:

**Code Quality:**
- Logic errors that could cause bugs
- Resource leaks (unclosed files, connections)
- Bare except clauses swallowing exceptions
- Missing error handling on API calls
- Inefficient algorithms (O(n²) when O(n) is possible)
- N+1 query patterns

**React/Frontend:**
- Missing dependency arrays in useEffect
- State updates on unmounted components
- Prop drilling that could use context
- Missing loading/error states
- Accessibility issues (missing aria labels, alt text)

**Python/Backend:**
- Functions with too many parameters (>5)
- Missing type hints on public functions
- Bare except clauses
- Using print() instead of logging in production code

### LOW Severity (Nice-to-Have)

Minor improvements that don't need immediate action:

- Code duplication that could be refactored
- Magic numbers that could be constants
- Variable naming suggestions
- Minor performance optimizations
- Documentation improvements

## What to IGNORE

**DO NOT flag these patterns:**

1. **Print statements in debugging/development code** - QA automation tools often need prints for debugging
2. **Hardcoded test data** - Test files can have hardcoded values
3. **Long functions in service modules** - Complex device interactions may need longer functions
4. **Missing docstrings on private methods** - Only require on public APIs
5. **Type hints in test files** - Tests can be more flexible
6. **Comments explaining complex Appium selectors** - These are helpful
7. **Environment variable fallback patterns** - `os.getenv("VAR", "default")` is correct
8. **Static fallback arrays** - When marked as intentional fallbacks
9. **Configuration files** - Files that define constants can contain those values

## Project-Specific Rules

### Frontend (Next.js/React)

**MUST check:**
- Server vs Client component usage
- Proper use of `use client` directive
- Image optimization (next/image)
- API route handlers have proper error handling
- Zustand store mutations are correct

**SHOULD check:**
- TailwindCSS class organization
- Component prop types are complete
- Loading and error states are handled

### Backend (FastAPI/Python)

**MUST check:**
- All endpoints have proper response models
- Pydantic models validate input
- Async functions use await correctly
- File operations are properly closed
- Appium sessions are properly cleaned up

**SHOULD check:**
- Proper use of dependency injection
- Repository pattern is followed
- Error messages are informative

### Appium/Mobile Testing

**MUST check:**
- Device capabilities are configurable
- Session cleanup on test failure
- Proper element waiting strategies
- Screenshot capture on failure

**SHOULD check:**
- Retry logic for flaky operations
- Timeout configuration
- Device state validation before test

## Review Process

1. **Automated Review Bot** runs on every PR
2. Bot posts inline comments with severity levels
3. HIGH severity blocks merge
4. MEDIUM severity requires acknowledgment
5. LOW severity is informational
6. Human review required for complex changes

## Labels

The review bot applies these labels:
- `bot: approved` - All checks passed
- `bot: comments` - Issues found that need review
- `bot: changes requested` - HIGH severity issues must be fixed
