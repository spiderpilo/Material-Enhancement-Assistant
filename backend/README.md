# Backend

Minimal FastAPI backend for local testing.

## Endpoints

- `GET /health`
- `POST /upload-doc`

`POST /upload-doc` accepts a PDF or DOCX file, extracts text, and sends a short clarity-improvement prompt to Gemini.

## Local Run

From the repository root:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --app-dir backend
```

If you already have a repo-root `.env`, keep it and make sure it contains `GOOGLE_GEMINI_API_KEY`.

## Docker Run

From the repository root:

```bash
cp .env.example .env
docker compose up --build backend
```

The backend will be available at `http://127.0.0.1:8000`.

To run the backend in watch mode:

```bash
docker compose watch backend
```

Compose passes `GOOGLE_GEMINI_API_KEY`, `GEMINI_API_KEY`, and `GOOGLE_API_KEY` through from your shell or repo-root `.env`.

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
