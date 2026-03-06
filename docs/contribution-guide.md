# Contribution Guide

Thank you for contributing to Material Enhancement Assistant.

This project is being developed as a collaborative educational tool to help professors improve course materials while keeping full instructor control over all final changes. To keep the codebase clean and easy to work with, please follow the guidelines below.

## Project Goals

The goal of this project is to build a system that:

- accepts professor slides and documents in multiple formats
- uses an LLM to improve clarity and student understanding
- grounds revisions in the course textbook
- requires professor approval before changes are finalized
- returns materials in a usable output format

## General Contribution Rules

- Keep code modular and easy to understand
- Prefer readability over cleverness
- Write code that matches the existing structure of the project
- Add comments only when they improve clarity
- Avoid large unrelated changes in a single commit
- Keep documentation updated when making architectural or workflow changes

## Project Structure Overview

- `backend/` contains the FastAPI backend and document-processing logic
- `frontend/` contains the user interface
- `docs/` contains planning and architecture documents
- `data/` contains local working files such as textbooks and processed documents

## Branching

Do not work directly on `main` for major changes.

Create a feature branch for your work.

Examples:

- `feature/upload-endpoint`
- `feature/textbook-ingestion`
- `feature/llm-rewrite-pipeline`
- `fix/parser-bug`
- `docs/update-architecture`

## Commit Style

Use short, clear commit messages.

Recommended format:

- `feat: add PDF parser service`
- `feat: implement textbook chunking`
- `fix: correct upload file validation`
- `docs: update contribution guide`
- `refactor: simplify llm service logic`

Try to keep each commit focused on one logical change.

## Pull Requests

When submitting a pull request:

1. Clearly explain what was changed
2. Explain why the change was needed
3. Mention any files or areas affected
4. Include screenshots if the frontend was changed
5. Mention any future work that still remains

Good pull requests are easy to review and focused on a single feature or fix.

## Backend Guidelines

- Keep API route files thin
- Put core logic inside `services/`
- Use `models/` to define structured data
- Put small reusable helpers in `utils/`
- Do not hardcode secrets or API keys
- Use `config.py` or environment variables for settings

### Example backend responsibility split

- `api/` receives requests and returns responses
- `services/` performs the main work
- `models/` defines data structure
- `utils/` contains helper functions

## Frontend Guidelines

- Keep components focused and reusable
- Put API request logic in `src/services/api.js`
- Avoid duplicating request logic across components
- Keep UI clean and readable
- Prioritize usability for instructors reviewing changes

## Documentation Guidelines

Documentation is an important part of this project.

Please update documentation when you change:

- project structure
- major features
- architecture
- development workflow
- AI prompting strategy

Relevant docs include:

- `project-plan.md`
- `architecture.md`
- `roadmap.md`
- `llm-design.md`

## Coding Style

### Python
- follow clear naming conventions
- keep functions focused
- avoid unnecessarily large files
- write beginner-readable code when possible

### JavaScript / React
- use descriptive component names
- keep components small and modular
- separate presentation from API logic when possible

## Testing and Validation

Before submitting work:

- make sure the code runs
- check for obvious errors
- verify that file paths and imports work
- confirm that your changes do not break existing structure

As the project grows, formal testing will be added.

## Areas Contributors Can Help With

Examples of useful contribution areas:

- file upload handling
- PDF and DOCX parsing
- OCR for images
- textbook chunking and embedding
- retrieval logic
- LLM prompt formatting
- review and approval UI
- export formatting
- accessibility improvements
- documentation improvements

## Communication

If you are unsure where to contribute, start by checking:

- `docs/project-plan.md`
- `docs/roadmap.md`
- open issues or team discussion

When working with others, communicate clearly about:

- what you are building
- which files you are changing
- whether your work depends on another feature

## Final Principle

This project is not just about generating AI output. It is about building a trustworthy academic assistant that supports learning while keeping professors in control.

Contributions should reflect that goal.