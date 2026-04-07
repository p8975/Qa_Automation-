# QA Automation Platform - Backend

FastAPI backend for AI-powered test case generation.

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-your-actual-key-here
CORS_ORIGINS=http://localhost:3000
PORT=8000
```

### 3. Run Development Server

```bash
# From backend directory
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or:

```bash
python app/main.py
```

API will be available at: `http://localhost:8000`

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Endpoints

### `GET /`
Health check

### `GET /health`
Detailed health status

### `POST /api/generate-test-cases`
Generate test cases from uploaded document.

**Request:**
- `file`: FormData file upload (PDF, DOCX, Markdown, TXT)

**Response:**
```json
{
  "test_cases": [
    {
      "id": "TC001",
      "title": "Verify user can login with valid credentials",
      "description": "...",
      "preconditions": ["User exists", "..."],
      "steps": ["1. Navigate to login", "2. Enter credentials", "..."],
      "expected_result": "User is logged in successfully",
      "priority": "High",
      "category": "Functional"
    }
  ],
  "document_name": "prd.pdf",
  "total_count": 15,
  "generation_time": 8.5
}
```

## Supported File Formats

- PDF (.pdf)
- Microsoft Word (.docx, .doc)
- Markdown (.md, .markdown)
- Plain Text (.txt)

## File Size Limit

Maximum upload size: **10MB**

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app + routes
│   ├── models.py            # Pydantic models
│   ├── services/
│   │   ├── document_parser.py  # Document text extraction
│   │   └── ai_generator.py     # OpenAI integration
│   └── utils/
│       └── prompts.py          # AI prompt templates
├── requirements.txt
├── .env.example
└── README.md
```

## Development

### Testing Document Parsing

```python
from app.services.document_parser import DocumentParser

with open('sample.pdf', 'rb') as f:
    text = DocumentParser.parse_document(f.read(), 'sample.pdf')
    print(text)
```

### Testing AI Generation

```python
from app.services.ai_generator import AITestCaseGenerator

generator = AITestCaseGenerator(api_key="sk-...")
test_cases = generator.generate_test_cases("Your PRD text here...")
print(f"Generated {len(test_cases)} test cases")
```

## Deployment

### Railway

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Create project: `railway init`
4. Add env vars: `railway variables set OPENAI_API_KEY=sk-...`
5. Deploy: `railway up`

### Render

1. Create new Web Service
2. Connect GitHub repo
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables in dashboard

## Troubleshooting

**OpenAI API errors:**
- Verify API key is correct
- Check account has credits
- Ensure internet connectivity

**Document parsing fails:**
- Verify file format is supported
- Check file isn't corrupted
- Ensure file has readable text content

**CORS errors:**
- Add frontend URL to CORS_ORIGINS in .env
- Restart backend after changing .env
