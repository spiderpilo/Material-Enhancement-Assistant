# LLM Design

## Purpose

The LLM in Material Enhancement Assistant is used to improve the clarity, readability, and student accessibility of professor-provided materials while preserving academic accuracy and instructor intent.

The model should act as a revision assistant, not as an autonomous author.

Its job is to suggest improvements, not to override the professor.

## Core Design Principles

### 1. Instructor Control
All LLM-generated changes must be reviewed and approved by the professor before being finalized.

### 2. Textbook Grounding
The LLM should use the course textbook as a reference whenever possible to keep revisions aligned with class material.

### 3. Accuracy Over Creativity
The model should prioritize correctness, clarity, and consistency over stylistic creativity.

### 4. Format Awareness
The system should preserve the structure of the original material as much as possible.

### 5. Traceable Changes
Every proposed revision should be explainable and tied to a reason.

## Primary Use Cases

The LLM may be used to:

- simplify dense academic wording
- reorganize confusing explanations
- rewrite bullet points more clearly
- add clearer transitions between ideas
- improve readability for students
- make explanations more direct and structured
- align wording with textbook-supported concepts

The LLM should not freely invent new course content.

## High-Level Workflow

1. Professor uploads course material
2. Document content is extracted by the parser
3. Relevant textbook sections are retrieved
4. The LLM receives:
   - extracted course material
   - retrieved textbook context
   - rewrite instructions
5. The LLM returns structured suggestions
6. The professor reviews and approves or rejects changes

## LLM Input Design

The LLM should not receive only a vague instruction like:

> make this easier to understand

Instead, the prompt should include clear constraints and context.

### Input Components

#### 1. Source Material
The extracted text from the uploaded slides or documents.

#### 2. Textbook Context
Relevant retrieved textbook chunks related to the uploaded material.

#### 3. System Instructions
Rules for how the model should behave.

#### 4. Output Format Instructions
A structured response format so the backend can process the result reliably.

## Recommended Model Behavior

The model should:

- preserve core meaning
- preserve technical correctness
- simplify wording when helpful
- avoid changing the instructor's intent
- stay consistent with textbook terminology
- avoid unsupported claims
- explain why a revision was suggested
- flag uncertainty rather than guess

## Recommended Output Structure

The model should ideally return structured data for each suggested change.

Example structure:

- original text
- revised text
- reason for revision
- supporting textbook reference
- confidence or uncertainty note

This makes professor review easier and keeps the pipeline organized.

## Example Prompt Strategy

### System Prompt
You are an academic content revision assistant. Your task is to improve clarity and student understanding while preserving academic accuracy, instructor intent, and alignment with the provided textbook context. Do not invent unsupported facts. Do not make final decisions on behalf of the professor. Return suggested revisions in a structured format.

### User Prompt Structure
- Original material:
  [insert extracted lecture material]

- Textbook context:
  [insert retrieved textbook chunks]

- Task:
  Rewrite the material to make it easier for students to understand. Preserve the original meaning and align changes with the textbook. For each change, provide the original text, revised text, and reason for the revision.

## Retrieval-Augmented Generation (RAG)

The textbook should not be sent in full with every request.

Instead, the system should use retrieval:

1. textbook is uploaded and parsed
2. textbook is split into chunks
3. chunks are embedded and stored
4. relevant chunks are retrieved for each document section
5. only the most relevant chunks are passed to the LLM

This reduces cost and improves relevance.

## Why RAG Is Important

RAG helps the project:

- stay grounded in course material
- reduce hallucinations
- improve consistency
- scale to larger textbooks
- avoid sending unnecessary context

## Safety and Reliability Rules

The LLM should avoid:

- inventing definitions not supported by the source
- changing the meaning of academic content
- adding examples that conflict with the textbook
- rewriting in a way that removes necessary technical detail
- presenting uncertain information as fact

If the model is unsure, it should say so in the output.

## Revision Philosophy

The goal is not to "dumb down" academic material.

The goal is to make material:

- easier to follow
- more structured
- less confusing
- more approachable for students

The revised content should still respect the course level and subject matter.

## Multi-Format Considerations

The LLM works on extracted text, not raw file formats.

That means:

- PDFs, DOCX files, and images are first parsed into text and structure
- the LLM operates on that internal representation
- the export system later reconstructs the output format

This separation is important because the LLM is not responsible for file formatting.

## Future Improvements

Potential future LLM features include:

- adjusting explanation difficulty level
- generating optional examples
- producing short summaries for each slide
- detecting unclear or overloaded slides
- generating student-friendly study notes
- supporting multilingual accessibility
- giving professors multiple revision style options

## Current Design Goal

The current goal is to use the LLM as a controlled, textbook-grounded academic revision assistant that improves clarity while keeping professors fully in control of the final material.