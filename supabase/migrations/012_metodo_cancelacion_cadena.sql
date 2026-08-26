-- ============================================================
-- CUENTAS APP — Agrega método "cancelación en cadena" a pagos
-- Ejecutar en Supabase SQL Editor, después de 011_trigger_perfil_usuario.sql
--
-- Permite registrar, con trazabilidad, las deudas que se saldan en el
-- modo "Completa" de Cierre sin que haya una transferencia real de plata
-- (se cancelan entre sí por formar una cadena cerrada).
-- ============================================================

alter table pagos drop constraint if exists pagos_metodo_check;

alter table pagos add constraint pagos_metodo_check
  check (metodo in ('transferencia','efectivo','otro','cancelacion_cadena'));
