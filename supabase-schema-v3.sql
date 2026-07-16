-- ═══════════════════════════════════════════════════════════════════
-- MAGNAT — schéma v3 : LA SAUVEGARDE CLOUD (16/07/2026)
-- À coller dans Supabase → SQL Editor → Run (après les schémas v1 et v2).
--
-- L'empire survit au navigateur : la sauvegarde complète (liquidités,
-- actions, dossiers, km, objets…) est poussée dans le cloud toutes les
-- 60 s. À la connexion, si le cloud est plus avancé que le local
-- (navigateur vidé, nouveau téléphone), il est restauré.
-- RLS strict : chacun ne lit et n'écrit QUE sa propre sauvegarde
-- (le blob contient les jetons Strava du joueur).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.saves (
  id uuid primary key references public.profiles (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

create policy "chacun lit sa sauvegarde"
  on public.saves for select using (auth.uid() = id);
create policy "chacun crée sa sauvegarde"
  on public.saves for insert with check (auth.uid() = id);
create policy "chacun met à jour sa sauvegarde"
  on public.saves for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "chacun supprime sa sauvegarde"
  on public.saves for delete using (auth.uid() = id);
