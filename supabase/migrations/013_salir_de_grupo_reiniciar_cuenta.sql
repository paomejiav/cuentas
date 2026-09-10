-- ============================================================
-- CUENTAS APP — Salir de grupo (con trazabilidad) + reiniciar cuenta
-- Ejecutar en Supabase SQL Editor, después de 012_metodo_cancelacion_cadena.sql
--
-- No se borra la membresía al salir de un grupo — se marca inactiva,
-- para que el historial del grupo siga mostrando a la persona (tachada)
-- en vez de perder el rastro de quién participó en cada gasto.
-- ============================================================

-- ============================================================
-- 1. GRUPO_MIEMBROS — estado activo/inactivo
-- ============================================================
alter table grupo_miembros add column if not exists activo boolean not null default true;
alter table grupo_miembros add column if not exists salio_en timestamptz;

-- ============================================================
-- 2. HELPERS — ahora exigen membresía activa
-- ============================================================
create or replace function es_miembro_grupo(p_grupo_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from grupo_miembros
    where grupo_id = p_grupo_id and usuario_id = auth.uid() and activo = true
  );
$$;

create or replace function es_admin_grupo(p_grupo_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from grupo_miembros
    where grupo_id = p_grupo_id and usuario_id = auth.uid() and rol = 'admin' and activo = true
  );
$$;

-- Nuevo helper: ¿es la única admin activa de este grupo?
create or replace function es_unica_admin_activa(p_grupo_id uuid, p_usuario_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select
    exists (select 1 from grupo_miembros where grupo_id = p_grupo_id and usuario_id = p_usuario_id and rol = 'admin' and activo = true)
    and not exists (
      select 1 from grupo_miembros
      where grupo_id = p_grupo_id and usuario_id != p_usuario_id and rol = 'admin' and activo = true
    );
$$;

-- ============================================================
-- 3. UNIRSE_A_GRUPO — ahora reactiva si ya hubo una membresía previa
-- ============================================================
create or replace function unirse_a_grupo(p_codigo text)
returns grupos language plpgsql security definer set search_path = public as $$
declare
  v_grupo grupos;
begin
  select * into v_grupo from grupos where codigo_invitacion = upper(p_codigo);

  if v_grupo.id is null then
    raise exception 'Código de invitación inválido';
  end if;

  insert into grupo_miembros (grupo_id, usuario_id, rol, activo, salio_en)
  values (v_grupo.id, auth.uid(), 'miembro', true, null)
  on conflict (grupo_id, usuario_id)
  do update set activo = true, salio_en = null, rol = 'miembro'
  where grupo_miembros.activo = false;

  return v_grupo;
end;
$$;

-- ============================================================
-- 4. SALIR_DE_GRUPO — salida individual, con traspaso manual si hace falta
-- ============================================================
create or replace function salir_de_grupo(p_grupo_id uuid, p_nuevo_admin_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from grupo_miembros where grupo_id = p_grupo_id and usuario_id = auth.uid() and activo = true
  ) then
    raise exception 'No sos miembro activo de este grupo';
  end if;

  if es_unica_admin_activa(p_grupo_id, auth.uid())
     and exists (select 1 from grupo_miembros where grupo_id = p_grupo_id and usuario_id != auth.uid() and activo = true) then

    if p_nuevo_admin_id is null then
      raise exception 'Sos la única admin activa: elegí quién va a ser el nuevo admin antes de salir';
    end if;

    if not exists (
      select 1 from grupo_miembros where grupo_id = p_grupo_id and usuario_id = p_nuevo_admin_id and activo = true
    ) then
      raise exception 'La persona elegida no es miembro activo de este grupo';
    end if;

    update grupo_miembros set rol = 'admin' where grupo_id = p_grupo_id and usuario_id = p_nuevo_admin_id;
  end if;

  update grupo_miembros
  set activo = false, salio_en = now()
  where grupo_id = p_grupo_id and usuario_id = auth.uid();
end;
$$;

-- ============================================================
-- 5. REINICIAR_CUENTA — sale de todos los grupos activos de una vez
-- Si es única admin activa en alguno, asigna un reemplazo al azar
-- entre los demás miembros activos (sin paso de elección manual).
-- ============================================================
create or replace function reiniciar_cuenta()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_grupo_id uuid;
  v_reemplazo uuid;
begin
  for v_grupo_id in
    select grupo_id from grupo_miembros where usuario_id = auth.uid() and activo = true
  loop
    if es_unica_admin_activa(v_grupo_id, auth.uid()) then
      select usuario_id into v_reemplazo
      from grupo_miembros
      where grupo_id = v_grupo_id and usuario_id != auth.uid() and activo = true
      order by random()
      limit 1;

      if v_reemplazo is not null then
        update grupo_miembros set rol = 'admin' where grupo_id = v_grupo_id and usuario_id = v_reemplazo;
      end if;
    end if;

    update grupo_miembros
    set activo = false, salio_en = now()
    where grupo_id = v_grupo_id and usuario_id = auth.uid();
  end loop;
end;
$$;

-- ============================================================
-- 6. CREAR_CUENTA / AGREGAR_MIEMBRO_CUENTA — solo miembros activos
-- ============================================================
create or replace function crear_cuenta(
  p_grupo_id uuid,
  p_nombre text,
  p_tipo text,
  p_icono text,
  p_integrantes uuid[]
)
returns cuentas language plpgsql security definer set search_path = public as $$
declare
  v_cuenta cuentas;
  v_usuario_id uuid;
begin
  if not es_miembro_grupo(p_grupo_id) then
    raise exception 'No sos miembro de este grupo';
  end if;

  insert into cuentas (grupo_id, nombre, tipo, icono, creado_por)
  values (p_grupo_id, p_nombre, p_tipo, p_icono, auth.uid())
  returning * into v_cuenta;

  insert into cuenta_miembros (cuenta_id, usuario_id, rol)
  values (v_cuenta.id, auth.uid(), 'admin');

  foreach v_usuario_id in array p_integrantes loop
    if v_usuario_id != auth.uid() then
      if exists (select 1 from grupo_miembros where grupo_id = p_grupo_id and usuario_id = v_usuario_id and activo = true) then
        insert into cuenta_miembros (cuenta_id, usuario_id, rol)
        values (v_cuenta.id, v_usuario_id, 'miembro')
        on conflict (cuenta_id, usuario_id) do nothing;
      end if;
    end if;
  end loop;

  return v_cuenta;
end;
$$;

create or replace function agregar_miembro_cuenta(p_cuenta_id uuid, p_usuario_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_grupo_id uuid;
begin
  if not es_admin_cuenta(p_cuenta_id) then
    raise exception 'Solo un admin de la cuenta puede agregar integrantes';
  end if;

  select grupo_id into v_grupo_id from cuentas where id = p_cuenta_id;

  if not exists (select 1 from grupo_miembros where grupo_id = v_grupo_id and usuario_id = p_usuario_id and activo = true) then
    raise exception 'Esa persona no es miembro activo del grupo';
  end if;

  insert into cuenta_miembros (cuenta_id, usuario_id, rol)
  values (p_cuenta_id, p_usuario_id, 'miembro')
  on conflict (cuenta_id, usuario_id) do nothing;
end;
$$;
