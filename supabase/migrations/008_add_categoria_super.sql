-- ============================================================
-- CUENTAS APP — Agrega categoría "Súper" a gastos
-- Ejecutar en Supabase SQL Editor, después de 007_schema_cuentas_compartidas_propina.sql
-- ============================================================

alter table gastos drop constraint if exists gastos_categoria_check;

alter table gastos add constraint gastos_categoria_check
  check (categoria in ('super','comida','transporte','regalo','cumpleanos','tragos','entretenimiento','otro'));
