# Quick Start Guide

Get the AI QA Automation Platform running in 5 minutes.

---

## Prerequisites

- Node.js 18+ installed
- Python 3.10+ installed
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))

---

## Step 1: Backend Setup (2 minutes)

### 1.1 Install Python Dependencies

```bash
cd /Users/prakashkumar/qa-automation-platform/backend
pip install -r requirements.txt
```

### 1.2 Configure OpenAI API Key

```bash
# Create .env file from example
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-your-actual-key-here
CORS_ORIGINS=http://localhost:3000
PORT=8000
```

### 1.3 Start Backend Server

```bash
python app/main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Test it:** Open http://localhost:8000 in browser - you should see:
```json
{
  "status": "healthy",
  "service": "QA Automation Platform API",
  "version": "0.1.0"
}
```

---

## Step 2: Frontend Setup (2 minutes)

Open a new terminal window:

### 2.1 Install Node Dependencies

```bash
cd /Users/prakashkumar/qa-automation-platform/frontend
npm install
```

### 2.2 Verify Environment Variable

Check that `.env.local` contains:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2.3 Start Frontend Server

```bash
npm run dev
```

You should see:
```
- Local:        http://localhost:3000
- Ready in 2.5s
```

**Test it:** Open http://localhost:3000 in browser - you should see the upload page.

---

## Step 3: Test End-to-End (1 minute)

### 3.1 Test with Sample PRD

1. Open http://localhost:3000
2. Drag and drop the sample PRD: `/Users/prakashkumar/qa-automation-platform/docs/sample_prd.md`
3. Click **"Generate Test Cases"**
4. Wait 10-30 seconds for AI to generate test cases
5. Review the generated test cases in the table
6. Mark some as "Good", "Needs Edit", or "Useless"
7. Click **"Export as JSON"** or **"Export as CSV"** to download

---

## Troubleshooting

### Backend won't start

**Error:** `ModuleNotFoundError: No module named 'fastapi'`
```bash
cd backend
pip install -r requirements.txt
```

**Error:** `OPENAI_API_KEY environment variable is required`
```bash
# Make sure .env exists and has valid API key
cat .env
```

### Frontend won't start

**Error:** `Module not found: Can't resolve ...`
```bash
cd frontend
rm -rf node_modules .next
npm install
npm run dev
```

### Backend connection error in frontend

**Error:** `Failed to fetch` or `Network error`
- Make sure backend is running on http://localhost:8000
- Check `.env.local` has correct API URL
- Try opening http://localhost:8000 directly in browser

### OpenAI API errors

**Error:** `Invalid API key`
- Get a new API key from https://platform.openai.com/api-keys
- Update `OPENAI_API_KEY` in backend/.env
- Restart backend server

**Error:** `Rate limit exceeded`
- You've hit OpenAI's rate limits
- Wait a few minutes and try again
- Consider upgrading your OpenAI plan

**Error:** `Insufficient credits`
- Add credits to your OpenAI account
- Visit https://platform.openai.com/settings/organization/billing

---

## What's Next?

### Test with Your Own PRDs

Upload your own PRD documents (PDF, DOCX, Markdown, or TXT) to test the AI generation quality.

### Validate Quality

Mark test cases as "Good", "Needs Edit", or "Useless" to measure the success metric:
- **Target:** 70%+ of test cases should be "Good" or "Needs Edit"

### Iterate on Prompts

If quality isn't good enough:
1. Edit the prompt in `backend/app/utils/prompts.py`
2. Restart backend
3. Test again with sample PRDs

### Deploy to Production

Once validated:
- Deploy backend to Railway or Render
- Deploy frontend to Vercel
- See README.md for deployment instructions

---

## Useful Commands

### Backend

```bash
# Start backend
cd backend && python app/main.py

# View API docs
open http://localhost:8000/docs

# Test health endpoint
curl http://localhost:8000/health
```

### Frontend

```bash
# Start frontend
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# Type check
cd frontend && npm run build
```

### Testing

```bash
# Test backend with curl
curl -X POST http://localhost:8000/api/generate-test-cases \
  -F "file=@docs/sample_prd.md"

# Test with different document formats
curl -X POST http://localhost:8000/api/generate-test-cases \
  -F "file=@path/to/your/prd.pdf"
```

---

## Support

- Technical documentation: `docs/TECH_SPEC.md`
- Backend README: `backend/README.md`
- Frontend README: `frontend/README.md`
- Main README: `README.md`

---

## Success Checklist

- [ ] Backend running on http://localhost:8000
- [ ] Frontend running on http://localhost:3000
- [ ] Sample PRD uploaded successfully
- [ ] Test cases generated (15-20 cases)
- [ ] Test cases are readable and relevant
- [ ] Status marking works
- [ ] Export to JSON works
- [ ] Export to CSV works

If all checks pass, you're ready to test with real PRDs!

---

**Estimated Time:** 5-10 minutes total
**Next Steps:** Upload your PRDs and validate AI quality
