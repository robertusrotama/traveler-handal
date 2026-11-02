-- Traveler Handal — skema awal (Fase 1). Sumber: vault/03-Architecture/Data-Model.md
-- Konvensi error RPC: message = kode stabil (snake_case) untuk dipetakan client,
-- hint = penjelasan Bahasa Indonesia. errcode 42501 → 403, 22023 → 400, P0001/P0002 → 400/404.

-- ───────────────────────── Enums ─────────────────────────
create type public.trip_pace as enum ('santai', 'sedang', 'padat');
create type public.budget_level as enum ('hemat', 'sedang', 'mewah');
create type public.trip_status as enum ('active', 'archived');
create type public.member_role as enum ('owner', 'member');
create type public.claim_status as enum ('pending', 'approved', 'rejected');
create type public.verification_status as enum ('verified', 'unverified', 'manual', 'none');
create type public.activity_source as enum ('ai', 'manual', 'import');
create type public.ai_kind as enum ('outline', 'day', 'ideas', 'alternatives', 'import');
create type public.ai_status as enum ('pending', 'success', 'failed');
create type public.place_provider as enum ('osm', 'google');

-- Fungsi internal (trigger, lookup undangan) di schema yang tidak diekspos PostgREST.
create schema if not exists private;
revoke all on schema private from public;

-- ───────────────────────── Tables ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text check (char_length(avatar_url) <= 2048),
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null constraint trips_owner_id_fkey references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  cities text[] not null check (
    cardinality(cities) between 1 and 20
    and array_position(cities, null) is null
    and array_position(cities, '') is null
  ),
  start_date date not null,
  end_date date not null,
  travelers_count int not null check (travelers_count >= 1),
  interests text[] not null default '{}' check (cardinality(interests) <= 20),
  interests_note text check (char_length(interests_note) <= 500),
  pace public.trip_pace not null default 'sedang',
  budget_level public.budget_level not null default 'sedang',
  status public.trip_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- end ≥ start, durasi 1–21 hari
  constraint trips_dates_check check (end_date >= start_date and end_date - start_date <= 20)
);
create index trips_owner_id_idx on public.trips (owner_id);

create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null constraint trip_members_trip_id_fkey references public.trips (id) on delete cascade,
  user_id uuid not null constraint trip_members_user_id_fkey references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role public.member_role not null default 'member',
  can_use_ai boolean not null default false,
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  -- owner selalu aktif & selalu boleh AI
  constraint trip_members_owner_check check (role <> 'owner' or (can_use_ai and revoked_at is null))
);
create unique index trip_members_active_user_key on public.trip_members (trip_id, user_id) where revoked_at is null;
create unique index trip_members_one_owner_key on public.trip_members (trip_id) where role = 'owner';
create index trip_members_user_id_idx on public.trip_members (user_id);

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null constraint trip_invites_trip_id_fkey references public.trips (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null constraint trip_invites_created_by_fkey references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index trip_invites_one_active_key on public.trip_invites (trip_id) where revoked_at is null;
create index trip_invites_trip_id_idx on public.trip_invites (trip_id);
create index trip_invites_created_by_idx on public.trip_invites (created_by);

create table public.member_claims (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null constraint member_claims_trip_id_fkey references public.trips (id) on delete cascade,
  member_id uuid not null constraint member_claims_member_id_fkey references public.trip_members (id) on delete cascade,
  claimant_user_id uuid not null constraint member_claims_claimant_user_id_fkey references public.profiles (id) on delete cascade,
  status public.claim_status not null default 'pending',
  decided_by uuid constraint member_claims_decided_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index member_claims_one_pending_key on public.member_claims (member_id, claimant_user_id) where status = 'pending';
create index member_claims_trip_id_idx on public.member_claims (trip_id);
create index member_claims_claimant_user_id_idx on public.member_claims (claimant_user_id);
create index member_claims_decided_by_idx on public.member_claims (decided_by);

create table public.days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null constraint days_trip_id_fkey references public.trips (id) on delete cascade,
  day_index int not null check (day_index between 0 and 20),
  date date not null,
  title text check (char_length(title) <= 100),
  city text check (char_length(city) <= 100),
  notes text check (char_length(notes) <= 2000),
  constraint days_trip_id_day_index_key unique (trip_id, day_index),
  -- target composite FK activities (trip_id, day_id): hari harus milik trip yang sama
  constraint days_trip_id_id_key unique (trip_id, id)
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  provider public.place_provider not null,
  provider_place_id text not null,
  name text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  address text,
  category text,
  opening_hours text,
  raw jsonb not null default '{}',
  fetched_at timestamptz not null default now(),
  constraint places_provider_provider_place_id_key unique (provider, provider_place_id)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null constraint activities_trip_id_fkey references public.trips (id) on delete cascade,
  day_id uuid,
  position double precision not null,
  title text not null check (char_length(title) between 1 and 200),
  why text check (char_length(why) <= 200),
  category text not null check (char_length(category) between 1 and 40),
  start_time time,
  duration_min int check (duration_min between 1 and 1440),
  search_query text check (char_length(search_query) <= 200),
  place_id uuid constraint activities_place_id_fkey references public.places (id) on delete set null,
  verification_status public.verification_status not null default 'none',
  source public.activity_source not null default 'manual',
  edited_by_user boolean not null default false,
  notes text check (char_length(notes) <= 2000),
  created_by uuid constraint activities_created_by_fkey references public.profiles (id) on delete set null,
  updated_by uuid constraint activities_updated_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- hari dihapus → aktivitas jatuh ke pool, bukan hilang (PG15+)
  constraint activities_trip_id_day_id_fkey foreign key (trip_id, day_id)
    references public.days (trip_id, id) on delete set null (day_id),
  constraint activities_ai_search_query_check check (source = 'manual' or search_query is not null),
  constraint activities_verified_place_check check (verification_status <> 'verified' or place_id is not null)
);
create index activities_trip_id_idx on public.activities (trip_id);
create index activities_day_id_position_idx on public.activities (day_id, position);
create index activities_place_id_idx on public.activities (place_id);
create index activities_created_by_idx on public.activities (created_by);
create index activities_updated_by_idx on public.activities (updated_by);

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null constraint ai_generations_trip_id_fkey references public.trips (id) on delete cascade,
  requested_by uuid constraint ai_generations_requested_by_fkey references public.profiles (id) on delete set null,
  kind public.ai_kind not null,
  target_day_id uuid constraint ai_generations_target_day_id_fkey references public.days (id) on delete set null,
  provider text not null,
  model text,
  status public.ai_status not null default 'pending',
  input_tokens int,
  output_tokens int,
  duration_ms int,
  error text check (char_length(error) <= 1000),
  created_at timestamptz not null default now()
);
-- kuota harian per trip
create index ai_generations_trip_id_created_at_idx on public.ai_generations (trip_id, created_at);
create index ai_generations_requested_by_idx on public.ai_generations (requested_by);
create index ai_generations_target_day_id_idx on public.ai_generations (target_day_id);

create table public.geocode_cache (
  query_normalized text not null check (char_length(query_normalized) between 1 and 300),
  country_code text not null,
  place_id uuid constraint geocode_cache_place_id_fkey references public.places (id) on delete cascade,
  fetched_at timestamptz not null default now(),
  primary key (query_normalized, country_code)
);
create index geocode_cache_place_id_idx on public.geocode_cache (place_id);

create table public.rate_limits (
  key text primary key,
  last_request_at timestamptz not null
);
insert into public.rate_limits (key, last_request_at) values ('nominatim', 'epoch');

-- ───────────────────────── Triggers ─────────────────────────
create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trips_set_updated_at before update on public.trips
  for each row execute function private.set_updated_at();

-- created_by/updated_by dari sesi bila ada; service role boleh mengisi sendiri.
create function private.activities_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  else
    new.updated_by := coalesce(auth.uid(), new.updated_by);
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger activities_stamp before insert or update on public.activities
  for each row execute function private.activities_stamp();

-- auth.users → profiles; juga sinkron saat identitas ditautkan (anon → Google).
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), ''), 80);
  v_avatar text := left(nullif(new.raw_user_meta_data ->> 'avatar_url', ''), 2048);
begin
  insert into public.profiles (id, display_name, avatar_url, is_anonymous)
  values (new.id, v_name, v_avatar, coalesce(new.is_anonymous, false))
  on conflict (id) do update set
    is_anonymous = excluded.is_anonymous,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
create trigger on_auth_user_updated after update of is_anonymous, raw_user_meta_data on auth.users
  for each row
  when (old.is_anonymous is distinct from new.is_anonymous
        or old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function private.handle_new_user();

-- ───────────────────────── Helper functions ─────────────────────────
create function public.is_trip_member(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.revoked_at is null
  )
$$;

create function public.is_trip_owner(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trips t where t.id = p_trip_id and t.owner_id = auth.uid())
$$;

-- Undangan aktif (hash cocok, belum dicabut, belum kedaluwarsa) atau null.
create function private.active_invite(p_token text) returns public.trip_invites
language sql stable set search_path = '' as $$
  select i.* from public.trip_invites i
  where p_token is not null
    and i.token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
    and i.revoked_at is null
    and i.expires_at > now()
$$;

-- Berlaku sampai akhir hari (UTC) end_date + 7.
create function private.invite_expiry(p_end_date date) returns timestamptz
language sql immutable set search_path = '' as $$
  select ((p_end_date + 8)::timestamp at time zone 'UTC')
$$;

-- ───────────────────────── RPC ─────────────────────────
create function public.create_trip(
  p_title text,
  p_country_code text,
  p_cities text[],
  p_start_date date,
  p_end_date date,
  p_travelers_count int,
  p_interests text[],
  p_interests_note text default null,
  p_pace public.trip_pace default 'sedang',
  p_budget_level public.budget_level default 'sedang'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_anon boolean;
  v_owner_name text;
  v_cities text[];
  v_interests text[];
  v_title text;
  v_country text := upper(btrim(p_country_code));
  v_trip uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501', hint = 'Silakan masuk terlebih dahulu.';
  end if;
  select p.is_anonymous, p.display_name into v_anon, v_owner_name from public.profiles p where p.id = v_uid;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) or v_anon is distinct from false then
    raise exception 'anonymous_not_allowed' using errcode = '42501', hint = 'Tamu tidak bisa membuat trip. Masuk dengan Google dulu.';
  end if;

  select coalesce(array_agg(c order by ord), '{}') into v_cities
  from unnest(p_cities) with ordinality as u(raw, ord), lateral (select nullif(btrim(raw), '') as c) x
  where c is not null;
  if cardinality(v_cities) < 1 or cardinality(v_cities) > 20
     or exists (select 1 from unnest(v_cities) c where char_length(c) > 100) then
    raise exception 'invalid_cities' using errcode = '22023', hint = 'Isi 1–20 kota (maks. 100 karakter per kota).';
  end if;
  if v_country is null or v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid_country_code' using errcode = '22023', hint = 'Kode negara harus 2 huruf (ISO 3166-1).';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_end_date - p_start_date > 20 then
    raise exception 'invalid_dates' using errcode = '22023', hint = 'Tanggal selesai harus ≥ tanggal mulai, durasi 1–21 hari.';
  end if;
  if p_travelers_count is null or p_travelers_count < 1 then
    raise exception 'invalid_travelers_count' using errcode = '22023', hint = 'Jumlah orang minimal 1.';
  end if;
  if p_pace is null or p_budget_level is null then
    raise exception 'invalid_preferences' using errcode = '22023', hint = 'Tempo dan level budget wajib diisi.';
  end if;

  select coalesce(array_agg(i order by ord), '{}') into v_interests
  from unnest(coalesce(p_interests, '{}')) with ordinality as u(raw, ord), lateral (select nullif(btrim(raw), '') as i) x
  where i is not null;
  if cardinality(v_interests) > 20 or exists (select 1 from unnest(v_interests) i where char_length(i) > 50) then
    raise exception 'invalid_interests' using errcode = '22023', hint = 'Maksimal 20 minat (maks. 50 karakter).';
  end if;
  if char_length(btrim(p_interests_note)) > 500 then
    raise exception 'invalid_interests_note' using errcode = '22023', hint = 'Catatan minat maksimal 500 karakter.';
  end if;

  v_title := coalesce(nullif(btrim(p_title), ''), left('Trip ke ' || v_cities[1], 100));
  if char_length(v_title) > 100 then
    raise exception 'invalid_title' using errcode = '22023', hint = 'Judul maksimal 100 karakter.';
  end if;

  insert into public.trips (owner_id, title, country_code, cities, start_date, end_date, travelers_count,
                            interests, interests_note, pace, budget_level)
  values (v_uid, v_title, v_country, v_cities, p_start_date, p_end_date, p_travelers_count,
          v_interests, nullif(btrim(p_interests_note), ''), p_pace, p_budget_level)
  returning id into v_trip;

  insert into public.trip_members (trip_id, user_id, display_name, role, can_use_ai)
  values (v_trip, v_uid, left(coalesce(nullif(btrim(v_owner_name), ''), 'Owner'), 40), 'owner', true);

  insert into public.days (trip_id, day_index, date)
  select v_trip, i, p_start_date + i from generate_series(0, p_end_date - p_start_date) i;

  return v_trip;
end $$;

create function public.update_trip_dates(p_trip_id uuid, p_start_date date, p_end_date date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old_count int;
  v_new_count int;
  v_pool_max double precision;
begin
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'forbidden' using errcode = '42501', hint = 'Hanya owner yang bisa mengubah tanggal trip.';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_end_date - p_start_date > 20 then
    raise exception 'invalid_dates' using errcode = '22023', hint = 'Tanggal selesai harus ≥ tanggal mulai, durasi 1–21 hari.';
  end if;
  perform 1 from public.trips where id = p_trip_id for update;

  select count(*) into v_old_count from public.days where trip_id = p_trip_id;
  v_new_count := p_end_date - p_start_date + 1;

  if v_new_count < v_old_count then
    -- aktivitas hari yang dihapus → pool, diurutkan setelah isi pool yang ada
    select coalesce(max(position), 0) into v_pool_max
    from public.activities where trip_id = p_trip_id and day_id is null;

    update public.activities a
    set day_id = null, position = v_pool_max + m.rn * 1024
    from (
      select a2.id, row_number() over (order by d.day_index, a2.position, a2.id) as rn
      from public.activities a2 join public.days d on d.id = a2.day_id
      where a2.trip_id = p_trip_id and d.day_index >= v_new_count
    ) m
    where a.id = m.id;

    delete from public.days where trip_id = p_trip_id and day_index >= v_new_count;
  end if;

  insert into public.days (trip_id, day_index, date)
  select p_trip_id, i, p_start_date + i from generate_series(v_old_count, v_new_count - 1) i;

  update public.days set date = p_start_date + day_index
  where trip_id = p_trip_id and date is distinct from p_start_date + day_index;

  update public.trips set start_date = p_start_date, end_date = p_end_date where id = p_trip_id;

  update public.trip_invites set expires_at = private.invite_expiry(p_end_date)
  where trip_id = p_trip_id and revoked_at is null;
end $$;

create function public.rotate_trip_invite(p_trip_id uuid, p_token_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_end date;
  v_id uuid;
begin
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'forbidden' using errcode = '42501', hint = 'Hanya owner yang bisa membuat link undangan.';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023', hint = 'Hash token harus SHA-256 hex.';
  end if;
  select end_date into v_end from public.trips where id = p_trip_id for update;

  update public.trip_invites set revoked_at = now() where trip_id = p_trip_id and revoked_at is null;
  insert into public.trip_invites (trip_id, token_hash, created_by, expires_at)
  values (p_trip_id, p_token_hash, auth.uid(), private.invite_expiry(v_end))
  returning id into v_id;
  return v_id;
end $$;

create function public.get_invite_preview(p_token text)
returns table (trip_id uuid, title text, owner_name text, start_date date, end_date date)
language sql stable security definer set search_path = '' as $$
  select t.id, t.title, m.display_name, t.start_date, t.end_date
  from private.active_invite(p_token) i
  join public.trips t on t.id = i.trip_id
  join public.trip_members m on m.trip_id = t.id and m.role = 'owner'
  where i.id is not null
$$;

create function public.list_claimable_members(p_token text)
returns table (member_id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.display_name
  from private.active_invite(p_token) i
  join public.trip_members m on m.trip_id = i.trip_id
  join public.profiles p on p.id = m.user_id
  where i.id is not null
    and auth.uid() is not null
    and m.role = 'member' and m.revoked_at is null and p.is_anonymous
    and m.user_id <> auth.uid()
  order by m.display_name, m.id
$$;

create function public.join_trip(p_token text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_trip uuid;
  v_name text := btrim(p_display_name);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501', hint = 'Sesi tidak ditemukan.';
  end if;
  -- sudah member aktif → idempoten, apa pun status link-nya
  select i.trip_id into v_trip from public.trip_invites i
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');
  if v_trip is not null and exists (
    select 1 from public.trip_members where trip_id = v_trip and user_id = v_uid and revoked_at is null
  ) then
    return v_trip;
  end if;

  select i.trip_id into v_trip from private.active_invite(p_token) i where i.id is not null;
  if v_trip is null then
    raise exception 'invite_invalid' using errcode = 'P0001', hint = 'Link undangan tidak valid, sudah kedaluwarsa, atau sudah direset.';
  end if;
  if exists (select 1 from public.trip_members where trip_id = v_trip and user_id = v_uid and revoked_at is not null) then
    raise exception 'access_revoked' using errcode = '42501', hint = 'Akses kamu ke trip ini sudah dicabut.';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'invalid_display_name' using errcode = '22023', hint = 'Nama harus 1–40 karakter.';
  end if;

  insert into public.trip_members (trip_id, user_id, display_name, role, can_use_ai)
  values (v_trip, v_uid, v_name, 'member', false)
  on conflict (trip_id, user_id) where revoked_at is null do nothing;
  return v_trip;
end $$;

create function public.request_member_claim(p_token text, p_member_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_trip uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501', hint = 'Sesi tidak ditemukan.';
  end if;
  select i.trip_id into v_trip from private.active_invite(p_token) i where i.id is not null;
  if v_trip is null then
    raise exception 'invite_invalid' using errcode = 'P0001', hint = 'Link undangan tidak valid, sudah kedaluwarsa, atau sudah direset.';
  end if;
  if exists (select 1 from public.trip_members where trip_id = v_trip and user_id = v_uid and revoked_at is null) then
    raise exception 'already_member' using errcode = 'P0001', hint = 'Kamu sudah menjadi member trip ini.';
  end if;
  if exists (select 1 from public.trip_members where trip_id = v_trip and user_id = v_uid and revoked_at is not null) then
    raise exception 'access_revoked' using errcode = '42501', hint = 'Akses kamu ke trip ini sudah dicabut.';
  end if;
  if not exists (
    select 1 from public.trip_members m join public.profiles p on p.id = m.user_id
    where m.id = p_member_id and m.trip_id = v_trip and m.role = 'member'
      and m.revoked_at is null and p.is_anonymous
  ) then
    raise exception 'member_not_claimable' using errcode = 'P0001', hint = 'Member ini tidak bisa diklaim.';
  end if;

  select id into v_id from public.member_claims
  where member_id = p_member_id and claimant_user_id = v_uid and status = 'pending'
    and created_at > now() - interval '7 days';
  if v_id is not null then
    return v_id;
  end if;
  -- klaim pending kedaluwarsa milik user ini dianggap ditolak agar index unik tidak bentrok
  update public.member_claims set status = 'rejected', decided_at = now()
  where member_id = p_member_id and claimant_user_id = v_uid and status = 'pending';

  insert into public.member_claims (trip_id, member_id, claimant_user_id)
  values (v_trip, p_member_id, v_uid)
  returning id into v_id;
  return v_id;
end $$;

create function public.decide_member_claim(p_claim_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.member_claims;
begin
  if p_approve is null then
    raise exception 'invalid_decision' using errcode = '22023', hint = 'Keputusan wajib diisi.';
  end if;
  select * into v_claim from public.member_claims where id = p_claim_id for update;
  if v_claim.id is null or not public.is_trip_owner(v_claim.trip_id) then
    raise exception 'forbidden' using errcode = '42501', hint = 'Hanya owner trip yang bisa memutuskan klaim.';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'claim_already_decided' using errcode = 'P0001', hint = 'Klaim ini sudah diputuskan.';
  end if;
  if v_claim.created_at <= now() - interval '7 days' then
    raise exception 'claim_expired' using errcode = 'P0001', hint = 'Klaim sudah kedaluwarsa (lebih dari 7 hari).';
  end if;

  if p_approve then
    perform 1 from public.trip_members where id = v_claim.member_id and revoked_at is null and role = 'member' for update;
    if not found then
      raise exception 'member_not_claimable' using errcode = 'P0001', hint = 'Member ini sudah dicabut atau tidak bisa diklaim.';
    end if;
    if exists (
      select 1 from public.trip_members
      where trip_id = v_claim.trip_id and user_id = v_claim.claimant_user_id and revoked_at is null
    ) then
      raise exception 'claimant_already_member' using errcode = 'P0001', hint = 'Pengklaim sudah menjadi member trip ini.';
    end if;
    -- sesi lama kehilangan akses karena RLS berbasis user_id
    update public.trip_members set user_id = v_claim.claimant_user_id where id = v_claim.member_id;
    update public.member_claims set status = 'rejected', decided_by = auth.uid(), decided_at = now()
    where member_id = v_claim.member_id and status = 'pending' and id <> v_claim.id;
  end if;

  update public.member_claims
  set status = case when p_approve then 'approved'::public.claim_status else 'rejected'::public.claim_status end,
      decided_by = auth.uid(), decided_at = now()
  where id = v_claim.id;
end $$;

-- null bila klaim tidak ada / bukan milik pemanggil; pending > 7 hari dilaporkan 'rejected'.
create function public.my_claim_status(p_claim_id uuid) returns public.claim_status
language sql stable security definer set search_path = '' as $$
  select case
    when c.status = 'pending' and c.created_at <= now() - interval '7 days' then 'rejected'::public.claim_status
    else c.status
  end
  from public.member_claims c
  where c.id = p_claim_id
    and (c.claimant_user_id = auth.uid() or public.is_trip_owner(c.trip_id))
$$;

-- p_day_id null = pool
create function public.rebalance_positions(p_trip_id uuid, p_day_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_trip_member(p_trip_id) then
    raise exception 'forbidden' using errcode = '42501', hint = 'Kamu bukan member trip ini.';
  end if;
  if p_day_id is not null and not exists (select 1 from public.days where id = p_day_id and trip_id = p_trip_id) then
    raise exception 'day_not_found' using errcode = 'P0002', hint = 'Hari tidak ditemukan di trip ini.';
  end if;
  update public.activities a set position = r.rn * 1024
  from (
    select id, row_number() over (order by position, id) as rn
    from public.activities
    where trip_id = p_trip_id and day_id is not distinct from p_day_id
  ) r
  where a.id = r.id;
end $$;

-- Rate limiter global (≤ 1 req / interval). Mengembalikan ms yang harus ditunggu pemanggil
-- sebelum request; slot sudah direservasi. Server saja (service_role).
create function public.take_rate_limit_slot(p_key text, p_interval_ms int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_last timestamptz;
  v_now timestamptz;
  v_slot timestamptz;
begin
  if p_key is null or btrim(p_key) = '' or p_interval_ms is null or p_interval_ms < 0 or p_interval_ms > 60000 then
    raise exception 'invalid_rate_limit_args' using errcode = '22023';
  end if;
  insert into public.rate_limits (key, last_request_at) values (p_key, 'epoch') on conflict (key) do nothing;
  select last_request_at into v_last from public.rate_limits where key = p_key for update;
  v_now := clock_timestamp(); -- setelah lock didapat; now() = awal transaksi
  v_slot := greatest(v_now, v_last + make_interval(secs => p_interval_ms / 1000.0));
  update public.rate_limits set last_request_at = v_slot where key = p_key;
  return ceil(extract(epoch from (v_slot - v_now)) * 1000)::int;
end $$;

-- ───────────────────────── Privileges ─────────────────────────
-- Supabase memberi default EXECUTE/ALL ke anon & authenticated; kunci eksplisit.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  public.is_trip_member(uuid),
  public.is_trip_owner(uuid),
  public.create_trip(text, text, text[], date, date, int, text[], text, public.trip_pace, public.budget_level),
  public.update_trip_dates(uuid, date, date),
  public.rotate_trip_invite(uuid, text),
  public.get_invite_preview(text),
  public.list_claimable_members(text),
  public.join_trip(text, text),
  public.request_member_claim(text, uuid),
  public.decide_member_claim(uuid, boolean),
  public.my_claim_status(uuid),
  public.rebalance_positions(uuid, uuid)
to authenticated;
grant execute on function public.get_invite_preview(text) to anon;
grant execute on function public.take_rate_limit_slot(text, int) to service_role;

-- anon tidak membaca tabel apa pun langsung.
revoke all on all tables in schema public from anon;

-- Kolom yang boleh diubah client (sisanya lewat RPC / server).
revoke insert, update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

revoke update on public.trips from authenticated;
grant update (title, country_code, cities, travelers_count, interests, interests_note, pace, budget_level, status)
  on public.trips to authenticated;

revoke update on public.trip_members from authenticated;
grant update (revoked_at, can_use_ai) on public.trip_members to authenticated;

revoke update on public.days from authenticated;
grant update (title, city, notes) on public.days to authenticated;

-- trip_id tidak bisa diubah (aktivitas tidak bisa dipindah ke trip lain).
revoke update on public.activities from authenticated;
grant update (day_id, position, title, why, category, start_time, duration_min, search_query, place_id,
              verification_status, source, edited_by_user, notes)
  on public.activities to authenticated;

revoke insert, update, delete, truncate on public.member_claims, public.ai_generations, public.places,
  public.geocode_cache from authenticated;
revoke all on public.rate_limits from authenticated;

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
alter table public.member_claims enable row level security;
alter table public.days enable row level security;
alter table public.activities enable row level security;
alter table public.ai_generations enable row level security;
alter table public.places enable row level security;
alter table public.geocode_cache enable row level security;
alter table public.rate_limits enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy trips_select_member on public.trips for select to authenticated
  using (public.is_trip_member(id));
create policy trips_update_owner on public.trips for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy trips_delete_owner on public.trips for delete to authenticated
  using (owner_id = (select auth.uid()));

-- baris sendiri tetap terlihat walau dicabut → client bisa menampilkan halaman "dicabut"
create policy trip_members_select on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id) or user_id = (select auth.uid()));
create policy trip_members_update_owner on public.trip_members for update to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

create policy trip_invites_owner on public.trip_invites for all to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

create policy member_claims_select on public.member_claims for select to authenticated
  using (claimant_user_id = (select auth.uid()) or public.is_trip_owner(trip_id));

create policy days_select_member on public.days for select to authenticated
  using (public.is_trip_member(trip_id));
create policy days_update_member on public.days for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

create policy activities_select_member on public.activities for select to authenticated
  using (public.is_trip_member(trip_id));
create policy activities_insert_member on public.activities for insert to authenticated
  with check (public.is_trip_member(trip_id));
create policy activities_update_member on public.activities for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy activities_delete_member on public.activities for delete to authenticated
  using (public.is_trip_member(trip_id));

create policy ai_generations_select_member on public.ai_generations for select to authenticated
  using (public.is_trip_member(trip_id));

create policy places_select_auth on public.places for select to authenticated using (true);
create policy geocode_cache_select_auth on public.geocode_cache for select to authenticated using (true);
-- rate_limits: tanpa policy (server saja)

-- ───────────────────────── Realtime ─────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.trips, public.trip_members, public.member_claims, public.days, public.activities;
  end if;
end $$;
