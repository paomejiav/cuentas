-- ============================================================
-- CUENTAS APP — Schema con grupos (reemplaza migration 001)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Extensión para UUIDs
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. GRUPOS
-- ============================================================
create table if not exists grupos (
  id            uuid primary key default uuid_generate_v4(),
  nombre        text not null,
  codigo_acceso text not null unique,
  creado_en     timestamptz not null default now()
);

-- ============================================================
-- 2. INTEGRANTES
-- ============================================================
create table if not exists integrantes (
  id           uuid primary key default uuid_generate_v4(),
  grupo_id     uuid not null references grupos(id) on delete cascade,
  nombre       text not null,
  avatar_color text not null default '#A8D8B9',
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

-- ============================================================
-- 3. GASTOS
-- ============================================================
create table if not exists gastos (
  id           uuid primary key default uuid_generate_v4(),
  grupo_id     uuid not null references grupos(id) on delete cascade,
  descripcion  text not null,
  monto_total  numeric(12, 2) not null check (monto_total > 0),
  pagado_por   uuid not null references integrantes(id),
  categoria    text not null default 'otro'
               check (categoria in ('comida','transporte','regalo','cumpleanos','tragos','entretenimiento','otro')),
  fecha        date not null default current_date,
  nota         text,
  creado_por   uuid not null references integrantes(id),
  creado_en    timestamptz not null default now(),
  mes_cierre   text  -- 'YYYY-MM', se llena al cerrar el mes
);

-- ============================================================
-- 4. DIVISIONES
-- ============================================================
create table if not exists divisiones (
  id               uuid primary key default uuid_generate_v4(),
  gasto_id         uuid not null references gastos(id) on delete cascade,
  integrante_id    uuid not null references integrantes(id),
  monto_asignado   numeric(12, 2) not null check (monto_asignado >= 0),
  unique(gasto_id, integrante_id)
);

-- ============================================================
-- 5. PAGOS
-- ============================================================
create table if not exists pagos (
  id                 uuid primary key default uuid_generate_v4(),
  grupo_id           uuid not null references grupos(id) on delete cascade,
  de_integrante_id   uuid not null references integrantes(id),
  a_integrante_id    uuid not null references integrantes(id),
  monto              numeric(12, 2) not null check (monto > 0),
  fecha              date not null default current_date,
  metodo             text not null default 'transferencia'
                     check (metodo in ('transferencia','efectivo','otro')),
  mes_cierre         text not null,
  creado_en          timestamptz not null default now(),
  check (de_integrante_id != a_integrante_id)
);

-- ============================================================
-- 6. CIERRES MENSUALES
-- ============================================================
create table if not exists cierres_mensuales (
  id             uuid primary key default uuid_generate_v4(),
  grupo_id       uuid not null references grupos(id) on delete cascade,
  mes            text not null,  -- 'YYYY-MM'
  total_gastado  numeric(12, 2) not null default 0,
  cerrado_en     timestamptz not null default now(),
  unique(grupo_id, mes)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_integrantes_grupo   on integrantes(grupo_id);
create index if not exists idx_gastos_grupo        on gastos(grupo_id);
create index if not exists idx_gastos_fecha        on gastos(fecha desc);
create index if not exists idx_gastos_mes_cierre   on gastos(mes_cierre);
create index if not exists idx_gastos_pagado_por   on gastos(pagado_por);
create index if not exists idx_divisiones_gasto    on divisiones(gasto_id);
create index if not exists idx_divisiones_integ    on divisiones(integrante_id);
create index if not exists idx_pagos_grupo         on pagos(grupo_id);
create index if not exists idx_pagos_mes           on pagos(mes_cierre);
create index if not exists idx_cierres_grupo       on cierres_mensuales(grupo_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table grupos             enable row level security;
alter table integrantes        enable row level security;
alter table gastos             enable row level security;
alter table divisiones         enable row level security;
alter table pagos              enable row level security;
alter table cierres_mensuales  enable row level security;

-- Políticas permisivas para anon (app de grupo cerrado sin auth por usuario)
-- Cuando agregues auth, reemplaza 'true' por la verificación de grupo

create policy "grupos_all"            on grupos            for all using (true) with check (true);
create policy "integrantes_all"       on integrantes       for all using (true) with check (true);
create policy "gastos_all"            on gastos            for all using (true) with check (true);
create policy "divisiones_all"        on divisiones        for all using (true) with check (true);
create policy "pagos_all"             on pagos             for all using (true) with check (true);
create policy "cierres_all"           on cierres_mensuales for all using (true) with check (true);

-- ============================================================
-- SEED — Grupo inicial (descomenta y edita con tus datos)
-- ============================================================
-- insert into grupos (nombre, codigo_acceso)
-- values ('Las Amigas', 'AMG001')
-- returning id;

-- Luego agrega integrantes con el grupo_id retornado:
-- insert into integrantes (grupo_id, nombre, avatar_color) values
--   ('<grupo_id>', 'Paola',     '#F4A79D'),
--   ('<grupo_id>', 'Camila',    '#A8D8B9'),
--   ('<grupo_id>', 'Sofía',     '#A8C8E8'),
--   ('<grupo_id>', 'Valentina', '#D4A8D8'),
--   ('<grupo_id>', 'Martina',   '#F4D4A0');
