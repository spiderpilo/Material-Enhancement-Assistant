# Backend

Minimal FastAPI backend for local testing.

## Endpoints

- `GET /health`
- `GET /projects` (auth required)
- `POST /projects` (auth required)
- `GET /projects/{project_uuid}` (auth required)
- `POST /upload-doc`
- `GET /course-contents/{id}/preview`
- `POST /create-account`
- `POST /login-account`

Project routes use `Authorization: Bearer <mea_access_token>`. The backend resolves the caller from Supabase `GET /auth/v1/user` and always enforces ownership server-side.

`POST /projects` accepts optional JSON body `{ "name"?: string }`. If omitted, the backend creates `Untitled Project`. `owner_user_id` always comes from the bearer token, never from client payload.

`GET /projects` returns `{ "projects": ProjectSummary[] }` ordered newest-first (by `created_at`).

`GET /projects/{project_uuid}` returns one owned project record. It returns `404` when the UUID does not exist or belongs to another user.

`POST /upload-doc` accepts a PDF, DOCX, or PPTX file up to 50MB, uploads it to Supabase Storage, inserts a `course_contents` row, queues preview rendering, and returns the inserted record with preview metadata.

`GET /course-contents/{id}/preview` returns the current preview manifest for a source. While rendering is still running it returns `preview_status: "pending"`. When ready it returns ordered page or slide image URLs.

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
SUPABASE_ANON_KEY=your-anon-key
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

Compose passes Gemini and Supabase settings through from your shell or repo-root `.env`. The backend container also installs LibreOffice so DOCX and PPTX uploads can be converted into rendered preview images.

## curl Examples

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Upload a document:

```bash
curl -X POST http://127.0.0.1:8000/upload-doc \
  -H "Authorization: Bearer <mea_access_token>" \
  -F "project_id=123" \
  -F "file=@/absolute/path/to/lecture1.pdf"
```

Expected success response shape:

```json
{
  "id": 1,
  "material_name": "lecture1.pdf",
  "access_url": "https://your-project.supabase.co/storage/v1/object/course-contents/course-contents/uuid/lecture1.pdf",
  "data_size": 12345,
  "source_type": "pdf",
  "preview_status": "pending",
  "preview_count": 0
}
```

Fetch the preview manifest:

```bash
curl http://127.0.0.1:8000/course-contents/1/preview
```

Create a project:

```bash
curl -X POST http://127.0.0.1:8000/projects \
  -H "Authorization: Bearer <mea_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Lecture Revision"}'
```

List recent projects:

```bash
curl http://127.0.0.1:8000/projects?limit=10 \
  -H "Authorization: Bearer <mea_access_token>"
```
