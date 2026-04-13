# Backend

Minimal FastAPI backend for local testing.

## Endpoints

- `GET /health`
- `POST /upload-doc`
- `POST /create-account`
- POST /login-account
`POST /upload-doc` accepts a PDF, DOCX, or PPTX file, uploads it to Supabase Storage, inserts a `course_contents` row, and returns the inserted record.

`POST /create-account` creates a Supabase auth user and inserts the matching `users` profile row on the backend.

## Local Run

From the repository root:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --app-dir backend
```

If you already have a repo-root `.env`, keep it and make sure it contains:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=course-contents
NEXT_PUBLIC_BACKEND_URL=
```

`access_url` stores the stable Supabase object URL written to `course_contents`. It is not a signed URL.

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
  "id": 1,
  "material_name": "lecture1.pdf",
  "access_url": "https://your-project.supabase.co/storage/v1/object/course-contents/course-contents/uuid/lecture1.pdf",
  "data_size": 12345
}
```
