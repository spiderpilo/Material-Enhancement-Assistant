-- Fix-up for databases that applied 20260922 before its projects index was
-- corrected. GET /projects orders by created_at DESC NULLS LAST; the earlier
-- (owner_user_id, created_at DESC, id DESC) index sorts NULLs first, so Postgres
-- still ran a Sort over every project of the user before applying LIMIT.
--
-- Idempotent: safe to re-run, and a no-op on databases migrated from scratch.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_projects_owner_user_id_created_at_nulls_last
    ON public.projects USING btree (owner_user_id, created_at DESC NULLS LAST, id DESC);

DROP INDEX IF EXISTS public.idx_projects_owner_user_id_created_at;

COMMIT;
