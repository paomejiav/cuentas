-- ============================================================
-- CUENTAS APP — Verificar acceso a una cuenta (para el botón "Enlace")
-- Ejecutar en Supabase SQL Editor, después de 014_cambiar_rol_sacar_miembro.sql
--
-- Devuelve solo lo necesario para decidir qué mensaje mostrarle a alguien
-- que abre el link de una cuenta, sin filtrar datos reales de la cuenta
-- (gastos, saldos, etc.) si no tiene acceso.
-- ============================================================

create or replace function verificar_acceso_cuenta(p_cuenta_id uuid)
returns table (
  existe boolean,
  tiene_acceso boolean,
  es_miembro_del_grupo boolean,
  nombre_cuenta text,
  nombre_grupo text
)
language plpgsql security definer set search_path = public as $$
declare
  v_grupo_id uuid;
  v_nombre_cuenta text;
  v_nombre_grupo text;
begin
  select c.grupo_id, c.nombre into v_grupo_id, v_nombre_cuenta
  from cuentas c where c.id = p_cuenta_id;

  if v_grupo_id is null then
    return query select false, false, false, null::text, null::text;
    return;
  end if;

  select g.nombre into v_nombre_grupo from grupos g where g.id = v_grupo_id;

  if es_miembro_cuenta(p_cuenta_id) then
    return query select true, true, true, v_nombre_cuenta, v_nombre_grupo;
  elsif es_miembro_grupo(v_grupo_id) then
    return query select true, false, true, null::text, v_nombre_grupo;
  else
    return query select true, false, false, null::text, null::text;
  end if;
end;
$$;

grant execute on function verificar_acceso_cuenta(uuid) to authenticated;
