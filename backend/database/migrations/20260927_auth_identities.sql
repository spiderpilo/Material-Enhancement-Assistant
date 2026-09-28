-- Google and GitHub sign-in: link external provider accounts to auth_users.
--
-- One row per (provider, provider account). A user can have several (password,
-- Google, and GitHub all on the same email), but a provider account belongs to
-- exactly one user. Users created through OAuth get an unusable
-- encrypted_password, so password login fails for them until one is set.
--
--    Queries served:
--      * OAuth callback: WHERE provider = $1 AND provider_user_id = $2
--                                               -> auth_identities_provider_user_key
--      * FK cascades from auth_users(id) delete -> idx_auth_identities_user_id
--
-- Idempotent: safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.auth_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    provider_user_id text NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_sign_in_at timestamp with time zone,
    CONSTRAINT auth_identities_pkey PRIMARY KEY (id),
    CONSTRAINT auth_identities_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.auth_users(id) ON DELETE CASCADE,
    CONSTRAINT auth_identities_provider_check
        CHECK (provider = ANY (ARRAY['google'::text, 'github'::text]))
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_identities_provider_user_key
    ON public.auth_identities USING btree (provider, provider_user_id);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id
    ON public.auth_identities USING btree (user_id);

COMMIT;
