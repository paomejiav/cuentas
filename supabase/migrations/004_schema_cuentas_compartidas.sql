-- ============================================================
-- CUENTAS APP — Cuentas compartidas (boletas de salidas grupales)
-- Ejecutar en Supabase SQL Editor, después de 002_schema_grupos.sql
-- ============================================================

-- ============================================================
-- 1. CUENTAS COMPARTIDAS
-- ============================================================
create table if not exists cuentas_compartidas (
  id               uuid primary key default uuid_generate_v4(),
  grupo_id         uuid not null references grupos(id) on delete cascade,
  nombre           text not null,
  fecha            date not null default current_date,
  pagado_por       uuid not null references integrantes(id),
  estado           text not null default 'abierta'
                   check (estado in ('abierta','cerrada')),
  foto_boleta_url  text,
  creado_por       uuid not null references integrantes(id),
  creado_en        timestamptz not null default now()
);

-- ============================================================
-- 2. CUENTAS COMPARTIDAS — PARTICIPANTES
-- ============================================================
create table if not exists cuentas_compartidas_participantes (
  id                     uuid primary key default uuid_generate_v4(),
  cuenta_compartida_id   uuid not null references cuentas_compartidas(id) on delete cascade,
  integrante_id          uuid not null references integrantes(id),
  es_exento              boolean not null default false,
  unique(cuenta_compartida_id, integrante_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_cuentas_compartidas_grupo         on cuentas_compartidas(grupo_id);
create index if not exists idx_cuentas_compartidas_pagado_por    on cuentas_compartidas(pagado_por);
create index if not exists idx_cc_participantes_cuenta           on cuentas_compartidas_participantes(cuenta_compartida_id);
create index if not exists idx_cc_participantes_integrante       on cuentas_compartidas_participantes(integrante_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table cuentas_compartidas               enable row level security;
alter table cuentas_compartidas_participantes enable row level security;

-- Políticas permisivas para anon, igual que el resto del schema
create policy "cuentas_compartidas_all"               on cuentas_compartidas               for all using (true) with check (true);
create policy "cuentas_compartidas_participantes_all"  on cuentas_compartidas_participantes for all using (true) with check (true);

-- ============================================================
-- STORAGE — Bucket para fotos de boletas
-- ============================================================
insert into storage.buckets (id, name, public)
values ('boletas-cuentas-compartidas', 'boletas-cuentas-compartidas', true)
on conflict (id) do nothing;

create policy "boletas_cuentas_compartidas_all"
  on storage.objects for all
  using (bucket_id = 'boletas-cuentas-compartidas')
  with check (bucket_id = 'boletas-cuentas-compartidas');
