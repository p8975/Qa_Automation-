# AI QA Automation Platform - MVP

**1-2 Week Validation Prototype**

AI-powered test case generation from PRD documents. Upload your product requirements, get comprehensive test cases in seconds.

## Mission

Validate that GPT-4 can analyze PRDs and generate high-quality test cases before investing months in full QA automation infrastructure.

## Success Metrics

- Working end-to-end flow in 1-2 weeks
- 70%+ of generated test cases are "Good" or "Needs editing"
- QA team can review, edit, and export test cases

---

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Lucide Icons

### Backend
- FastAPI
- Pydantic
- OpenAI GPT-4 Turbo
- Document parsing (PyPDF2, python-docx, markdown)

### Deployment
- Frontend: Vercel
- Backend: Railway or Render

---

## Project Structure

```
qa-automation-platform/
├── frontend/          # Next.js 14 app
├── backend/           # FastAPI app
└── docs/             # Tech specs and documentation
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- OpenAI API key

### 1. Clone Repository

```bash
cd /Users/prakashkumar/qa-automation-platform
```

### 2. Setup Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OpenAI API key

# Run backend
python app/main.py
```

Backend will be available at http://localhost:8000

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
# .env.local is already created with:
# NEXT_PUBLIC_API_URL=http://localhost:8000

# Run frontend
npm run dev
```

Frontend will be available at http://localhost:3000

---

## Usage Flow

1. **Upload PRD Document**
   - Drag and drop or click to browse
   - Supported formats: PDF, DOCX, Markdown, TXT
   - Max file size: 10MB

2. **Generate Test Cases**
   - Click "Generate Test Cases" button
   - AI analyzes document (10-30 seconds)
   - Returns 15-20 comprehensive test cases

3. **Review & Edit**
   - View test cases in interactive table
   - Expand rows to see full details
   - Mark status: Good / Needs Edit / Useless / Pending
   - Edit test cases inline if needed

4. **Export**
   - Export to JSON for automation tools
   - Export to CSV for spreadsheets

---

## API Documentation

### `POST /api/generate-test-cases`

Generate test cases from uploaded document.

**Request:**
```bash
curl -X POST http://localhost:8000/api/generate-test-cases \
  -F "file=@prd.pdf"
```

**Response:**
```json
{
  "test_cases": [
    {
      "id": "TC001",
      "title": "Verify user can login with valid credentials",
      "description": "Test that a registered user can log into the application",
      "preconditions": ["User account exists", "User is on login page"],
      "steps": [
        "1. Navigate to login page",
        "2. Enter valid username",
        "3. Enter valid password",
        "4. Click 'Login' button"
      ],
      "expected_result": "User is authenticated and redirected to dashboard",
      "priority": "High",
      "category": "Functional"
    }
  ],
  "document_name": "prd.pdf",
  "total_count": 15,
  "generation_time": 8.5
}
```

---

## Features

### Current (MVP)
- Document upload (PDF, DOCX, Markdown, TXT)
- AI test case generation with GPT-4
- Interactive test case table
- Status marking for QA review
- Inline editing
- Export to JSON/CSV

### Future (Post-Validation)
- User authentication
- Database persistence
- Build upload and management
- Test execution (Appium/Playwright)
- Test run history and analytics
- Scheduling and CI/CD integration
- Multi-user collaboration

---

## Development

### Backend Development

```bash
cd backend

# Run with auto-reload
python app/main.py

# Or use uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# API docs available at:
# http://localhost:8000/docs
```

### Frontend Development

```bash
cd frontend

# Run dev server
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

---

## Deployment

### Deploy Backend (Railway)

```bash
cd backend

# Install Railway CLI
npm install -g @railway/cli

# Login and create project
railway login
railway init

# Add environment variables
railway variables set OPENAI_API_KEY=sk-...
railway variables set CORS_ORIGINS=https://your-frontend.vercel.app

# Deploy
railway up
```

### Deploy Frontend (Vercel)

```bash
cd frontend

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Add environment variable in Vercel dashboard:
# NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

---

## Testing

### Test Backend

```bash
cd backend

# Health check
curl http://localhost:8000/health

# Generate test cases with sample document
curl -X POST http://localhost:8000/api/generate-test-cases \
  -F "file=@sample_prd.pdf"
```

### Test Frontend

1. Open http://localhost:3000
2. Upload a sample PRD document
3. Click "Generate Test Cases"
4. Review generated test cases
5. Test status marking and editing
6. Test export functionality

---

## Cost Estimate

- **OpenAI API:** ~$0.01-0.03 per test case generation
- **Vercel:** Free tier (sufficient for MVP)
- **Railway/Render:** Free tier or $5/mo
- **Total:** ~$5-10/mo during validation phase

---

## Timeline

- **Week 1:** Backend + Document Processing + AI Integration
- **Week 2:** Frontend UI + Polish + Deploy

**Target Ship Date:** End of Week 2

---

## Contributing

This is a rapid MVP prototype. Focus on:
- Speed over perfection
- Validation over features
- Shipping over planning

---

## Next Steps After Validation

If we achieve 70%+ quality on generated test cases:

1. Add PostgreSQL for persistence
2. Add user authentication (Clerk/Auth0)
3. Build upload management
4. Add test execution layer (Appium)
5. Add analytics and reporting
6. Add scheduling and CI/CD integration
7. Multi-user collaboration features

---

## License

MIT License - see LICENSE file for details

---

## Support

For issues or questions:
- Check docs/TECH_SPEC.md for detailed technical documentation
- Review backend/README.md and frontend/README.md for setup guides
- Open an issue on GitHub

---

Built with Next.js, FastAPI, and OpenAI GPT-4 Turbo
