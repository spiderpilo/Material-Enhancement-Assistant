-- Add human-readable location metadata to stored RAG chunks.
-- Chunks remain the internal retrieval unit, while page/slide/section ranges
-- are exposed to chat answers and source summaries.

BEGIN;

ALTER TABLE public.course_content_chunks
  ADD COLUMN IF NOT EXISTS location_kind text,
  ADD COLUMN IF NOT EXISTS location_start integer,
  ADD COLUMN IF NOT EXISTS location_end integer;

DROP FUNCTION IF EXISTS public.match_course_content_chunks(
  vector(768),
  bigint,
  integer,
  bigint
);

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
