-- ============================================================
-- CUENTAS APP — Trigger: crea el perfil en `usuarios` al registrarse
-- Ejecutar en Supabase SQL Editor, después de 009_gasto_aislado_liquidacion_directa.sql
--
-- Se dispara al insertar en auth.users (apenas alguien se registra, incluso
-- antes de confirmar el email). Toma nombre y avatar_color del metadata
-- que se manda en el signUp() del cliente.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', 'Sin nombre'),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#A8D8B9')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
