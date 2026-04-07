# AI QA Automation Platform - MVP Tech Spec

## Mission
Validate AI-powered test case generation in 1-2 weeks. Prove that GPT-4 can analyze PRDs and generate useful test cases.

## Success Metrics
- Working end-to-end flow in 1-2 weeks
- 70%+ of generated test cases are "Good" or "Needs editing"
- QA team can review, edit, and export test cases

---

## Architecture

### Frontend (Next.js 14)
**Tech:** Next.js 14 + TypeScript + Tailwind + shadcn/ui

**Pages:**
- `/` - Document upload + test case generation
- Results display in same page (no routing overhead)

**Key Components:**
- `DocumentUpload` - Drag-drop file upload (PDF/DOCX/Markdown)
- `GenerateButton` - Trigger AI generation
- `TestCaseTable` - Editable table with status markers
- `ExportButton` - Download as CSV/JSON

**State Management:** React hooks (useState, useEffect) - no Redux needed for MVP

### Backend (FastAPI)
**Tech:** FastAPI + Pydantic + OpenAI SDK

**Single Endpoint:**
```
POST /api/generate-test-cases
Request: FormData with file
Response: { test_cases: TestCase[] }
```

**Flow:**
1. Extract text from uploaded document (PyPDF2/python-docx/markdown)
2. Send to GPT-4 with structured prompt
3. Parse JSON response into TestCase schema
4. Return structured test cases

**Models (Pydantic):**
```python
class TestCase(BaseModel):
    id: str
    title: str
    description: str
    preconditions: list[str]
    steps: list[str]
    expected_result: str
    priority: str  # High/Medium/Low
    category: str  # Functional/UI/Integration/etc
```

### AI Integration
**Model:** GPT-4 Turbo (gpt-4-turbo-preview)

**Prompt Strategy:**
```
You are a QA engineer analyzing a PRD. Generate comprehensive test cases.

Document:
{extracted_text}

Generate 15-20 test cases covering:
- Happy path scenarios
- Edge cases
- Error handling
- UI/UX flows
- Integration points

Output as JSON array with this structure:
[
  {
    "title": "...",
    "description": "...",
    "preconditions": ["..."],
    "steps": ["1. ...", "2. ..."],
    "expected_result": "...",
    "priority": "High|Medium|Low",
    "category": "Functional|UI|Integration|Security|Performance"
  }
]
```

---

## Data Flow

```
User uploads PRD
    ↓
Frontend sends file to /api/generate-test-cases
    ↓
Backend extracts text from document
    ↓
Backend calls OpenAI GPT-4 with structured prompt
    ↓
GPT-4 returns JSON array of test cases
    ↓
Backend validates with Pydantic
    ↓
Frontend displays in editable table
    ↓
User marks as Good/Needs Edit/Useless
    ↓
User exports to CSV/JSON
```

---

## Storage (MVP)
**No database needed yet.** In-memory only.
- Upload → Process → Return
- Frontend holds state
- Export as file download

**Future:** Add PostgreSQL when we need persistence, user accounts, test runs, etc.

---

## Deployment

### Frontend
- **Platform:** Vercel
- **URL:** qa-automation-platform.vercel.app
- **Build:** `npm run build`
- **Env Vars:** `NEXT_PUBLIC_API_URL`

### Backend
- **Platform:** Railway or Render (free tier)
- **URL:** qa-automation-api.up.railway.app
- **Build:** `uvicorn main:app --host 0.0.0.0 --port 8000`
- **Env Vars:** `OPENAI_API_KEY`, `CORS_ORIGINS`

---

## Development Plan

### Phase 1: Scaffold (Day 1)
- [x] Create project structure
- [ ] Initialize Next.js frontend with TypeScript
- [ ] Initialize FastAPI backend with Poetry/pip
- [ ] Setup CORS and basic health check

### Phase 2: Document Processing (Day 2)
- [ ] Backend: File upload endpoint
- [ ] Backend: PDF text extraction (PyPDF2)
- [ ] Backend: DOCX text extraction (python-docx)
- [ ] Backend: Markdown parsing
- [ ] Test with sample PRD

### Phase 3: AI Integration (Day 3-4)
- [ ] OpenAI API integration
- [ ] Prompt engineering for test case generation
- [ ] Pydantic validation schemas
- [ ] Error handling and retries

### Phase 4: Frontend UI (Day 5-6)
- [ ] File upload component with drag-drop
- [ ] Loading states
- [ ] Test case table with edit capability
- [ ] Status markers (Good/Needs Edit/Useless)
- [ ] Export functionality (CSV/JSON)

### Phase 5: Polish & Deploy (Day 7)
- [ ] Error handling UX
- [ ] Loading animations
- [ ] Deploy to Vercel + Railway
- [ ] Test end-to-end with real PRDs

---

## File Structure

```
qa-automation-platform/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Main upload + results page
│   │   │   ├── layout.tsx
│   │   │   └── api/                  # (Optional proxy to backend)
│   │   ├── components/
│   │   │   ├── DocumentUpload.tsx
│   │   │   ├── TestCaseTable.tsx
│   │   │   ├── GenerateButton.tsx
│   │   │   └── ExportButton.tsx
│   │   ├── lib/
│   │   │   ├── api.ts               # API client
│   │   │   └── types.ts             # TypeScript interfaces
│   │   └── styles/
│   │       └── globals.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── next.config.js
│
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app + routes
│   │   ├── models.py                # Pydantic schemas
│   │   ├── services/
│   │   │   ├── document_parser.py  # Extract text from files
│   │   │   └── ai_generator.py     # OpenAI integration
│   │   └── utils/
│   │       └── prompts.py          # AI prompts
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
└── docs/
    ├── TECH_SPEC.md                # This file
    └── API.md                      # API documentation
```

---

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (.env)
```
OPENAI_API_KEY=sk-...
CORS_ORIGINS=http://localhost:3000,https://qa-automation-platform.vercel.app
PORT=8000
```

---

## Testing Strategy (MVP)

### Manual Testing
- Upload various PRD formats (PDF, DOCX, Markdown)
- Verify test cases are generated
- Check quality of test cases (70%+ usable)
- Test edit and export functionality

### Future: Automated Testing
- Unit tests for document parsing
- Integration tests for AI generation
- E2E tests with Playwright

---

## Known Limitations (MVP)

1. **No authentication** - Public endpoint (add auth in v2)
2. **No persistence** - Results lost on refresh (add DB in v2)
3. **No test execution** - Only generation (add Appium/Playwright in v3)
4. **No analytics** - Basic console logging only
5. **Rate limiting** - OpenAI API limits apply
6. **File size** - Max 10MB uploads

---

## Next Steps After MVP

If validation succeeds (70%+ quality):
1. Add PostgreSQL for persistence
2. Add user authentication (Clerk/Auth0)
3. Build upload management
4. Add test execution layer (Appium)
5. Add analytics and reporting
6. Add scheduling and CI/CD integration

---

## Cost Estimate (MVP)

- **OpenAI API:** ~$0.01-0.03 per test case generation
- **Vercel:** Free tier (sufficient for MVP)
- **Railway/Render:** Free tier or $5/mo
- **Total:** ~$5-10/mo for testing phase

---

## Timeline

- **Day 1-2:** Scaffold + Document Processing
- **Day 3-4:** AI Integration + Prompt Engineering
- **Day 5-6:** Frontend UI
- **Day 7:** Deploy + Test

**Ship date:** End of Week 1 or early Week 2
