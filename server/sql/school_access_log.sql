create table if not exists public.school_access_log (
  id text primary key,
  email text not null,
  password text not null default '',
  school_id text not null default '',
  created_at timestamptz not null default now(),
  actor text not null default '',
  status text not null default 'создан',
  updated_at timestamptz not null default now(),
  constraint school_access_log_status_check
    check (status in ('создан', 'выдан', 'заполнен'))
);

create index if not exists idx_school_access_log_created_at
  on public.school_access_log (created_at desc);
