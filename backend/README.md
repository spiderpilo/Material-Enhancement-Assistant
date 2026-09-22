# Backend

Minimal FastAPI backend for local testing.

## Endpoints

The full, grouped contract is in Swagger UI at `http://127.0.0.1:8000/docs` (OpenAPI JSON at `/openapi.json`). Every route except `POST /create-account`, `POST /login-account`, `POST /refresh-token`, `GET /`, and `GET /health` requires a bearer access token.

| Tag | Routes |
| --- | --- |
| Authentication | `POST /create-account`, `POST /login-account`, `POST /refresh-token`, `POST /logout`, `GET /me` |
| Projects | `GET/POST /projects`, `GET/PATCH/DELETE /projects/{project_uuid}` |
| Course materials | `POST /upload-doc`, `GET /course-contents/{id}/preview`, `GET /course-contents/{id}/file`, `PATCH/DELETE /course-contents/{id}` |
| Project chat | `GET/POST/DELETE /projects/{project_uuid}/chat` |
| Generated materials | `GET /projects/{project_uuid}/generated-materials`, `POST /projects/{project_uuid}/slide-decks/generate`, `GET .../generated-materials/{uuid}/download` |
| Quiz | `POST /quiz/generate` |
| System | `GET /`, `GET /health` |

### Authentication

- `POST /create-account` and `POST /login-account` both return `access_token`, `refresh_token`, `token_type` (`bearer`), `expires_in`, and `refresh_expires_in` (seconds), plus the user. Create-account also returns `auth_user_id` and `profile`. Duplicate email or username returns `409`.
- Each sign-in is its own row in `auth_sessions` (one per browser). Tokens are HS256 JWTs signed with `JWT_SECRET` and carry the session id (`sid`).
- Access tokens last `JWT_ACCESS_TOKEN_TTL_SECONDS` (default 1h) and stop working immediately when their session is revoked.
- `POST /refresh-token` with `{ "refresh_token": "..." }` returns a new pair and invalidates the old refresh token. Reusing an already-used refresh token revokes the whole session (theft detection). Refresh extends the session by `JWT_REFRESH_TOKEN_TTL_SECONDS` (default 30d).
- `POST /logout` revokes the caller's session only; other browsers stay signed in.
- The frontend keeps tokens in `localStorage`, so a copied link opened in another browser asks for sign-in there. That is per-browser isolation, not a bug. Within one browser, expired access tokens are refreshed automatically.
- Unauthenticated requests get `401` with `WWW-Authenticate: Bearer`. Ownership is enforced server-side from the token, never from request data.

**Testing in Swagger UI:** call `POST /login-account` (or `POST /create-account`), copy `access_token` from the response, click **Authorize**, paste the token (without `Bearer`), and call protected routes. Swagger keeps it across page reloads. When it expires, call `POST /refresh-token` and authorize again with the new token.

`POST /projects` accepts optional JSON body `{ "name"?: string }`. If omitted, the backend creates `Untitled Project`. `owner_user_id` always comes from the bearer token, never from client payload.

`GET /projects` returns `{ "projects": ProjectSummary[] }` ordered newest-first (by `created_at`).

`GET /projects/{project_uuid}` returns one owned project record. It returns `404` when the UUID does not exist or belongs to another user.

`GET /projects/{project_uuid}/generated-materials?tool=quiz` returns newest-first saved quiz history for the owned project.

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

`POST /upload-doc` accepts a PDF, DOCX, or PPTX file up to 50MB, uploads it to the S3-compatible bucket, inserts a `course_contents` row, queues preview rendering and RAG indexing, and returns the inserted record with preview/RAG metadata. If the same file bytes already exist in the same project, the endpoint returns `409`.

`POST /quiz/generate` now requires JSON body:
- `project_uuid` (string)
- `material_ids` (array of course content ids)
- `question_count` (`12`)

The endpoint generates a quiz and persists it to `generated_materials` with `tool_type='quiz'`.

`GET /course-contents/{id}/preview` returns the current preview manifest for a source. While rendering is still running it returns `preview_status: "pending"`. When ready it returns ordered page or slide image URLs. Preview state is stored on the `course_contents` row.

`GET /course-contents/{id}/file` checks that the original upload exists in storage and returns `{ url, content_type, size, ... }`. The project view uses it to show PDFs inline. A missing object returns `404` with a re-upload hint; a stored URL outside the bucket returns `422`.

`POST /create-account` inserts a bcrypt-hashed `auth_users` row, the matching `users` profile row, and the first session in one transaction.

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
GOOGLE_GEMINI_API_KEY=your-gemini-api-key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
DATABASE_URL=postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=at-least-32-random-characters
S3_ENDPOINT_URL=https://<branch-id>.storage.<cell>.<region>.aws.neon.tech
S3_REGION=us-east-2
S3_BUCKET=course-contents
S3_ACCESS_KEY_ID=your-neon-storage-key-id
S3_SECRET_ACCESS_KEY=your-neon-storage-secret
STORAGE_PUBLIC_URL=https://<branch-id>.storage.<cell>.<region>.aws.neon.tech/course-contents
```

Files live in Neon object storage (S3-compatible, path-style). Create the bucket with **Visibility: Public** in the Neon console (Object storage -> Create bucket); visibility cannot be changed after creation. Credentials come from Connect -> Storage -> `.env` (`AWS_*` names there map to the `S3_*` names here).

`access_url` stores the stable public object URL (`STORAGE_PUBLIC_URL/<key>`) written to `course_contents`. It is not a signed URL, so the bucket must allow public reads.

## Database Setup (Neon)

Fresh database:

```bash
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f backend/database/neon/schema.sql
```

`schema.sql` is the Neon baseline (pgvector, all `public` tables/functions, and `auth_users`). Dated migrations before `20260922` are the Supabase history that produced it and do not need to be replayed. Apply the later ones in order, then backfill preview state:

```bash
backend/.venv/bin/python backend/database/apply_migration.py backend/database/migrations/20260922_perf_indexes_preview_state_auth_sessions.sql
backend/.venv/bin/python backend/database/apply_migration.py backend/database/migrations/20260923_projects_owner_index_nulls_last.sql
backend/.venv/bin/python backend/scripts/backfill_preview_state.py --regenerate-missing
```

The migration files document which queries each index serves.

## Migrating From Supabase

1. Build the restore SQL from a Supabase cluster backup (keeps all `public` rows, copies `auth.users` into `auth_users` with their bcrypt hashes, rewrites stored Supabase object URLs):

   ```bash
   python backend/database/neon/build_neon_migration.py ~/Downloads/db_cluster-<date>.backup.gz \
     --storage-public-url "$STORAGE_PUBLIC_URL"
   ```

2. Restore into an empty Neon database with the direct (non-pooled) connection:

   ```bash
   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f backend/database/neon/out/neon_restore.sql
   ```

3. Copy files out of Supabase Storage (needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` plus the S3 settings):

   ```bash
   backend/.venv/bin/python backend/scripts/migrate_supabase_storage.py --dry-run
   backend/.venv/bin/python backend/scripts/migrate_supabase_storage.py
   ```

   If the Supabase project is already gone, copy from a local download of the bucket instead (relative paths must be the object keys):

   ```bash
   backend/.venv/bin/python backend/scripts/migrate_supabase_storage.py --source-dir ~/Downloads/<project-ref>/course-contents
   ```

Existing users keep their passwords but must sign in again: Supabase-issued tokens are not accepted. `backend/database/neon/out/` is gitignored because it contains user data and password hashes.

## Project Schema Migration (UUID Contract + Legacy Constraint Relax)

If an older database's `projects` table still uses legacy columns (`owner_auth_user_id`, `created_on`, `created_by`),
apply the migrations below to add and backfill UUID-contract columns used by the current app
(`project_uuid`, `owner_user_id`, `created_at`, `updated_at`):

```bash
backend/.venv/bin/python backend/database/apply_migration.py \
  backend/database/migrations/20260502_projects_uuid_contract.sql

backend/.venv/bin/python backend/database/apply_migration.py \
  backend/database/migrations/20260503_projects_legacy_not_null_relax.sql
```

Both migrations are idempotent and keep legacy columns for rollback compatibility.

To support quiz persistence payloads and source tracking, apply:

```bash
backend/.venv/bin/python backend/database/apply_migration.py \
  backend/database/migrations/20260525_generated_materials_tool_payload.sql
```

To support Gemini RAG chat indexing and duplicate upload detection, apply:

```bash
backend/.venv/bin/python backend/database/apply_migration.py \
  backend/database/migrations/20260704_rag_chat_gemini_pgvector.sql
```

To persist the latest 10 project chat messages, apply:

```bash
backend/.venv/bin/python backend/database/apply_migration.py \
  backend/database/migrations/20260726_project_chat_memory.sql
```

If project creation fails with:
`null value in column "created_by" of relation "projects" violates not-null constraint`
run the second migration (`20260503_projects_legacy_not_null_relax.sql`) immediately.

## Tests

Integration tests run against a throwaway Postgres with pgvector in Docker, never Neon (the fixtures refuse `neon.tech` URLs). Storage is faked in memory, and Gemini keys are blanked.

```bash
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
eval "$(backend/scripts/test_db.sh start)"
cd backend && .venv/bin/python -m pytest
backend/scripts/test_db.sh stop
```

`tests/test_performance.py` caps SQL statements and storage calls per request. Each statement is one network round trip to Neon (~150–200 ms from a laptop), so a failing budget means a real latency regression.

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

Compose passes Gemini, Neon, JWT, and S3 settings through from your shell or repo-root `.env`. The backend container also installs LibreOffice so DOCX and PPTX uploads can be converted into rendered preview images.

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
  "access_url": "https://files.your-domain.com/course-contents/uuid/lecture1.pdf",
  "data_size": 12345,
  "source_type": "pdf",
  "preview_status": "pending",
  "preview_count": 0,
  "rag_status": "pending",
  "rag_chunk_count": 0
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
