-- Supabase GitHub Preview branches are isolated, data-less environments.
-- This seed does not run as a production migration and contains no account,
-- team, player, game, or credential data.
update public.r207_preview_control
set preview_enabled = true,
    updated_at = statement_timestamp()
where control_id;
