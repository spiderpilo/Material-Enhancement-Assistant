## Project Structure

```text
Material-Enhancement-Assistant
├── README.md
├── backend
│   ├── README.md
│   ├── app
│   │   ├── api
│   │   │   ├── approval.py
│   │   │   ├── process.py
│   │   │   └── upload.py
│   │   ├── config.py
│   │   ├── main.py
│   │   ├── models
│   │   │   ├── document_model.py
│   │   │   ├── revision_model.py
│   │   │   └── textbook_model.py
│   │   ├── services
│   │   │   ├── embedding_service.py
│   │   │   ├── export_service.py
│   │   │   ├── llm_service.py
│   │   │   └── parser_service.py
│   │   └── utils
│   │       ├── file_utils.py
│   │       └── text_utils.py
│   └── requirements.txt
├── data
│   ├── README.md
│   ├── processed_docs
│   └── textbooks
├── docs
│   ├── README.md
│   ├── architecture.md
│   ├── contribution-guide.md
│   ├── llm-design.md
│   ├── project-plan.md
│   └── roadmap.md
└── frontend
    ├── README.md
    └── src
        ├── components
        ├── pages
        └── services
```

### Directory Overview

backend/  
Contains the FastAPI server responsible for document processing, LLM interaction, and textbook retrieval.

frontend/  
Contains the React/Next.js user interface for uploading materials and reviewing AI-generated suggestions.

docs/  
Project planning documents including architecture, roadmap, and contribution guidelines.

data/  
Local storage for textbooks and processed document outputs.