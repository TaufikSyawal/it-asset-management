-- Mock Supabase Environment for Local Testing
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Roles
do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;

do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;

do $$ begin
  create role service_role nologin;
exception when duplicate_object then null; end $$;

-- Auth Schema
create schema if not exists auth;

grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- auth.uid() function simulating Supabase JWT session claim
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- auth.jwt() simulating Supabase JWT claims
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Storage Schema
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id) on delete cascade,
  name text not null,
  owner uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);

alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
