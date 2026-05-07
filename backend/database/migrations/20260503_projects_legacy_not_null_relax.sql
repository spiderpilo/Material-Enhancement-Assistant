-- Relax legacy NOT NULL columns on public.projects that may still exist in mixed-contract environments.
-- Safe to re-run (idempotent).

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.projects') IS NULL THEN
    RAISE NOTICE 'public.projects table not found; skipping legacy NOT NULL relax migration.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.projects
      ALTER COLUMN created_by DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'owner_auth_user_id'
  ) THEN
    ALTER TABLE public.projects
      ALTER COLUMN owner_auth_user_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'created_on'
  ) THEN
    ALTER TABLE public.projects
      ALTER COLUMN created_on DROP NOT NULL;
  END IF;
END $$;

COMMIT;
