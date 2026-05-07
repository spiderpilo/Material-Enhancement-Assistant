-- Migrate public.projects from legacy auth-owner contract to UUID project contract.
-- Safe to re-run (idempotent). Keeps legacy columns for rollback window.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_uuid uuid,
  ADD COLUMN IF NOT EXISTS owner_user_id text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.projects
SET owner_user_id = owner_auth_user_id
WHERE owner_user_id IS NULL
  AND owner_auth_user_id IS NOT NULL;

UPDATE public.projects
SET created_at = created_on
WHERE created_at IS NULL
  AND created_on IS NOT NULL;

UPDATE public.projects
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE public.projects
SET updated_at = COALESCE(created_on, created_at, NOW())
WHERE updated_at IS NULL;

UPDATE public.projects
SET project_uuid = gen_random_uuid()
WHERE project_uuid IS NULL;

ALTER TABLE public.projects
  ALTER COLUMN project_uuid SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.projects WHERE owner_user_id IS NULL) THEN
    RAISE EXCEPTION
      USING MESSAGE = 'projects.owner_user_id contains NULL rows after backfill. Resolve rows before enforcing NOT NULL.';
  END IF;
END $$;

ALTER TABLE public.projects
  ALTER COLUMN project_uuid SET NOT NULL,
  ALTER COLUMN owner_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_project_uuid_key'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_project_uuid_key UNIQUE (project_uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_owner_user_id
  ON public.projects (owner_user_id);

CREATE OR REPLACE FUNCTION public.projects_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_set_updated_at ON public.projects;

CREATE TRIGGER trg_projects_set_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.projects_set_updated_at();

COMMIT;
