create type user_role as enum ('user', 'admin');
create type message_role as enum ('user', 'assistant');
create type vault_category as enum (
  'bloodwork',
  'genetics',
  'wearables',
  'body-composition',
  'notes',
  'other'
);
create type vault_status as enum ('ready', 'processing', 'failed');

create table if not exists public.users (
  id serial primary key,
  union_id varchar(255) not null unique,
  name varchar(255),
  email varchar(320),
  avatar text,
  role user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  agent_id varchar(50) not null,
  title varchar(255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id serial primary key,
  conversation_id integer not null references public.conversations(id) on delete cascade,
  role message_role not null,
  content text not null,
  agent_id varchar(50),
  metadata text,
  created_at timestamptz not null default now()
);

create table if not exists public.vault_files (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  filename varchar(255) not null,
  file_type varchar(64) not null,
  category vault_category not null default 'other',
  size integer not null,
  status vault_status not null default 'ready',
  encrypted_url text,
  iv varchar(255),
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_id_idx on public.conversations(user_id);
create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists vault_files_user_id_idx on public.vault_files(user_id);
