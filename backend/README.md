# Backend

The backend is responsible for document processing, LLM integration, and textbook retrieval.

## Responsibilities

• Document parsing  
• OCR for images and scanned documents  
• Textbook ingestion and vector storage  
• LLM prompt generation and response handling  
• Suggestion generation  
• Exporting improved documents  

## Framework

FastAPI is used to build the API because of its performance and strong support for Python AI tooling.

## Core Modules

api/  
Defines API endpoints.

services/  
Contains core logic such as LLM interaction and document parsing.

models/  
Defines internal data structures.

utils/  
Utility functions used throughout the backend.