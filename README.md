# Material Enhancement Assistant

Material Enhancement Assistant is an AI-powered educational tool that helps professors improve the clarity and accessibility of course materials while keeping instructors in control of every change.

The current repository includes:
- a FastAPI backend for document upload and text extraction
- a Next.js frontend for the course content upload interface

## Local Development

Run the backend and frontend in separate terminals.

### Backend

From the repository root:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
```

Create a repository-root `.env` file. The backend loads environment variables from the project root and expects one of the following API keys:

```env
GOOGLE_GEMINI_API_KEY=your_api_key_here
```

You can also use `GEMINI_API_KEY` or `GOOGLE_API_KEY`.

Start the FastAPI server:

```bash
uvicorn app.main:app --reload --app-dir backend
```

Backend URLs:
- API base: `http://127.0.0.1:8000`
- Health check: `http://127.0.0.1:8000/health`

The current backend exposes:
- `GET /health`
- `POST /upload-doc`
- `POST /create-account`
POST /login-account
### Frontend

From the `frontend/` directory:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Set `NEXT_PUBLIC_BACKEND_URL= ` in the repo-root `.env` so the account creation page can submit to the FastAPI backend.

## Docker Development

This repository now includes a Docker Compose setup for local development.

Create a repo-root `.env` file if you want the upload endpoint to call Gemini:

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
- Gemini API keys are passed through from your shell or repo-root `.env` via Compose variable expansion.

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
- Google GenAI SDK with Gemini model support

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
