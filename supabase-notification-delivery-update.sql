-- LaxHornet transactional email delivery tracking.
-- Additive and safe to run more than once.

alter table public.notification_queue
  add column if not exists template_key text not null default '',
  add column if not exists attempts integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text not null default '',
  add column if not exists provider_message_id text not null default '',
  add column if not exists delivered_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists complained_at timestamptz,
  add column if not exists suppressed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notification_queue'::regclass
      and conname = 'notification_queue_status_check'
  ) then
    alter table public.notification_queue
      add constraint notification_queue_status_check
      check (status in ('pending', 'sending', 'sent', 'failed', 'bounced', 'complained', 'suppressed', 'held'));
  end if;
end;
$$;

comment on column public.notification_queue.template_key is
  'Optional server-side email template override. event_type remains the default template selector.';
comment on column public.notification_queue.attempts is
  'Number of times the delivery worker atomically claimed this notification.';
comment on column public.notification_queue.provider_message_id is
  'Resend message ID used to reconcile delivery webhooks.';
