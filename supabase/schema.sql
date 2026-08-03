-- ClubSync database schema
-- Safe to run more than once — every statement checks before creating.
-- Run this entire file in Supabase: Project → SQL Editor → New query → paste → Run

-- ============ SCHOOLS & SPORTS (reference data) ============
-- These are lookup tables, not user-editable. New sports can be added later
-- with a single INSERT — no code changes needed. Schools list can be expanded
-- the same way.

create table if not exists schools (
  name text primary key,
  city text,
  state text
);

create table if not exists sports (
  name text primary key
);

insert into sports (name) values ('Ice Hockey')
on conflict (name) do nothing;


-- The full US schools list is seeded separately via CSV import in the
-- Supabase Table Editor (see us_schools.csv) rather than pasted here —
-- 2,300+ rows isn't practical to paste as SQL.

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  city text not null,
  conference text not null default 'ACC',
  color_primary text not null default '#2E7DD7',
  school text references schools(name),
  sport text references sports(name),
  division text not null default 'D1' check (division in ('D1', 'D2', 'D3')),
  invite_code text unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  created_at timestamptz not null default now()
);

alter table teams add column if not exists school text references schools(name);
alter table teams add column if not exists sport text references sports(name);
alter table teams add column if not exists division text not null default 'D1';
alter table teams drop constraint if exists teams_division_check;
alter table teams add constraint teams_division_check check (division in ('D1', 'D2', 'D3'));
alter table teams add column if not exists invite_code text unique;
alter table teams alter column invite_code set default substr(md5(random()::text || clock_timestamp()::text), 1, 8);
update teams set invite_code = substr(md5(random()::text || clock_timestamp()::text), 1, 8) where invite_code is null;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  full_name text not null,
  role text not null default 'Staff',
  phone text,
  email text not null,
  is_commissioner boolean not null default false,
  is_team_admin boolean not null default false,
  member_type text not null default 'staff' check (member_type in ('staff', 'player')),
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists is_commissioner boolean not null default false;
alter table profiles add column if not exists is_team_admin boolean not null default false;
alter table profiles add column if not exists member_type text not null default 'staff';
alter table profiles drop constraint if exists profiles_member_type_check;
alter table profiles add constraint profiles_member_type_check check (member_type in ('staff', 'player'));

create table if not exists team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  requested_role text not null default 'Staff',
  requested_member_type text not null default 'staff' check (requested_member_type in ('staff', 'player')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  unique (team_id, profile_id)
);

alter table team_join_requests add column if not exists requested_member_type text not null default 'staff';
alter table team_join_requests drop constraint if exists team_join_requests_requested_member_type_check;
alter table team_join_requests add constraint team_join_requests_requested_member_type_check
  check (requested_member_type in ('staff', 'player'));

create table if not exists weekends (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  date date not null,
  status text not null default 'open' check (status in ('open', 'busy', 'scheduled')),
  preference text check (preference in ('home', 'away', 'either')),
  opponent_team_id uuid references teams(id) on delete set null,
  opponent_name text,
  game_time text,
  game_location text,
  game_notes text,
  is_home boolean,
  created_at timestamptz not null default now(),
  unique (team_id, date)
);

alter table weekends add column if not exists opponent_name text;

create table if not exists game_requests (
  id uuid primary key default gen_random_uuid(),
  from_team_id uuid not null references teams(id) on delete cascade,
  to_team_id uuid not null references teams(id) on delete cascade,
  weekend_id uuid references weekends(id) on delete cascade,
  source_weekend_id uuid references weekends(id) on delete cascade,
  kind text not null default 'availability' check (kind in ('availability', 'confirmation')),
  from_wants_to_host boolean not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now()
);

alter table game_requests alter column weekend_id drop not null;
alter table game_requests add column if not exists source_weekend_id uuid references weekends(id) on delete cascade;
alter table game_requests add column if not exists kind text not null default 'availability';
alter table game_requests drop constraint if exists game_requests_kind_check;
alter table game_requests add constraint game_requests_kind_check check (kind in ('availability', 'confirmation'));

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  team_a_id uuid not null references teams(id) on delete cascade,
  team_b_id uuid not null references teams(id) on delete cascade,
  sender_team_id uuid not null references teams(id) on delete cascade,
  sender_profile_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists message_reads (
  team_id uuid not null references teams(id) on delete cascade,
  other_team_id uuid not null references teams(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (team_id, other_team_id)
);

-- ============ HELPER FUNCTION ============
-- Looks up the signed-in user's team without triggering recursive RLS checks.

create or replace function current_team_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select team_id from profiles where id = auth.uid();
$$;

create or replace function is_team_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_team_admin from profiles where id = auth.uid()), false);
$$;

create or replace function is_staff_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select member_type = 'staff' from profiles where id = auth.uid()), false);
$$;

create or replace function is_commissioner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_commissioner from profiles where id = auth.uid()), false);
$$;

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
-- Creates the profiles row the instant someone signs up, using the name/phone
-- passed in from the signup form. Runs as the database itself (security definer),
-- so it works even before the new user has an active session — avoiding the
-- "new row violates row-level security policy" timing issue entirely.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Member'),
    new.raw_user_meta_data->>'phone',
    new.email,
    'Staff'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============ ROW LEVEL SECURITY ============

alter table teams enable row level security;
alter table profiles enable row level security;
alter table weekends enable row level security;
alter table game_requests enable row level security;
alter table messages enable row level security;
alter table team_join_requests enable row level security;
alter table schools enable row level security;
alter table sports enable row level security;
alter table message_reads enable row level security;

-- Drop policies first (if they exist) so re-running this file never errors.
drop policy if exists "teams_select_all" on teams;
drop policy if exists "teams_insert_authenticated" on teams;
drop policy if exists "teams_update_own" on teams;
drop policy if exists "teams_delete_own" on teams;
drop policy if exists "profiles_select_all" on profiles;
drop policy if exists "profiles_insert_own" on profiles;
drop policy if exists "profiles_update_own" on profiles;
drop policy if exists "profiles_update_as_admin" on profiles;
drop policy if exists "profiles_update_teammate_by_admin" on profiles;
drop policy if exists "weekends_select_all" on weekends;
drop policy if exists "weekends_select_scoped" on weekends;
drop policy if exists "weekends_insert_own_team" on weekends;
drop policy if exists "weekends_update_own_team" on weekends;
drop policy if exists "weekends_delete_own_team" on weekends;
drop policy if exists "weekends_delete_as_opponent" on weekends;
drop policy if exists "weekends_update_as_confirming_team" on weekends;
drop policy if exists "requests_select_involved" on game_requests;
drop policy if exists "requests_insert_as_sender" on game_requests;
drop policy if exists "requests_update_involved" on game_requests;
drop policy if exists "messages_select_involved" on messages;
drop policy if exists "messages_insert_as_participant" on messages;
drop policy if exists "join_requests_select_own_or_admin" on team_join_requests;
drop policy if exists "join_requests_insert_own" on team_join_requests;
drop policy if exists "join_requests_update_admin" on team_join_requests;
drop policy if exists "schools_select_all" on schools;
drop policy if exists "schools_insert_authenticated" on schools;
drop policy if exists "sports_select_all" on sports;
drop policy if exists "message_reads_select_own" on message_reads;
drop policy if exists "message_reads_insert_own" on message_reads;
drop policy if exists "message_reads_update_own" on message_reads;

-- Teams: any signed-in user can see all teams (needed to browse/search).
-- Only signed-in users can create a team (during onboarding).
-- Only members of a team can update it.
create policy "teams_select_all" on teams for select to authenticated using (true);
create policy "teams_insert_authenticated" on teams for insert to authenticated with check (true);
create policy "teams_update_own" on teams for update to authenticated
  using (id = current_team_id());
create policy "teams_delete_own" on teams for delete to authenticated
  using (id = current_team_id() and is_team_admin());

-- Profiles: staff directory is visible to all signed-in users (so you can see
-- another team's contacts). Users can only create/edit their own profile row.
create policy "profiles_select_all" on profiles for select to authenticated using (true);
create policy "profiles_insert_own" on profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles_update_own" on profiles for update to authenticated
  using (id = auth.uid());
create policy "profiles_update_as_admin" on profiles for update to authenticated
  using (
    is_team_admin()
    and exists (
      select 1 from team_join_requests r
      where r.profile_id = profiles.id
        and r.team_id = current_team_id()
        and r.status = 'pending'
    )
  );
create policy "profiles_update_teammate_by_admin" on profiles for update to authenticated
  using (is_team_admin() and team_id = current_team_id());

-- Weekends: schedules are visible to everyone (needed to browse other teams).
-- Only a team's own staff can add/edit/delete their own weekends.
create policy "weekends_select_scoped" on weekends for select to authenticated
  using (
    team_id = current_team_id()
    or status = 'open'
    or is_commissioner()
    or exists (
      select 1 from game_requests r
      where (r.weekend_id = weekends.id or r.source_weekend_id = weekends.id)
        and (r.from_team_id = current_team_id() or r.to_team_id = current_team_id())
    )
  );
create policy "weekends_insert_own_team" on weekends for insert to authenticated
  with check (team_id = current_team_id() and is_staff_member());
create policy "weekends_update_own_team" on weekends for update to authenticated
  using (team_id = current_team_id() and is_staff_member());
create policy "weekends_delete_own_team" on weekends for delete to authenticated
  using (team_id = current_team_id() and is_staff_member());
create policy "weekends_delete_as_opponent" on weekends for delete to authenticated
  using (opponent_team_id = current_team_id() and is_staff_member());
create policy "weekends_update_as_confirming_team" on weekends for update to authenticated
  using (
    is_staff_member()
    and exists (
      select 1 from game_requests r
      where r.source_weekend_id = weekends.id
        and r.to_team_id = current_team_id()
    )
  );

-- Game requests: visible only to the two teams involved.
-- Either team can insert (send request); either team can update (approve/decline/cancel).
create policy "requests_select_involved" on game_requests for select to authenticated
  using (from_team_id = current_team_id() or to_team_id = current_team_id());
create policy "requests_insert_as_sender" on game_requests for insert to authenticated
  with check (from_team_id = current_team_id() and is_staff_member());
create policy "requests_update_involved" on game_requests for update to authenticated
  using ((from_team_id = current_team_id() or to_team_id = current_team_id()) and is_staff_member());

-- Messages: visible only to the two teams in the thread.
create policy "messages_select_involved" on messages for select to authenticated
  using (team_a_id = current_team_id() or team_b_id = current_team_id());
create policy "messages_insert_as_participant" on messages for insert to authenticated
  with check (
    sender_team_id = current_team_id()
    and (team_a_id = current_team_id() or team_b_id = current_team_id())
    and is_staff_member()
  );

-- Join requests: the requester can see/create their own request. Only that
-- team's admin can see the full list for their team or approve/decline.
create policy "join_requests_select_own_or_admin" on team_join_requests for select to authenticated
  using (profile_id = auth.uid() or (team_id = current_team_id() and is_team_admin()));
create policy "join_requests_insert_own" on team_join_requests for insert to authenticated
  with check (profile_id = auth.uid());
create policy "join_requests_update_admin" on team_join_requests for update to authenticated
  using (team_id = current_team_id() and is_team_admin());

create policy "schools_select_all" on schools for select to authenticated using (true);
create policy "schools_insert_authenticated" on schools for insert to authenticated with check (true);
create policy "sports_select_all" on sports for select to authenticated using (true);

create policy "message_reads_select_own" on message_reads for select to authenticated
  using (team_id = current_team_id());
create policy "message_reads_insert_own" on message_reads for insert to authenticated
  with check (team_id = current_team_id());
create policy "message_reads_update_own" on message_reads for update to authenticated
  using (team_id = current_team_id());

-- ============ ONE TEAM PER SCHOOL+SPORT+DIVISION ============
-- A school can have separate D1/D2/D3 teams for the same sport, but not two
-- teams at the same division.
alter table teams drop constraint if exists teams_school_sport_unique;
alter table teams add constraint teams_school_sport_division_unique unique (school, sport, division);

-- ============ VIEWING ANOTHER TEAM'S SCHEDULE ============
-- Other teams should see whether a day is open or busy so they can plan
-- around it, but never who you're actually playing on a busy/scheduled day.
-- This runs as the database itself, so it's a real restriction — not just
-- something the app UI hides.

create or replace function team_schedule_for_viewer(target_team_id uuid)
returns table (
  id uuid,
  team_id uuid,
  date date,
  status text,
  preference text,
  opponent_team_id uuid,
  opponent_name text,
  game_time text,
  game_location text,
  game_notes text,
  is_home boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    w.id,
    w.team_id,
    w.date,
    w.status,
    case when w.status = 'open' then w.preference else null end as preference,
    case when target_team_id = current_team_id() then w.opponent_team_id else null end as opponent_team_id,
    case when target_team_id = current_team_id() then w.opponent_name else null end as opponent_name,
    case when target_team_id = current_team_id() then w.game_time else null end as game_time,
    case when target_team_id = current_team_id() then w.game_location else null end as game_location,
    case when target_team_id = current_team_id() then w.game_notes else null end as game_notes,
    case when target_team_id = current_team_id() then w.is_home else null end as is_home
  from weekends w
  where w.team_id = target_team_id;
$$;

-- ============ AUTO-MATCH NEW TEAMS TO EXISTING "OFF-PLATFORM" GAMES ============
-- When a team creates their ClubSync profile, check if any other team already
-- has them penciled in by school name (the "Other" opponent option). If so,
-- link it up and send the confirmation request automatically — no one has to
-- remember to go back and manually re-link it later.

create or replace function match_pending_opponents(new_team_id uuid, new_team_school text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_count integer := 0;
  w record;
begin
  for w in
    select * from weekends
    where opponent_name = new_team_school
      and opponent_team_id is null
      and team_id != new_team_id
  loop
    update weekends set opponent_team_id = new_team_id where id = w.id;

    insert into game_requests (from_team_id, to_team_id, source_weekend_id, kind, from_wants_to_host)
    values (w.team_id, new_team_id, w.id, 'confirmation', coalesce(w.is_home, true));

    matched_count := matched_count + 1;
  end loop;

  return matched_count;
end;
$$;

-- ============ REALTIME ============
-- Lets the app get live updates (new requests/messages) without refreshing.
-- Wrapped so re-running this file never errors if already added.

do $$
begin
  alter publication supabase_realtime add table weekends;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table game_requests;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null;
end $$;
