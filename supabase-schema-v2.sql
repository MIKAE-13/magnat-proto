-- ═══════════════════════════════════════════════════════════════════
-- MAGNAT — schéma v2 : LA BOURSE NATIONALE (15/07/2026)
-- À coller dans Supabase → SQL Editor → Run (après le schéma v1).
--
-- Les cours sont calculés par tous les clients à l'identique (bruit
-- déterministe) ; cette table est le SIGNAL AGRÉGÉ des joueurs qui
-- infléchit la courbe : achats immobiliers, ordres en bourse, tuyaux
-- d'Informateur. Chaque signal est plafonné à ±1 % (contrainte SQL),
-- et la somme par heure est plafonnée à ±3 % côté client.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.stock_signals (
  id bigint generated always as identity primary key,
  sym text not null check (sym in ('KWA','GLU','HBL','FKT','CDD','CDV','TRN','VRT','SBT')),
  pct real not null check (pct between -0.01 and 0.01),
  reason text not null default '',
  author uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists stock_signals_created_idx on public.stock_signals (created_at);

alter table public.stock_signals enable row level security;

create policy "signaux lisibles par tous"
  on public.stock_signals for select using (true);
create policy "chacun signe ses signaux"
  on public.stock_signals for insert with check (auth.uid() = author);

-- Diffusion temps réel : chaque signal fait frémir la cote de tous
alter publication supabase_realtime add table public.stock_signals;
