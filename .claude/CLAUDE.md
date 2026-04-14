# QA Automation Platform - Claude Code Instructions

This is a QA Automation Platform with:
- **Backend**: Python + FastAPI (`backend/`)
- **Frontend**: Next.js + TypeScript (`frontend/`)

---

## Project Structure

```
backend/
  app/
    main.py          # FastAPI app entry point
    models.py        # Pydantic models
    services/        # Business logic
    repositories/    # Data access
    utils/           # Utilities
frontend/
  src/
    app/             # Next.js pages
    components/      # React components
```

---

## Core Behavior: Code-First Analysis

**CRITICAL RULE: Never make claims without verification.**

Before making ANY technical claim, risk assessment, or analysis:

1. **READ the actual code first** — Use `Read` or `Grep` tool to see the real file contents
2. **Verify line numbers** — Never guess line numbers, always confirm by reading the file
3. **Confirm behavior** — Don't assume what code does, read it and verify
4. **Validate user claims** — If user provides analysis, verify against actual code before agreeing

---

## Mandatory Analysis Protocol

### Before ANY Implementation Task:

```
Step 1: IMPACT SCAN
└── Backend: grep -r "pattern" backend/ --include="*.py"
└── Frontend: grep -r "pattern" frontend/src/ --include="*.ts" --include="*.tsx"
└── Count files and usages
└── List every affected file path

Step 2: READ EACH FILE
└── Don't assume based on filename
└── Read actual code at each location
└── Note exact line numbers

Step 3: CATEGORIZE
└── HIGH RISK: Breaking changes, runtime errors possible
└── MEDIUM RISK: Feature incomplete, UX issues
└── LOW RISK: Safe changes, no runtime impact

Step 4: ESTIMATE ACCURATELY
└── Based on actual file count, not assumption
└── Include all phases: code + test + verify

Step 5: THEN PROPOSE
└── Only after steps 1-4, suggest implementation
```

### Before Confirming User's Analysis:

```
Step 1: DON'T SAY "SAHI HAI" IMMEDIATELY
└── Even if it looks correct

Step 2: READ EVERY FILE MENTIONED
└── Verify each claim against actual code

Step 3: CHECK LINE NUMBERS
└── User's line numbers may be outdated

Step 4: THEN RESPOND
└── "Verified at line X: [actual code snippet]"
└── Or "Correction needed: Line X actually shows..."
```

---

## Verification Protocol (MANDATORY - ALL TASKS)

**CRITICAL: "Build passed" ≠ "Implementation correct"**

### Before saying "complete", "verified", "done", "fixed":

#### Step 1: IDENTIFY what changed
```
List every pattern/string/function that should have changed
Example: Replacing X with Y
- X should no longer exist in functional code
- Y should exist in all places X was removed
```

#### Step 2: GREP for OLD patterns
```bash
# Backend
grep -r "old_pattern" backend/ --include="*.py"

# Frontend
grep -r "old_pattern" frontend/src/ --include="*.ts" --include="*.tsx"
```

#### Step 3: GREP for NEW patterns
```bash
# Backend
grep -r "new_pattern" backend/ --include="*.py"

# Frontend
grep -r "new_pattern" frontend/src/ --include="*.ts" --include="*.tsx"
```

#### Step 4: RUN LINTS
```bash
# Backend
ruff check backend/

# Frontend
cd frontend && npm run lint
```

#### Step 5: PROOF FORMAT (Required before marking complete)
```
Task: [description]
Changed: X → Y

Grep "X" (old pattern): [count] results
  - main.py:10 = config definition ✅
  - service.py:20 = functional code 🔴 NEEDS FIX

Grep "Y" (new pattern): [count] results
  - Verified in: [list files where correctly applied]

Lint: ruff check backend/ → All checks passed ✅
Status: COMPLETE ✅ / NOT COMPLETE 🔴
```

---

## Project-Specific Commands

### Backend (Python/FastAPI)
```bash
# Lint
ruff check backend/

# Run server
cd backend && uvicorn app.main:app --reload --port 8000
```

### Frontend (Next.js)
```bash
# Lint
cd frontend && npm run lint

# Type check
cd frontend && npx tsc --noEmit

# Build
cd frontend && npm run build

# Run dev server
cd frontend && npm run dev
```

---

## Git Safety Rules

- NEVER push directly to main — always create a feature branch
- NEVER force-push to shared branches
- NEVER skip pre-commit hooks (--no-verify)
- NEVER commit .env files, API keys, secrets, or credentials
- ALWAYS create PR for code changes

---

## Dependency Safety

- NEVER add new dependencies without being asked
- NEVER upgrade major versions without being asked
- If a dependency is needed, ask first and explain why

---

## Known Failure Patterns — DO NOT DO THESE

- Do NOT claim "build is passing" without actually running the build command
- Do NOT say "tests should pass" — run them and show the output
- Do NOT assume a component works because the code looks correct
- Do NOT treat reading a file as verification that the code works
- Do NOT skip verification because "changes are small"
- Do NOT clean up or refactor unrelated code while working on a task
- Do NOT add error handling for scenarios that cannot happen

---

## Output Rules

- Before a tool call: max 1 sentence explaining intent
- After implementation: max 3 sentences summary
- Lead with the result, not the reasoning
- Comments only where logic is non-obvious

---

## Speed Mode

Respond with maximum density. No fluff. No caveats unless critical. Get to the point immediately.
