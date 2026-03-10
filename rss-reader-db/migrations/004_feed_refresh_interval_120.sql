alter table feeds
  alter column poll_interval_minutes set default 120;

update feeds
set
  poll_interval_minutes = 120,
  next_poll_at = now() + interval '120 minutes',
  updated_at = now()
where status <> 'disabled';
