-- ============================================================
-- CUENTAS APP — Propina de la cuenta compartida
-- Ejecutar en Supabase SQL Editor, después de 006_schema_cuentas_compartidas_consumo.sql
-- ============================================================

alter table cuentas_compartidas
  add column if not exists monto_propina numeric(12, 2) default null;
