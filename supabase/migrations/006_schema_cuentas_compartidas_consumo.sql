-- ============================================================
-- CUENTAS APP — Consumo por persona de cada item (cuentas compartidas)
-- Ejecutar en Supabase SQL Editor, después de 005_schema_cuentas_compartidas_items.sql
-- ============================================================

-- ============================================================
-- 1. CUENTAS COMPARTIDAS — CONSUMO
-- ============================================================
create table if not exists cuentas_compartidas_consumo (
  id                 uuid primary key default uuid_generate_v4(),
  item_id            uuid not null references cuentas_compartidas_items(id) on delete cascade,
  integrante_id      uuid not null references integrantes(id) on delete cascade,
  cantidad_asignada  numeric(10, 2) not null default 0 check (cantidad_asignada >= 0),
  actualizado_en     timestamptz not null default now(),
  unique(item_id, integrante_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_cc_consumo_item        on cuentas_compartidas_consumo(item_id);
create index if not exists idx_cc_consumo_integrante   on cuentas_compartidas_consumo(integrante_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table cuentas_compartidas_consumo enable row level security;

-- Política permisiva para anon, igual que el resto del schema
create policy "cuentas_compartidas_consumo_all" on cuentas_compartidas_consumo for all using (true) with check (true);
