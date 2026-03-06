# Material Enhancement Assistant

Material Enhancement Assistant is an AI-powered educational tool designed to help professors improve the clarity and accessibility of course materials while maintaining full instructor control.

The system takes lecture slides, documents, or images and uses a Large Language Model (LLM) to suggest improvements that make the material easier for students to understand. These improvements are grounded in the course textbook and must be approved by the professor before being applied.

## Key Features

• Accepts multiple document formats (PDF, DOCX, images, etc.)  
• Uses LLMs to improve clarity, structure, and readability  
• References the course textbook to ensure accuracy  
• Requires professor approval for all changes  
• Preserves the original document format when exporting  

## Example Workflow

1. Professor uploads lecture slides or course materials  
2. The system parses and analyzes the document  
3. Relevant textbook sections are retrieved  
4. The LLM proposes clearer explanations and formatting  
5. Professor reviews the changes in a side-by-side interface  
6. Approved revisions are exported back into the original format

## Tech Stack (Planned)

Frontend  
- Next.js / React  
- Tailwind CSS  

Backend  
- FastAPI (Python)

AI
- OpenAI or Claude LLM APIs
- Retrieval-Augmented Generation (RAG)

Database
- PostgreSQL + pgvector

Document Processing
- PyMuPDF
- python-docx
- OCR for images and scanned documents

Storage
- S3 or Supabase Storage

## Project Structure
docs/ → architecture, roadmap, and project documentation
backend/ → API, document processing, and LLM integration
frontend/ → user interface and approval workflow
data/ → textbook storage and processed document data


## Status

Early development.

This project is currently being built by members of the AI club as an educational tool to assist instructors and students.

## Contributing

See `docs/contribution-guide.md` for contribution guidelines.

## License

MIT License