# Frontend

This directory now contains a working Next.js App Router project with Tailwind CSS v4, TypeScript, and ESLint.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

Set this in the repo-root `.env` when the backend runs on a non-default URL:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

The upload UI posts PDF, DOCX, and PPTX files to `POST /upload-doc`. After upload, the project workspace polls `GET /course-contents/{id}/preview` and swaps placeholder cards with rendered page or slide previews as soon as the backend finishes processing.

## Run With Docker

From the repository root:

```bash
docker compose up --build frontend
```

Or start both frontend and backend together:

```bash
docker compose up --build
```

The frontend will be available at `http://localhost:3000`.

To keep the frontend synced with local file edits:

```bash
docker compose watch frontend
```

## Available Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Structure

- `src/app/` contains the App Router layout, page, and global styles.
- `public/` contains static assets.
- `package.json` defines the frontend scripts and dependencies.

## Next Steps

- Build `UploadPanel`, `DiffViewer`, and `ApprovalPanel` under `src/components/`.
- Add review and approval API integration.
- Expand the starter page into the professor review interface.
