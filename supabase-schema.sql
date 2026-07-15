-- ═══════════════════════════════════════════════════════════════════
-- MAGNAT — schéma du monde commun (v1, 15/07/2026)
-- À coller tel quel dans Supabase → SQL Editor → Run.
--
-- Philosophie v1 (prototype) : le client est de confiance — les règles
-- RLS garantissent l'identité (chacun écrit en son nom), pas encore
-- l'anti-triche économique (viendra avec les fonctions serveur).
-- ═══════════════════════════════════════════════════════════════════

-- Les magnats : un profil public par joueur
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null check (char_length(pseudo) between 2 and 20),
  avatar text not null default 'loup',
  level int not null default 1,
  worth bigint not null default 50000,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profils lisibles par tous"
  on public.profiles for select using (true);
create policy "chacun crée son profil"
  on public.profiles for insert with check (auth.uid() = id);
create policy "chacun met à jour son profil"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Le cadastre : qui possède quoi, dans le monde entier
create table if not exists public.properties (
  place_id text primary key,
  owner uuid not null references public.profiles (id) on delete cascade,
  owner_pseudo text not null,
  level int not null default 0,
  taken_via text not null default 'achat',
  updated_at timestamptz not null default now()
);

alter table public.properties enable row level security;

create policy "cadastre lisible par tous"
  on public.properties for select using (true);
create policy "acquérir un lieu libre"
  on public.properties for insert with check (auth.uid() = owner);
-- l'UPDATE par un autre joueur = l'OPA hostile par parchemins (voulue !)
create policy "transférer un acte (OPA par parchemins comprise)"
  on public.properties for update
  using (auth.role() = 'authenticated')
  with check (auth.uid() = owner);
create policy "revendre son bien"
  on public.properties for delete using (auth.uid() = owner);

-- Diffusion temps réel du cadastre
alter publication supabase_realtime add table public.properties;
