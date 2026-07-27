-- ============================================================
-- CUENTAS APP — Gasto aislado (sin grupo) + liquidación directa por división
-- Ejecutar en Supabase SQL Editor, después de 008_rediseno_usuarios_grupos_cuentas.sql
-- ============================================================

-- ============================================================
-- 1. GASTOS — grupo_id pasa a opcional (gasto aislado usuario a usuario)
-- ============================================================
alter table gastos alter column grupo_id drop not null;

-- Un gasto sin grupo tampoco puede tener cuenta (una cuenta siempre pertenece a un grupo)
alter table gastos add constraint gastos_cuenta_requiere_grupo
  check (grupo_id is not null or cuenta_id is null);

-- ============================================================
-- 2. DIVISIONES — liquidación individual, cada quien salda a su ritmo
-- ============================================================
alter table divisiones add column if not exists saldado boolean not null default false;
alter table divisiones add column if not exists saldado_en timestamptz;

-- ============================================================
-- 3. PAGOS — opcional a un grupo (pago de un gasto aislado) + opcional a un gasto puntual
-- ============================================================
alter table pagos alter column grupo_id drop not null;
alter table pagos add column if not exists gasto_id uuid references gastos(id) on delete set null;
create index if not exists idx_pagos_gasto on pagos(gasto_id);

-- mes_cierre ya era nullable — un pago directo (no ligado a un cierre) simplemente no lo completa
alter table pagos alter column mes_cierre drop not null;

-- ============================================================
-- 4. PAGO_DIVISIONES — trazabilidad: qué divisiones saldó cada pago
-- Un pago de cierre mensual puede saldar varias divisiones a la vez;
-- un pago directo típicamente salda una sola.
-- ============================================================
create table if not exists pago_divisiones (
  id            uuid primary key default uuid_generate_v4(),
  pago_id       uuid not null references pagos(id) on delete cascade,
  division_id   uuid not null references divisiones(id) on delete cascade,
  creado_en     timestamptz not null default now(),
  unique(pago_id, division_id)
);

create index if not exists idx_pago_divisiones_pago      on pago_divisiones(pago_id);
create index if not exists idx_pago_divisiones_division  on pago_divisiones(division_id);

alter table pago_divisiones enable row level security;

-- ============================================================
-- 5. FUNCIÓN HELPER — participante de un gasto (para el caso sin grupo)
-- ============================================================
create or replace function es_participante_gasto(p_gasto_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from gastos g
    where g.id = p_gasto_id
    and (
      g.pagado_por = auth.uid()
      or g.creado_por = auth.uid()
      or exists (select 1 from divisiones d where d.gasto_id = g.id and d.usuario_id = auth.uid())
    )
  );
$$;

-- ============================================================
-- 6. RLS — actualizar políticas de gastos/divisiones/pagos para contemplar grupo_id nulo
-- ============================================================

-- GASTOS
drop policy if exists "gastos_select" on gastos;
drop policy if exists "gastos_insert" on gastos;
drop policy if exists "gastos_update" on gastos;
drop policy if exists "gastos_delete" on gastos;

create policy "gastos_select" on gastos for select using (
  (grupo_id is not null and es_miembro_grupo(grupo_id))
  or (grupo_id is null and es_participante_gasto(id))
);

create policy "gastos_insert" on gastos for insert with check (
  (grupo_id is not null and es_miembro_grupo(grupo_id) and (cuenta_id is null or es_miembro_cuenta(cuenta_id)))
  or (grupo_id is null and creado_por = auth.uid())
);

create policy "gastos_update" on gastos for update using (
  (grupo_id is not null and es_miembro_grupo(grupo_id))
  or (grupo_id is null and es_participante_gasto(id))
);

create policy "gastos_delete" on gastos for delete using (
  (grupo_id is not null and es_miembro_grupo(grupo_id))
  or (grupo_id is null and es_participante_gasto(id))
);

-- DIVISIONES — se actualiza para cubrir gastos sin grupo
drop policy if exists "divisiones_all" on divisiones;

create policy "divisiones_all" on divisiones for all using (
  exists (
    select 1 from gastos g where g.id = divisiones.gasto_id
    and (
      (g.grupo_id is not null and es_miembro_grupo(g.grupo_id))
      or (g.grupo_id is null and es_participante_gasto(g.id))
    )
  )
) with check (
  exists (
    select 1 from gastos g where g.id = divisiones.gasto_id
    and (
      (g.grupo_id is not null and es_miembro_grupo(g.grupo_id))
      or (g.grupo_id is null and es_participante_gasto(g.id))
    )
  )
);

-- PAGOS — se actualiza para cubrir pagos sin grupo (gasto aislado)
drop policy if exists "pagos_all" on pagos;

create policy "pagos_all" on pagos for all using (
  (grupo_id is not null and es_miembro_grupo(grupo_id))
  or (grupo_id is null and (de_usuario_id = auth.uid() or a_usuario_id = auth.uid()))
) with check (
  (grupo_id is not null and es_miembro_grupo(grupo_id))
  or (grupo_id is null and (de_usuario_id = auth.uid() or a_usuario_id = auth.uid()))
);

-- PAGO_DIVISIONES — hereda el acceso del pago al que pertenece
create policy "pago_divisiones_all" on pago_divisiones for all using (
  exists (
    select 1 from pagos p where p.id = pago_divisiones.pago_id
    and (
      (p.grupo_id is not null and es_miembro_grupo(p.grupo_id))
      or (p.grupo_id is null and (p.de_usuario_id = auth.uid() or p.a_usuario_id = auth.uid()))
    )
  )
) with check (
  exists (
    select 1 from pagos p where p.id = pago_divisiones.pago_id
    and (
      (p.grupo_id is not null and es_miembro_grupo(p.grupo_id))
      or (p.grupo_id is null and (p.de_usuario_id = auth.uid() or p.a_usuario_id = auth.uid()))
    )
  )
);
