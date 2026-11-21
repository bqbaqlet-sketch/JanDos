-- JanDos: Supabase SQL схемасы. Supabase → SQL Editor ішінде толығымен іске қосыңыз.
-- JanDos database schema. Run the whole file in Supabase → SQL Editor.

create extension if not exists pgcrypto;

-- ============ PROFILES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'owner' check (role in ('owner','vet','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Рөлді (role) пайдаланушы өзгерте алмайды / users cannot change their own role
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- ============ VETS ============
create table if not exists public.vets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,  -- ветеринар Google-мен кіргенде чат үшін байланыстырылады
  full_name text not null,
  specialization text,
  animals text[] default '{}',
  city text,
  clinic text,
  experience_years int,
  bio text,
  photo_url text,
  whatsapp text,
  telegram text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.vets enable row level security;
drop policy if exists "vets read" on public.vets;
create policy "vets read" on public.vets for select using (is_published or user_id = auth.uid() or public.is_admin());
drop policy if exists "vets admin write" on public.vets;
create policy "vets admin write" on public.vets for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============ REVIEWS ============
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  vet_id uuid not null references public.vets(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (vet_id, author_id)
);
alter table public.reviews enable row level security;
drop policy if exists "reviews read" on public.reviews;
create policy "reviews read" on public.reviews for select using (true);
drop policy if exists "reviews insert" on public.reviews;
create policy "reviews insert" on public.reviews for insert to authenticated
  with check (author_id = auth.uid()
              and not exists (select 1 from public.vets v where v.id = vet_id and v.user_id = auth.uid()));
drop policy if exists "reviews delete" on public.reviews;
create policy "reviews delete" on public.reviews for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create or replace view public.vet_ratings with (security_invoker = true) as
  select vet_id, round(avg(rating)::numeric, 2) as avg_rating, count(*)::int as reviews_count
  from public.reviews group by vet_id;
grant select on public.vet_ratings to anon, authenticated;

-- ============ CHAT ============
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  vet_id uuid not null references public.vets(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (vet_id, owner_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text check (char_length(body) <= 4000),
  image_url text,
  created_at timestamptz not null default now(),
  check (body is not null or image_url is not null)
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);

create or replace function public.is_participant(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    left join public.vets v on v.id = c.vet_id
    where c.id = conv and (c.owner_id = auth.uid() or v.user_id = auth.uid())
  );
$$;

alter table public.conversations enable row level security;
drop policy if exists "conv read" on public.conversations;
create policy "conv read" on public.conversations for select to authenticated using (public.is_participant(id));
drop policy if exists "conv insert" on public.conversations;
create policy "conv insert" on public.conversations for insert to authenticated with check (owner_id = auth.uid());

alter table public.messages enable row level security;
drop policy if exists "msg read" on public.messages;
create policy "msg read" on public.messages for select to authenticated using (public.is_participant(conversation_id));
drop policy if exists "msg insert" on public.messages;
create policy "msg insert" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_participant(conversation_id));

-- Realtime чат үшін / for live chat
alter publication supabase_realtime add table public.messages;

-- ============ STORAGE (чат фотолары) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "chat images upload" on storage.objects;
create policy "chat images upload" on storage.objects for insert to authenticated with check (bucket_id = 'chat-images');
drop policy if exists "chat images read" on storage.objects;
create policy "chat images read" on storage.objects for select using (bucket_id = 'chat-images');

-- ============ ӘКІМШІНІ ТАҒАЙЫНДАУ / MAKE YOURSELF ADMIN ============
-- Google-мен бір рет кіргеннен кейін / after your first Google sign-in, run:
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR_EMAIL@gmail.com');

-- ============ ВЕТЕРИНАР ҮЛГІСІ / SAMPLE VET (қажет болса) ============
-- insert into public.vets (full_name, specialization, animals, city, clinic, experience_years, bio, whatsapp, telegram, is_published)
-- values ('Аты Жөні', 'Терапевт', '{Ит,Мысық}', 'Тараз', 'Клиника атауы', 8, 'Қысқаша сипаттама', '+77001234567', 'username', true);
