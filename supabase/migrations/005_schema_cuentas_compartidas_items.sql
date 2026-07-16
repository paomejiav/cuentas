-- ============================================================
-- CUENTAS APP — Items de una cuenta compartida
-- Ejecutar en Supabase SQL Editor, después de 004_schema_cuentas_compartidas.sql
-- ============================================================

-- ============================================================
-- 1. CUENTAS COMPARTIDAS — ITEMS
-- ============================================================
create table if not exists cuentas_compartidas_items (
  id                     uuid primary key default uuid_generate_v4(),
  cuenta_compartida_id   uuid not null references cuentas_compartidas(id) on delete cascade,
  descripcion            text not null,
  precio_unitario        numeric(12, 2) not null check (precio_unitario > 0),
  cantidad               numeric(10, 2) not null check (cantidad > 0),
  total                  numeric(12, 2) not null check (total >= 0),
  creado_en              timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_cc_items_cuenta on cuentas_compartidas_items(cuenta_compartida_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table cuentas_compartidas_items enable row level security;

-- Política permisiva para anon, igual que el resto del schema
create policy "cuentas_compartidas_items_all" on cuentas_compartidas_items for all using (true) with check (true);
