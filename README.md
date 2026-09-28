# Material Enhancement Assistant

Material Enhancement Assistant is an AI-powered educational tool that helps professors improve the clarity and accessibility of course materials while keeping instructors in control of every change.

The current repository includes:
- a FastAPI backend for document upload, retrieval-augmented (RAG) project chat, quiz generation, and slide deck generation
- a Next.js workspace for uploading sources, previewing them, chatting with them, and running the AI tools

## Local Development

Run the backend and frontend in separate terminals.

### Backend

From the repository root:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
```

Create a repository-root `.env` file (start from `.env.example`). The backend loads environment variables from the project root.
AI features use three providers:

```env
# Gemini: quiz generation, clarity rewrites, and the embeddings behind chat retrieval
GOOGLE_GEMINI_API_KEY=your_api_key_here
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768

# DeepSeek: project chat answers
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_CHAT_MODEL=deepseek-v4-pro

# Cerebras: slide deck outlines (the Slide Deck tool is disabled in the UI while in beta)
CEREBRAS_API_KEY=your_api_key_here
CEREBRAS_SLIDE_MODEL=gpt-oss-120b
```


Start the FastAPI server:

```bash
uvicorn app.main:app --reload --app-dir backend
```

Backend URLs:
- API base: `http://127.0.0.1:8000`
- Health check: `http://127.0.0.1:8000/health`

API docs (Swagger UI, grouped by feature, with an **Authorize** button for bearer tokens): `http://127.0.0.1:8000/docs`. See `backend/README.md` for the auth flow, migrations, and tests.
### Frontend

From the `frontend/` directory:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The frontend calls `http://127.0.0.1:8000` by default. To use another backend, set `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local` (or in the repo-root `.env` when running through Docker Compose).

## Docker Development

This repository now includes a Docker Compose setup for local development.

Create a repo-root `.env` file with Neon, JWT, and S3 storage settings before testing uploads:

```bash
cp .env.example .env
```

Start both services:

```bash
docker compose up --build
```

Run the same stack in watch mode:

```bash
docker compose watch
```

Available URLs:
- frontend: `http://localhost:3000`
- backend API: `http://localhost:8000`
- backend health check: `http://localhost:8000/health`

Useful commands:

```bash
docker compose up --build
docker compose watch
docker compose down
docker compose logs -f backend
docker compose logs -f frontend
```

Notes:
- The Compose setup is geared toward development, not production deployment.
- `docker compose watch` syncs source changes into the running containers.
- Changing `backend/requirements.txt`, `frontend/package.json`, or `frontend/package-lock.json` triggers a rebuild.
- Gemini, DeepSeek, Cerebras, Neon, JWT, and S3 storage settings are passed through from your shell or repo-root `.env` via Compose variable expansion.
- Uploads accept PDF, DOCX, and PPTX files up to 50MB and create a `course_contents` row after the S3 storage upload succeeds.
- Uploaded files are indexed for RAG chat in the background. The original file remains stored for previews, quizzes, and slide deck generation.

## Project Chat

The **Conversation** panel in a project answers questions from the selected sources, and answers stream in as they are written.

1. The question moves into the conversation, and the composer clears right away.
2. A thinking bubble shows a spinning orb and a shimmering status that follows the backend's progress: "Searching your sources", then "Reading N sources". The retrieved sources appear as numbered chips.
3. While the model reasons, the status moves on to "Connecting the key ideas" and "Drafting an answer".
4. The answer fades in piece by piece behind a pulsing caret. The panel stays pinned to the newest text unless you scroll up.
5. When the answer finishes, the backend saves the exchange and the bubble settles into the saved copy.

How it works:
- The frontend calls `POST /projects/{project_uuid}/chat/stream`. It returns Server-Sent Events: `status`, `sources`, `delta` (answer text), then `done` (the saved conversation), or `error`.
- Retrieval uses Gemini embeddings over pgvector chunks. DeepSeek writes the answer as plain text.
- Only uploads with a finished index (`rag_status = ready`) can be searched.
- The exchange is saved only when the answer completes. A failed or abandoned answer leaves the stored conversation unchanged, and a failed question goes back into the composer.
- All chat motion is turned off when the operating system asks for reduced motion.
- `POST /projects/{project_uuid}/chat` still returns the whole answer in one response, for API clients that do not stream.

See `backend/README.md` for the event format and a curl example.

## Deployment (Render)

Production runs as two Render web services built from Docker images, with Neon for Postgres and object storage.

```
PR ──> CI: config check, backend tests (pgvector), frontend lint/types,
        Docker builds smoke-tested on port 10000          ──> "CI result" check
merge to main ──> Deploy: CI again on the merged commit
                  ──> push images to GHCR as :<sha>
                  ──> backend: fail if Neon migrations are pending
                  ──> Render deploy hook ?imgURL=...:<sha>
                  ──> wait for /health to report <sha>, check /health/db
                  ──> frontend (after backend), same steps with /api/health
                  ──> move :main to the live image
```

Only services whose files changed are rebuilt and deployed. Run **Deploy** manually (Actions tab) to redeploy both.

### One-time setup

1. **Render**: New → Blueprint → this repo (`render.yaml`). First add a registry credential named `ghcr` (Render → Settings → Registry Credentials) using a GitHub username and a classic personal access token with `read:packages`. Enter the `sync: false` secrets when prompted. `DATABASE_URL` must be the **pooled** Neon URL, and `CORS_ALLOWED_ORIGINS` must be the frontend's Render URL. The first deploy needs the images to exist, so run the **Deploy** workflow once before applying the Blueprint, or let the first Blueprint deploy fail and redeploy afterwards.
2. **Render deploy hooks**: copy each service's Deploy Hook URL (Settings → Deploy Hook).
3. **GitHub**: create an environment named `production` (Settings → Environments). Add required reviewers if deploys and migrations should need approval. Then configure:

   | Name | Kind | Value |
   | --- | --- | --- |
   | `RENDER_BACKEND_DEPLOY_HOOK` | environment secret | backend deploy hook URL |
   | `RENDER_FRONTEND_DEPLOY_HOOK` | environment secret | frontend deploy hook URL |
   | `NEON_DIRECT_URL` | environment secret | Neon **direct** (non-pooler) connection string |
   | `BACKEND_URL` | repository variable | e.g. `https://mea-backend.onrender.com` |
   | `FRONTEND_URL` | repository variable | e.g. `https://mea-frontend.onrender.com` |
   | `NEXT_PUBLIC_API_BASE_URL` | repository variable | same as `BACKEND_URL` (built into the frontend bundle) |

4. **Branch protection** on `main`: require the `CI result` status check.

Secrets only live in Render and GitHub. They are never written to images (the only frontend build arg is the public API URL), and the deploy script never prints the hook URL.

### Migrations

Migrations never run automatically. After merging a PR that adds a file to `backend/database/migrations/`, the backend deploy stops at **Check migrations applied** until someone runs **Actions → Migrate database**. Run it first with `apply` unchecked to list the pending files, then again with `apply` checked. Migrations must be additive and idempotent: the old backend keeps serving traffic while they run. First time only: production has no `schema_migrations` table yet, so the first run records the two post-baseline migrations. They are idempotent, so re-running them is safe.

### Rollback

**Actions → Rollback** redeploys an earlier `:<sha>` image for one service without rebuilding. Database migrations are not reverted.

## Example Workflow

1. Professor uploads lecture slides or course materials.
2. The system parses and analyzes the document.
3. Relevant textbook sections are retrieved.
4. The LLM proposes clearer explanations and formatting.
5. Professor reviews the changes in a side-by-side interface.
6. Approved revisions are exported back into the original format.

## Current Stack

Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS

Backend
- FastAPI
- Uvicorn
- PyMuPDF
- python-docx

AI
- Google GenAI SDK: Gemini for quizzes, clarity rewrites, and embeddings
- OpenAI SDK against OpenAI-compatible APIs: DeepSeek for streamed project chat, Cerebras for slide deck outlines
- pgvector for retrieval over indexed course material

## Project Structure

- `docs/` architecture, roadmap, and project documentation
- `backend/` API, document processing, and LLM integration
- `frontend/` user interface and approval workflow
- `data/` textbook storage and processed document data

## Status

Early development.

This project is currently being built by members of the AI club as an educational tool to assist instructors and students.

## Contributing

See `docs/contribution-guide.md` for contribution guidelines.

## License

MIT License
