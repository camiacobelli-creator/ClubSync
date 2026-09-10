-- ClubSlate database schema
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

insert into sports (name) values
  ('Ice Hockey'), ('Roller Hockey'), ('Field Hockey'),
  ('Soccer'), ('Rugby'), ('Lacrosse'), ('Ultimate Frisbee'),
  ('Volleyball'), ('Baseball'), ('Softball'), ('Basketball'),
  ('Tennis'), ('Golf'), ('Swimming'), ('Water Polo'), ('Wrestling'),
  ('Fencing'), ('Equestrian'), ('Cycling'), ('Rowing'), ('Sailing'),
  ('Skiing'), ('Snowboarding'), ('Cricket'), ('Badminton'),
  ('Table Tennis'), ('Handball'), ('Archery'), ('Climbing'),
  ('Triathlon'), ('Track and Field'), ('Quidditch'), ('Bowling'),
  ('Boxing'), ('Martial Arts'), ('Powerlifting'), ('Gymnastics'),
  ('Figure Skating'), ('Cheerleading'), ('Esports'), ('Paintball'),
  ('Disc Golf'), ('Dance')
on conflict (name) do nothing;

-- The full US schools list is seeded separately via CSV import in the
-- Supabase Table Editor (see us_schools.csv) rather than pasted here —
-- 2,300+ rows isn't practical to paste as SQL.

-- ============ TEAMS ============
-- A school can field more than one team in the same sport (e.g. a 1st and
-- 2nd team) — team_number distinguishes them, with 1 meaning the top team.
-- Conference is free text: Power 5 name or a custom "Other" value the team
-- typed in at signup.

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  city text not null,
  conference text not null default 'ACC',
  color_primary text not null default '#2E7DD7',
  school text references schools(name),
  sport text references sports(name),
  team_number integer not null default 1,
  invite_code text unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  created_at timestamptz not null default now()
);

alter table teams add column if not exists school text references schools(name);
alter table teams add column if not exists sport text references sports(name);
alter table teams add column if not exists team_number integer not null default 1;
alter table teams add column if not exists invite_code text unique;
alter table teams alter column invite_code set default substr(md5(random()::text || clock_timestamp()::text), 1, 8);
update teams set invite_code = substr(md5(random()::text || clock_timestamp()::text), 1, 8) where invite_code is null;

-- A school can have more than one team per sport (1st/2nd/3rd), but not two
-- teams claiming the same team_number for the same school+sport.
alter table teams drop constraint if exists teams_school_sport_unique;
alter table teams drop constraint if exists teams_school_sport_division_unique;
alter table teams drop constraint if exists teams_school_sport_division_number_unique;
alter table teams drop constraint if exists teams_school_sport_number_unique;
alter table teams add constraint teams_school_sport_number_unique unique (school, sport, team_number);

-- ============ PROFILES ============
-- commissioner_status tracks the approval workflow: a profile requests to be
-- commissioner (status 'pending'), and a site admin approves ('approved',
-- is_commissioner also flips true) or denies ('none', cleared to retry).

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  full_name text not null,
  role text not null default 'Staff',
  phone text,
  email text not null,
  is_commissioner boolean not null default false,
  commissioner_league text,
  commissioner_sport text,
  commissioner_status text not null default 'none' check (commissioner_status in ('none','pending','approved','denied')),
  is_site_admin boolean not null default false,
  is_team_admin boolean not null default false,
  member_type text not null default 'staff' check (member_type in ('staff', 'player')),
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists is_commissioner boolean not null default false;
alter table profiles add column if not exists commissioner_league text;
alter table profiles add column if not exists commissioner_sport text;
alter table profiles add column if not exists commissioner_status text not null default 'none';
alter table profiles drop constraint if exists profiles_commissioner_status_check;
alter table profiles add constraint profiles_commissioner_status_check
  check (commissioner_status in ('none','pending','approved','denied'));
alter table profiles add column if not exists is_site_admin boolean not null default false;
alter table profiles add column if not exists is_team_admin boolean not null default false;
alter table profiles add column if not exists member_type text not null default 'staff';
alter table profiles drop constraint if exists profiles_member_type_check;
alter table profiles add constraint profiles_member_type_check check (member_type in ('staff', 'player'));

-- Backfill: anyone already approved as commissioner should show as 'approved'
update profiles set commissioner_status = 'approved' where is_commissioner = true and commissioner_status = 'none';

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

-- ============ WEEKENDS ============
-- opponent_team_number is informational only (label, e.g. "their 2nd team") —
-- it never gates auto-matching, since teams across conferences/leagues play
-- each other all the time regardless of tier.

create table if not exists weekends (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  date date not null,
  status text not null default 'open' check (status in ('open', 'busy', 'scheduled')),
  preference text check (preference in ('home', 'away', 'either')),
  opponent_team_id uuid references teams(id) on delete set null,
  opponent_name text,
  opponent_team_number integer,
  game_time text,
  game_location text,
  game_notes text,
  is_home boolean,
  created_at timestamptz not null default now(),
  unique (team_id, date)
);

alter table weekends add column if not exists opponent_name text;
alter table weekends add column if not exists opponent_team_number integer;

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

-- ============ TEAM-TO-TEAM MESSAGING ============

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

-- ============ COMMISSIONER <-> TEAM MESSAGING ============

create table if not exists commissioner_messages (
  id uuid primary key default gen_random_uuid(),
  commissioner_id uuid not null references profiles(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  sender_role text not null check (sender_role in ('commissioner', 'team')),
  sender_profile_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists commissioner_messages_thread_idx
  on commissioner_messages (commissioner_id, team_id, created_at);

create table if not exists commissioner_message_reads (
  commissioner_id uuid not null references profiles(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  reader_role text not null check (reader_role in ('commissioner','team')),
  last_read_at timestamptz not null default now(),
  primary key (commissioner_id, team_id, reader_role)
);

-- ============ SUPPORT / HELP MESSAGES ============
-- One-way inbox to the app owner. No select policy — nobody, including the
-- sender, can read these back through the app. Checked via the Supabase
-- Table Editor directly (or the email notification trigger below).

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  sender_profile_id uuid not null references profiles(id) on delete cascade,
  sender_name text not null,
  sender_email text not null,
  sender_role text not null,
  team_name text,
  is_commissioner boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

-- ============ HELPER FUNCTIONS ============
-- Looks up the signed-in user's team/role without triggering recursive RLS checks.

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

-- Presidents, Vice Presidents, and Head Coaches can remove a teammate from
-- the roster even without the separate "team admin" flag — see the narrowly
-- scoped policy below that only permits that one action.
drop function if exists is_team_officer();
create function is_team_officer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role in ('President', 'Vice President', 'Head Coach') from profiles where id = auth.uid()),
    false
  );
$$;

drop function if exists is_site_admin();
create function is_site_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_site_admin from profiles where id = auth.uid()), false);
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
  insert into profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    new.email
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
alter table team_join_requests enable row level security;
alter table weekends enable row level security;
alter table game_requests enable row level security;
alter table messages enable row level security;
alter table message_reads enable row level security;
alter table schools enable row level security;
alter table sports enable row level security;
alter table commissioner_messages enable row level security;
alter table commissioner_message_reads enable row level security;
alter table support_messages enable row level security;

drop policy if exists "teams_select_all" on teams;
drop policy if exists "teams_insert_authenticated" on teams;
drop policy if exists "teams_update_own" on teams;
drop policy if exists "teams_delete_own" on teams;
create policy "teams_select_all" on teams for select to authenticated using (true);
create policy "teams_insert_authenticated" on teams for insert to authenticated with check (true);
create policy "teams_update_own" on teams for update to authenticated
  using (id = current_team_id());

-- Profiles: visible to everyone (staff contacts need to be found; commissioner
-- and player-visibility rules are enforced by which columns the app queries
-- and shows, not by RLS row hiding). Users can only create/edit their own
-- profile row, except for the narrower admin/officer/site-admin cases below.
drop policy if exists "profiles_select_all" on profiles;
drop policy if exists "profiles_insert_own" on profiles;
drop policy if exists "profiles_update_own" on profiles;
drop policy if exists "profiles_update_as_admin" on profiles;
drop policy if exists "profiles_update_teammate_by_admin" on profiles;
drop policy if exists "profiles_update_teammate_kick_by_officer" on profiles;
drop policy if exists "profiles_update_by_site_admin" on profiles;

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

-- President/VP/Head Coach can kick a teammate — but this policy only ever
-- permits the kick itself (team_id set to null, admin flag cleared), nothing
-- else, so it can't be used to self-promote or edit other fields.
create policy "profiles_update_teammate_kick_by_officer" on profiles for update to authenticated
  using (is_team_officer() and team_id = current_team_id() and id != auth.uid())
  with check (team_id is null and is_team_admin = false);

-- Site admin (you) can approve/deny commissioner requests and revoke access.
create policy "profiles_update_by_site_admin" on profiles for update to authenticated
  using (is_site_admin());

-- Weekends: schedules are visible to everyone (needed to browse other teams).
-- Only a team's own staff can add/edit/delete their own weekends. Commissioners
-- can see every row (the *fields* they see are further limited by
-- team_schedule_for_viewer below, not by this policy).
drop policy if exists "weekends_select_scoped" on weekends;
drop policy if exists "weekends_insert_own_team" on weekends;
drop policy if exists "weekends_update_own_team" on weekends;
drop policy if exists "weekends_delete_own_team" on weekends;
drop policy if exists "weekends_delete_as_opponent" on weekends;
drop policy if exists "weekends_update_as_confirming_team" on weekends;

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
drop policy if exists "requests_select_involved" on game_requests;
drop policy if exists "requests_insert_as_sender" on game_requests;
drop policy if exists "requests_update_involved" on game_requests;
create policy "requests_select_involved" on game_requests for select to authenticated
  using (from_team_id = current_team_id() or to_team_id = current_team_id());
create policy "requests_insert_as_sender" on game_requests for insert to authenticated
  with check (from_team_id = current_team_id() and is_staff_member());
create policy "requests_update_involved" on game_requests for update to authenticated
  using ((from_team_id = current_team_id() or to_team_id = current_team_id()) and is_staff_member());

-- Messages: visible only to the two teams in the thread.
drop policy if exists "messages_select_involved" on messages;
drop policy if exists "messages_insert_as_participant" on messages;
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
drop policy if exists "join_requests_select_own_or_admin" on team_join_requests;
drop policy if exists "join_requests_insert_own" on team_join_requests;
drop policy if exists "join_requests_update_admin" on team_join_requests;
create policy "join_requests_select_own_or_admin" on team_join_requests for select to authenticated
  using (profile_id = auth.uid() or (team_id = current_team_id() and is_team_admin()));
create policy "join_requests_insert_own" on team_join_requests for insert to authenticated
  with check (profile_id = auth.uid());
create policy "join_requests_update_admin" on team_join_requests for update to authenticated
  using (team_id = current_team_id() and is_team_admin());

drop policy if exists "schools_select_all" on schools;
drop policy if exists "schools_insert_authenticated" on schools;
drop policy if exists "sports_select_all" on sports;
create policy "schools_select_all" on schools for select to authenticated using (true);
create policy "schools_insert_authenticated" on schools for insert to authenticated with check (true);
create policy "sports_select_all" on sports for select to authenticated using (true);

drop policy if exists "message_reads_select_own" on message_reads;
drop policy if exists "message_reads_insert_own" on message_reads;
drop policy if exists "message_reads_update_own" on message_reads;
create policy "message_reads_select_own" on message_reads for select to authenticated
  using (team_id = current_team_id());
create policy "message_reads_insert_own" on message_reads for insert to authenticated
  with check (team_id = current_team_id());
create policy "message_reads_update_own" on message_reads for update to authenticated
  using (team_id = current_team_id());

-- Commissioner <-> team messages: visible to the commissioner or the team involved.
drop policy if exists "commissioner_messages_select" on commissioner_messages;
drop policy if exists "commissioner_messages_insert_commissioner" on commissioner_messages;
drop policy if exists "commissioner_messages_insert_team" on commissioner_messages;
create policy "commissioner_messages_select" on commissioner_messages for select to authenticated
  using (commissioner_id = auth.uid() or team_id = current_team_id());
create policy "commissioner_messages_insert_commissioner" on commissioner_messages for insert to authenticated
  with check (sender_role = 'commissioner' and commissioner_id = auth.uid() and sender_profile_id = auth.uid() and is_commissioner());
create policy "commissioner_messages_insert_team" on commissioner_messages for insert to authenticated
  with check (sender_role = 'team' and team_id = current_team_id() and sender_profile_id = auth.uid() and is_staff_member());

drop policy if exists "commissioner_message_reads_select" on commissioner_message_reads;
drop policy if exists "commissioner_message_reads_insert_commissioner" on commissioner_message_reads;
drop policy if exists "commissioner_message_reads_update_commissioner" on commissioner_message_reads;
drop policy if exists "commissioner_message_reads_insert_team" on commissioner_message_reads;
drop policy if exists "commissioner_message_reads_update_team" on commissioner_message_reads;
create policy "commissioner_message_reads_select" on commissioner_message_reads for select to authenticated
  using (commissioner_id = auth.uid() or team_id = current_team_id());
create policy "commissioner_message_reads_insert_commissioner" on commissioner_message_reads for insert to authenticated
  with check (reader_role = 'commissioner' and commissioner_id = auth.uid() and is_commissioner());
create policy "commissioner_message_reads_update_commissioner" on commissioner_message_reads for update to authenticated
  using (reader_role = 'commissioner' and commissioner_id = auth.uid())
  with check (reader_role = 'commissioner' and commissioner_id = auth.uid());
create policy "commissioner_message_reads_insert_team" on commissioner_message_reads for insert to authenticated
  with check (reader_role = 'team' and team_id = current_team_id() and is_staff_member());
create policy "commissioner_message_reads_update_team" on commissioner_message_reads for update to authenticated
  using (reader_role = 'team' and team_id = current_team_id())
  with check (reader_role = 'team' and team_id = current_team_id());

-- Support messages: anyone can send one about themselves. No select policy —
-- not even the sender can read these back; checked via Table Editor or email.
drop policy if exists "support_messages_insert_own" on support_messages;
create policy "support_messages_insert_own" on support_messages for insert to authenticated
  with check (sender_profile_id = auth.uid());

-- ============ VIEWING ANOTHER TEAM'S SCHEDULE ============
-- Other teams should see whether a day is open or busy so they can plan
-- around it, but never who you're actually playing on a busy/scheduled day —
-- unless you're the commissioner of that team's (or their opponent's)
-- conference+sport, in which case you see everything. This runs as the
-- database itself, so it's a real restriction — not just something the app
-- UI hides.

drop function if exists team_schedule_for_viewer(uuid);
create function team_schedule_for_viewer(target_team_id uuid)
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
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  viewer_league text;
  viewer_sport text;
  target_conf text;
  target_sport text;
  is_own boolean;
  commissioner_covers_target boolean;
begin
  select p.commissioner_league, p.commissioner_sport
    into viewer_league, viewer_sport
    from profiles p
    where p.id = auth.uid() and p.is_commissioner;

  select t.conference, t.sport into target_conf, target_sport
    from teams t
    where t.id = target_team_id;

  is_own := (target_team_id = current_team_id());
  commissioner_covers_target := (
    viewer_league is not null
    and viewer_league = target_conf
    and viewer_sport = target_sport
  );

  return query
    select
      w.id, w.team_id, w.date, w.status,
      case when w.status = 'open' then w.preference else null end,
      case when is_own or commissioner_covers_target
             or (viewer_league is not null and opp.conference = viewer_league and opp.sport = viewer_sport)
           then w.opponent_team_id else null end,
      case when is_own or commissioner_covers_target
             or (viewer_league is not null and opp.conference = viewer_league and opp.sport = viewer_sport)
           then w.opponent_name else null end,
      case when is_own or commissioner_covers_target
             or (viewer_league is not null and opp.conference = viewer_league and opp.sport = viewer_sport)
           then w.game_time else null end,
      case when is_own or commissioner_covers_target
             or (viewer_league is not null and opp.conference = viewer_league and opp.sport = viewer_sport)
           then w.game_location else null end,
      case when is_own or commissioner_covers_target
             or (viewer_league is not null and opp.conference = viewer_league and opp.sport = viewer_sport)
           then w.game_notes else null end,
      case when is_own or commissioner_covers_target
             or (viewer_league is not null and opp.conference = viewer_league and opp.sport = viewer_sport)
           then w.is_home else null end
    from weekends w
    left join teams opp on opp.id = w.opponent_team_id
    where w.team_id = target_team_id;
end;
$$;

-- ============ AUTO-MATCH NEW TEAMS TO EXISTING "OFF-PLATFORM" GAMES ============
-- When a team creates their ClubSlate profile, check if any other team already
-- has them penciled in by school name (the "Other" opponent option) for the
-- SAME sport. If so, link it up and send the confirmation request
-- automatically — no one has to remember to go back and manually re-link it.

drop function if exists match_pending_opponents(uuid, text);
drop function if exists match_pending_opponents(uuid, text, integer);
drop function if exists match_pending_opponents(uuid, text, text);
create function match_pending_opponents(new_team_id uuid, new_team_school text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_count integer := 0;
  new_team_sport text;
  w record;
begin
  select t.sport into new_team_sport from teams t where t.id = new_team_id;

  for w in
    select wk.*
    from weekends wk
    join teams t on t.id = wk.team_id
    where wk.opponent_name = new_team_school
      and wk.opponent_team_id is null
      and wk.team_id != new_team_id
      and t.sport = new_team_sport
  loop
    update weekends set opponent_team_id = new_team_id where id = w.id;

    insert into game_requests (from_team_id, to_team_id, source_weekend_id, kind, from_wants_to_host)
    values (w.team_id, new_team_id, w.id, 'confirmation', coalesce(w.is_home, true));

    matched_count := matched_count + 1;
  end loop;

  return matched_count;
end;
$$;

-- ============ EMAIL NOTIFICATIONS (Help messages, commissioner requests) ============
-- Calls the notify-admin Edge Function via pg_net whenever someone submits a
-- Help message or a commissioner request goes pending. The function itself
-- lives in Supabase Edge Functions (not SQL) and emails the site admin via
-- Resend. Replace the URL below if the project ref ever changes.

create extension if not exists pg_net;

create or replace function notify_admin_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://noxmgozlwokcgwnuyrbn.supabase.co/functions/v1/notify-admin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_IGs1_aSj0nu2bicktjkDqA_03ZMj_D-'
    ),
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'old_record', case when TG_OP = 'UPDATE' then row_to_json(OLD) else null end
    )
  );
  return NEW;
end;
$$;

drop trigger if exists help_message_notify on support_messages;
create trigger help_message_notify
  after insert on support_messages
  for each row execute function notify_admin_webhook();

drop trigger if exists commissioner_request_notify on profiles;
create trigger commissioner_request_notify
  after update on profiles
  for each row execute function notify_admin_webhook();

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

do $$
begin
  alter publication supabase_realtime add table commissioner_messages;
exception when duplicate_object then null;
end $$;
