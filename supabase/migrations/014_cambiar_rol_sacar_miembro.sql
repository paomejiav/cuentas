-- ============================================================
-- CUENTAS APP — Cambiar rol y sacar integrante de un grupo
-- Ejecutar en Supabase SQL Editor, después de 013_salir_de_grupo_reiniciar_cuenta.sql
--
-- Ambas acciones solo las puede hacer un admin activo del grupo, sobre
-- OTRO integrante (nunca sobre sí mismo — para eso ya existe salir_de_grupo).
-- "Sacar" marca inactivo igual que salir_de_grupo, nunca borra la fila.
-- ============================================================

create or replace function cambiar_rol_miembro(p_grupo_id uuid, p_usuario_id uuid, p_nuevo_rol text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin_grupo(p_grupo_id) then
    raise exception 'Solo un admin puede cambiar roles';
  end if;

  if p_usuario_id = auth.uid() then
    raise exception 'No podés cambiar tu propio rol desde acá';
  end if;

  if p_nuevo_rol not in ('admin', 'miembro') then
    raise exception 'Rol inválido';
  end if;

  if not exists (
    select 1 from grupo_miembros where grupo_id = p_grupo_id and usuario_id = p_usuario_id and activo = true
  ) then
    raise exception 'Esa persona no es miembro activo del grupo';
  end if;

  update grupo_miembros set rol = p_nuevo_rol
  where grupo_id = p_grupo_id and usuario_id = p_usuario_id;
end;
$$;

create or replace function sacar_miembro(p_grupo_id uuid, p_usuario_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin_grupo(p_grupo_id) then
    raise exception 'Solo un admin puede sacar integrantes';
  end if;

  if p_usuario_id = auth.uid() then
    raise exception 'No podés sacarte a vos misma desde acá — usá "Salir del grupo"';
  end if;

  if not exists (
    select 1 from grupo_miembros where grupo_id = p_grupo_id and usuario_id = p_usuario_id and activo = true
  ) then
    raise exception 'Esa persona no es miembro activo del grupo';
  end if;

  update grupo_miembros
  set activo = false, salio_en = now()
  where grupo_id = p_grupo_id and usuario_id = p_usuario_id;
end;
$$;
