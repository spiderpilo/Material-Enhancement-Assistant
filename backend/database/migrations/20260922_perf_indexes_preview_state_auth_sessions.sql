-- Performance indexes, DB-backed preview state, and server-side auth sessions.
--
-- Apply with:
--   backend/.venv/bin/python backend/database/apply_migration.py \
--     backend/database/migrations/20260922_perf_indexes_preview_state_auth_sessions.sql
-- Then backfill preview state from storage:
--   backend/.venv/bin/python backend/scripts/backfill_preview_state.py
--
-- Idempotent: safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. project_materials had no primary key and no index at all.
--
--    Queries served:
--      * project detail / list: project_materials JOIN course_contents
--        WHERE project_id = $1                     -> (project_id, material_id)
--      * ownership checks: project_materials JOIN projects
--        WHERE material_id = $1 AND owner_user_id = $2   -> (material_id)
--      * FK cascades from course_contents(id) delete  -> (material_id)
--
--    The pair is also the natural key; a unique index stops the same material
--    being linked twice (verified no duplicates exist before adding it).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS project_materials_project_id_material_id_key
    ON public.project_materials USING btree (project_id, material_id);

CREATE INDEX IF NOT EXISTS idx_project_materials_material_id
    ON public.project_materials USING btree (material_id);

-- ---------------------------------------------------------------------------
-- 2. GET /projects: WHERE owner_user_id = $1 ORDER BY created_at DESC, id DESC LIMIT n
--    A composite index returns rows pre-sorted, so LIMIT stops early instead of
--    sorting every project the user owns. Supersedes the single-column index.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_owner_user_id_created_at
    ON public.projects USING btree (owner_user_id, created_at DESC, id DESC);

DROP INDEX IF EXISTS public.idx_projects_owner_user_id;

-- ---------------------------------------------------------------------------
-- 3. Preview state lived only in storage (course-content-previews/<id>/status.json),
--    so every project read made one storage GET per material. Keep it in the row.
-- ---------------------------------------------------------------------------
ALTER TABLE public.course_contents
    ADD COLUMN IF NOT EXISTS source_type text,
    ADD COLUMN IF NOT EXISTS preview_status text NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS preview_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS preview_error text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_contents_preview_status_check'
    ) THEN
        ALTER TABLE public.course_contents
            ADD CONSTRAINT course_contents_preview_status_check
            CHECK (preview_status = ANY (ARRAY['pending'::text, 'ready'::text, 'failed'::text]));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_contents_source_type_check'
    ) THEN
        ALTER TABLE public.course_contents
            ADD CONSTRAINT course_contents_source_type_check
            CHECK (source_type IS NULL OR source_type = ANY (ARRAY['pdf'::text, 'docx'::text, 'pptx'::text]));
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Server-side sessions so refresh tokens can rotate and be revoked.
--    One row per sign-in (per browser). A refresh token is valid only while its
--    jti equals current_refresh_jti; presenting an older jti means the token was
--    replayed, and the session is revoked. Access tokens carry the session id
--    (sid) and stop working as soon as the session is revoked (logout).
--
--    Queries served:
--      * every authenticated request: WHERE id = $sid        -> primary key
--      * refresh rotation: UPDATE ... WHERE id = $sid        -> primary key
--      * revoke all sessions for a user: WHERE user_id = $1  -> idx_auth_sessions_user_id
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    current_refresh_jti uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_refreshed_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revoked_reason text,
    user_agent text,
    CONSTRAINT auth_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.auth_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
    ON public.auth_sessions USING btree (user_id);

COMMIT;
