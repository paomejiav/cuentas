-- ============================================================
-- CUENTAS APP — Schema inicial
-- ============================================================

-- Extensión para UUIDs
create extension if not exists "uuid-ossp";


-- ============================================================
-- MEMBERS — Integrantes del grupo (fijo pero modificable)
-- ============================================================
create table members (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  avatar_color text not null default '#A8D8B9',  -- color de fondo del avatar
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- EXPENSES — Cada gasto registrado
-- ============================================================
create type split_type as enum ('equal', 'exact', 'percentage');
create type expense_category as enum (
  'comida', 'transporte', 'regalo', 'cumpleanos',
  'tragos', 'entretenimiento', 'otro'
);

create table expenses (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  amount      numeric(12, 2) not null check (amount > 0),
  category    expense_category not null default 'otro',
  paid_by     uuid not null references members(id),
  split_type  split_type not null default 'equal',
  date        date not null default current_date,
  notes       text,
  -- Si pertenece a un período cerrado, se llena al cerrar
  settlement_id uuid,  -- FK se agrega después de crear settlements
  created_at  timestamptz not null default now()
);

-- ============================================================
-- EXPENSE_SPLITS — Cómo se divide cada gasto entre las personas
-- Siempre se guarda el monto final en CLP (sin importar split_type)
-- ============================================================
create table expense_splits (
  id          uuid primary key default uuid_generate_v4(),
  expense_id  uuid not null references expenses(id) on delete cascade,
  member_id   uuid not null references members(id),
  amount      numeric(12, 2) not null check (amount >= 0),
  -- Solo se llena cuando split_type = 'percentage'
  percentage  numeric(5, 2) check (percentage >= 0 and percentage <= 100),
  created_at  timestamptz not null default now(),
  unique(expense_id, member_id)
);

-- ============================================================
-- SETTLEMENTS — Cierres de período
-- ============================================================
create type settlement_status as enum ('open', 'closed');
create type settlement_mode as enum ('individual', 'optimized');

create table settlements (
  id              uuid primary key default uuid_generate_v4(),
  period_label    text not null,          -- ej: "Mayo 2026"
  status          settlement_status not null default 'open',
  mode            settlement_mode not null default 'optimized',
  -- Snapshot de saldos al momento del cierre (JSON)
  balance_snapshot jsonb,
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz
);

-- FK de expenses → settlements
alter table expenses
  add constraint fk_expenses_settlement
  foreign key (settlement_id) references settlements(id);

-- ============================================================
-- PAYMENTS — Pagos individuales dentro de un cierre
-- ============================================================
create type payment_method as enum (
  'transferencia', 'efectivo', 'mercadopago', 'otro'
);

create table payments (
  id              uuid primary key default uuid_generate_v4(),
  settlement_id   uuid not null references settlements(id) on delete cascade,
  from_member_id  uuid not null references members(id),
  to_member_id    uuid not null references members(id),
  amount          numeric(12, 2) not null check (amount > 0),
  method          payment_method not null default 'transferencia',
  notes           text,
  confirmed_at    timestamptz,   -- null = pendiente de confirmar
  created_at      timestamptz not null default now(),
  check (from_member_id != to_member_id)
);

-- ============================================================
-- ÍNDICES — Para queries frecuentes
-- ============================================================
create index idx_expenses_paid_by      on expenses(paid_by);
create index idx_expenses_settlement   on expenses(settlement_id);
create index idx_expenses_date         on expenses(date desc);
create index idx_expense_splits_member on expense_splits(member_id);
create index idx_payments_settlement   on payments(settlement_id);
create index idx_payments_from         on payments(from_member_id);
create index idx_payments_to           on payments(to_member_id);

-- ============================================================
-- ROW LEVEL SECURITY — Habilitado pero permisivo por ahora
-- (app de grupo cerrado, sin auth individual por persona)
-- ============================================================
alter table members        enable row level security;
alter table expenses       enable row level security;
alter table expense_splits enable row level security;
alter table settlements    enable row level security;
alter table payments       enable row level security;

-- Políticas abiertas mientras no hay auth por usuario
create policy "allow_all_members"        on members        for all using (true) with check (true);
create policy "allow_all_expenses"       on expenses       for all using (true) with check (true);
create policy "allow_all_splits"         on expense_splits for all using (true) with check (true);
create policy "allow_all_settlements"    on settlements    for all using (true) with check (true);
create policy "allow_all_payments"       on payments       for all using (true) with check (true);

-- ============================================================
-- SEED — Datos iniciales de ejemplo (comentar si no se quieren)
-- ============================================================
-- insert into members (name, avatar_color) values
--   ('Paola',    '#F4A79D'),
--   ('Camila',   '#A8D8B9'),
--   ('Sofía',    '#A8C8E8'),
--   ('Valentina','#D4A8D8'),
--   ('Martina',  '#F4D4A0');
