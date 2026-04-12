# Frontend

This directory now contains a working Next.js App Router project with Tailwind CSS v4, TypeScript, and ESLint.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

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
- Add API integration for upload, review, and approval flows.
- Expand the starter page into the professor review interface.
