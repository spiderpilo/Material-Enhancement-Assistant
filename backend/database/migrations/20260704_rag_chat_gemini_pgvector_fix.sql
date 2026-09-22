-- Correct an already-applied OpenAI/1536-dimension RAG migration for Gemini embeddings.
-- This resets stored chunk rows because existing vectors cannot be converted from
-- OpenAI 1536 dimensions to Gemini 768 dimensions.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

DROP FUNCTION IF EXISTS public.match_course_content_chunks(
  vector(1536),
  bigint,
  integer,
  bigint
);

DROP FUNCTION IF EXISTS public.match_course_content_chunks(
  vector(768),
  bigint,
  integer,
  bigint
);

DROP INDEX IF EXISTS public.idx_course_content_chunks_embedding_ivfflat;

TRUNCATE TABLE public.course_content_chunks;

ALTER TABLE public.course_content_chunks
  ALTER COLUMN embedding TYPE vector(768);

ALTER TABLE public.course_content_chunks
  ADD COLUMN IF NOT EXISTS location_kind text,
  ADD COLUMN IF NOT EXISTS location_start integer,
  ADD COLUMN IF NOT EXISTS location_end integer;

CREATE INDEX IF NOT EXISTS idx_course_content_chunks_embedding_ivfflat
  ON public.course_content_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

UPDATE public.course_contents
SET
  rag_status = 'failed',
  rag_chunk_count = 0,
  rag_error = 'RAG index reset for Gemini embeddings. Delete and re-upload this material to make chat retrieval available.'
WHERE rag_status IN ('pending', 'ready')
   OR rag_chunk_count <> 0
   OR rag_error IS NULL;

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
