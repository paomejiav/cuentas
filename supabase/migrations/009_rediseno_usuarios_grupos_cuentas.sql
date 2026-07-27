-- ============================================================
-- CUENTAS APP — Rediseño: auth real (Supabase Auth) + grupos + cuentas persistentes
-- Ejecutar en Supabase SQL Editor
--
-- ⚠️ DESTRUCTIVO: elimina TODOS los datos actuales (de prueba).
-- No migra cuentas_compartidas (boleta wizard) — queda rota a propósito,
-- se rediseña en un paso posterior (plegada dentro de "montos exactos").
-- ============================================================

-- ============================================================
-- 0. LIMPIEZA — elimina el modelo viejo completo
-- ============================================================

-- Tablas huérfanas de la migración 001 (nunca se borraron)
drop table if exists payments cascade;
drop table if exists settlements cascade;
drop table if exists expense_splits cascade;
drop table if exists expenses cascade;
drop table if exists members cascade;
drop type if exists split_type cascade;
drop type if exists expense_category cascade;
drop type if exists settlement_status cascade;
drop type if exists settlement_mode cascade;
drop type if exists payment_method cascade;

-- Modelo actual (002+) que se reemplaza
drop table if exists cierres_mensuales cascade;
drop table if exists pagos cascade;
drop table if exists divisiones cascade;
drop table if exists gastos cascade;

-- integrantes y grupos: se eliminan con CASCADE. Esto deja las tablas de
-- cuentas_compartidas_* SIN sus FKs hacia integrantes/grupos (columnas huérfanas,
-- sin enforcement) — a propósito, se rediseñan en el paso 6 del roadmap.
drop table if exists integrantes cascade;
drop table if exists grupos cascade;

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. USUARIOS (perfil conectado a Supabase Auth)
-- ============================================================
create table usuarios (
  id            uuid primary key references auth.users(id) on delete cascade,
  nombre        text not null,
  avatar_color  text not null default '#A8D8B9',
  creado_en     timestamptz not null default now()
);

-- ============================================================
-- 2. GRUPOS
-- ============================================================
create table grupos (
  id                 uuid primary key default uuid_generate_v4(),
  nombre             text not null,
  codigo_invitacion  text not null unique,
  creado_por         uuid references usuarios(id),
  creado_en          timestamptz not null default now()
);

-- ============================================================
-- 3. GRUPO_MIEMBROS
-- ============================================================
create table grupo_miembros (
  id          uuid primary key default uuid_generate_v4(),
  grupo_id    uuid not null references grupos(id) on delete cascade,
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  rol         text not null default 'miembro' check (rol in ('admin','miembro')),
  unido_en    timestamptz not null default now(),
  unique(grupo_id, usuario_id)
);

-- ============================================================
-- 4. CUENTAS (persistentes, dentro de un grupo)
-- ============================================================
create table cuentas (
  id           uuid primary key default uuid_generate_v4(),
  grupo_id     uuid not null references grupos(id) on delete cascade,
  nombre       text not null,
  tipo         text not null default 'hogar' check (tipo in ('hogar','viaje','evento')),
  icono        text,
  estado       text not null default 'activa' check (estado in ('activa','cerrada')),
  creado_por   uuid references usuarios(id),
  creado_en    timestamptz not null default now()
);

-- ============================================================
-- 5. CUENTA_MIEMBROS (subconjunto de grupo_miembros)
-- ============================================================
create table cuenta_miembros (
  id          uuid primary key default uuid_generate_v4(),
  cuenta_id   uuid not null references cuentas(id) on delete cascade,
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  rol         text not null default 'miembro' check (rol in ('admin','miembro')),
  unido_en    timestamptz not null default now(),
  unique(cuenta_id, usuario_id)
);

-- ============================================================
-- 6. GASTOS (cuenta_id opcional — puede quedar suelto a nivel grupo)
-- ============================================================
create table gastos (
  id            uuid primary key default uuid_generate_v4(),
  grupo_id      uuid not null references grupos(id) on delete cascade,
  cuenta_id     uuid references cuentas(id) on delete set null,
  descripcion   text not null,
  monto_total   numeric(12, 2) not null check (monto_total > 0),
  pagado_por    uuid not null references usuarios(id),
  categoria     text not null default 'otro'
                check (categoria in ('super','comida','transporte','regalo','cumpleanos','tragos','otro')),
  fecha         date not null default current_date,
  nota          text,
  creado_por    uuid not null references usuarios(id),
  creado_en     timestamptz not null default now(),
  mes_cierre    text
);

-- ============================================================
-- 7. DIVISIONES
-- ============================================================
create table divisiones (
  id               uuid primary key default uuid_generate_v4(),
  gasto_id         uuid not null references gastos(id) on delete cascade,
  usuario_id       uuid not null references usuarios(id),
  monto_asignado   numeric(12, 2) not null check (monto_asignado >= 0),
  unique(gasto_id, usuario_id)
);

-- ============================================================
-- 8. PAGOS
-- ============================================================
create table pagos (
  id             uuid primary key default uuid_generate_v4(),
  grupo_id       uuid not null references grupos(id) on delete cascade,
  de_usuario_id  uuid not null references usuarios(id),
  a_usuario_id   uuid not null references usuarios(id),
  monto          numeric(12, 2) not null check (monto > 0),
  fecha          date not null default current_date,
  metodo         text not null default 'transferencia'
                 check (metodo in ('transferencia','efectivo','otro')),
  mes_cierre     text not null,
  creado_en      timestamptz not null default now(),
  check (de_usuario_id != a_usuario_id)
);

-- ============================================================
-- 9. CIERRES MENSUALES
-- ============================================================
create table cierres_mensuales (
  id             uuid primary key default uuid_generate_v4(),
  grupo_id       uuid not null references grupos(id) on delete cascade,
  mes            text not null,
  total_gastado  numeric(12, 2) not null default 0,
  cerrado_en     timestamptz not null default now(),
  unique(grupo_id, mes)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index idx_grupo_miembros_grupo    on grupo_miembros(grupo_id);
create index idx_grupo_miembros_usuario  on grupo_miembros(usuario_id);
create index idx_cuentas_grupo           on cuentas(grupo_id);
create index idx_cuenta_miembros_cuenta  on cuenta_miembros(cuenta_id);
create index idx_cuenta_miembros_usuario on cuenta_miembros(usuario_id);
create index idx_gastos_grupo            on gastos(grupo_id);
create index idx_gastos_cuenta           on gastos(cuenta_id);
create index idx_gastos_fecha            on gastos(fecha desc);
create index idx_gastos_mes_cierre       on gastos(mes_cierre);
create index idx_gastos_pagado_por       on gastos(pagado_por);
create index idx_divisiones_gasto        on divisiones(gasto_id);
create index idx_divisiones_usuario      on divisiones(usuario_id);
create index idx_pagos_grupo             on pagos(grupo_id);
create index idx_pagos_mes               on pagos(mes_cierre);
create index idx_cierres_grupo           on cierres_mensuales(grupo_id);

-- ============================================================
-- FUNCIONES HELPER (security definer, evitan recursión en RLS)
-- ============================================================
create or replace function es_miembro_grupo(p_grupo_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from grupo_miembros
    where grupo_id = p_grupo_id and usuario_id = auth.uid()
  );
$$;

create or replace function es_admin_grupo(p_grupo_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from grupo_miembros
    where grupo_id = p_grupo_id and usuario_id = auth.uid() and rol = 'admin'
  );
$$;

create or replace function es_miembro_cuenta(p_cuenta_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from cuenta_miembros
    where cuenta_id = p_cuenta_id and usuario_id = auth.uid()
  );
$$;

create or replace function es_admin_cuenta(p_cuenta_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from cuenta_miembros
    where cuenta_id = p_cuenta_id and usuario_id = auth.uid() and rol = 'admin'
  );
$$;

-- ============================================================
-- FUNCIONES DE ESCRITURA CONTROLADA (RPC — el cliente llama estas,
-- nunca inserta directo en grupo_miembros / cuenta_miembros)
-- ============================================================

-- Crear grupo: el creador queda como admin automáticamente
create or replace function crear_grupo(p_nombre text)
returns grupos language plpgsql security definer set search_path = public as $$
declare
  v_codigo text;
  v_grupo grupos;
begin
  v_codigo := upper(substr(md5(random()::text), 1, 6));
  insert into grupos (nombre, codigo_invitacion, creado_por)
  values (p_nombre, v_codigo, auth.uid())
  returning * into v_grupo;

  insert into grupo_miembros (grupo_id, usuario_id, rol)
  values (v_grupo.id, auth.uid(), 'admin');

  return v_grupo;
end;
$$;

-- Unirse a un grupo con código de invitación
create or replace function unirse_a_grupo(p_codigo text)
returns grupos language plpgsql security definer set search_path = public as $$
declare
  v_grupo grupos;
begin
  select * into v_grupo from grupos where codigo_invitacion = upper(p_codigo);

  if v_grupo.id is null then
    raise exception 'Código de invitación inválido';
  end if;

  insert into grupo_miembros (grupo_id, usuario_id, rol)
  values (v_grupo.id, auth.uid(), 'miembro')
  on conflict (grupo_id, usuario_id) do nothing;

  return v_grupo;
end;
$$;

-- Crear cuenta dentro de un grupo, con integrantes elegidos entre miembros del grupo
create or replace function crear_cuenta(
  p_grupo_id uuid,
  p_nombre text,
  p_tipo text,
  p_icono text,
  p_integrantes uuid[]  -- usuario_ids ya validados como miembros del grupo
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

  -- El creador queda como admin de la cuenta
  insert into cuenta_miembros (cuenta_id, usuario_id, rol)
  values (v_cuenta.id, auth.uid(), 'admin');

  -- El resto de los integrantes elegidos, validando que sean del grupo
  foreach v_usuario_id in array p_integrantes loop
    if v_usuario_id != auth.uid() and es_miembro_grupo(p_grupo_id) then
      if exists (select 1 from grupo_miembros where grupo_id = p_grupo_id and usuario_id = v_usuario_id) then
        insert into cuenta_miembros (cuenta_id, usuario_id, rol)
        values (v_cuenta.id, v_usuario_id, 'miembro')
        on conflict (cuenta_id, usuario_id) do nothing;
      end if;
    end if;
  end loop;

  return v_cuenta;
end;
$$;

-- Agregar un miembro del grupo a una cuenta existente (para "Agregar" en pantalla 09)
create or replace function agregar_miembro_cuenta(p_cuenta_id uuid, p_usuario_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_grupo_id uuid;
begin
  if not es_admin_cuenta(p_cuenta_id) then
    raise exception 'Solo un admin de la cuenta puede agregar integrantes';
  end if;

  select grupo_id into v_grupo_id from cuentas where id = p_cuenta_id;

  if not exists (select 1 from grupo_miembros where grupo_id = v_grupo_id and usuario_id = p_usuario_id) then
    raise exception 'Esa persona no es miembro del grupo';
  end if;

  insert into cuenta_miembros (cuenta_id, usuario_id, rol)
  values (p_cuenta_id, p_usuario_id, 'miembro')
  on conflict (cuenta_id, usuario_id) do nothing;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table usuarios          enable row level security;
alter table grupos            enable row level security;
alter table grupo_miembros    enable row level security;
alter table cuentas           enable row level security;
alter table cuenta_miembros   enable row level security;
alter table gastos            enable row level security;
alter table divisiones        enable row level security;
alter table pagos             enable row level security;
alter table cierres_mensuales enable row level security;

-- USUARIOS: te ves a vos mismo + a cualquiera con quien compartas un grupo
create policy "usuarios_select" on usuarios for select using (
  id = auth.uid()
  or exists (
    select 1 from grupo_miembros gm1
    join grupo_miembros gm2 on gm1.grupo_id = gm2.grupo_id
    where gm1.usuario_id = auth.uid() and gm2.usuario_id = usuarios.id
  )
);
create policy "usuarios_insert_propio" on usuarios for insert with check (id = auth.uid());
create policy "usuarios_update_propio" on usuarios for update using (id = auth.uid());

-- GRUPOS: solo lo ven/editan sus miembros. Alta solo vía crear_grupo().
create policy "grupos_select" on grupos for select using (es_miembro_grupo(id));
create policy "grupos_update" on grupos for update using (es_admin_grupo(id));

-- GRUPO_MIEMBROS: solo lectura directa. Altas solo vía crear_grupo()/unirse_a_grupo().
create policy "grupo_miembros_select" on grupo_miembros for select using (es_miembro_grupo(grupo_id));
create policy "grupo_miembros_delete" on grupo_miembros for delete using (es_admin_grupo(grupo_id));

-- CUENTAS: solo las ven sus integrantes. Alta solo vía crear_cuenta().
create policy "cuentas_select" on cuentas for select using (es_miembro_cuenta(id));
create policy "cuentas_update" on cuentas for update using (es_admin_cuenta(id));

-- CUENTA_MIEMBROS: solo lectura directa. Altas vía crear_cuenta()/agregar_miembro_cuenta().
create policy "cuenta_miembros_select" on cuenta_miembros for select using (es_miembro_cuenta(cuenta_id));
create policy "cuenta_miembros_delete" on cuenta_miembros for delete using (es_admin_cuenta(cuenta_id));

-- GASTOS: cualquier miembro del grupo puede ver/crear/editar (igual que hoy)
create policy "gastos_select" on gastos for select using (es_miembro_grupo(grupo_id));
create policy "gastos_insert" on gastos for insert with check (
  es_miembro_grupo(grupo_id) and (cuenta_id is null or es_miembro_cuenta(cuenta_id))
);
create policy "gastos_update" on gastos for update using (es_miembro_grupo(grupo_id));
create policy "gastos_delete" on gastos for delete using (es_miembro_grupo(grupo_id));

-- DIVISIONES: heredan el acceso del gasto al que pertenecen
create policy "divisiones_all" on divisiones for all using (
  exists (select 1 from gastos g where g.id = divisiones.gasto_id and es_miembro_grupo(g.grupo_id))
) with check (
  exists (select 1 from gastos g where g.id = divisiones.gasto_id and es_miembro_grupo(g.grupo_id))
);

-- PAGOS: cualquier miembro del grupo
create policy "pagos_all" on pagos for all using (es_miembro_grupo(grupo_id)) with check (es_miembro_grupo(grupo_id));

-- CIERRES: cualquier miembro del grupo
create policy "cierres_select" on cierres_mensuales for select using (es_miembro_grupo(grupo_id));
create policy "cierres_insert" on cierres_mensuales for insert with check (es_miembro_grupo(grupo_id));
