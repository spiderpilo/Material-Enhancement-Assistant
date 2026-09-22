-- Add Gemini-backed RAG indexing for uploaded project materials.
-- Safe to re-run (idempotent).

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.course_contents
  ADD COLUMN IF NOT EXISTS project_id bigint,
  ADD COLUMN IF NOT EXISTS content_sha256 text,
  ADD COLUMN IF NOT EXISTS rag_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rag_chunk_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rag_error text;

UPDATE public.course_contents AS course_content
SET project_id = project_material.project_id
FROM public.project_materials AS project_material
WHERE course_content.project_id IS NULL
  AND project_material.material_id = course_content.id;

UPDATE public.course_contents
SET rag_status = 'pending'
WHERE rag_status IS NULL;

UPDATE public.course_contents
SET rag_chunk_count = 0
WHERE rag_chunk_count IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'course_contents_rag_status_check'
      AND conrelid = 'public.course_contents'::regclass
  ) THEN
    ALTER TABLE public.course_contents
      ADD CONSTRAINT course_contents_rag_status_check
      CHECK (rag_status IN ('pending', 'ready', 'failed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_contents_project_content_sha256_unique
  ON public.course_contents (project_id, content_sha256)
  WHERE project_id IS NOT NULL AND content_sha256 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_course_contents_project_rag_status
  ON public.course_contents (project_id, rag_status);

CREATE TABLE IF NOT EXISTS public.course_content_chunks (
  id bigserial PRIMARY KEY,
  project_id bigint NOT NULL,
  course_content_id bigint NOT NULL REFERENCES public.course_contents(id) ON DELETE CASCADE,
  material_name text NOT NULL,
  chunk_index integer NOT NULL,
  text text NOT NULL,
  start_char integer,
  end_char integer,
  location_kind text,
  location_start integer,
  location_end integer,
  embedding vector(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (course_content_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_course_content_chunks_project_id
  ON public.course_content_chunks (project_id);

CREATE INDEX IF NOT EXISTS idx_course_content_chunks_course_content_id
  ON public.course_content_chunks (course_content_id);

CREATE INDEX IF NOT EXISTS idx_course_content_chunks_embedding_ivfflat
  ON public.course_content_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE OR REPLACE FUNCTION public.match_course_content_chunks(
  query_embedding vector(768),
  filter_project_id bigint,
  match_count integer DEFAULT 8,
  filter_material_id bigint DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  project_id bigint,
  course_content_id bigint,
  material_name text,
  chunk_index integer,
  text text,
  start_char integer,
  end_char integer,
  location_kind text,
  location_start integer,
  location_end integer,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    chunk.id,
    chunk.project_id,
    chunk.course_content_id,
    chunk.material_name,
    chunk.chunk_index,
    chunk.text,
    chunk.start_char,
    chunk.end_char,
    chunk.location_kind,
    chunk.location_start,
    chunk.location_end,
    1 - (chunk.embedding <=> query_embedding) AS similarity
  FROM public.course_content_chunks AS chunk
  JOIN public.course_contents AS course_content
    ON course_content.id = chunk.course_content_id
  WHERE chunk.project_id = filter_project_id
    AND course_content.rag_status = 'ready'
    AND (filter_material_id IS NULL OR chunk.course_content_id = filter_material_id)
  ORDER BY chunk.embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMIT;
