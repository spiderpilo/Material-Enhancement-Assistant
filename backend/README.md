# Backend

Minimal FastAPI backend for local testing.

## Endpoints

- `GET /health`
- `POST /upload-doc`

`POST /upload-doc` accepts a PDF or DOCX file, extracts text, and sends a short clarity-improvement prompt to Gemini.

## Local Run

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --app-dir backend
```

If you already have a repo-root `.env`, keep it and make sure it contains `GOOGLE_GEMINI_API_KEY`.

## curl Examples

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Upload a document:

```bash
curl -X POST http://127.0.0.1:8000/upload-doc \
  -F "file=@/absolute/path/to/lecture1.pdf"
```

Expected success response shape:

```json
{
  "filename": "lecture1.pdf",
  "file_type": "pdf",
  "text_length": 12345,
  "preview": "First few hundred characters...",
  "gemini_response": "Clearer rewrite..."
}
```
