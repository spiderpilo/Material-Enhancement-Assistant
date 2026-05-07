# Backend

Minimal FastAPI backend for local testing.

## Endpoints

- `GET /health`
- `GET /projects` (auth required)
- `POST /projects` (auth required)
- `GET /projects/{project_uuid}` (auth required)
- `PATCH /projects/{project_uuid}` (auth required)
- `DELETE /projects/{project_uuid}` (auth required)
- `POST /upload-doc`
- `GET /course-contents/{id}/preview`
- `POST /create-account`
- `POST /login-account`

Project routes use `Authorization: Bearer <mea_access_token>`. The backend resolves the caller from Supabase `GET /auth/v1/user` and always enforces ownership server-side.

`POST /projects` accepts optional JSON body `{ "name"?: string }`. If omitted, the backend creates `Untitled Project`. `owner_user_id` always comes from the bearer token, never from client payload.

`GET /projects` returns `{ "projects": ProjectSummary[] }` ordered newest-first (by `created_at`).

`GET /projects/{project_uuid}` returns one owned project record. It returns `404` when the UUID does not exist or belongs to another user.

`PATCH /projects/{project_uuid}` updates the project name. It returns:
- `200` on success
- `400` for blank names after trim
- `401` for missing/invalid bearer token
- `403` when the project exists but belongs to another user
- `404` when the UUID does not exist

`DELETE /projects/{project_uuid}` permanently deletes the owned project and returns:
- `204` on success
- `401` for missing/invalid bearer token
- `403` when the project exists but belongs to another user
- `404` when the UUID does not exist

`POST /upload-doc` accepts a PDF, DOCX, or PPTX file up to 50MB, uploads it to Supabase Storage, inserts a `course_contents` row, queues preview rendering, and returns the inserted record with preview metadata.

`GET /course-contents/{id}/preview` returns the current preview manifest for a source. While rendering is still running it returns `preview_status: "pending"`. When ready it returns ordered page or slide image URLs.

`POST /create-account` creates a Supabase auth user and inserts the matching `users` profile row on the backend.

## Local Run

From the repository root:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r backend/requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --app-dir backend
```

To avoid interpreter drift (for example, system Python without `fitz`), you can always use:

```bash
backend/scripts/run_dev.sh
```

The script starts Uvicorn with `--reload-dir backend/app` so the reloader only watches backend source files.

Quick interpreter sanity checks before starting:

```bash
python -c "import sys; print(sys.executable)"
python -c "import fitz; print('ok')"
```

If you choose not to use `backend/.venv`, install dependencies into the exact interpreter that starts Uvicorn:

```bash
python3 -m pip install PyMuPDF
```

If you already have a repo-root `.env`, keep it and make sure it contains:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=course-contents
SUPABASE_ANON_KEY=your-anon-key
```

`access_url` stores the stable Supabase object URL written to `course_contents`. It is not a signed URL.

## Project Schema Migration (UUID Contract + Legacy Constraint Relax)

If your Supabase `projects` table still uses legacy columns (`owner_auth_user_id`, `created_on`, `created_by`),
apply the migrations below to add and backfill UUID-contract columns used by the current app
(`project_uuid`, `owner_user_id`, `created_at`, `updated_at`):

```bash
backend/.venv/bin/python backend/database/apply_migration.py \
  backend/database/migrations/20260502_projects_uuid_contract.sql

backend/.venv/bin/python backend/database/apply_migration.py \
  backend/database/migrations/20260503_projects_legacy_not_null_relax.sql
```

Both migrations are idempotent and keep legacy columns for rollback compatibility.

If project creation fails with:
`null value in column "created_by" of relation "projects" violates not-null constraint`
run the second migration (`20260503_projects_legacy_not_null_relax.sql`) immediately.

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
