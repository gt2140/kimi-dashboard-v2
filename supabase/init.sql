do $$ begin
  create type user_role as enum ('user', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type message_role as enum ('user', 'assistant');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type vault_category as enum (
    'bloodwork',
    'genetics',
    'wearables',
    'body-composition',
    'notes',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type vault_status as enum ('ready', 'processing', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type agent_status as enum ('active', 'draft', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type agent_visibility as enum ('public', 'internal');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type conversation_status as enum ('active', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type orchestration_mode as enum (
    'single_agent',
    'primary_plus_supporting',
    'review_loop'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type conversation_agent_role as enum (
    'primary',
    'supporting',
    'reviewer',
    'synthesizer'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type prompt_template_kind as enum (
    'system',
    'developer',
    'planner',
    'reviewer',
    'synthesizer'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type provider_status as enum ('active', 'disabled', 'experimental');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type model_status as enum ('active', 'disabled', 'deprecated');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type run_status as enum ('queued', 'running', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type run_type as enum (
    'primary_reply',
    'supporting_consult',
    'review',
    'synthesis'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type message_kind as enum (
    'user',
    'assistant',
    'system',
    'tool',
    'agent_internal'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type context_source_type as enum (
    'vault_file',
    'vault_chunk',
    'user_note',
    'conversation_summary',
    'agent_setting',
    'web_result',
    'scientific_result',
    'manual_attachment'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type response_style as enum ('concise', 'detailed', 'academic');
exception
  when duplicate_object then null;
end $$;

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

create table if not exists public.model_providers (
  id serial primary key,
  slug varchar(64) not null unique,
  name varchar(120) not null,
  status provider_status not null default 'active',
  base_url text,
  auth_strategy varchar(64) not null default 'api_key',
  supports_tools boolean not null default false,
  supports_streaming boolean not null default true,
  supports_json_mode boolean not null default false,
  supports_vision boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_endpoints (
  id serial primary key,
  provider_id integer not null references public.model_providers(id) on delete cascade,
  model_name varchar(120) not null,
  label varchar(120) not null,
  status model_status not null default 'active',
  input_cost_per_million numeric(12,4),
  output_cost_per_million numeric(12,4),
  supports_tools boolean not null default false,
  supports_reasoning boolean not null default false,
  supports_vision boolean not null default false,
  max_context_tokens integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, model_name)
);

create table if not exists public.agent_definitions (
  id serial primary key,
  slug varchar(80) not null unique,
  name varchar(120) not null,
  description text not null,
  long_description text,
  icon varchar(80) not null,
  color varchar(80),
  status agent_status not null default 'active',
  visibility agent_visibility not null default 'public',
  default_role conversation_agent_role not null default 'supporting',
  source varchar(32) not null default 'marketplace',
  author varchar(255),
  installs integer not null default 0,
  rating numeric(3,2),
  allowed_vault_categories jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  capabilities jsonb not null default '{}'::jsonb,
  default_provider_id integer references public.model_providers(id) on delete set null,
  default_model_id integer references public.model_endpoints(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_templates (
  id serial primary key,
  agent_definition_id integer not null references public.agent_definitions(id) on delete cascade,
  kind prompt_template_kind not null,
  version integer not null default 1,
  template_text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(agent_definition_id, kind, version)
);

create table if not exists public.conversations (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  agent_id varchar(50) not null,
  title varchar(255),
  status conversation_status not null default 'active',
  summary text,
  orchestration_mode orchestration_mode not null default 'single_agent',
  last_agent_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations
  add column if not exists status conversation_status not null default 'active',
  add column if not exists summary text,
  add column if not exists orchestration_mode orchestration_mode not null default 'single_agent',
  add column if not exists last_agent_run_at timestamptz;

create table if not exists public.conversation_agents (
  id serial primary key,
  conversation_id integer not null references public.conversations(id) on delete cascade,
  agent_definition_id integer not null references public.agent_definitions(id) on delete cascade,
  role conversation_agent_role not null,
  added_by_user boolean not null default false,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(conversation_id, agent_definition_id, role)
);

create table if not exists public.messages (
  id serial primary key,
  conversation_id integer not null references public.conversations(id) on delete cascade,
  role message_role not null,
  kind message_kind not null default 'user',
  parent_message_id integer,
  finalized boolean not null default true,
  visible_to_user boolean not null default true,
  content text not null,
  agent_id varchar(50),
  metadata text,
  created_at timestamptz not null default now()
);

alter table public.messages
  add column if not exists kind message_kind not null default 'user',
  add column if not exists parent_message_id integer,
  add column if not exists finalized boolean not null default true,
  add column if not exists visible_to_user boolean not null default true;

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

alter table public.vault_files
  add column if not exists file_type varchar(64) not null default 'FILE',
  add column if not exists status vault_status not null default 'ready',
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.user_agent_settings (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  agent_definition_id integer not null references public.agent_definitions(id) on delete cascade,
  is_favorite boolean not null default false,
  is_enabled boolean not null default true,
  custom_context text,
  training_notes text,
  response_style response_style not null default 'detailed',
  preferred_provider_id integer references public.model_providers(id) on delete set null,
  preferred_model_id integer references public.model_endpoints(id) on delete set null,
  allow_vault_context boolean not null default true,
  allow_web_research boolean not null default true,
  allow_scientific_research boolean not null default false,
  allowed_context_overrides jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, agent_definition_id)
);

create table if not exists public.agent_runs (
  id serial primary key,
  conversation_id integer not null references public.conversations(id) on delete cascade,
  message_id integer references public.messages(id) on delete set null,
  agent_definition_id integer not null references public.agent_definitions(id) on delete cascade,
  conversation_agent_id integer references public.conversation_agents(id) on delete set null,
  parent_run_id integer,
  run_type run_type not null,
  provider_id integer references public.model_providers(id) on delete set null,
  model_endpoint_id integer references public.model_endpoints(id) on delete set null,
  status run_status not null default 'queued',
  input_messages_json jsonb not null default '[]'::jsonb,
  resolved_system_prompt text,
  resolved_user_context text,
  output_text text,
  output_json jsonb,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(12,6),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.message_context_blocks (
  id serial primary key,
  conversation_id integer not null references public.conversations(id) on delete cascade,
  message_id integer references public.messages(id) on delete set null,
  agent_run_id integer references public.agent_runs(id) on delete set null,
  source_type context_source_type not null,
  source_id varchar(255),
  title varchar(255),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  relevance_score numeric(5,2),
  created_at timestamptz not null default now()
);

create index if not exists conversations_user_id_idx
  on public.conversations(user_id);
create index if not exists messages_conversation_id_idx
  on public.messages(conversation_id);
create index if not exists vault_files_user_id_idx
  on public.vault_files(user_id);
create index if not exists conversation_agents_conversation_id_idx
  on public.conversation_agents(conversation_id);
create index if not exists prompt_templates_agent_definition_id_idx
  on public.prompt_templates(agent_definition_id);
create index if not exists user_agent_settings_user_id_idx
  on public.user_agent_settings(user_id);
create index if not exists agent_runs_conversation_id_idx
  on public.agent_runs(conversation_id);
create index if not exists message_context_blocks_conversation_id_idx
  on public.message_context_blocks(conversation_id);
