-- Add project-scoped persistent chat memory.
-- Safe to re-run (idempotent).

BEGIN;

CREATE TABLE IF NOT EXISTS public.project_chat_memory (
  project_id bigint PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_user_id text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT project_chat_memory_messages_array_check
    CHECK (jsonb_typeof(messages) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_project_chat_memory_owner_user_id
  ON public.project_chat_memory (owner_user_id);

CREATE OR REPLACE FUNCTION public.append_project_chat_exchange(
  filter_project_id bigint,
  filter_owner_user_id text,
  user_message jsonb,
  assistant_message jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_owner_user_id text;
  current_messages jsonb;
  combined_messages jsonb;
  retained_messages jsonb;
BEGIN
  SELECT owner_user_id
  INTO project_owner_user_id
  FROM public.projects
  WHERE id = filter_project_id;

  IF project_owner_user_id IS NULL OR project_owner_user_id <> filter_owner_user_id THEN
    RAISE EXCEPTION 'Project was not found.';
  END IF;

  IF user_message->>'role' <> 'user'
     OR assistant_message->>'role' <> 'assistant' THEN
    RAISE EXCEPTION 'Chat exchange roles are invalid.';
  END IF;

  INSERT INTO public.project_chat_memory (project_id, owner_user_id)
  VALUES (filter_project_id, filter_owner_user_id)
  ON CONFLICT (project_id) DO NOTHING;

  SELECT messages
  INTO current_messages
  FROM public.project_chat_memory
  WHERE project_id = filter_project_id
    AND owner_user_id = filter_owner_user_id
  FOR UPDATE;

  IF current_messages IS NULL THEN
    RAISE EXCEPTION 'Chat memory was not found.';
  END IF;

  combined_messages :=
    current_messages || jsonb_build_array(user_message, assistant_message);

  SELECT COALESCE(jsonb_agg(item ORDER BY position), '[]'::jsonb)
  INTO retained_messages
  FROM jsonb_array_elements(combined_messages) WITH ORDINALITY AS entries(item, position)
  WHERE position > GREATEST(jsonb_array_length(combined_messages) - 10, 0);

  UPDATE public.project_chat_memory
  SET messages = retained_messages,
      updated_at = NOW()
  WHERE project_id = filter_project_id
    AND owner_user_id = filter_owner_user_id;

  RETURN retained_messages;
END;
$$;

REVOKE ALL ON public.project_chat_memory FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_chat_memory TO service_role;
REVOKE ALL ON FUNCTION public.append_project_chat_exchange(bigint, text, jsonb, jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_project_chat_exchange(bigint, text, jsonb, jsonb)
  TO service_role;

COMMIT;
