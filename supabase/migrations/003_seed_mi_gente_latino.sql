-- ============================================================
-- SEED — Mi gente latino
-- Ejecutar DESPUÉS de la migration 002
-- ============================================================

-- Insertar grupo y capturar el id
with grupo_insertado as (
  insert into grupos (nombre, codigo_acceso)
  values ('Mi gente latino', 'MGL001')
  returning id
)
insert into integrantes (grupo_id, nombre, avatar_color)
select
  grupo_insertado.id,
  integrante.nombre,
  integrante.color
from grupo_insertado,
(values
  ('Jo',   '#F4A79D'),
  ('Fabi', '#A8D8B9'),
  ('Naty', '#A8C8E8'),
  ('Glo',  '#D4A8D8'),
  ('Pao',  '#F4D4A0')
) as integrante(nombre, color);

-- Verificar:
-- select g.nombre, g.codigo_acceso, i.nombre, i.avatar_color
-- from grupos g join integrantes i on i.grupo_id = g.id
-- where g.codigo_acceso = 'MGL001';
