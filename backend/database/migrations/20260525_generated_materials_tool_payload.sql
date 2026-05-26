-- Extend generated_materials for tool-specific payload storage (quiz first).
-- Safe to re-run (idempotent).

BEGIN;

ALTER TABLE public.generated_materials
  ADD COLUMN IF NOT EXISTS tool_type text;

UPDATE public.generated_materials
SET tool_type = 'quiz'
WHERE tool_type IS NULL;

ALTER TABLE public.generated_materials
  ALTER COLUMN tool_type SET DEFAULT 'quiz',
  ALTER COLUMN tool_type SET NOT NULL;

ALTER TABLE public.generated_materials
  ADD COLUMN IF NOT EXISTS source_material_ids bigint[];

UPDATE public.generated_materials
SET source_material_ids = '{}'::bigint[]
WHERE source_material_ids IS NULL;

ALTER TABLE public.generated_materials
  ALTER COLUMN source_material_ids SET DEFAULT '{}'::bigint[],
  ALTER COLUMN source_material_ids SET NOT NULL;

ALTER TABLE public.generated_materials
  ADD COLUMN IF NOT EXISTS payload jsonb;

UPDATE public.generated_materials
SET payload = '{}'::jsonb
WHERE payload IS NULL;

ALTER TABLE public.generated_materials
  ALTER COLUMN payload SET DEFAULT '{}'::jsonb,
  ALTER COLUMN payload SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_generated_materials_project_tool_created_at
  ON public.generated_materials (project_uuid, tool_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_materials_source_material_ids_gin
  ON public.generated_materials USING GIN (source_material_ids);

COMMIT;
